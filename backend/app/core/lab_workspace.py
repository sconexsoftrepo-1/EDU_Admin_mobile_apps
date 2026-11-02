"""Laboratories: the lab register, lab in-charges and their lab sessions.

Labs are kept as versioned workspace documents (``documents.labs``), so no new database table is
needed. A lab records its name, floor, room number, type, the non-teaching lab in-charge who runs
it and the lab subjects (practicals) held in it. Faculty assigned to a lab subject's section
(``subject_offerings``) supervise the students; the lab in-charge looks after the lab itself.

A lab in-charge signs in to the staff app (``teacher-mobile`` client) and sees their labs' sessions:
the batch (course, academic year, semester, section), the time period, the students and their
attendance for that day, plus their own timetable, leave, payslips and Form 16.
"""
from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import Field

from . import assignment_workspace as aw
from .security import StrictModel, current_user, has_permission
from .storage import audit, new_code, now

router = APIRouter(prefix="/academics/labs", tags=["Laboratories"])

LAB_TYPES = ["Physics", "Chemistry", "Biology", "Botany", "Zoology", "Computer", "Electronics",
             "Language", "Commerce", "Research", "Other"]
LAB_ROLE = "LAB_INCHARGE"
LAB_SCREENS = ["profile", "labs", "timetable", "leave", "payslips", "tax-documents", "calendar",
               "announcements", "notifications"]


def person(record):
    """Full name with single spaces (no gap for a missing middle name)."""
    return " ".join(aw.name(record or {}).split())


def registry(data):
    return data.setdefault("documents", {}).setdefault("labs", {})


def lab_subject(subject):
    """Practicals, labs and workshops are held in a lab."""
    text = f"{subject.get('name', '')} {subject.get('subject_type', '')}".lower()
    return subject.get("subject_type") == "practical" or any(w in text for w in ("lab", "practical", "workshop"))


def employee_labs(data, employee_code):
    return [lab for lab in registry(data).values()
            if lab.get("incharge_employee_code") == employee_code and lab.get("status", "active") == "active"]


def is_teacher(data, employee_code):
    return any(t.get("employee_code") == employee_code for t in aw.rows(data, "teachers"))


def is_lab_incharge(data, user):
    """An employee without teaching duties who runs at least one lab (or holds the lab role)."""
    if user.get("person_type") != "employee":
        return False
    code = user.get("person_code")
    holds_role = LAB_ROLE in data.get("accounts", {}).get(user.get("code"), {}).get("role_codes", [])
    return (bool(employee_labs(data, code)) or holds_role) and not is_teacher(data, code)


def ensure_lab_role(data):
    """The "Lab In-charge" access role: staff app screens for lab sessions and own pay documents."""
    roles = data.setdefault("roles", {})
    if LAB_ROLE not in roles and not any(r.get("name", "").casefold() == "lab in-charge" for r in roles.values()):
        roles[LAB_ROLE] = {"code": LAB_ROLE, "name": "Lab In-charge", "scope": "teaching", "system_admin": False,
                           "screens": LAB_SCREENS,
                           "permissions": {"timetable_slots": ["view"], "student_attendance": ["view"],
                                           "leave_requests": ["view", "create"], "payslips": ["view"],
                                           "employee_tax_documents": ["view"], "calendar_events": ["view"],
                                           "announcements": ["view"], "notifications": ["view"]}}
    return roles.get(LAB_ROLE)


def can_manage(data, user):
    return not aw.personal(user) and not aw.teaching(user) and any(
        has_permission(data, user, table, action)
        for table, action in (("staff_profiles", "create"), ("staff_profiles", "edit"),
                              ("programs", "edit"), ("subject_offerings", "create")))


def can_view(data, user):
    return can_manage(data, user) or (not aw.personal(user) and any(
        has_permission(data, user, table, "view") for table in ("staff_profiles", "programs", "subject_offerings")))


def view(data, lab):
    employees = data["records"].get("employees", {})
    subjects = data["records"].get("subjects", {})
    incharge = employees.get(lab.get("incharge_employee_code") or "", {})
    return {**lab, "incharge_name": person(incharge) or None,
            "subjects": [{"code": c, "name": subjects.get(c, {}).get("name", c)} for c in lab.get("subject_codes", [])]}


def lab_for_subject(data, subject_code, subject_name=""):
    """The lab a subject is held in: an explicit link first, then a lab whose type names the subject."""
    labs = [lab for lab in registry(data).values() if lab.get("status", "active") == "active"]
    linked = next((lab for lab in labs if subject_code in lab.get("subject_codes", [])), None)
    if linked:
        return linked
    text = subject_name.lower()
    return next((lab for lab in labs if lab.get("lab_type") and lab["lab_type"].lower() != "other"
                 and lab["lab_type"].lower() in text), None)


class LabInput(StrictModel):
    name: str = Field(min_length=2, max_length=120)
    floor: str = Field(min_length=1, max_length=40, description="e.g. Ground, 1st, 2nd")
    room_number: str = Field(min_length=1, max_length=40)
    lab_type: Literal[tuple(LAB_TYPES)] = "Other"  # type: ignore[valid-type]
    incharge_employee_code: str | None = Field(default=None, max_length=100)
    subject_codes: list[str] = Field(default_factory=list, max_length=60)
    campus_code: str | None = Field(default=None, max_length=100)
    capacity: int | None = Field(default=None, ge=1, le=1000)
    status: Literal["active", "inactive"] = "active"


class LabUpdate(LabInput):
    revision: int = Field(ge=1)


def validate(data, body: LabInput, code=None):
    if any(lab["code"] != code and lab["name"].casefold() == body.name.strip().casefold()
           for lab in registry(data).values()):
        raise HTTPException(409, "A lab with this name is already registered")
    if any(lab["code"] != code and str(lab.get("room_number", "")).casefold() == body.room_number.strip().casefold()
           and str(lab.get("floor", "")).casefold() == body.floor.strip().casefold() for lab in registry(data).values()):
        raise HTTPException(409, "Another lab is registered in this room")
    if body.incharge_employee_code:
        employee = data["records"].get("employees", {}).get(body.incharge_employee_code)
        if not employee or employee.get("status", "active") != "active":
            raise HTTPException(422, "Select an active employee as lab in-charge")
    known = data["records"].get("subjects", {})
    missing = [c for c in body.subject_codes if c not in known]
    if missing:
        raise HTTPException(422, "Select lab subjects from the course curriculum")


def options(data):
    employees = data["records"].get("employees", {})
    teaching = {t["employee_code"] for t in aw.rows(data, "teachers")}
    profiles = {p["employee_code"]: p for p in aw.rows(data, "staff_profiles")}
    incharges = [{"code": e["code"], "name": person(e), "employee_id": e.get("employee_id") or e.get("employee_number"),
                  "designation": profiles.get(e["code"], {}).get("responsibility") or e.get("designation")}
                 for e in employees.values()
                 if e.get("status", "active") == "active" and e["code"] not in teaching
                 and e.get("employee_type") != "labour"]
    subjects = [{"code": s["code"], "name": s.get("name", s["code"]), "subject_type": s.get("subject_type")}
                for s in aw.rows(data, "subjects") if lab_subject(s)]
    return {"lab_types": LAB_TYPES, "incharges": sorted(incharges, key=lambda e: e["name"]),
            "subjects": sorted(subjects, key=lambda s: s["name"]),
            "campuses": [{"code": c["code"], "name": c.get("name", c["code"])} for c in aw.rows(data, "campuses")]}


@router.get("")
def list_labs(request: Request, user=Depends(current_user)):
    data = request.app.state.store.snapshot()
    if not can_view(data, user):
        raise HTTPException(403, "Lab register access is not assigned to this role")
    items = sorted((view(data, lab) for lab in registry(data).values()), key=lambda r: (r.get("floor", ""), r["name"]))
    return {"items": items, "total": len(items), "can_manage": can_manage(data, user), **options(data)}


@router.post("", status_code=201)
def register_lab(body: LabInput, request: Request, user=Depends(current_user)):
    with request.app.state.store.transaction() as data:
        if not can_manage(data, user):
            raise HTTPException(403, "Lab registration is not assigned to this role")
        validate(data, body)
        lab = {**body.model_dump(), "name": body.name.strip(), "floor": body.floor.strip(),
               "room_number": body.room_number.strip(), "code": new_code("LAB"), "revision": 1,
               "created_at": now(), "updated_at": now(), "created_by": user["code"]}
        registry(data)[lab["code"]] = lab
        if lab["incharge_employee_code"]:
            ensure_lab_role(data)
        audit(data, user["code"], "lab_register", "labs", lab["code"])
        return view(data, lab)


@router.put("/{code}")
def update_lab(code: str, body: LabUpdate, request: Request, user=Depends(current_user)):
    with request.app.state.store.transaction() as data:
        if not can_manage(data, user):
            raise HTTPException(403, "Lab registration is not assigned to this role")
        lab = registry(data).get(code)
        if not lab:
            raise HTTPException(404, "Lab not found")
        if lab.get("revision", 1) != body.revision:
            raise HTTPException(409, "This lab changed; refresh before saving")
        validate(data, body, code)
        values = body.model_dump(exclude={"revision"})
        lab.update({**values, "name": body.name.strip(), "floor": body.floor.strip(),
                    "room_number": body.room_number.strip(), "revision": body.revision + 1, "updated_at": now()})
        if lab["incharge_employee_code"]:
            ensure_lab_role(data)
        audit(data, user["code"], "lab_update", "labs", code)
        return view(data, lab)


def assign_incharge(data, employee_code, lab_codes, actor):
    """Staff onboarding: make the employee in-charge of the selected labs."""
    labs = registry(data)
    unknown = [c for c in lab_codes if c not in labs]
    if unknown:
        raise HTTPException(422, "Select registered labs")
    for code in lab_codes:
        labs[code].update({"incharge_employee_code": employee_code, "revision": labs[code].get("revision", 1) + 1,
                           "updated_at": now()})
        audit(data, actor, "lab_incharge_assign", "labs", code)
    if lab_codes:
        ensure_lab_role(data)


# ---------------------------------------------------------------------------
# Lab sessions for the in-charge: weekly schedule, and one day's sessions with students and attendance.

def year_for_section(data, section):
    batch = data["records"].get("batches", {}).get(section.get("batch_code"), {})
    years = data["records"].get("academic_years", {})
    if batch.get("academic_year_code") in years:
        return years[batch["academic_year_code"]]
    return next((y for y in years.values() if y.get("batch_code") == batch.get("code")
                 or (y.get("program_code") == batch.get("program_code")
                     and str(y.get("start_date", ""))[:4] == str(batch.get("entry_year"))
                     and str(y.get("end_date", ""))[:4] == str(batch.get("graduation_year")))), {})


def weekly_sessions(data, employee_code, labs=None):
    """Every weekly lab period for the in-charge's labs, from timetable slots and published timetables."""
    labs = labs if labs is not None else employee_labs(data, employee_code)
    subjects = data["records"].get("subjects", {})
    by_subject = {}
    for lab in labs:
        for code in lab.get("subject_codes", []):
            by_subject.setdefault(code, lab)
    # Labs linked by type only (no explicit subjects) take matching practical subjects.
    for subject in subjects.values():
        if subject["code"] not in by_subject and lab_subject(subject):
            match = lab_for_subject(data, subject["code"], subject.get("name", ""))
            if match and match in labs and not match.get("subject_codes"):
                by_subject[subject["code"]] = match
    if not by_subject:
        return []
    sections = data["records"].get("sections", {})
    employees = data["records"].get("employees", {})
    teachers = data["records"].get("teachers", {})
    programs = data["records"].get("programs", {})
    offerings = {o["code"]: o for o in aw.rows(data, "subject_offerings") if o["subject_code"] in by_subject}
    sessions = {}

    def add(offering_or_section, subject_code, weekday, start, end, room="", source=""):
        section = sections.get(offering_or_section.get("section_code"), {})
        if not section:
            return
        year = year_for_section(data, section)
        offering = next((o for o in offerings.values() if o["section_code"] == section["code"]
                         and o["subject_code"] == subject_code), {})
        faculty = employees.get(teachers.get(offering.get("teacher_code"), {}).get("employee_code"), {})
        lab = by_subject[subject_code]
        key = (section["code"], subject_code, int(weekday), str(start)[:5])
        sessions[key] = {
            "code": f"{lab['code']}:{section['code']}:{subject_code}:{weekday}:{str(start)[:5]}",
            "lab_code": lab["code"], "lab_name": lab["name"], "floor": lab.get("floor"),
            "room_number": room or lab.get("room_number"), "subject_code": subject_code,
            "subject_name": subjects.get(subject_code, {}).get("name", subject_code),
            "section_code": section["code"], "section_name": section.get("name", ""),
            "program_code": year.get("program_code"), "program_name": programs.get(year.get("program_code"), {}).get("name", ""),
            "academic_year_code": year.get("code"), "academic_year_name": year.get("name", ""),
            "faculty_name": person(faculty) or None, "weekday": int(weekday),
            "start_time": str(start)[:5], "end_time": str(end)[:5], "source": source}

    for slot in aw.rows(data, "timetable_slots"):
        offering = offerings.get(slot.get("offering_code"))
        if offering:
            add(offering, offering["subject_code"], slot["weekday"], slot.get("start_time", ""), slot.get("end_time", ""),
                slot.get("room_name", ""), "slot")
    section_by_name = {}
    for s in sections.values():
        section_by_name.setdefault((s.get("batch_code"), s.get("name")), s)
    for timetable in data.get("documents", {}).get("timetables", {}).values():
        if timetable.get("status") != "Published":
            continue
        section = section_by_name.get((timetable.get("batch_code"), timetable.get("section")))
        if not section:
            continue
        periods = timetable.get("periods", [])
        for cell in timetable.get("cells", []):
            if cell.get("subject_code") not in by_subject or cell.get("row", 0) >= len(periods):
                continue
            last = min(cell["row"] + cell.get("span", 1) - 1, len(periods) - 1)
            add({"section_code": section["code"]}, cell["subject_code"], int(cell["day"]) + 1,
                periods[cell["row"]]["start"], periods[last]["end"], cell.get("room", ""), "timetable")
    return sorted(sessions.values(), key=lambda s: (s["weekday"], s["start_time"], s["lab_name"]))


def day_sessions(data, employee_code, on: date):
    """The in-charge's lab sessions on one day, each with its students and their attendance."""
    from .attendance_workspace import all_registers
    sessions = [dict(s) for s in weekly_sessions(data, employee_code) if s["weekday"] == on.isoweekday()]
    if not sessions:
        return []
    students = data["records"].get("students", {})
    registers = [r for r in all_registers(data) if str(r.get("session_date"))[:10] == on.isoformat()]
    # Period numbers of each section's day, in start-time order (how registers number periods).
    day_times = {}
    for s in weekly_sessions(data, employee_code):
        if s["weekday"] == on.isoweekday():
            day_times.setdefault(s["section_code"], set()).add(s["start_time"])
    for session in sessions:
        roster = sorted({e["student_code"] for e in aw.rows(data, "student_enrollments")
                         if e["section_code"] == session["section_code"] and e.get("status") == "active"},
                        key=lambda c: person(students.get(c, {})))
        same = [r for r in registers if r.get("section_code") == session["section_code"]]
        register = next((r for r in same if r.get("subject_code") == session["subject_code"]), None) or next(
            (r for r in same if str(r.get("subject", "")).casefold() == session["subject_name"].casefold()), None)
        marks = (register or {}).get("marks", {})
        rows = [{"code": c, "name": person(students.get(c, {})) or c,
                 "admission_number": students.get(c, {}).get("admission_number", ""),
                 "status": marks.get(c)} for c in roster]
        counts = {k: sum(1 for r in rows if r["status"] == k) for k in ("present", "late", "absent", "excused")}
        session.update({"date": on.isoformat(), "students": rows, "attendance_marked": register is not None,
                        "counts": {**counts, "total": len(rows), "unmarked": sum(1 for r in rows if not r["status"])}})
    return sessions


@router.get("/my-sessions")
def my_sessions(request: Request, on: date | None = Query(default=None), user=Depends(current_user)):
    data = request.app.state.store.snapshot()
    if user.get("person_type") != "employee":
        raise HTTPException(403, "Lab sessions are for staff")
    labs = employee_labs(data, user["person_code"])
    from .academic_progress import local_now
    day = on or local_now().date()
    return {"date": day.isoformat(), "labs": [view(data, lab) for lab in labs],
            "sessions": day_sessions(data, user["person_code"], day),
            "week": weekly_sessions(data, user["person_code"], labs)}
