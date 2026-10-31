"""Assignment workflow documents, scoped audiences, private uploads and review.

Uses the same transaction-backed, versioned document store as timetable templates.
Legacy offering-based assignments remain visible; new assignments need no dummy subject.
"""
import base64
import binascii
import hashlib
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path
from zoneinfo import ZoneInfo
from typing import Literal

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request
from fastapi.responses import Response
from pydantic import Field, model_validator

from .security import StrictModel, current_user, has_permission, role_limit
from .storage import audit, new_code, now

router = APIRouter(prefix="/academics/assignment-workspace", tags=["Assignment workspace"])
CHUNK_SIZE = 262144
MAX_FILE = 10 * 1024 * 1024


def rows(data, table):
    return list(data["records"].get(table, {}).values())


def docs(data, kind):
    return data.setdefault("documents", {}).setdefault("assignment_" + kind, {})


def name(person):
    return " ".join(str(person.get(k) or "").strip() for k in ("first_name", "middle_name", "last_name")).strip()


def teacher_codes(data, user):
    return {t["code"] for t in rows(data, "teachers") if t["employee_code"] == user.get("person_code")}


def personal(user):
    return user.get("person_type") in {"student", "parent"}


def teaching(user):
    return user.get("client") == "teacher-mobile" or user.get("workspace_scope") == "teaching"


def permitted(data, user, action="view"):
    if personal(user):
        return False
    allowed = role_limit(data, user, "screens")
    return (allowed is None or "assignments" in allowed) and (bool(teacher_codes(data, user)) if teaching(user) else has_permission(data, user, "assignments", action))


def staff(data, user, action="view"):
    if not permitted(data, user, action):
        raise HTTPException(403, "Assignment access is not assigned to this role")


def own_students(data, user, student_code=None):
    if user.get("person_type") == "student":
        result = {user["person_code"]}
    elif user.get("person_type") == "parent":
        result = {r["student_code"] for r in rows(data, "student_parents") if r["parent_code"] == user["person_code"]}
    else:
        return set()
    if student_code and student_code not in result:
        raise HTTPException(404, "Student not found")
    return {student_code} if student_code else result


def roster(data, year_code, program_code, section_code=None):
    year = data["records"].get("academic_years", {}).get(year_code)
    if not year or year.get("program_code") != program_code:
        raise HTTPException(422, "Select an academic batch belonging to this course")
    candidates = [b for b in rows(data, "batches") if b["program_code"] == program_code]
    # Explicit links take precedence over a historical date-range match.
    batches = {b["code"] for b in candidates if b["code"] == year.get("batch_code")}
    if not batches:
        batches = {b["code"] for b in candidates if b.get("academic_year_code") == year_code}
    if not batches:
        batches = {b["code"] for b in candidates if not b.get("academic_year_code")
                   and int(b["entry_year"]) == int(str(year["start_date"])[:4])
                   and int(b["graduation_year"]) == int(str(year["end_date"])[:4])}
    sections = {s["code"] for s in rows(data, "sections") if s["batch_code"] in batches}
    if section_code and section_code not in sections:
        raise HTTPException(422, "The section does not belong to this academic batch")
    members = {p["student_code"] for p in rows(data, "student_admission_profiles")
               if p.get("program_code") == program_code and p.get("academic_year_code") == year_code
               and (not section_code or p.get("section_code") == section_code)}
    members.update(e["student_code"] for e in rows(data, "student_enrollments")
                   if e.get("status") == "active" and e["section_code"] in ({section_code} if section_code else sections))
    people = {s["code"]: s for s in rows(data, "students") if s.get("status") == "active" and s["code"] in members}
    return year, sections, people


def teacher_scope(data, user, year_code, program_code, section_code=None):
    _, sections, students = roster(data, year_code, program_code, section_code)
    if teaching(user):
        owned = {o["section_code"] for o in rows(data, "subject_offerings") if o["teacher_code"] in teacher_codes(data, user)}
        if section_code and section_code not in owned or not (sections & owned):
            raise HTTPException(403, "This academic batch is outside your teaching classes")
        own_members = {e["student_code"] for e in rows(data, "student_enrollments")
                       if e.get("status") == "active" and e["section_code"] in sections & owned}
        students = {k: v for k, v in students.items() if k in own_members}
    return students


def all_assignments(data):
    result = dict(docs(data, "records"))
    offerings = {o["code"]: o for o in rows(data, "subject_offerings")}
    sections = {s["code"]: s for s in rows(data, "sections")}
    batches = {b["code"]: b for b in rows(data, "batches")}
    for old in rows(data, "assignments"):
        if old["code"] in result:
            continue
        offering = offerings.get(old.get("offering_code"), {})
        section = sections.get(offering.get("section_code"), {})
        batch = batches.get(section.get("batch_code"), {})
        members = sorted({e["student_code"] for e in rows(data, "student_enrollments")
                          if e.get("status") == "active" and e["section_code"] == section.get("code")})
        result[old["code"]] = {**old, "description": old.get("instructions") or "", "legacy": True,
            "teacher_code": offering.get("teacher_code"), "section_code": section.get("code"),
            "program_code": batch.get("program_code"), "academic_year_code": batch.get("academic_year_code"),
            "recipient_student_codes": members, "attachments": [], "revision": 0, "allow_late": False}
    return result


def get_assignment(data, code):
    record = all_assignments(data).get(code)
    if not record:
        raise HTTPException(404, "Assignment not found")
    return record


def can_review(data, user, assignment):
    return permitted(data, user) and (not teaching(user) or assignment.get("teacher_code") in teacher_codes(data, user))


def authorize(data, user, assignment):
    if personal(user):
        if not (own_students(data, user) & set(assignment["recipient_student_codes"])):
            raise HTTPException(404, "Assignment not found")
    elif not can_review(data, user, assignment):
        raise HTTPException(404, "Assignment not found")


def submissions(data, code):
    result = {s["student_code"]: dict(s) for s in rows(data, "assignment_submissions") if s["assignment_code"] == code}
    result.update({s["student_code"]: dict(s) for s in docs(data, "submissions").values() if s["assignment_code"] == code})
    return result


def file_public(record):
    return {k: record[k] for k in ("code", "filename", "mime_type", "size_bytes") if k in record}


def submission_public(data, value):
    if not value:
        return None
    return {**{k: value.get(k) for k in ("code", "student_code", "submitted_at", "completed", "reviewed_at", "marks", "feedback", "late", "revision")},
            "attachments": [file_public(docs(data, "files")[k]) for k in value.get("attachments", []) if k in docs(data, "files")]}


def present(data, user, record, student_code=None, values=None):
    authorize(data, user, record)
    values = submissions(data, record["code"]) if values is None else values
    members = record["recipient_student_codes"]
    program = data["records"].get("programs", {}).get(record.get("program_code"), {})
    year = data["records"].get("academic_years", {}).get(record.get("academic_year_code"), {})
    teacher = data["records"].get("teachers", {}).get(record.get("teacher_code"), {})
    employee = data["records"].get("employees", {}).get(teacher.get("employee_code"), {})
    output = {**{k: record.get(k) for k in ("code", "title", "description", "due_at", "max_marks", "teacher_code", "program_code", "academic_year_code", "section_code", "created_by", "created_at", "revision", "allow_late", "legacy", "subject_code", "semester_number")},
        "subject_name": data["records"].get("subjects",{}).get(record.get("subject_code"),{}).get("name",""),
        "course_name": program.get("name", ""), "batch_name": year.get("name", ""), "teacher_name": name(employee),
        "attachments": [file_public(docs(data, "files")[k]) for k in record.get("attachments", []) if k in docs(data, "files")],
        "can_review": can_review(data, user, record), "can_grade": can_review(data, user, record) and permitted(data, user, "edit"), "can_submit": user.get("person_type") == "student",
        "counts": {"assigned": len(members), "submitted": sum(bool(values.get(s, {}).get("submitted_at")) for s in members),
                   "reviewed": sum(bool(values.get(s, {}).get("completed")) for s in members)},
    }
    output["counts"]["pending"] = len(members) - output["counts"]["submitted"]
    if personal(user):
        selected = own_students(data, user, student_code) & set(members)
        output["my_submissions"] = {s: submission_public(data, values.get(s)) for s in selected}
        output["my_submission"] = next(iter(output["my_submissions"].values()), None)
        # Never expose the rest of a class's students or counts to parents/students.
        output.pop("counts")
    due = datetime.fromisoformat(str(record["due_at"]).replace("Z", "+00:00"))
    local_today = datetime.now(ZoneInfo("Asia/Kolkata")).date()
    complete = (all(values.get(s, {}).get("completed") for s in members) and bool(members)) if not personal(user) else all(values.get(s, {}).get("completed") for s in selected)
    output["bucket"] = "completed" if complete else "today" if due.astimezone(ZoneInfo("Asia/Kolkata")).date() == local_today else "overdue" if due < datetime.now(timezone.utc) else "upcoming"
    return output


class AssignmentInput(StrictModel):
    course_level: Literal["intermediate", "degree"]
    program_code: str = Field(min_length=1, max_length=100)
    academic_year_code: str = Field(min_length=1, max_length=100)
    section_code: str | None = None
    teacher_code: str | None = None
    subject_code: str | None = None
    semester_number: int | None = Field(default=None, ge=1, le=16)
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(default="", max_length=10000)
    due_at: datetime
    max_marks: Decimal = Field(gt=0, le=10000, decimal_places=2)
    recipient_student_codes: list[str] | None = Field(default=None, max_length=5000)
    attachments: list[str] = Field(default_factory=list, max_length=10)
    allow_late: bool = True
    revision: int = Field(default=0, ge=0)

    @model_validator(mode="after")
    def valid_due(self):
        if self.due_at.tzinfo is None:
            raise ValueError("Due date must include its time zone")
        if not self.title.strip():
            raise ValueError("Enter an assignment name")
        return self


@router.get("/options")
def options(request: Request, program_code: str | None = None, academic_year_code: str | None = None,
            section_code: str | None = None, user=Depends(current_user)):
    data = request.app.state.store.snapshot()
    staff(data, user)
    own = teacher_codes(data, user)
    sections_owned = {o["section_code"] for o in rows(data, "subject_offerings") if o["teacher_code"] in own}
    batches_owned = {s["batch_code"] for s in rows(data, "sections") if s["code"] in sections_owned}
    years = [y for y in rows(data, "academic_years") if y.get("program_code")]
    if teaching(user):
        years = [y for y in years if any(b["code"] in batches_owned and b["program_code"] == y["program_code"] and
                 (b["code"] == y.get("batch_code") or b.get("academic_year_code") == y["code"] or
                  str(b["entry_year"]) == str(y["start_date"])[:4] and str(b["graduation_year"]) == str(y["end_date"])[:4]) for b in rows(data, "batches"))]
    programs = [p for p in rows(data, "programs") if p.get("course_level") in {"intermediate", "degree"}
                and (not teaching(user) or p["code"] in {y["program_code"] for y in years})]
    employees = {e["code"]: e for e in rows(data, "employees")}
    teachers = [{"code": t["code"], "name": name(employees.get(t["employee_code"], {}))} for t in rows(data, "teachers")
                if (not teaching(user) or t["code"] in own) and employees.get(t["employee_code"], {}).get("status") == "active"]
    result = {"courses": [{"code": p["code"], "name": p["name"], "course_level": p["course_level"]} for p in programs],
              "academic_years": [{k: y.get(k) for k in ("code", "name", "program_code", "start_date", "end_date")} for y in years],
              "teachers": teachers, "teacher_locked": teaching(user), "sections": [], "students": [],
              "can_create": permitted(data, user, "create")}
    if program_code and academic_year_code:
        students = teacher_scope(data, user, academic_year_code, program_code, section_code)
        _, sections, _ = roster(data, academic_year_code, program_code)
        result["sections"] = [{"code": s["code"], "name": s["name"]} for s in rows(data, "sections") if s["code"] in sections
                              and (not teaching(user) or s["code"] in sections_owned)]
        result["students"] = [{"code": s["code"], "name": name(s), "admission_number": s.get("admission_number")} for s in students.values()]
    from .curriculum_workspace import curriculum
    result["subjects"] = curriculum(data, program_code, academic_year_code)["items"] if program_code else []
    if teaching(user):
        offered = {o["subject_code"] for o in rows(data,"subject_offerings") if o["teacher_code"] in own and (not section_code or o["section_code"] == section_code) and (not academic_year_code or o["section_code"] in {s["code"] for s in result["sections"]})}
        result["subjects"] = [s for s in result["subjects"] if s["subject_code"] in offered]
    from .academic_progress import semester_state
    year=data["records"].get("academic_years",{}).get(academic_year_code)
    result["current_semester"]=semester_state(data,year)["current"] if year else None
    return result


def notifications(data, student_codes, title, body, assignment_code):
    parents = {r["parent_code"] for r in rows(data, "student_parents") if r["student_code"] in student_codes and r.get("receives_notifications", True)}
    recipients = {a["code"] for a in data["accounts"].values() if a.get("active") and
                  ((a.get("person_type") == "student" and a.get("person_code") in student_codes) or
                   (a.get("person_type") == "parent" and a.get("person_code") in parents))}
    made = []
    for account in sorted(recipients):
        code = new_code("ANOTICE")
        data["records"].setdefault("notifications", {})[code] = {"code": code, "user_code": account, "title": title,
            "body": body, "channel": "in_app", "status": "sent", "sent_at": now(), "assignment_code": assignment_code}
        made.append(code)
    return made


def dispatch_push(request, notice_codes):
    settings = request.app.state.settings
    if not (settings.push_adapter_url and settings.push_adapter_token):
        return
    from .integrations_api import adapter_post
    for code in notice_codes:
        with request.app.state.store.transaction() as data:
            record = data["records"]["notifications"][code]
            tokens = [d["token"] for d in rows(data, "device_tokens") if d["user_code"] == record["user_code"]]
            payload = {"idempotency_key": code, "tokens": tokens, "title": record["title"], "body": record["body"],
                       "data": {**({"assessment_code": record["assessment_code"], "screen": "assessments"} if record.get("assessment_code") else {"assignment_code": record["assignment_code"], "screen": "assignments"}), "notification_code": code}}
        if not tokens:
            continue
        try:
            result = adapter_post(settings.push_adapter_url, settings.push_adapter_token, payload)
            accepted = result.get("accepted") is True
        except Exception:
            accepted = False
        with request.app.state.store.transaction() as data:
            data["records"]["notifications"][code]["push_status"] = "accepted" if accepted else "failed"


def validate_files(data, codes, user, assignment_code=None):
    for code in codes:
        file = docs(data, "files").get(code)
        if not file or not file.get("ready") or file["owner"] != user["code"] or file.get("assignment_code") not in (None, assignment_code):
            raise HTTPException(422, "Attach only your uploaded PDF or image files")


def save_assignment(body, request, background, user, code=None):
    with request.app.state.store.transaction() as data:
        staff(data, user, "edit" if code else "create")
        previous = get_assignment(data, code) if code else None
        if previous and not can_review(data, user, previous):
            raise HTTPException(404, "Assignment not found")
        if previous and submissions(data, code):
            raise HTTPException(409, "An assignment with submissions cannot have its audience or instructions changed")
        if body.revision != (previous.get("revision", 0) if previous else 0):
            raise HTTPException(409, "This assignment changed. Refresh before saving.")
        program = data["records"].get("programs", {}).get(body.program_code)
        if not program or program.get("course_level") != body.course_level:
            raise HTTPException(422, "Select a course belonging to the chosen level")
        students = teacher_scope(data, user, body.academic_year_code, body.program_code, body.section_code)
        recipients = sorted(set(body.recipient_student_codes if body.recipient_student_codes is not None else students))
        if not recipients or set(recipients) - set(students):
            raise HTTPException(422, "Select at least one eligible student from this academic batch")
        own = teacher_codes(data, user)
        teacher = next(iter(own), None) if teaching(user) else body.teacher_code
        if not teacher or teacher not in data["records"].get("teachers", {}):
            raise HTTPException(422, "Select a registered teacher")
        if teaching(user) and body.teacher_code and body.teacher_code not in own:
            raise HTTPException(403, "Assignments must use your own teacher profile")
        if body.subject_code:
            from .curriculum_workspace import curriculum
            if not any(s['subject_code']==body.subject_code and s['semester_number']==body.semester_number for s in curriculum(data,body.program_code,body.academic_year_code)['items']):
                raise HTTPException(422,'Select a subject from the course semester')
            _, sections, _ = roster(data,body.academic_year_code,body.program_code,body.section_code)
            if teaching(user) and not any(o['teacher_code']==teacher and o['subject_code']==body.subject_code and o['section_code'] in ({body.section_code} if body.section_code else sections) for o in rows(data,'subject_offerings')):
                raise HTTPException(403,'This subject is outside your teaching allocation')
        if body.due_at <= datetime.now(timezone.utc):
            raise HTTPException(422, "Choose a future due date and time")
        validate_files(data, body.attachments, user, code)
        code = code or new_code("ASG")
        record = {**body.model_dump(mode="json"), "code": code, "teacher_code": teacher,
                  "recipient_student_codes": recipients, "title": body.title.strip(),
                  "revision": body.revision + 1, "created_by": previous.get("created_by", user["code"]) if previous else user["code"],
                  "created_at": previous.get("created_at", now()) if previous else now(), "updated_at": now()}
        docs(data, "records")[code] = record
        for file in body.attachments:
            docs(data, "files")[file]["assignment_code"] = code
        notices = notifications(data, set(recipients), "Assignment: " + record["title"],
                                "New assignment. Due " + body.due_at.isoformat() + ". Open Assignments for details.", code)
        audit(data, user["code"], "assignment_update" if previous else "assignment_create", "assignments", code)
        result = present(data, user, record)
    background.add_task(dispatch_push, request, notices)
    return result


@router.post("", status_code=201)
def create(body: AssignmentInput, request: Request, background: BackgroundTasks, user=Depends(current_user)):
    return save_assignment(body, request, background, user)


@router.put("/{code}")
def update(code: str, body: AssignmentInput, request: Request, background: BackgroundTasks, user=Depends(current_user)):
    return save_assignment(body, request, background, user, code)


@router.get("")
def listing(request: Request, student_code: str | None = None, user=Depends(current_user)):
    data = request.app.state.store.snapshot()
    if not personal(user):
        staff(data, user)
    selected = own_students(data, user, student_code)
    items = []
    indexed = {}
    for submission in rows(data, "assignment_submissions") + list(docs(data, "submissions").values()):
        indexed.setdefault(submission["assignment_code"], {})[submission["student_code"]] = dict(submission)
    for record in all_assignments(data).values():
        if personal(user) and not selected.intersection(record["recipient_student_codes"]):
            continue
        if not personal(user) and not can_review(data, user, record):
            continue
        items.append(present(data, user, record, student_code, indexed.get(record["code"], {})))
    return {"items": sorted(items, key=lambda a: a["due_at"]), "can_create": permitted(data, user, "create"),
            "can_review": not personal(user), "account_code": user["code"], "role": user.get("person_type"),
            "students": [{"code": s["code"], "name": name(s)} for s in rows(data, "students") if s["code"] in own_students(data, user)]}


@router.get("/{code}")
def detail(code: str, request: Request, student_code: str | None = None, user=Depends(current_user)):
    data = request.app.state.store.snapshot()
    record = get_assignment(data, code)
    result = present(data, user, record, student_code)
    if can_review(data, user, record):
        values = submissions(data, code)
        people = data["records"].get("students", {})
        result["students"] = [{"code": s, "name": name(people.get(s, {})), "admission_number": people.get(s, {}).get("admission_number"),
                              "submission": submission_public(data, values.get(s))} for s in record["recipient_student_codes"]]
    return result


class Submit(StrictModel):
    attachments: list[str] = Field(min_length=1, max_length=10)
    revision: int = Field(default=0, ge=0)


@router.post("/{code}/submit")
def submit(code: str, body: Submit, request: Request, user=Depends(current_user)):
    with request.app.state.store.transaction() as data:
        assignment = get_assignment(data, code)
        authorize(data, user, assignment)
        if user.get("person_type") != "student":
            raise HTTPException(403, "Only the student may upload their assignment")
        previous = submissions(data, code).get(user["person_code"])
        if previous and (previous.get("completed") or previous.get("marks") is not None):
            raise HTTPException(409, "Reviewed work is locked. Ask your teacher before replacing it.")
        if body.revision != (previous.get("revision", 0) if previous else 0):
            raise HTTPException(409, "Submission changed. Refresh before submitting.")
        late = datetime.fromisoformat(str(assignment["due_at"]).replace("Z", "+00:00")) < datetime.now(timezone.utc)
        if late and not assignment.get("allow_late", False):
            raise HTTPException(409, "This assignment is closed to late submissions")
        validate_files(data, body.attachments, user, code)
        key = previous["code"] if previous else new_code("ASUB")
        record = {"code": key, "assignment_code": code, "student_code": user["person_code"], "submitted_at": now(),
                  "attachments": body.attachments, "late": late, "completed": False, "marks": None, "feedback": "",
                  "revision": body.revision + 1}
        docs(data, "submissions")[key] = record
        for file in body.attachments:
            docs(data, "files")[file]["assignment_code"] = code
        audit(data, user["code"], "assignment_submit", "assignment_submissions", key)
        return submission_public(data, record)


class ReviewRow(StrictModel):
    student_code: str
    completed: bool
    marks: Decimal | None = Field(default=None, ge=0, decimal_places=2)
    feedback: str = Field(default="", max_length=2000)
    revision: int = Field(default=0, ge=0)


class Review(StrictModel):
    students: list[ReviewRow] = Field(min_length=1, max_length=5000)


@router.post("/{code}/review")
def review(code: str, body: Review, request: Request, background: BackgroundTasks, user=Depends(current_user)):
    notices = []
    with request.app.state.store.transaction() as data:
        assignment = get_assignment(data, code)
        staff(data, user, "edit")
        if not can_review(data, user, assignment):
            raise HTTPException(404, "Assignment not found")
        values = submissions(data, code)
        if len({r.student_code for r in body.students}) != len(body.students):
            raise HTTPException(422, "A student may occur only once in a review")
        for row in body.students:
            if row.student_code not in assignment["recipient_student_codes"]:
                raise HTTPException(422, "The student is not assigned this work")
            previous = values.get(row.student_code)
            if row.revision != (previous.get("revision", 0) if previous else 0):
                raise HTTPException(409, "A student submission changed. Refresh before reviewing.")
            if row.marks is not None and (not row.completed or row.marks > Decimal(str(assignment["max_marks"]))):
                raise HTTPException(422, "Mark work completed before grading; marks must not exceed the maximum")
            key = previous["code"] if previous else new_code("ASUB")
            record = {**(previous or {}), "code": key, "assignment_code": code, "student_code": row.student_code,
                      "completed": row.completed, "marks": str(row.marks) if row.marks is not None else None,
                      "feedback": row.feedback, "reviewed_by": user["code"], "reviewed_at": now(), "revision": row.revision + 1}
            docs(data, "submissions")[key] = record
            if row.completed and (not previous or not previous.get("completed") or previous.get("marks") != record["marks"]):
                notices += notifications(data, {row.student_code}, "Assignment reviewed: " + assignment["title"],
                                         (f"Marks: {record['marks']} / {assignment['max_marks']}. " if row.marks is not None else "") + "Open Assignments to see your feedback.", code)
        audit(data, user["code"], "assignment_review", "assignments", code)
    background.add_task(dispatch_push, request, notices)
    return detail(code, request, None, user)


class FileStart(StrictModel):
    filename: str = Field(min_length=1, max_length=180)
    size_bytes: int = Field(gt=0, le=MAX_FILE)
    assignment_code: str | None = None
    syllabus_code: str | None = None
    resource_upload: bool = False
    assessment_upload: bool = False
    event_upload: bool = False
    event_code: str | None = None


class FileChunk(StrictModel):
    index: int = Field(ge=0, le=39)
    content_base64: str = Field(max_length=350000)


@router.post("/files/start", status_code=201)
def start_file(body: FileStart, request: Request, user=Depends(current_user)):
    with request.app.state.store.transaction() as data:
        if sum((body.assessment_upload, bool(body.assignment_code), bool(body.syllabus_code), body.resource_upload, body.event_upload, bool(body.event_code))) > 1:
            raise HTTPException(422, "Choose one upload destination")
        if body.assessment_upload:
            from .assessment_workspace import require
            require(data, user, "create")
        elif body.event_upload:
            from .calendar_workspace import staff_can
            if not staff_can(data, user, "create"):
                raise HTTPException(403, "Calendar event publishing is not assigned to this role")
        elif body.event_code:
            from .calendar_workspace import authorize_event, get_event
            authorize_event(data, user, get_event(data, body.event_code))
        elif body.resource_upload:
            from .syllabus_workspace import staff_can
            if not staff_can(data, user, "create"):
                raise HTTPException(403, "Syllabus publishing is not assigned to this role")
        elif body.syllabus_code:
            from .syllabus_workspace import authorize_syllabus, get_syllabus
            syllabus = get_syllabus(data, body.syllabus_code)
            authorize_syllabus(data, user, syllabus)
            if personal(user):
                raise HTTPException(403, "Only staff can upload shared resources")
        elif body.assignment_code:
            assignment = get_assignment(data, body.assignment_code)
            authorize(data, user, assignment)
            if user.get("person_type") == "parent":
                raise HTTPException(403, "Only students submit their work")
        else:
            staff(data, user, "create")
        filename = Path(body.filename.replace("\\", "/")).name
        if Path(filename).suffix.lower() not in {".pdf", ".png", ".jpg", ".jpeg", ".webp"}:
            raise HTTPException(422, "Choose PDF, JPG, PNG or WebP files")
        code = new_code("AFILE")
        docs(data, "files")[code] = {"code": code, "owner": user["code"], "filename": filename,
            "size_bytes": body.size_bytes, "assignment_code": body.assignment_code,
            "syllabus_code": body.syllabus_code, "event_code": body.event_code,
            "assessment_upload": body.assessment_upload, "resource_upload": body.resource_upload, "event_upload": body.event_upload,
            "parts": {}, "ready": False, "created_at": now()}
        return {"code": code, "chunk_size": CHUNK_SIZE}


@router.post("/files/{code}/chunk")
def chunk_file(code: str, body: FileChunk, request: Request, user=Depends(current_user)):
    from app.modules.documents.files.api import file_transaction
    with file_transaction(request) as (data, pending):
        record = docs(data, "files").get(code)
        if not record or record["owner"] != user["code"]:
            raise HTTPException(404, "Upload not found")
        if record["ready"]:
            raise HTTPException(409, "Upload already finalized")
        try:
            raw = base64.b64decode(body.content_base64, validate=True)
        except (binascii.Error, ValueError):
            raise HTTPException(422, "Invalid file chunk") from None
        expected = min(CHUNK_SIZE, record["size_bytes"] - body.index * CHUNK_SIZE)
        if expected <= 0 or len(raw) != expected:
            raise HTTPException(422, "File chunk has an incorrect size")
        folder = "Assessments" if record.get("assessment_upload") else "Calendar" if record.get("event_upload") or record.get("event_code") else "Syllabus" if record.get("resource_upload") or record.get("syllabus_code") else "Assignments"
        key = f"{folder}/{code}/part-{body.index}-{new_code('P')}"
        request.app.state.files.put(key, raw, "application/octet-stream")
        pending.append(key)
        record["parts"][str(body.index)] = key
        return {"received": body.index}


@router.post("/files/{code}/finish")
def finish_file(code: str, request: Request, user=Depends(current_user)):
    from app.modules.documents.files.api import file_transaction
    with file_transaction(request) as (data, pending):
        record = docs(data, "files").get(code)
        if not record or record["owner"] != user["code"]:
            raise HTTPException(404, "Upload not found")
        if record["ready"]:
            return file_public(record)
        parts = (record["size_bytes"] + CHUNK_SIZE - 1) // CHUNK_SIZE
        if set(record["parts"]) != {str(i) for i in range(parts)}:
            raise HTTPException(422, "Upload all file parts before submitting")
        raw = b"".join(request.app.state.files.get(record["parts"][str(i)]) or b"" for i in range(parts))
        mime = "application/pdf" if raw.startswith(b"%PDF-") else "image/png" if raw.startswith(b"\x89PNG\r\n\x1a\n") else "image/jpeg" if raw.startswith(b"\xff\xd8\xff") else "image/webp" if raw.startswith(b"RIFF") and raw[8:12] == b"WEBP" else None
        if record.get("event_upload") or record.get("event_code"):
            mime = mime if mime in {"image/png", "image/jpeg", "image/webp"} else None
        if len(raw) != record["size_bytes"] or not mime:
            raise HTTPException(422, "Upload a valid PDF or supported image file")
        folder = "Assessments" if record.get("assessment_upload") else "Calendar" if record.get("event_upload") or record.get("event_code") else "Syllabus" if record.get("resource_upload") or record.get("syllabus_code") else "Assignments"
        key = f"{folder}/{code}/{new_code('FILE')}"
        request.app.state.files.put(key, raw, mime)
        pending.append(key)
        record.update(ready=True, storage_key=key, mime_type=mime, sha256=hashlib.sha256(raw).hexdigest(),
                      **(request.app.state.files.metadata(key) if hasattr(request.app.state.files, "metadata") else {"storage_provider": request.app.state.settings.file_storage}))
        old_parts = list(record.pop("parts").values())
        result = file_public(record)
    for key in old_parts:
        try:
            request.app.state.files.delete(key)
        except Exception:
            pass
    return result


@router.get("/files/{code}/view")
def view_file(code: str, request: Request, user=Depends(current_user)):
    from app.modules.documents.files.api import file_store
    data = request.app.state.store.snapshot()
    record = docs(data, "files").get(code)
    if not record or not record.get("ready"):
        raise HTTPException(404, "File not found")
    if record["owner"] != user["code"]:
        if record.get("assessment_code"):
            from .assessment_workspace import authorize, get
            assessment = get(data, record["assessment_code"])
            authorize(data, user, assessment)
            if code not in assessment.get("attachments", []):
                raise HTTPException(404, "File not found")
        elif record.get("syllabus_code"):
            from .syllabus_workspace import authorize_syllabus, get_syllabus
            syllabus = get_syllabus(data, record["syllabus_code"])
            authorize_syllabus(data, user, syllabus)
            if code not in syllabus.get("attachments", []):
                raise HTTPException(404, "File not found")
        elif record.get("event_code"):
            from .calendar_workspace import authorize_event, get_event
            event = get_event(data, record["event_code"])
            authorize_event(data, user, event)
            if code != event.get("image_code"):
                raise HTTPException(404, "File not found")
        else:
            assignment = get_assignment(data, record.get("assignment_code"))
            authorize(data, user, assignment)
            if code not in assignment.get("attachments", []):
                linked = [s for s in submissions(data, assignment["code"]).values() if code in s.get("attachments", [])]
                allowed = bool(linked) and (can_review(data, user, assignment) or any(s["student_code"] in own_students(data, user) for s in linked))
                if not allowed:
                    raise HTTPException(404, "File not found")
    raw = file_store(request, record).get(record["storage_key"])
    if raw is None:
        raise HTTPException(404, "File bytes are unavailable")
    return Response(raw, media_type=record["mime_type"], headers={"Content-Disposition": "inline", "X-Content-Type-Options": "nosniff"})


@router.get("/students/{student_code}/academics")
def student_academics(student_code: str, request: Request, user=Depends(current_user)):
    data = request.app.state.store.snapshot()
    if personal(user):
        own_students(data, user, student_code)
    else:
        staff(data, user)
    student = data["records"].get("students", {}).get(student_code)
    if not student:
        raise HTTPException(404, "Student not found")
    records = [a for a in all_assignments(data).values() if student_code in a["recipient_student_codes"]
               and (personal(user) or can_review(data, user, a))]
    if teaching(user) and not records:
        owned = {o["section_code"] for o in rows(data, "subject_offerings") if o["teacher_code"] in teacher_codes(data, user)}
        if not any(e["student_code"] == student_code and e["section_code"] in owned and e.get("status") == "active" for e in rows(data, "student_enrollments")):
            raise HTTPException(404, "Student not found")
    items, earned, possible = [], Decimal(0), Decimal(0)
    for assignment in records:
        value = submissions(data, assignment["code"]).get(student_code)
        if value and value.get("completed") and value.get("marks") is not None:
            earned += Decimal(str(value["marks"]))
            possible += Decimal(str(assignment["max_marks"]))
        items.append({"code": assignment["code"], "title": assignment["title"], "due_at": assignment["due_at"],
                      "max_marks": assignment["max_marks"], "submission": submission_public(data, value)})
    return {"student_code": student_code, "student_name": name(student), "items": sorted(items, key=lambda a: a["due_at"], reverse=True),
            "summary": {"assigned": len(items), "completed": sum(bool(i["submission"] and i["submission"].get("completed")) for i in items),
                        "marks": str(earned), "max_marks": str(possible), "percentage": str((earned / possible * 100).quantize(Decimal('0.01'))) if possible else None}}
