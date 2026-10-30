"""Audience aware academic calendar with image notifications."""
from datetime import datetime, timedelta, timezone
import hashlib
import hmac
from typing import Literal
from zoneinfo import ZoneInfo

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from fastapi.responses import Response
from pydantic import Field

from . import assignment_workspace as aw
from .security import StrictModel, current_user, has_permission, role_limit
from .storage import audit, new_code, now

router = APIRouter(prefix="/academics/calendar-workspace", tags=["Academic calendar workspace"])


def rows(data, table):
    return list(data["records"].get(table, {}).values())


def staff_can(data, user, action="view"):
    if aw.personal(user):
        return False
    allowed = role_limit(data, user, "screens")
    if allowed is not None and not {"calendar", "calendar_events"}.intersection(allowed):
        return False
    return has_permission(data, user, "calendar_events", action)


def programs_for_student(data, student):
    result = {r.get("program_code") for r in rows(data, "student_admission_profiles")
              if r.get("student_code") == student and r.get("program_code")}
    sections = {r["code"]: r for r in rows(data, "sections")}
    batches = {r["code"]: r for r in rows(data, "batches")}
    for enrollment in rows(data, "student_enrollments"):
        if enrollment.get("student_code") != student or enrollment.get("status") != "active":
            continue
        section = sections.get(enrollment.get("section_code"), {})
        batch = batches.get(section.get("batch_code"), {})
        if batch.get("program_code"):
            result.add(batch["program_code"])
    return result


def matches(data, event, student_codes):
    audience = event.get("audience_type", "all")
    code = event.get("audience_code")
    if audience == "all":
        return True
    programs = {p["code"]: p for p in rows(data, "programs")}
    for student in student_codes:
        own = [programs[p] for p in programs_for_student(data, student) if p in programs]
        if audience == "program" and code in {p["code"] for p in own}:
            return True
        if audience == "department" and code in {p.get("department_code") for p in own}:
            return True
        if audience in {"intermediate", "degree"} and audience in {p.get("course_level") for p in own}:
            return True
    return False


def personal_students(data, user):
    if user.get("person_type") == "student":
        return {user.get("person_code")}
    if user.get("person_type") == "parent":
        return {r["student_code"] for r in rows(data, "student_parents")
                if r.get("parent_code") == user.get("person_code")}
    return set()


def get_event(data, code):
    from app.modules.academics.calendar_events.api import query_get, TABLE
    from app.core.resources import display_rows
    row = query_get(data, code)
    return display_rows(data, TABLE, [row])[0]


def event_records(data):
    from app.modules.academics.calendar_events.api import query_list, TABLE
    from app.core.resources import display_rows
    return display_rows(data, TABLE, query_list(data))


def authorize_event(data, user, event):
    if aw.personal(user):
        if not matches(data, event, personal_students(data, user)):
            raise HTTPException(404, "Event not found")
    elif not staff_can(data, user):
        raise HTTPException(404, "Event not found")


def public_event(data, user, event):
    authorize_event(data, user, event)
    image = aw.docs(data, "files").get(event.get("image_code"), {})
    return {**event, "image": {k: image[k] for k in ("code", "filename", "mime_type", "size_bytes") if k in image} if image else None,
            "can_manage": staff_can(data, user, "edit")}


class EventInput(StrictModel):
    title: str = Field(min_length=1, max_length=200)
    starts_at: datetime
    ends_at: datetime | None = None
    event_type: Literal["holiday", "academic", "cultural", "sports", "meeting"]
    place: str = Field(default="", max_length=200)
    short_description: str = Field(min_length=1, max_length=300)
    description: str = Field(default="", max_length=10000)
    audience_type: Literal["all", "department", "intermediate", "degree", "program"] = "all"
    audience_code: str | None = None
    image_code: str | None = None


@router.get("/options")
def options(request: Request, user=Depends(current_user)):
    data = request.app.state.store.snapshot()
    if not staff_can(data, user, "create"):
        raise HTTPException(403, "Calendar event creation is not assigned to this role")
    departments = sorted(rows(data, "departments"), key=lambda row: str(row.get("name") or "").casefold())
    return {"departments": [{"code": r["code"], "name": r["name"]} for r in departments],
            "courses": [{"code": r["code"], "name": r["name"], "department_code": r.get("department_code"),
                         "course_level": r.get("course_level"), "specialization": r.get("branch") or "General"}
                        for r in rows(data, "programs") if r.get("course_level") in {"intermediate", "degree"}],
            "event_types": ["holiday", "academic", "cultural", "sports", "meeting"], "can_create": True}


@router.get("")
def listing(request: Request, student_code: str | None = None, user=Depends(current_user)):
    data = request.app.state.store.snapshot()
    if not aw.personal(user) and not staff_can(data, user):
        raise HTTPException(403, "Calendar access is not assigned to this role")
    all_students = personal_students(data, user)
    if student_code and student_code not in all_students:
        raise HTTPException(404, "Student not found")
    students = {student_code} if student_code else all_students
    result = []
    for event in event_records(data):
        if aw.personal(user) and not matches(data, event, students):
            continue
        result.append(public_event(data, user, event))
    result.sort(key=lambda r: r.get("starts_at") or "")
    children = [{"code": r["code"], "name": aw.name(r)} for r in rows(data, "students") if r["code"] in all_students]
    return {"items": result, "can_create": staff_can(data, user, "create"), "students": children,
            "role": user.get("person_type")}


@router.post("", status_code=201)
def create(body: EventInput, request: Request, background: BackgroundTasks, user=Depends(current_user)):
    settings = request.app.state.settings
    notices = []
    with request.app.state.store.transaction() as data:
        if not staff_can(data, user, "create"):
            raise HTTPException(403, "Calendar event creation is not assigned to this role")
        starts = body.starts_at
        ends = body.ends_at or starts
        if starts.tzinfo is None or ends.tzinfo is None or ends < starts:
            raise HTTPException(422, "Choose a valid end date on or after the start date")
        campuses = rows(data, "campuses")
        if not campuses:
            raise HTTPException(422, "Add a campus record before publishing calendar events")
        departments = {d["code"] for d in rows(data, "departments")}
        programs = {p["code"]: p for p in rows(data, "programs")}
        if body.audience_type == "department" and body.audience_code not in departments:
            raise HTTPException(422, "Select a valid department")
        if body.audience_type == "program" and body.audience_code not in programs:
            raise HTTPException(422, "Select a valid course specialization")
        if body.audience_type == "program" and programs[body.audience_code].get("course_level") not in {"intermediate", "degree"}:
            raise HTTPException(422, "Select an intermediate or degree course")
        image = None
        if body.image_code:
            image = aw.docs(data, "files").get(body.image_code)
            if not image or not image.get("ready") or image.get("owner") != user["code"] or image.get("event_upload") is not True or image.get("mime_type") not in {"image/png", "image/jpeg", "image/webp"}:
                raise HTTPException(422, "Choose an uploaded event image")
        code = new_code("EVT")
        record = {"code": code, "campus_code": campuses[0]["code"], "title": body.title.strip(),
                  "starts_at": starts.isoformat(), "ends_at": ends.isoformat(), "event_type": body.event_type,
                  "place": body.place.strip(), "short_description": body.short_description.strip(),
                  "description": body.description.strip(), "audience_type": body.audience_type,
                  "audience_code": body.audience_code, "image_code": body.image_code,
                  "created_by": user["code"], "created_at": now()}
        from app.modules.academics.calendar_events.api import query_save
        query_save(data, record)
        if image:
            image["event_code"] = code
        students = {s["code"] for s in rows(data, "students") if s.get("status") == "active"}
        recipients = {s for s in students if matches(data, record, {s})}
        parents = {r["parent_code"] for r in rows(data, "student_parents") if r.get("student_code") in recipients and r.get("receives_notifications", True)}
        accounts = {a["code"] for a in data["accounts"].values() if a.get("active") and
                    ((a.get("person_type") == "student" and a.get("person_code") in recipients) or
                     (a.get("person_type") == "parent" and a.get("person_code") in parents))}
        for account in sorted(accounts):
            notice = new_code("CNOTICE")
            data["records"].setdefault("notifications", {})[notice] = {"code": notice, "user_code": account,
                "title": "Upcoming event: " + record["title"],
                "body": record["short_description"] + " · " + starts.astimezone(ZoneInfo("Asia/Kolkata")).strftime("%d %b %Y") + (" · " + record["place"] if record["place"] else ""),
                "channel": "in_app", "status": "sent", "sent_at": now(), "calendar_event_code": code}
            notices.append(notice)
        audit(data, user["code"], "calendar_event_create", "calendar_events", code)
        result = public_event(data, user, record)
    if notices:
        background.add_task(dispatch_push, request, notices)
    return result


@router.get("/{code}")
def detail(code: str, request: Request, user=Depends(current_user)):
    data = request.app.state.store.snapshot()
    return public_event(data, user, get_event(data, code))


def image_signature(settings, file_code, expires):
    message = f"calendar-image:{file_code}:{expires}".encode()
    return hmac.new(settings.jwt_secret.encode(), message, hashlib.sha256).hexdigest()


@router.get("/images/{file_code}")
def public_event_image(file_code: str, expires: int, signature: str, request: Request):
    if expires < int(datetime.now(timezone.utc).timestamp()) or not hmac.compare_digest(
        image_signature(request.app.state.settings, file_code, expires), signature
    ):
        raise HTTPException(404, "Event image not found")
    data = request.app.state.store.snapshot()
    image = aw.docs(data, "files").get(file_code)
    if not image or not image.get("ready") or not image.get("event_code"):
        raise HTTPException(404, "Event image not found")
    event = get_event(data, image["event_code"])
    if event.get("image_code") != file_code:
        raise HTTPException(404, "Event image not found")
    from app.modules.documents.files.api import file_store
    raw = file_store(request, image).get(image["storage_key"])
    if raw is None:
        raise HTTPException(404, "Event image not found")
    return Response(raw, media_type=image["mime_type"], headers={
        "Cache-Control": f"public, max-age={max(0, min(expires - int(datetime.now(timezone.utc).timestamp()), 604800))}",
        "X-Content-Type-Options": "nosniff",
    })


def dispatch_push(request, codes):
    settings = request.app.state.settings
    if not (settings.push_adapter_url and settings.push_adapter_token):
        return
    from .integrations_api import adapter_post
    for code in codes:
        with request.app.state.store.transaction() as data:
            record = data["records"]["notifications"][code]
            tokens = [d["token"] for d in rows(data, "device_tokens") if d["user_code"] == record["user_code"]]
            event = get_event(data, record["calendar_event_code"])
            image = aw.docs(data, "files").get(event.get("image_code"), {})
            image_url = None
            if image.get("storage_key"):
                expires = max(int((datetime.now(timezone.utc) + timedelta(days=1)).timestamp()),
                              int(datetime.fromisoformat(str(event["ends_at"]).replace("Z", "+00:00")).timestamp()) + 86400)
                signature = image_signature(settings, image["code"], expires)
                base = settings.public_api_url.rstrip("/")
                if base.startswith(("http://localhost", "http://127.0.0.1")):
                    base = str(request.base_url).rstrip("/")
                image_url = f"{base}/api/v1/academics/calendar-workspace/images/{image['code']}?expires={expires}&signature={signature}"
            payload = {"idempotency_key": code, "tokens": tokens, "title": record["title"], "body": record["body"],
                       "image": image_url, "image_url": image_url,
                       "send_at": event.get("starts_at"),
                       "data": {"calendar_event_code": event["code"], "notification_code": code, "screen": "calendar"}}
        if not tokens:
            continue
        try:
            accepted = adapter_post(settings.push_adapter_url, settings.push_adapter_token, payload).get("accepted") is True
        except Exception:
            accepted = False
        with request.app.state.store.transaction() as data:
            data["records"]["notifications"][code]["push_status"] = "accepted" if accepted else "failed"
