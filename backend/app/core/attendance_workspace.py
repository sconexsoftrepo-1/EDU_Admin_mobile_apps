"""Shared class registers and attendance analytics for web and mobile clients.

Registers use transaction-backed workspace documents (record_extras on SQL).
Only explicitly marked sessions enter percentages; unscheduled/unmarked days are
never inferred absent. Present and late count as attended; excused counts as leave.
"""
from datetime import date, datetime, timedelta
from typing import Literal
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import Field, model_validator

from . import assignment_workspace as aw
from .security import StrictModel, current_user, has_permission, role_limit
from .storage import audit, new_code, now

router = APIRouter(prefix="/academics/attendance-workspace", tags=["Attendance workspace"])
STATUSES = ("present", "late", "absent", "excused")


def documents(data):
    return data.setdefault("documents", {}).setdefault("attendance_registers", {})


def today():
    return datetime.now(ZoneInfo("Asia/Kolkata")).date()


def allowed(data, user, action="view"):
    if aw.personal(user):
        return False
    screens = role_limit(data, user, "screens")
    if screens is not None and "attendance" not in screens:
        return False
    if aw.teaching(user):
        return bool(aw.teacher_codes(data, user)) and action in {"view", "create", "edit"}
    return has_permission(data, user, "student_attendance", action)


def require(data, user, action="view"):
    if not allowed(data, user, action):
        raise HTTPException(403, "Attendance access is not assigned to this role")


def scope(data, user, program, year, section=None):
    require(data, user)
    return aw.teacher_scope(data, user, year, program, section)


def owns_section(data, user, section):
    return section in {o.get("section_code") for o in aw.rows(data, "subject_offerings")
                       if o.get("teacher_code") in aw.teacher_codes(data, user)}


class Mark(StrictModel):
    student_code: str = Field(min_length=1, max_length=100)
    status: Literal["present", "late", "absent", "excused"]


class Register(StrictModel):
    program_code: str = Field(min_length=1, max_length=100)
    academic_year_code: str = Field(min_length=1, max_length=100)
    section_code: str | None = None
    session_date: date
    period: int = Field(ge=0, le=24, description="0 = whole day; 1–24 = teaching period")
    subject: str = Field(default="", max_length=160)
    slot_code: str | None = Field(default=None,max_length=160)
    subject_code: str | None = None
    semester_number: int | None = Field(default=None,ge=1,le=16)
    revision: int = Field(default=0, ge=0)
    marks: list[Mark] = Field(min_length=1, max_length=2000)

    @model_validator(mode="after")
    def unique_students(self):
        if len({m.student_code for m in self.marks}) != len(self.marks):
            raise ValueError("A student may be marked only once in a register")
        if self.session_date > today():
            raise ValueError("Attendance cannot be marked for a future date")
        return self


def identity(row):
    return (row.get("program_code"), row.get("academic_year_code"), row.get("section_code") or "",
            str(row.get("session_date")), int(row.get("period", 0)))


def legacy_registers(data):
    """Read historical offering-based marks alongside the new shared registers."""
    offerings = {r["code"]: r for r in aw.rows(data, "subject_offerings")}
    sections = {r["code"]: r for r in aw.rows(data, "sections")}
    batches = {r["code"]: r for r in aw.rows(data, "batches")}
    years = aw.rows(data, "academic_years")
    marks = {}
    for row in aw.rows(data, "student_attendance"):
        marks.setdefault(row.get("session_code"), {})[row.get("student_code")] = row.get("status")
    sessions = aw.rows(data, "attendance_sessions")
    times = {}
    for row in sessions:
        offering = offerings.get(row.get("offering_code"), {})
        key = (offering.get("section_code"), str(row.get("session_date", ""))[:10])
        times.setdefault(key, set()).add(str(row.get("start_time", "")))
    result = []
    for row in sessions:
        offering = offerings.get(row.get("offering_code"), {})
        section = sections.get(offering.get("section_code"), {})
        batch = batches.get(section.get("batch_code"), {})
        year = batch.get("academic_year_code") or next((y["code"] for y in years
            if y.get("program_code") == batch.get("program_code") and
            (y.get("batch_code") == batch.get("code") or
             (str(y.get("start_date", ""))[:4] == str(batch.get("entry_year")) and
              str(y.get("end_date", ""))[:4] == str(batch.get("graduation_year"))))), None)
        day = str(row.get("session_date") or row.get("date") or "")[:10]
        if not day or not marks.get(row["code"]):
            continue
        period = int(row.get("period_number") or (sorted(times.get((section.get("code"), day), {""})).index(str(row.get("start_time", ""))) + 1))
        result.append({"code": row["code"], "program_code": batch.get("program_code"), "academic_year_code": year,
                       "section_code": section.get("code"), "session_date": day,
                       "period": period, "subject": offering.get("subject_code", ""),
                       "marks": {k: ("excused" if v in {"leave", "excused"} else v) for k, v in marks[row["code"]].items() if v in {*STATUSES, "leave"}},
                       "revision": 0, "legacy": True})
    return result


def all_registers(data):
    saved = list(documents(data).values())
    replaced = {identity(row) for row in saved}
    return saved + [r for r in legacy_registers(data) if identity(r) not in replaced]


def approved_leaves(data, students):
    result = {s: set() for s in students}
    for row in aw.rows(data, "student_leave_requests"):
        student = row.get("student_code")
        if student not in result or str(row.get("status")).lower() != "approved":
            continue
        try:
            start = date.fromisoformat(str(row.get("start_date") or row.get("from_date"))[:10])
            end = date.fromisoformat(str(row.get("end_date") or row.get("to_date") or start)[:10])
        except ValueError:
            continue
        for offset in range(min(3660, max(0, (end - start).days + 1))):
            result[student].add((start + timedelta(days=offset)).isoformat())
    return result


def summarize(registers, students, leaves, start, end):
    counts = dict.fromkeys(STATUSES, 0)
    days = {}
    leave_days = set()
    for register in registers:
        day = register["session_date"]
        if not start <= day <= end:
            continue
        for student, status in register["marks"].items():
            if student not in students or status not in counts:
                continue
            counts[status] += 1
            days.setdefault((student, day), []).append(status)
            if status == "excused":
                leave_days.add((student, day))
    for student in students:
        leave_days.update((student, d) for d in leaves.get(student, set()) if start <= d <= end)
    recorded = sum(counts.values())
    attended = counts["present"] + counts["late"]
    return {**counts, "recorded": recorded, "attended": attended,
            "percentage": round(100 * attended / recorded, 1) if recorded else None,
            "recorded_days": len(days), "leave_days": len(leave_days),
            "absent_days": sum("absent" in statuses for statuses in days.values()),
            "start": start, "end": end}


@router.get("/options")
def options(request: Request, user=Depends(current_user)):
    data = request.app.state.store.snapshot()
    personal = aw.personal(user)
    if not personal:
        require(data, user)
    own = aw.own_students(data, user) if personal else set()
    years = []
    course_codes = set()
    section_codes = set()
    for year in aw.rows(data, "academic_years"):
        program = year.get("program_code")
        if not program:
            continue
        try:
            _, sections, roster = aw.roster(data, year["code"], program)
            if personal and not own.intersection(roster):
                continue
            if not personal and aw.teaching(user):
                sections = {s for s in sections if owns_section(data, user, s)}
                if not sections:
                    continue
        except (HTTPException, ValueError, KeyError):
            continue
        years.append({**{k: year.get(k) for k in ("code", "name", "program_code", "batch_code", "start_date", "end_date")},
                      "section_codes": sorted(sections) if not personal else []})
        course_codes.add(program)
        section_codes.update(sections)
    return {"courses": [{"code": r["code"], "name": r.get("name"), "course_level": r.get("course_level"),
                         "branch": r.get("branch") or r.get("specialization") or "General"}
                        for r in aw.rows(data, "programs") if r["code"] in course_codes],
            "academic_years": years,
            "sections": [{"code": r["code"], "name": r.get("name", r["code"]), "batch_code": r.get("batch_code")}
                         for r in aw.rows(data, "sections") if r["code"] in section_codes] if not personal else [],
            "students": [{"code": r["code"], "name": aw.name(r)} for r in aw.rows(data, "students") if r["code"] in own],
            "can_mark": allowed(data, user, "create"), "teacher": aw.teaching(user), "personal": personal,
            "statuses": list(STATUSES), "periods": [{"value": 0, "label": "Whole day"}] +
            [{"value": n, "label": f"Period {n}"} for n in range(1, 13)]}


@router.get("")
def listing(request: Request, program_code: str | None = None, academic_year_code: str | None = None,
            section_code: str | None = None, student_code: str | None = None, on: date | None = None,
            period: int = Query(default=1, ge=0, le=24),
            user=Depends(current_user)):
    data = request.app.state.store.snapshot()
    anchor = on or today()
    if aw.personal(user):
        students = aw.own_students(data, user, student_code)
        roster = {r["code"]: r for r in aw.rows(data, "students") if r["code"] in students}
    else:
        require(data, user)
        if not program_code or not academic_year_code:
            raise HTTPException(422, "Select a course, branch and academic batch")
        roster = scope(data, user, program_code, academic_year_code, section_code)
        if student_code and student_code not in roster:
            raise HTTPException(404, "Student not found in this class")
        students = {student_code} if student_code else set(roster)
    week = anchor - timedelta(days=anchor.weekday())
    window_start = min(anchor.replace(month=1, day=1), week).isoformat()
    window_end = max(anchor.replace(month=12, day=31), week + timedelta(days=6)).isoformat()
    registers = []
    for row in all_registers(data):
        if not window_start <= str(row.get("session_date", "")) <= window_end:
            continue
        if program_code and row.get("program_code") != program_code or academic_year_code and row.get("academic_year_code") != academic_year_code:
            continue
        if section_code and row.get("section_code") != section_code:
            continue
        if not aw.personal(user) and aw.teaching(user) and not owns_section(data, user, row.get("section_code")):
            continue
        marks = {s: status for s, status in row["marks"].items() if s in students}
        if marks:
            registers.append({**row, "marks": marks})
    registers.sort(key=lambda r: (r["session_date"], r["period"]))
    leaves = approved_leaves(data, students)
    week = anchor - timedelta(days=anchor.weekday())
    month = anchor.replace(day=1)
    month_end = (month.replace(day=28) + timedelta(days=4)).replace(day=1) - timedelta(days=1)
    spans = {"day": (anchor, anchor), "week": (week, week + timedelta(days=6)), "month": (month, month_end),
             "year": (anchor.replace(month=1, day=1), anchor.replace(month=12, day=31))}
    summaries = {key: summarize(registers, students, leaves, a.isoformat(), b.isoformat()) for key, (a, b) in spans.items()}
    summaries["period"] = summarize([r for r in registers if r["period"] == period], students, leaves, anchor.isoformat(), anchor.isoformat())
    calendar = []
    for offset in range(month_end.day):
        day = month + timedelta(days=offset)
        stats = summarize(registers, students, leaves, day.isoformat(), day.isoformat())
        calendar.append({"date": day.isoformat(), **stats})
    return {"date": anchor.isoformat(), "registers": registers, "summaries": summaries, "calendar": calendar,
            "leave_dates": {s: sorted(d for d in leaves.get(s, set()) if d[:4] == str(anchor.year)) for s in students},
            "students": [{"code": s, "name": aw.name(roster[s]), "admission_number": roster[s].get("admission_number", "")}
                         for s in sorted(students, key=lambda s: aw.name(roster[s]))],
            "can_mark": allowed(data, user, "create"),
            "calculation": "Present + late / all recorded sessions (including absence and excused leave); a whole-day register counts as one session. Unmarked sessions are excluded. Day counts are student-days; leave days include approved leave and marked excused sessions."}


@router.put("/register")
def save(body: Register, request: Request, user=Depends(current_user)):
    with request.app.state.store.transaction() as data:
        require(data, user, "create")
        people = scope(data, user, body.program_code, body.academic_year_code, body.section_code)
        year = data["records"].get("academic_years", {}).get(body.academic_year_code, {})
        day = body.session_date.isoformat()
        if (year.get("start_date") and day < str(year["start_date"])[:10]) or (year.get("end_date") and day > str(year["end_date"])[:10]):
            raise HTTPException(422, "Choose a date within the selected academic batch")
        if aw.teaching(user) and (not body.section_code or not owns_section(data, user, body.section_code)):
            raise HTTPException(403, "Choose one of your assigned class sections")
        if not {m.student_code for m in body.marks}.issubset(people):
            raise HTTPException(422, "The register contains students outside the selected class")
        record = body.model_dump(mode="json", exclude={"marks", "revision"})
        if body.slot_code or aw.teaching(user):
            from .academic_progress import today_classes,local_now
            instant=local_now().replace(year=body.session_date.year,month=body.session_date.month,day=body.session_date.day)
            classes=[c for c in today_classes(data,user,year,instant=instant) if c['section_code']==body.section_code]
            session=next((c for c in classes if (c['code']==body.slot_code if body.slot_code else c['period']==body.period)),None)
            scheduled_offerings={o['code'] for o in aw.rows(data,'subject_offerings') if o['section_code']==body.section_code}
            scheduled=any(s['offering_code'] in scheduled_offerings for s in aw.rows(data,'timetable_slots'))
            if (body.slot_code or classes or scheduled) and (not session or session['period']!=body.period): raise HTTPException(422,'Choose a scheduled teaching period for this class and date')
            if session:
                if aw.teaching(user) and body.session_date==local_now().date() and local_now().strftime('%H:%M')<session['start_time']: raise HTTPException(403,'Attendance opens when the scheduled class begins')
                record.update(slot_code=session['code'],subject_code=session['subject_code'],semester_number=session['semester_number'],subject=session['subject_name'])
        existing = next((r for r in documents(data).values() if identity(r) == identity(record)), None)
        if existing and not allowed(data, user, "edit"):
            raise HTTPException(403, "Attendance edit permission required")
        revision = existing.get("revision", 0) if existing else 0
        if revision != body.revision:
            raise HTTPException(409, "This register changed. Reload attendance before saving again")
        for other in all_registers(data):
            if identity(other) == identity(record):
                continue
            if (other.get("program_code"), other.get("academic_year_code"), other.get("session_date")) != (body.program_code, body.academic_year_code, body.session_date.isoformat()):
                continue
            overlapping = not other.get("section_code") or not body.section_code or other.get("section_code") == body.section_code
            if overlapping and (other["period"] == 0 or body.period == 0):
                raise HTTPException(409, "Whole-day and period registers cannot overlap for the same class and date")
            if overlapping and other["period"] == body.period:
                raise HTTPException(409, "Choose the existing class scope before editing this register")
        previous = existing or next((r for r in legacy_registers(data) if identity(r) == identity(record)), {})
        if previous and not allowed(data, user, "edit"):
            raise HTTPException(403, "Attendance edit permission required")
        record.update(code=existing["code"] if existing else new_code("ATT"), revision=revision + 1,
                      marks={**(previous.get("marks", {})), **{m.student_code: m.status for m in body.marks}},
                      updated_at=now(), updated_by=user["code"])
        documents(data)[record["code"]] = record
        audit(data, user["code"], "attendance_save", "student_attendance", record["code"])
    return record
