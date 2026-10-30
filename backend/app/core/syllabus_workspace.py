"""Shared, cohort-scoped syllabus and course resource center."""
from typing import Literal

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from pydantic import Field

from . import assignment_workspace as aw
from .security import StrictModel, current_user, has_permission, role_limit
from .storage import audit, new_code, now

router = APIRouter(prefix="/academics/syllabus-workspace", tags=["Syllabus and resources"])


def records(data, table):
    return list(data["records"].get(table, {}).values())


def items(data):
    return data.setdefault("documents", {}).setdefault("syllabus_records", {})


def staff_can(data, user, action="view"):
    if aw.personal(user):
        return False
    allowed = role_limit(data, user, "screens")
    screens = {"syllabus", "learning_resources"}
    if allowed is not None and not screens.intersection(allowed):
        return False
    if aw.teaching(user):
        return bool(aw.teacher_codes(data, user))
    return has_permission(data, user, "learning_resources", action) or has_permission(data, user, "syllabus", action)


def eligible(data, record):
    year = data["records"].get("academic_years", {}).get(record["academic_year_code"])
    if not year or year.get("program_code") != record["program_code"]:
        return set()
    try:
        return set(aw.roster(data, year["code"], record["program_code"])[2])
    except (KeyError, TypeError, ValueError):
        return set()


def authorized(data, user, record):
    if aw.personal(user):
        allowed = aw.own_students(data, user) & eligible(data, record)
        if not allowed:
            raise HTTPException(404, "Resource not found")
        return
    if not staff_can(data, user):
        raise HTTPException(404, "Resource not found")
    if aw.teaching(user):
        try:
            aw.teacher_scope(data, user, record["academic_year_code"], record["program_code"])
        except HTTPException:
            raise HTTPException(404, "Resource not found") from None


def get_syllabus(data, code):
    record = items(data).get(code)
    if not record:
        raise HTTPException(404, "Resource not found")
    return record


authorize_syllabus = authorized


def public_file(data, code):
    row = aw.docs(data, "files").get(code, {})
    return {key: row[key] for key in ("code", "filename", "mime_type", "size_bytes") if key in row}


def present(data, user, record):
    authorized(data, user, record)
    program = data["records"].get("programs", {}).get(record["program_code"], {})
    year = data["records"].get("academic_years", {}).get(record["academic_year_code"], {})
    return {**{key: record.get(key) for key in ("code", "syllabus_name", "description", "course_level", "specialization", "program_code", "academic_year_code", "created_by", "created_at")},
            "course_name": program.get("name", ""), "batch_name": year.get("name", ""),
            "attachments": [public_file(data, code) for code in record.get("attachments", []) if code in aw.docs(data, "files")],
            "can_manage": staff_can(data, user, "edit"), "student_count": len(eligible(data, record)) if not aw.personal(user) else None}


class SyllabusInput(StrictModel):
    course_level: Literal["intermediate", "degree"]
    program_code: str = Field(min_length=1, max_length=100)
    specialization: str = Field(min_length=1, max_length=160)
    academic_year_code: str = Field(min_length=1, max_length=100)
    syllabus_name: str = Field(min_length=1, max_length=200)
    description: str = Field(default="", max_length=10000)
    attachments: list[str] = Field(min_length=1, max_length=10)


@router.get("/options")
def options(request: Request, course_level: str | None = None, program_code: str | None = None, user=Depends(current_user)):
    data = request.app.state.store.snapshot()
    if not staff_can(data, user, "create"):
        raise HTTPException(403, "Syllabus publishing is not assigned to this role")
    years = records(data, "academic_years")
    owned_sections = {o["section_code"] for o in records(data, "subject_offerings") if o.get("teacher_code") in aw.teacher_codes(data, user)}
    owned_batches = {s["batch_code"] for s in records(data, "sections") if s["code"] in owned_sections}
    if aw.teaching(user):
        years = [y for y in years if any(b["code"] in owned_batches and b.get("program_code") == y.get("program_code") and
                    (b["code"] == y.get("batch_code") or b.get("academic_year_code") == y["code"] or
                     str(b.get("entry_year")) == str(y.get("start_date", ""))[:4] and str(b.get("graduation_year")) == str(y.get("end_date", ""))[:4]) for b in records(data, "batches"))]
    courses = [p for p in records(data, "programs") if p.get("course_level") in {"intermediate", "degree"}
               and (not course_level or p.get("course_level") == course_level)
               and (not program_code or p["code"] == program_code)
               and (not aw.teaching(user) or p["code"] in {y.get("program_code") for y in years})]
    return {"courses": [{"code": p["code"], "name": p["name"], "course_level": p["course_level"], "specialization": p.get("branch") or "General"} for p in courses],
            "academic_years": [{key: y.get(key) for key in ("code", "name", "program_code", "start_date", "end_date")} for y in years if not program_code or y.get("program_code") == program_code],
            "can_create": staff_can(data, user, "create")}


@router.get("")
def listing(request: Request, student_code: str | None = None, user=Depends(current_user)):
    data = request.app.state.store.snapshot()
    visible = []
    all_children = aw.own_students(data, user) if aw.personal(user) else set()
    children = aw.own_students(data, user, student_code) if aw.personal(user) and student_code else all_children
    for record in items(data).values():
        if aw.personal(user):
            if not children.intersection(eligible(data, record)):
                continue
        else:
            try:
                authorized(data, user, record)
            except HTTPException:
                continue
        visible.append(present(data, user, record))
    students = [{"code": s["code"], "name": aw.name(s)} for s in records(data, "students") if s["code"] in all_children]
    return {"items": sorted(visible, key=lambda x: x.get("created_at") or "", reverse=True),
            "can_create": staff_can(data, user, "create"), "students": students, "selected_student_code": student_code or user.get("person_code") if user.get("person_type") == "student" else student_code,
            "role": user.get("person_type")}


@router.post("", status_code=201)
def create(body: SyllabusInput, request: Request, background: BackgroundTasks, user=Depends(current_user)):
    notices = []
    with request.app.state.store.transaction() as data:
        if not staff_can(data, user, "create"):
            raise HTTPException(403, "Syllabus publishing is not assigned to this role")
        program = data["records"].get("programs", {}).get(body.program_code)
        if not program or program.get("course_level") != body.course_level:
            raise HTTPException(422, "Select a course from the chosen level")
        if (program.get("branch") or "General") != body.specialization:
            raise HTTPException(422, "Select the course specialization")
        year = data["records"].get("academic_years", {}).get(body.academic_year_code)
        if not year or year.get("program_code") != body.program_code:
            raise HTTPException(422, "Select an academic year belonging to this course")
        students = aw.teacher_scope(data, user, body.academic_year_code, body.program_code) if aw.teaching(user) else aw.roster(data, body.academic_year_code, body.program_code)[2]
        if not students:
            raise HTTPException(422, "No active students are enrolled in this academic year")
        files = aw.docs(data, "files")
        for code in body.attachments:
            file = files.get(code)
            if not file or not file.get("ready") or file.get("owner") != user["code"] or file.get("syllabus_code"):
                raise HTTPException(422, "Attach only files uploaded for this syllabus")
        code = new_code("SYL")
        record = {**body.model_dump(mode="json"), "code": code, "created_by": user["code"], "created_at": now()}
        items(data)[code] = record
        for attachment in body.attachments:
            files[attachment]["syllabus_code"] = code
        parents = {r["parent_code"] for r in records(data, "student_parents") if r["student_code"] in students and r.get("receives_notifications", True)}
        accounts = {a["code"] for a in data["accounts"].values() if a.get("active") and
                    ((a.get("person_type") == "student" and a.get("person_code") in students) or
                     (a.get("person_type") == "parent" and a.get("person_code") in parents))}
        for account in sorted(accounts):
            notice = new_code("SNOTICE")
            data["records"].setdefault("notifications", {})[notice] = {"code": notice, "user_code": account,
                "title": "New syllabus or learning resource", "body": body.syllabus_name + " is available to download.",
                "channel": "in_app", "status": "sent", "sent_at": now(), "syllabus_code": code}
            notices.append(notice)
        audit(data, user["code"], "syllabus_publish", "learning_resources", code)
        result = present(data, user, record)
    background.add_task(dispatch_resource_push, request, notices)
    return result


@router.get("/{code}")
def detail(code: str, request: Request, user=Depends(current_user)):
    data = request.app.state.store.snapshot()
    record = items(data).get(code)
    if not record:
        raise HTTPException(404, "Resource not found")
    return present(data, user, record)


def dispatch_resource_push(request, notice_codes):
    settings = request.app.state.settings
    if not (settings.push_adapter_url and settings.push_adapter_token):
        return
    from .integrations_api import adapter_post
    for code in notice_codes:
        with request.app.state.store.transaction() as data:
            record = data["records"]["notifications"][code]
            tokens = [d["token"] for d in records(data, "device_tokens") if d["user_code"] == record["user_code"]]
            payload = {"idempotency_key": code, "tokens": tokens, "title": record["title"], "body": record["body"],
                       "data": {"syllabus_code": record["syllabus_code"], "notification_code": code, "screen": "syllabus"}}
        if not tokens:
            continue
        try:
            accepted = adapter_post(settings.push_adapter_url, settings.push_adapter_token, payload).get("accepted") is True
        except Exception:
            accepted = False
        with request.app.state.store.transaction() as data:
            data["records"]["notifications"][code]["push_status"] = "accepted" if accepted else "failed"
