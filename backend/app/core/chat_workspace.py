"""Chats: WhatsApp-style one-to-one and group conversations for the dashboard and both apps.

Who may start a chat with whom:
* students and parents  -> the teachers of their (children's) classes; never other students;
* teachers / staff      -> every staff member, the students of their classes and those students' parents;
* administrators        -> everyone (students, parents, staff); they can also open groups for a
  course, branch (specialisation), academic year or section, for students, parents or both.
Teachers can open groups for the sections they teach. In groups only staff post; students and
parents read them (so there is no student-to-student chat anywhere).

Messages carry text and/or one attachment (photo, PDF or voice note) uploaded with the shared
chunked upload API (``POST /academics/assignment-workspace/files/start`` with ``chat_thread_code``).
Data lives in ``message_threads``, ``thread_members`` and ``messages``; extra fields (kind, title,
read position, attachment) are kept with each record.

Endpoints (all under ``/api/v1/chat``): ``GET /conversations``, ``GET /unread``,
``GET /directory``, ``GET /options``, ``POST /direct``, ``POST /groups``,
``GET /conversations/{code}``, ``GET /conversations/{code}/messages``,
``POST /conversations/{code}/messages``, ``POST /conversations/{code}/read``,
``GET /attachments/{file_code}``.
"""
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request
from fastapi.responses import Response
from pydantic import Field

from . import assignment_workspace as aw
from .security import StrictModel, current_user, has_permission
from .storage import audit, new_code, now

router = APIRouter(prefix="/chat", tags=["Chat"])
STAFF_SIDES = {"admin", "teacher"}
PREVIEW = {"image": "📷 Photo", "pdf": "📄 Document", "audio": "🎤 Voice message"}


# ---- People ---------------------------------------------------------------------------------
def is_admin(data, user):
    if user.get("person_type") == "system":
        return True
    if user.get("person_type") != "employee" or aw.teaching(user):
        return False
    roles = [data["roles"].get(r, {}) for r in data["accounts"].get(user["code"], {}).get("role_codes", [])]
    return any(r.get("system_admin") for r in roles) or any(
        has_permission(data, user, screen, "create") for screen in ("messages", "notifications", "announcements"))


def side(data, user):
    kind = user.get("person_type")
    if kind in {"student", "parent"}:
        return kind
    return "admin" if is_admin(data, user) else "teacher"


def account_person(data, account):
    table = {"student": "students", "parent": "parents", "employee": "employees"}.get(account.get("person_type"))
    return data["records"].get(table, {}).get(account.get("person_code"), {}) if table else {}


def display_name(data, account):
    person = account_person(data, account)
    return " ".join(aw.name(person).split()) or account.get("login_id") or account.get("code") or "Someone"


def employee_teacher_codes(data, employee_code):
    return {t["code"] for t in aw.rows(data, "teachers") if t.get("employee_code") == employee_code}


def active_sections(data, student_codes):
    return {e["section_code"] for e in aw.rows(data, "student_enrollments")
            if e.get("student_code") in student_codes and e.get("status") == "active"}


def children(data, parent_code):
    return {r["student_code"] for r in aw.rows(data, "student_parents") if r.get("parent_code") == parent_code}


def teacher_sections(data, employee_code):
    teachers = employee_teacher_codes(data, employee_code)
    return {o["section_code"] for o in aw.rows(data, "subject_offerings") if o.get("teacher_code") in teachers}


def section_students(data, sections):
    return {e["student_code"] for e in aw.rows(data, "student_enrollments")
            if e.get("section_code") in sections and e.get("status") == "active"}


def parents_of(data, students):
    return {r["parent_code"] for r in aw.rows(data, "student_parents") if r.get("student_code") in students}


def student_place(data, student_code):
    """Course, academic year and section names of a student (for labels and group filters)."""
    from .student_leave_workspace import student_context
    return student_context(data, student_code)


def allowed_people(data, user):
    """(person_type, person_code) pairs the user may start a one-to-one chat with; None = everyone."""
    who = side(data, user)
    if who == "admin":
        return None
    if who in {"student", "parent"}:
        students = {user["person_code"]} if who == "student" else children(data, user["person_code"])
        sections = active_sections(data, students)
        teachers = {o["teacher_code"] for o in aw.rows(data, "subject_offerings") if o.get("section_code") in sections}
        return {("employee", t["employee_code"]) for t in aw.rows(data, "teachers") if t["code"] in teachers}
    students = section_students(data, teacher_sections(data, user["person_code"]))
    people = {("student", s) for s in students} | {("parent", p) for p in parents_of(data, students)}
    people |= {("employee", e["code"]) for e in aw.rows(data, "employees") if e.get("status", "active") == "active"}
    return people


def account_role(data, account):
    if account.get("person_type") != "employee":
        return account.get("person_type") or "staff"
    employee = data["records"].get("employees", {}).get(account.get("person_code"), {})
    if employee_teacher_codes(data, employee.get("code")) or employee.get("employee_type") == "teacher":
        return "teacher"
    return "staff"


def describe(data, account, viewer_students=None):
    """Second line under a name: subjects taught, a student's class, or a parent's children."""
    kind = account.get("person_type")
    person = account_person(data, account)
    if kind == "employee":
        teachers = employee_teacher_codes(data, person.get("code"))
        offerings = [o for o in aw.rows(data, "subject_offerings") if o.get("teacher_code") in teachers]
        if viewer_students is not None:
            sections = active_sections(data, viewer_students)
            offerings = [o for o in offerings if o.get("section_code") in sections] or offerings
        subjects = sorted({data["records"].get("subjects", {}).get(o["subject_code"], {}).get("name", o["subject_code"])
                           for o in offerings})
        title = person.get("designation") or ("Teacher" if subjects else "Staff")
        return f"{title} · {', '.join(subjects[:3])}" if subjects else title
    if kind == "student":
        place = student_place(data, person.get("code"))
        roll = roll_number(data, person.get("code"))
        bits = [person.get("admission_number"), roll and f"Roll {roll}", place.get("course_name"),
                place.get("section_name") and f"Section {place['section_name']}"]
        return "Student · " + " · ".join(b for b in bits if b)
    if kind == "parent":
        kids = [data["records"].get("students", {}).get(s, {}) for s in sorted(children(data, person.get("code")))]
        names = ", ".join(" ".join(aw.name(k).split()) for k in kids if k)
        return f"Parent of {names}" if names else "Parent"
    return "Administrator"


def roll_number(data, student_code):
    return next((e.get("roll_number") for e in aw.rows(data, "student_enrollments")
                 if e.get("student_code") == student_code and e.get("status") == "active" and e.get("roll_number")), None)


def contact(data, account, viewer_students=None):
    return {"code": account["code"], "name": display_name(data, account), "role": account_role(data, account),
            "detail": describe(data, account, viewer_students)}


def can_message(data, user, account):
    if not account or not account.get("active") or account["code"] == user["code"]:
        return False
    if user.get("person_type") in {"student", "parent"} and account.get("person_type") in {"student", "parent"}:
        return False  # families talk to staff only
    people = allowed_people(data, user)
    if people is None:
        return account.get("person_type") in {"student", "parent", "employee", "system"}
    return (account.get("person_type"), account.get("person_code")) in people


# ---- Threads --------------------------------------------------------------------------------
def members(data, thread_code):
    return [m for m in aw.rows(data, "thread_members") if m.get("thread_code") == thread_code]


def membership(data, user, thread_code):
    member = next((m for m in members(data, thread_code) if m.get("user_code") == user["code"]), None)
    if not member:
        raise HTTPException(404, "Conversation not found")
    return member


def thread_kind(data, thread):
    return thread.get("kind") or ("direct" if len(members(data, thread["code"])) <= 2 else "group")


def can_post(data, user, thread):
    if thread_kind(data, thread) == "direct" or thread.get("posting") == "all":
        return True
    return side(data, user) in STAFF_SIDES


def thread_messages(data, thread_code):
    return sorted((m for m in aw.rows(data, "messages") if m.get("thread_code") == thread_code and not m.get("deleted_at")),
                  key=lambda m: str(m.get("sent_at") or ""))


def preview(message):
    text = str(message.get("body") or "").strip()
    if message.get("kind") in PREVIEW:
        label = PREVIEW[message["kind"]]
        if message.get("kind") == "pdf" and message.get("attachment_name"):
            label = f"📄 {message['attachment_name']}"
        return f"{label} {text}".strip() if text and message["kind"] != "audio" else label
    return text


def conversation(data, user, thread, mine=None, messages=None):
    mine = mine or membership(data, user, thread["code"])
    everyone = members(data, thread["code"])
    accounts = data["accounts"]
    kind = thread_kind(data, thread)
    others = [accounts.get(m["user_code"], {"code": m["user_code"]}) for m in everyone if m["user_code"] != user["code"]]
    messages = thread_messages(data, thread["code"]) if messages is None else messages
    last = messages[-1] if messages else None
    seen = str(mine.get("last_read_at") or "")
    unread = sum(1 for m in messages if m.get("sender_code") != user["code"] and str(m.get("sent_at") or "") > seen)
    if kind == "direct":
        other = others[0] if others else {}
        title, subtitle, role = display_name(data, other), describe(data, other) if other.get("person_type") else "", account_role(data, other)
    else:
        title = thread.get("title") or thread.get("subject") or "Group"
        subtitle = thread.get("description") or f"{len(everyone)} members"
        role = "group"
    last_sender = ""
    if last and kind == "group":
        last_sender = "You" if last.get("sender_code") == user["code"] else display_name(data, accounts.get(last.get("sender_code"), {})).split(" ")[0]
    return {"code": thread["code"], "kind": kind, "title": title, "subtitle": subtitle, "role": role,
            "subject": thread.get("subject") if kind == "direct" and thread.get("subject") not in {None, "", "Chat"} else None,
            "members": len(everyone), "can_post": can_post(data, user, thread),
            "last_message": preview(last) if last else "", "last_sender": last_sender,
            "last_mine": bool(last and last.get("sender_code") == user["code"]),
            "last_at": (last or {}).get("sent_at") or thread.get("created_at"), "unread": unread,
            "with_code": others[0].get("code") if kind == "direct" and others else None}


def my_threads(data, user):
    codes = {m["thread_code"]: m for m in aw.rows(data, "thread_members") if m.get("user_code") == user["code"]}
    threads = data["records"].get("message_threads", {})
    return [(threads[c], m) for c, m in codes.items() if c in threads]


@router.get("/conversations")
def list_conversations(request: Request, user=Depends(current_user)):
    ensure_year_groups(request)
    data = request.app.state.store.snapshot()
    by_thread = {}
    for message in aw.rows(data, "messages"):
        if not message.get("deleted_at"):
            by_thread.setdefault(message.get("thread_code"), []).append(message)
    items = []
    for thread, mine in my_threads(data, user):
        messages = sorted(by_thread.get(thread["code"], []), key=lambda m: str(m.get("sent_at") or ""))
        if not messages and thread.get("created_by_code") != user["code"] and not thread.get("auto_year"):
            continue
        items.append(conversation(data, user, thread, mine, messages))
    items.sort(key=lambda c: str(c.get("last_at") or ""), reverse=True)
    who = side(data, user)
    return {"items": items, "unread": sum(c["unread"] for c in items), "me": {"code": user["code"], "side": who},
            "can_create_groups": who in STAFF_SIDES}


@router.get("/unread")
def unread(request: Request, user=Depends(current_user)):
    data = request.app.state.store.snapshot()
    seen = {m["thread_code"]: str(m.get("last_read_at") or "") for m in aw.rows(data, "thread_members")
            if m.get("user_code") == user["code"]}
    count = sum(1 for m in aw.rows(data, "messages") if m.get("thread_code") in seen and not m.get("deleted_at")
                and m.get("sender_code") != user["code"] and str(m.get("sent_at") or "") > seen[m["thread_code"]])
    return {"unread": count}


@router.get("/conversations/{code}")
def get_conversation(code: str, request: Request, user=Depends(current_user)):
    data = request.app.state.store.snapshot()
    thread = data["records"].get("message_threads", {}).get(code)
    if not thread:
        raise HTTPException(404, "Conversation not found")
    result = conversation(data, user, thread)
    if result["kind"] == "group":
        result["people"] = [contact(data, data["accounts"][m["user_code"]]) for m in members(data, code)
                            if m["user_code"] in data["accounts"]][:300]
    return result


def message_view(data, user, message, everyone):
    others = [m for m in everyone if m["user_code"] != message.get("sender_code")]
    read_by = sum(1 for m in others if str(m.get("last_read_at") or "") >= str(message.get("sent_at") or ""))
    sender = data["accounts"].get(message.get("sender_code"), {})
    attachment = None
    if message.get("attachment_code"):
        attachment = {"code": message["attachment_code"], "name": message.get("attachment_name"),
                      "mime": message.get("attachment_mime"), "size": message.get("attachment_size"),
                      "duration_ms": message.get("duration_ms"), "url": f"/chat/attachments/{message['attachment_code']}"}
    mine = message.get("sender_code") == user["code"]
    return {"code": message["code"], "body": message.get("body") or "", "kind": message.get("kind") or "text",
            "sent_at": message.get("sent_at"), "mine": mine, "sender_code": message.get("sender_code"),
            "sender_name": "You" if mine else display_name(data, sender), "sender_role": account_role(data, sender),
            "attachment": attachment, "client_id": message.get("client_id"),
            "status": ("read" if others and read_by >= len(others) else "delivered") if mine else None,
            "read_by": read_by if mine else None}


@router.get("/conversations/{code}/messages")
def list_messages(code: str, request: Request, user=Depends(current_user), after: str | None = Query(default=None, max_length=40),
                  before: str | None = Query(default=None, max_length=40), limit: int = Query(default=60, ge=1, le=200),
                  mark_read: bool = True):
    def build(data):
        membership(data, user, code)
        everyone = members(data, code)
        messages = thread_messages(data, code)
        if after:
            messages = [m for m in messages if str(m.get("sent_at") or "") > after]
        if before:
            messages = [m for m in messages if str(m.get("sent_at") or "") < before]
        more = len(messages) > limit and not after
        messages = messages[-limit:]
        return {"items": [message_view(data, user, m, everyone) for m in messages], "has_more": more,
                "read_marks": {m["user_code"]: m.get("last_read_at") for m in everyone if m["user_code"] != user["code"]}
                if len(everyone) <= 2 else None}

    data = request.app.state.store.snapshot()
    result = build(data)
    member = membership(data, user, code)
    newest = max((m["sent_at"] for m in result["items"] if not m["mine"]), default="")
    if mark_read and newest and str(member.get("last_read_at") or "") < newest:
        mark(request, user, code)
    return result


def mark(request, user, code):
    with request.app.state.store.transaction() as data:
        member = membership(data, user, code)
        member["last_read_at"] = now()
        for notice in aw.rows(data, "notifications"):
            if notice.get("user_code") == user["code"] and notice.get("thread_code") == code and notice.get("status") != "read":
                notice["status"] = "read"
        return member["last_read_at"]


@router.post("/conversations/{code}/read")
def read(code: str, request: Request, user=Depends(current_user)):
    return {"last_read_at": mark(request, user, code)}


class SendInput(StrictModel):
    body: str = Field(default="", max_length=4000)
    attachment_code: str | None = Field(default=None, max_length=80)
    duration_ms: int | None = Field(default=None, ge=0, le=15 * 60 * 1000)
    client_id: str | None = Field(default=None, max_length=80)


def kind_of(mime):
    mime = str(mime or "")
    return "image" if mime.startswith("image/") else "audio" if mime.startswith("audio/") else "pdf" if mime == "application/pdf" else None


def notify(data, user, thread, message):
    sender = display_name(data, data["accounts"].get(user["code"], user))
    kind = thread_kind(data, thread)
    title = sender if kind == "direct" else f"{sender} · {thread.get('title') or thread.get('subject') or 'Group'}"
    notices = []
    for member in members(data, thread["code"]):
        if member["user_code"] == user["code"] or member.get("muted"):
            continue
        code = new_code("MNOTICE")
        data["records"].setdefault("notifications", {})[code] = {
            "code": code, "user_code": member["user_code"], "title": title, "body": preview(message)[:160] or "New message",
            "channel": "in_app", "status": "sent", "sent_at": now(), "screen": "messages", "thread_code": thread["code"],
            "kind": "chat", "sender_name": sender, "conversation_title": None if kind == "direct" else (thread.get("title") or thread.get("subject"))}
        notices.append(code)
    return notices


@router.post("/conversations/{code}/messages", status_code=201)
def send(code: str, body: SendInput, request: Request, background: BackgroundTasks, user=Depends(current_user)):
    text = body.body.strip()
    if not text and not body.attachment_code:
        raise HTTPException(422, "Type a message or attach a file")
    with request.app.state.store.transaction() as data:
        thread = data["records"].get("message_threads", {}).get(code)
        if not thread:
            raise HTTPException(404, "Conversation not found")
        membership(data, user, code)
        if not can_post(data, user, thread):
            raise HTTPException(403, "Only staff can post in this group")
        if body.client_id:
            existing = next((m for m in thread_messages(data, code) if m.get("client_id") == body.client_id
                             and m.get("sender_code") == user["code"]), None)
            if existing:
                return message_view(data, user, existing, members(data, code))
        message = {"code": new_code("MSG"), "thread_code": code, "sender_code": user["code"], "body": text, "sent_at": now(),
                   "kind": "text", "client_id": body.client_id}
        if body.attachment_code:
            upload = aw.docs(data, "files").get(body.attachment_code)
            if not upload or upload.get("owner") != user["code"] or not upload.get("ready") or upload.get("chat_thread_code") != code:
                raise HTTPException(422, "Attachment not found; upload it again")
            if upload.get("message_code"):
                raise HTTPException(409, "This attachment was already sent")
            kind = kind_of(upload.get("mime_type"))
            if not kind:
                raise HTTPException(422, "Send photos, PDFs or voice notes")
            upload["message_code"] = message["code"]
            message.update(kind=kind, attachment_code=upload["code"], attachment_name=upload.get("filename"),
                           attachment_mime=upload.get("mime_type"), attachment_size=upload.get("size_bytes"),
                           duration_ms=body.duration_ms if kind == "audio" else None)
        data["records"].setdefault("messages", {})[message["code"]] = message
        mine = membership(data, user, code)
        mine["last_read_at"] = message["sent_at"]
        thread["last_message_at"] = message["sent_at"]
        notices = notify(data, user, thread, message)
        audit(data, user["code"], "chat_message", "messages", message["code"])
        result = message_view(data, user, message, members(data, code))
    if notices:
        from .certificate_workspace import push
        background.add_task(push, request, notices)
    return result


# ---- Starting chats -------------------------------------------------------------------------
def new_thread(data, user, kind, title, member_codes, **extra):
    code = new_code("THREAD")
    data["records"].setdefault("message_threads", {})[code] = {
        "code": code, "subject": title[:200] or "Chat", "created_by_code": user["code"], "kind": kind, "title": title[:200],
        "created_at": now(), **extra}
    for account in dict.fromkeys([user["code"], *member_codes]):
        member = new_code("TM")
        data["records"].setdefault("thread_members", {})[member] = {
            "code": member, "thread_code": code, "user_code": account, "role": "admin" if account == user["code"] else "member",
            "joined_at": now()}
    return data["records"]["message_threads"][code]


class DirectInput(StrictModel):
    recipient_user_code: str = Field(min_length=1, max_length=80)


@router.post("/direct")
def start_direct(body: DirectInput, request: Request, user=Depends(current_user)):
    with request.app.state.store.transaction() as data:
        account = data["accounts"].get(body.recipient_user_code)
        if not can_message(data, user, account):
            raise HTTPException(403, "You can't start a chat with this person")
        pair = {user["code"], account["code"]}
        threads = data["records"].get("message_threads", {})
        by_thread = {}
        for m in aw.rows(data, "thread_members"):
            by_thread.setdefault(m["thread_code"], set()).add(m["user_code"])
        existing = next((threads[c] for c, people in by_thread.items() if people == pair and c in threads
                         and thread_kind(data, threads[c]) == "direct"), None)
        thread = existing or new_thread(data, user, "direct", "Chat", [account["code"]])
        if not existing:
            audit(data, user["code"], "chat_start", "message_threads", thread["code"])
        return conversation(data, user, thread)


class GroupInput(StrictModel):
    title: str = Field(default="", max_length=120)
    course_level: str | None = Field(default=None, max_length=80)
    program_code: str | None = Field(default=None, max_length=60)
    academic_year_code: str | None = Field(default=None, max_length=60)
    section_code: str | None = Field(default=None, max_length=60)
    audience: str = Field(default="both", pattern="^(students|parents|both)$")
    include_teachers: bool = True
    allow_replies: bool = False


def placement(data):
    """student_code -> (course_level, program_code, academic_year_code, section_code)."""
    records = data["records"]
    profiles = {p.get("student_code"): p for p in aw.rows(data, "student_admission_profiles")}
    result = {}
    for e in aw.rows(data, "student_enrollments"):
        if e.get("status") != "active":
            continue
        section = records.get("sections", {}).get(e.get("section_code"), {})
        batch = records.get("batches", {}).get(section.get("batch_code"), {})
        profile = profiles.get(e["student_code"], {})
        program = batch.get("program_code") or profile.get("program_code")
        year = batch.get("academic_year_code") or profile.get("academic_year_code")
        level = records.get("programs", {}).get(program, {}).get("course_level")
        result[e["student_code"]] = (level, program, year, e.get("section_code"))
    return result


@router.post("/groups", status_code=201)
def create_group(body: GroupInput, request: Request, user=Depends(current_user)):
    with request.app.state.store.transaction() as data:
        who = side(data, user)
        if who not in STAFF_SIDES:
            raise HTTPException(403, "Only staff can create groups")
        if not any((body.course_level, body.program_code, body.academic_year_code, body.section_code)):
            raise HTTPException(422, "Choose a course, branch, academic year or section")
        if who == "teacher":
            mine = teacher_sections(data, user["person_code"])
            if not body.section_code or body.section_code not in mine:
                raise HTTPException(403, "Teachers can create groups for the sections they teach")
        places = placement(data)
        students = {s for s, (level, program, year, section) in places.items()
                    if (not body.course_level or level == body.course_level) and (not body.program_code or program == body.program_code)
                    and (not body.academic_year_code or year == body.academic_year_code)
                    and (not body.section_code or section == body.section_code)}
        if not students:
            raise HTTPException(409, "No students match this selection")
        people = set()
        if body.audience in {"students", "both"}:
            people |= {("student", s) for s in students}
        if body.audience in {"parents", "both"}:
            people |= {("parent", p) for p in parents_of(data, students)}
        if body.include_teachers:
            sections = {places[s][3] for s in students}
            teachers = {o["teacher_code"] for o in aw.rows(data, "subject_offerings") if o.get("section_code") in sections}
            people |= {("employee", t["employee_code"]) for t in aw.rows(data, "teachers") if t["code"] in teachers}
        accounts = [a["code"] for a in data["accounts"].values() if a.get("active") and a["code"] != user["code"]
                    and (a.get("person_type"), a.get("person_code")) in people]
        if not accounts:
            raise HTTPException(409, "Nobody in this selection has an app login yet")
        records = data["records"]
        names = [records.get("programs", {}).get(body.program_code, {}).get("name") if body.program_code else body.course_level,
                 records.get("academic_years", {}).get(body.academic_year_code, {}).get("name") if body.academic_year_code else None,
                 f"Section {records.get('sections', {}).get(body.section_code, {}).get('name', body.section_code)}" if body.section_code else None]
        label = " · ".join(n for n in names if n)
        audience = {"students": "Students", "parents": "Parents", "both": "Students & parents"}[body.audience]
        title = body.title.strip() or f"{label} — {audience}"
        thread = new_thread(data, user, "group", title, accounts, description=f"{audience} · {label}",
                            posting="all" if body.allow_replies else "staff",
                            audience={k: getattr(body, k) for k in ("course_level", "program_code", "academic_year_code", "section_code", "audience")})
        audit(data, user["code"], "chat_group", "message_threads", thread["code"])
        return conversation(data, user, thread)


# ---- Academic-year groups -------------------------------------------------------------------
def admin_accounts(data):
    """Active staff accounts with college-wide messaging rights (they join every year group)."""
    result = set()
    for account in data["accounts"].values():
        if not account.get("active") or account.get("person_type") not in {"employee", "system"}:
            continue
        roles = [data["roles"].get(r, {}) for r in account.get("role_codes", [])]
        if any(r.get("system_admin") or (r.get("scope", "college") == "college" and any(
                "create" in (r.get("permissions") or {}).get(screen, []) for screen in ("messages", "notifications", "announcements")))
               for r in roles):
            result.add(account["code"])
    return result


def year_group_plan(data):
    """academic_year_code -> (title, description, member account codes)."""
    records = data["records"]
    years = {}
    for student, (_, program, year, section) in placement(data).items():
        if year:
            entry = years.setdefault(year, {"students": set(), "sections": set(), "program": program})
            entry["students"].add(student)
            entry["sections"].add(section)
    admins = admin_accounts(data)
    by_person = {(a.get("person_type"), a.get("person_code")): a["code"] for a in data["accounts"].values() if a.get("active")}
    teachers_of = {}
    for o in aw.rows(data, "subject_offerings"):
        teachers_of.setdefault(o.get("section_code"), set()).add(o.get("teacher_code"))
    employee_of = {t["code"]: t.get("employee_code") for t in aw.rows(data, "teachers")}
    plan = {}
    for year, entry in years.items():
        people = {("student", s) for s in entry["students"]}
        people |= {("parent", p) for p in parents_of(data, entry["students"])}
        people |= {("employee", employee_of.get(t)) for sec in entry["sections"] for t in teachers_of.get(sec, ())}
        accounts = {by_person[p] for p in people if p in by_person} | admins
        year_name = records.get("academic_years", {}).get(year, {}).get("name") or year
        program = records.get("programs", {}).get(entry["program"], {}).get("name") or ""
        title = year_name if not program or program.casefold() in year_name.casefold() else f"{program} · {year_name}"
        plan[year] = (title, "Academic year group · students, parents and teachers", accounts)
    return plan, admins


def year_group_signature(plan):
    import hashlib
    text = "|".join(f"{y}:{t}:{','.join(sorted(a))}" for y, (t, _, a) in sorted(plan.items()))
    return hashlib.sha256(text.encode()).hexdigest()


def sync_year_groups(data):
    """Create one group per academic year and keep its members in step with enrollments."""
    plan, admins = year_group_plan(data)
    creator = sorted(admins)[0] if admins else None
    threads = {t.get("auto_year"): t for t in aw.rows(data, "message_threads") if t.get("auto_year")}
    table = data["records"].setdefault("thread_members", {})
    for year, (title, description, accounts) in plan.items():
        thread = threads.get(year)
        if not thread:
            if not creator or not accounts:
                continue
            thread = new_thread(data, {"code": creator}, "group", title, sorted(accounts - {creator}),
                                description=description, posting="staff", auto_year=year)
            continue
        thread.update(title=title, subject=title[:200], description=description)
        current = {m["user_code"]: m for m in members(data, thread["code"])}
        for account in accounts - set(current):
            code = new_code("TM")
            table[code] = {"code": code, "thread_code": thread["code"], "user_code": account, "role": "member", "joined_at": now()}
        for account, member in current.items():
            if account not in accounts:
                table.pop(member["code"], None)
    settings = data.setdefault("documents", {}).setdefault("chat_settings", {})
    settings["year_groups"] = {"code": "year_groups", "signature": year_group_signature(plan), "synced_at": now()}


def ensure_year_groups(request):
    """Cheap check on a snapshot; writes only when enrollments, parents or teachers changed."""
    data = request.app.state.store.snapshot()
    plan, _ = year_group_plan(data)
    stored = data.get("documents", {}).get("chat_settings", {}).get("year_groups", {})
    if stored.get("signature") == year_group_signature(plan):
        return
    try:
        with request.app.state.store.transaction() as fresh:
            sync_year_groups(fresh)
    except Exception:  # never block the chat list on a sync problem
        import logging
        logging.getLogger(__name__).exception("Academic-year chat groups could not be synced")


# ---- Directory ------------------------------------------------------------------------------
def matches(text, q):
    return not q or all(part in text for part in q.casefold().split())


@router.get("/directory")
def directory(request: Request, user=Depends(current_user), q: str = Query(default="", max_length=80),
              role: str = Query(default="", pattern="^(|student|parent|teacher|staff)$"),
              program_code: str = Query(default="", max_length=60), academic_year_code: str = Query(default="", max_length=60),
              section_code: str = Query(default="", max_length=60), limit: int = Query(default=60, ge=1, le=200)):
    """People the user can chat with. Students come with their parents (search by admission number)."""
    data = request.app.state.store.snapshot()
    who = side(data, user)
    allowed = allowed_people(data, user)
    viewer_students = None
    if who == "student":
        viewer_students = {user["person_code"]}
    elif who == "parent":
        viewer_students = children(data, user["person_code"])
    accounts = [a for a in data["accounts"].values() if can_message(data, user, a)]
    by_person = {(a.get("person_type"), a.get("person_code")): a for a in accounts}
    places = placement(data) if (program_code or academic_year_code or section_code) else {}
    links = {}
    for r in aw.rows(data, "student_parents"):
        links.setdefault(r["student_code"], []).append(r)
    students = data["records"].get("students", {})
    results = []
    for account in sorted(accounts, key=lambda a: display_name(data, a).casefold()):
        kind = account.get("person_type")
        person = account_person(data, account)
        if kind == "student":
            if places:
                level, program, year, section = places.get(person.get("code"), (None,) * 4)
                if (program_code and program != program_code) or (academic_year_code and year != academic_year_code) or (
                        section_code and section != section_code):
                    continue
            if role and role not in {"student", "parent"}:
                continue
            text = " ".join(str(x or "") for x in (aw.name(person), person.get("admission_number"), account.get("login_id"),
                                                    person.get("phone"), roll_number(data, person.get("code")))).casefold()
            parents = []
            for link in links.get(person.get("code"), []):
                parent = data["records"].get("parents", {}).get(link["parent_code"], {})
                text += " " + " ".join(str(x or "") for x in (aw.name(parent), parent.get("phone"))).casefold()
                pa = by_person.get(("parent", link["parent_code"]))
                parents.append({"code": pa["code"] if pa else None, "name": " ".join(aw.name(parent).split()) or link["parent_code"],
                                "relationship": link.get("relationship") or "Parent", "phone": parent.get("phone"),
                                "can_chat": bool(pa)})
            if not matches(text, q):
                continue
            if role == "parent":
                continue
            results.append({**contact(data, account, viewer_students), "admission_number": person.get("admission_number"),
                            "roll_number": roll_number(data, person.get("code")), "parents": parents})
        elif kind == "parent":
            if places or role in {"student", "teacher", "staff"}:
                continue
            text = " ".join(str(x or "") for x in (aw.name(person), person.get("phone"), account.get("login_id"))).casefold()
            # Searching a student's name or ID lists the parents under that student instead.
            if matches(text, q):
                results.append(contact(data, account, viewer_students))
        else:
            if places:
                continue
            item = contact(data, account, viewer_students)
            if role and item["role"] != role:
                continue
            text = " ".join(str(x or "") for x in (item["name"], item["detail"], account.get("login_id"),
                                                    person.get("employee_number"), person.get("code"))).casefold()
            if matches(text, q):
                results.append(item)
        if len(results) >= limit:
            break
    order = {"teacher": 0, "staff": 1, "student": 2, "parent": 3}
    if who in {"student", "parent"}:
        results.sort(key=lambda r: (order.get(r["role"], 9), r["name"]))
    return {"items": results, "side": who, "everyone": allowed is None}


@router.get("/options")
def options(request: Request, user=Depends(current_user)):
    """Group filters: course levels, branches (programs), academic years and sections."""
    data = request.app.state.store.snapshot()
    who = side(data, user)
    if who not in STAFF_SIDES:
        return {"course_levels": [], "programs": [], "academic_years": [], "sections": [], "can_create_groups": False}
    records = data["records"]
    allowed_sections = teacher_sections(data, user["person_code"]) if who == "teacher" else None
    places = placement(data)
    used = {}
    for level, program, year, section in places.values():
        if allowed_sections is not None and section not in allowed_sections:
            continue
        used.setdefault(section, (level, program, year))
    programs = {p for _, p, _ in used.values() if p}
    years = {y for _, _, y in used.values() if y}
    return {
        "can_create_groups": True,
        "course_levels": sorted({lvl for lvl, _, _ in used.values() if lvl}),
        "programs": sorted(({"code": c, "name": records.get("programs", {}).get(c, {}).get("name", c),
                             "branch": records.get("programs", {}).get(c, {}).get("branch"),
                             "course_level": records.get("programs", {}).get(c, {}).get("course_level")} for c in programs),
                           key=lambda r: r["name"]),
        "academic_years": sorted(({"code": c, "name": records.get("academic_years", {}).get(c, {}).get("name", c),
                                   "program_code": records.get("academic_years", {}).get(c, {}).get("program_code")} for c in years),
                                 key=lambda r: r["name"]),
        "sections": sorted(({"code": s, "name": records.get("sections", {}).get(s, {}).get("name", s), "course_level": lvl,
                             "program_code": p, "academic_year_code": y,
                             "label": " · ".join(x for x in (records.get("programs", {}).get(p, {}).get("name"),
                                                             records.get("academic_years", {}).get(y, {}).get("name"),
                                                             f"Section {records.get('sections', {}).get(s, {}).get('name', s)}") if x)}
                            for s, (lvl, p, y) in used.items() if s), key=lambda r: r["label"]),
    }


# ---- Attachments ----------------------------------------------------------------------------
@router.get("/attachments/{file_code}")
def attachment(file_code: str, request: Request, user=Depends(current_user)):
    from app.modules.documents.files.api import file_store
    data = request.app.state.store.snapshot()
    record = aw.docs(data, "files").get(file_code)
    if not record or not record.get("ready") or not record.get("chat_thread_code"):
        raise HTTPException(404, "File not found")
    membership(data, user, record["chat_thread_code"])
    if record.get("owner") != user["code"] and not record.get("message_code"):
        raise HTTPException(404, "File not found")
    raw = file_store(request, record).get(record["storage_key"])
    if raw is None:
        raise HTTPException(404, "File bytes are unavailable")
    return Response(raw, media_type=record["mime_type"], headers={
        "Content-Disposition": "inline", "X-Content-Type-Options": "nosniff", "Cache-Control": "private, max-age=86400"})


def ensure_member_for_upload(data, user, thread_code):
    thread = data["records"].get("message_threads", {}).get(thread_code)
    if not thread:
        raise HTTPException(404, "Conversation not found")
    membership(data, user, thread_code)
    if not can_post(data, user, thread):
        raise HTTPException(403, "Only staff can post in this group")
