"""Edits by anyone but the Super Admin wait for approval before touching live data.

The dashboard's write requests pass through one gate instead of per-screen code:

* DELETE is refused.
* An edit to existing data is stored in ``edit_requests`` as the exact request, with a readable
  from/to list, and answered with 202. Nothing else is written, so every screen keeps the old data.
* Accept replays the stored request through the normal endpoint as the Super Admin, so validation
  and business rules still run. Reject only records the decision.

Only the web dashboard is gated; the mobile apps keep working as they did. A route this module does
not recognise is refused for non-admins, so a new endpoint can never bypass approval by accident.
"""
import json
import re

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import JSONResponse
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import Field

from .security import StrictModel, current_user, has_permission
from .storage import audit, new_code, now

router = APIRouter(prefix="/edit-requests", tags=["Edit approvals"])
TABLE = "edit_requests"
PREFIX = "/api/v1"
GATED_CLIENT = "admin-web"
HIDDEN_FIELDS = {"code", "password", "password_hash", "storage_key", "profile_photo_storage_key", "revision"}
# Not edits of college records: the person's own session, messages and this approval API.
EXEMPT = ("/auth/", "/chat/", "/mobile/", "/push/", "/public/", "/edit-requests")
# Custom edit endpoints: route -> (table holding the data, readable name).
CUSTOM = {
    "/academics/semester-workspace/results": ("exam_results", "Semester results"),
    "/academics/semester-workspace/calendar": ("academic_years", "Semester calendar"),
    "/academics/assessment-workspace/{code}": ("exams", "Assessment"),
    "/academics/assessment-workspace/{code}/marks": ("exam_results", "Assessment marks"),
    "/academics/course-curricula/{code}": ("programs", "Course curriculum"),
    "/academics/course-curricula/{code}/faculty": ("subject_offerings", "Subject faculty"),
    "/academics/course-curricula/{code}/subjects/{link_code}": ("curriculum_subjects", "Curriculum subject"),
    "/academics/attendance-workspace/register": ("student_attendance", "Attendance register"),
    "/academics/labs/{code}": ("rooms", "Lab"),
    "/academics/timetable-templates/bell-schedule": ("timetable_slots", "Bell schedule"),
    "/academics/timetable-templates/{code}": ("timetable_slots", "Timetable"),
    "/academics/assignment-workspace/{code}": ("assignments", "Assignment"),
    "/master-data/staff-onboarding/{employee_code}": ("employees", "Employee"),
    "/master-data/enrollment/batches/{batch_code}": ("batches", "Batch"),
    "/admissions/admission-enquiries/intake/{code}": ("admission_enquiries", "Admission enquiry"),
    "/finance/fee-payments/{code}": ("payments", "Fee payment"),
}
# POST actions that change an existing record rather than create one.
ACTIONS = {
    "/certificates/workspace/requests/{code}/approve": ("certificate_requests", "Certificate approval"),
    "/certificates/workspace/requests/{code}/reject": ("certificate_requests", "Certificate rejection"),
    "/documents/certificates/{code}/revoke": ("certificates", "Certificate revocation"),
    "/students/leave-workspace/{code}/decision": ("student_leave_requests", "Student leave decision"),
    "/hr/staff-workspace/leave/{code}/decision": ("leave_requests", "Staff leave decision"),
    "/hr/salary-workspace/runs/{code}/paid": ("payroll_runs", "Payroll marked as paid"),
    "/hostel/permissions/{code}/approve": ("hostel_permissions", "Hostel permission approval"),
    "/hostel/permissions/{code}/depart": ("hostel_permissions", "Hostel departure"),
    "/hostel/permissions/{code}/return": ("hostel_permissions", "Hostel return"),
    "/admissions/documents/{code}/review": ("admission_documents", "Admission document review"),
}
# The only custom edits a teacher makes on the dashboard, because they own these records.
TEACHING_EDITS = {
    "/academics/attendance-workspace/register",
    "/academics/assessment-workspace/{code}",
    "/academics/assessment-workspace/{code}/marks",
    "/academics/assignment-workspace/{code}",
    "/academics/semester-workspace/results",
}


def super_admins(data):
    return [code for code, a in data.get("accounts", {}).items() if a.get("active") and any(
        data["roles"].get(r, {}).get("system_admin") for r in a.get("role_codes", []))]


def notice(data, accounts, title, body, request_code):
    """In-app notices that open the change requests screen; returns their codes for the push."""
    made = []
    for account in accounts:
        code = new_code("ENOTICE")
        data["records"].setdefault("notifications", {})[code] = {
            "code": code, "user_code": account, "title": title, "body": body, "channel": "in_app",
            "status": "sent", "sent_at": now(), "edit_request_code": request_code, "screen": "change-requests"}
        made.append(code)
    return made


def push_soon(app, codes):
    """Phone push without holding up the response (the gate runs outside the endpoints)."""
    if not codes:
        return
    import threading
    from types import SimpleNamespace

    from .push_delivery import deliver
    threading.Thread(target=deliver, args=(SimpleNamespace(app=app), codes), daemon=True).start()


def is_super_admin(data, user):
    roles = data["accounts"].get(user["code"], {}).get("role_codes", [])
    return any(data["roles"].get(code, {}).get("system_admin") for code in roles)


def templates(app):
    """Route patterns from the API schema, the most literal first."""
    cached = getattr(app.state, "edit_route_patterns", None)
    if cached is None:
        paths = [p for p in app.openapi()["paths"] if p.startswith(PREFIX + "/")]
        paths.sort(key=lambda p: (p.count("{"), -len(p)))
        cached = [(p[len(PREFIX):], re.compile(re.sub(r"\{(\w+)\}", r"(?P<\1>[^/]+)", p) + "$")) for p in paths]
        app.state.edit_route_patterns = cached
    return cached


def match_route(app, path):
    for template, pattern in templates(app):
        found = pattern.match(path)
        if found:
            return template, found.groupdict()
    return None, {}


def generic_tables(app):
    cached = getattr(app.state, "edit_generic_tables", None)
    if cached is None:
        from pathlib import Path

        entries = json.loads((Path(__file__).parents[1] / "contracts/resources.json").read_text())
        cached = {e["path"][len(PREFIX):] + "/{code}": e["screen"] for e in entries if e["generic_api"]}
        app.state.edit_generic_tables = cached
    return cached


def target_of(app, method, template, params):
    """(table, readable name) of an edit, or None when this route is not a known edit."""
    if method == "POST":
        return ACTIONS.get(template)
    if template in CUSTOM:
        return CUSTOM[template]
    if template == "/workspace/resources/{table}/{code}":
        return params["table"], params["table"].replace("_", " ").capitalize()
    table = generic_tables(app).get(template)
    return (table, table.replace("_", " ").capitalize()) if table else None


def record_label(record, fallback):
    name = " ".join(str(record.get(k)).strip() for k in ("first_name", "last_name") if record.get(k))
    payer = record.get("payer") if isinstance(record.get("payer"), dict) else {}
    return name or record.get("name") or record.get("title") or payer.get("name") or fallback


def show(value):
    if value is None or value == "":
        return "—"
    if isinstance(value, bool):
        return "Yes" if value else "No"
    text = json.dumps(value, ensure_ascii=False, default=str) if isinstance(value, (dict, list)) else str(value)
    return text if len(text) <= 400 else text[:400] + "…"


def same(left, right):
    return (left in (None, "") and right in (None, "")) or show(left) == show(right)


def pick(record, field):
    """A field of a record; "payer.name" reads inside a nested object."""
    for part in field.split("."):
        record = record.get(part) if isinstance(record, dict) else None
    return record


def changes_of(before, body):
    # Admission intake wraps its fields in {"values": {...}}.
    values = body.get("values") if isinstance(body.get("values"), dict) else body
    flat = []
    for key, value in values.items():
        if key in HIDDEN_FIELDS:
            continue
        # A nested object (a payment's student details) is listed field by field.
        if isinstance(value, dict) and isinstance(before.get(key), (dict, type(None))):
            flat += [(f"{key}.{k}", f"{key.replace('_', ' ').capitalize()} · {k.replace('_', ' ')}", v) for k, v in value.items()]
        else:
            flat.append((key, key.replace("_", " ").capitalize(), value))
    return [{"field": field, "label": label, "from": show(pick(before, field)), "to": show(value)}
            for field, label, value in flat if not same(pick(before, field), value)]


def to_public(row):
    item = dict(row)
    item["changes"] = json.loads(row.get("changes") or "[]")
    for private in ("body", "before_record", "query_string"):
        item.pop(private, None)
    return item


def queue(request, data, user, template, params, table, title, body):
    from .dashboard_overview import viewer_of

    code = next((params[k] for k in ("code", "employee_code", "batch_code", "link_code") if k in params), None)
    before = data["records"].get(table, {}).get(code) if table and code else None
    changes = changes_of(before or {}, body)
    # Saving a form without changing anything needs no approval and changes nothing.
    if before is not None and request.method != "POST" and not changes:
        return JSONResponse({**before, "unchanged": True})
    viewer = viewer_of(data, user)
    path = request.scope["path"]
    request_code = None
    with request.app.state.store.transaction() as live:
        rows = live["records"].setdefault(TABLE, {})
        # A second edit of the same record by the same person replaces the one still waiting.
        previous = next((r for r in rows.values() if r["status"] == "pending" and r["requester_code"] == user["code"]
                         and r["path"] == path and r["method"] == request.method), None)
        request_code = previous["code"] if previous else new_code("EDR")
        rows[request_code] = {
            "code": request_code, "status": "pending", "method": request.method, "path": path,
            "query_string": request.url.query or "", "body": json.dumps(body, ensure_ascii=False, default=str),
            "target_table": table, "target_code": code, "target_title": title,
            "target_label": record_label(before or {}, str(code or title)),
            "changes": json.dumps(changes, ensure_ascii=False),
            "before_record": json.dumps(before, ensure_ascii=False, default=str) if before else None,
            "requester_code": user["code"], "requester_name": viewer["name"],
            "requester_role": ", ".join(r for r in viewer["roles"] if r) or None,
            "requested_at": now(), "decided_by": None, "decided_at": None, "decision_note": None, "last_error": None,
        }
        audit(live, user["code"], "edit_request", table or TABLE, request_code)
        codes = notice(live, super_admins(live), "Change request to review",
                       f"{viewer['name']} edited {title}: {record_label(before or {}, str(code or title))}"
                       f" ({len(changes)} change{'s' if len(changes) != 1 else ''}).", request_code)
    push_soon(request.app, codes)
    # Forms read fields from the response, so answer with the record as it would look.
    return JSONResponse({**(before or {}), **(body.get("values") if isinstance(body.get("values"), dict) else body),
                         "pending_approval": True, "edit_request_code": request_code}, status_code=202)


def evaluate(request, raw_body):
    """Returns a response when the gate handles the request, or None to let it through."""
    if not request.url.path.startswith(PREFIX + "/"):
        return None
    tail = request.url.path[len(PREFIX):]
    if tail.startswith(EXEMPT) or request.method not in {"PATCH", "PUT", "DELETE", "POST"}:
        return None
    header = request.headers.get("authorization", "")
    if not header.lower().startswith("bearer "):
        return None
    template, params = match_route(request.app, request.scope["path"])
    if request.method == "POST" and template not in ACTIONS:
        return None  # Creating data is allowed; the endpoint checks its own permission.
    try:
        user = current_user(request, HTTPAuthorizationCredentials(scheme="Bearer", credentials=header.split(None, 1)[1]))
    except HTTPException:
        return None  # The endpoint answers with the proper 401.
    if user.get("client") != GATED_CLIENT:
        return None
    data = request.app.state.store.snapshot()
    if is_super_admin(data, user):
        return None
    if request.method == "DELETE":
        return JSONResponse({"detail": "Only the Super Admin can delete records."}, status_code=403)
    target = target_of(request.app, request.method, template, params)
    if not target:
        return JSONResponse({"detail": "Only the Super Admin can change this."}, status_code=403)
    table, title = target
    # Checked now: an accepted request runs with the Super Admin's rights, so this is the only
    # point where the requester's own permission can be enforced.
    teaching = user.get("workspace_scope") == "teaching"
    if not (teaching and template in TEACHING_EDITS) and not any(
        has_permission(data, user, table, action) for action in ("edit", "approve")
    ):
        return JSONResponse({"detail": "Your role cannot change this record."}, status_code=403)
    try:
        body = json.loads(raw_body) if raw_body else {}
    except ValueError:
        return None  # The endpoint reports the malformed request.
    if not isinstance(body, dict):
        return None
    # First save of a versioned record (for example today's attendance) creates it: nothing to approve.
    if request.method == "PUT" and body.get("revision") == 0:
        return None
    return queue(request, data, user, template, params, table, title, body)


async def edit_approval_gate(request: Request, call_next):
    # Tests of the endpoints' own rules switch the gate off; production never sets this.
    if request.method in {"PATCH", "PUT", "DELETE", "POST"} and not getattr(request.app.state, "edit_approvals_off", False):
        raw_body = await request.body()
        response = await run_in_threadpool(evaluate, request, raw_body)
        if response is not None:
            return response
    return await call_next(request)


async def replay(app, row, authorization):
    """Send the stored request through the whole application, as the Super Admin who accepted it."""
    body = (row.get("body") or "").encode()
    scope = {"type": "http", "asgi": {"version": "3.0"}, "http_version": "1.1", "method": row["method"],
             "scheme": "http", "path": row["path"], "raw_path": row["path"].encode(), "root_path": "",
             "query_string": (row.get("query_string") or "").encode(), "client": ("127.0.0.1", 0),
             "server": ("edit-approval", 80),
             "headers": [(b"authorization", authorization.encode()), (b"content-type", b"application/json"),
                         (b"content-length", str(len(body)).encode())]}
    sent = []
    result = {"status": 500, "chunks": []}

    async def receive():
        if not sent:
            sent.append(True)
            return {"type": "http.request", "body": body, "more_body": False}
        return {"type": "http.disconnect"}

    async def send(message):
        if message["type"] == "http.response.start":
            result["status"] = message["status"]
        elif message["type"] == "http.response.body":
            result["chunks"].append(message.get("body", b""))

    await app(scope, receive, send)
    return result["status"], b"".join(result["chunks"]).decode(errors="replace")


def stale_fields(data, row):
    """Fields that changed in the live record after this request was made."""
    current = data["records"].get(row.get("target_table"), {}).get(row.get("target_code"))
    before = json.loads(row["before_record"]) if row.get("before_record") else None
    if current is None or before is None:
        return []
    return [c["label"] for c in json.loads(row.get("changes") or "[]")
            if not same(pick(current, c["field"]), pick(before, c["field"]))]


def require_admin(data, user):
    if not is_super_admin(data, user):
        raise HTTPException(403, "Only the Super Admin can decide edit requests")


def get_row(data, code):
    row = data["records"].get(TABLE, {}).get(code)
    if not row:
        raise HTTPException(404, "Edit request not found")
    return row


@router.get("")
def listing(request: Request, status: str | None = None, user=Depends(current_user)):
    data = request.app.state.store.snapshot()
    admin = is_super_admin(data, user)
    rows = [r for r in data["records"].get(TABLE, {}).values()
            if (admin or r["requester_code"] == user["code"]) and (not status or r["status"] == status)]
    rows.sort(key=lambda r: str(r.get("requested_at") or ""), reverse=True)
    items = []
    for row in rows[:200]:
        item = to_public(row)
        if admin and row["status"] == "pending":
            item["stale_fields"] = stale_fields(data, row)
        items.append(item)
    return {"items": items, "can_decide": admin}


@router.get("/pending-count")
def pending_count(request: Request, user=Depends(current_user)):
    data = request.app.state.store.snapshot()
    admin = is_super_admin(data, user)
    return {"can_decide": admin,
            "count": sum(r["status"] == "pending" and (admin or r["requester_code"] == user["code"])
                         for r in data["records"].get(TABLE, {}).values())}


class AcceptInput(StrictModel):
    apply_over_newer_data: bool = False


class RejectInput(StrictModel):
    note: str | None = Field(default=None, max_length=500)


def claim(request, code, user):
    """Mark the request as being applied, so a double click cannot run it twice."""
    with request.app.state.store.transaction() as data:
        require_admin(data, user)
        row = get_row(data, code)
        if row["status"] != "pending":
            raise HTTPException(409, "This edit request was already decided")
        row["status"] = "applying"
        data["records"][TABLE][code] = row
        return dict(row)


def finish(request, code, user, status, error=None):
    with request.app.state.store.transaction() as data:
        row = get_row(data, code)
        row.update(status=status, last_error=error)
        if status == "accepted":
            row.update(decided_by=user["code"], decided_at=now())
        data["records"][TABLE][code] = row
        codes = []
        if status == "accepted":
            audit(data, user["code"], "edit_request_accept", row.get("target_table") or TABLE, code)
            codes = notice(data, [row["requester_code"]], "Your change was approved",
                           f"{row.get('target_title')}: {row.get('target_label')} is updated.", code)
    push_soon(request.app, codes)
    return to_public(row)


@router.post("/{code}/accept")
async def accept(code: str, body: AcceptInput, request: Request, user=Depends(current_user)):
    data = await run_in_threadpool(request.app.state.store.snapshot)
    require_admin(data, user)
    row = get_row(data, code)
    stale = stale_fields(data, row) if row["status"] == "pending" else []
    if stale and not body.apply_over_newer_data:
        raise HTTPException(409, f"Changed since this request was made: {', '.join(stale)}. Review and confirm.")
    row = await run_in_threadpool(claim, request, code, user)
    try:
        status, text = await replay(request.app, row, request.headers.get("authorization", ""))
    except Exception:
        await run_in_threadpool(finish, request, code, user, "pending", "The change could not be applied.")
        raise
    if status >= 400:
        try:
            detail = json.loads(text).get("detail")
        except ValueError:
            detail = None
        message = detail if isinstance(detail, str) else "The change could not be applied."
        await run_in_threadpool(finish, request, code, user, "pending", message)
        raise HTTPException(409, f"Not applied: {message}")
    return await run_in_threadpool(finish, request, code, user, "accepted")


@router.post("/{code}/reject")
def reject(code: str, body: RejectInput, request: Request, user=Depends(current_user)):
    with request.app.state.store.transaction() as data:
        require_admin(data, user)
        row = get_row(data, code)
        if row["status"] != "pending":
            raise HTTPException(409, "This edit request was already decided")
        row.update(status="rejected", decided_by=user["code"], decided_at=now(), decision_note=body.note, last_error=None)
        data["records"][TABLE][code] = row
        audit(data, user["code"], "edit_request_reject", row.get("target_table") or TABLE, code)
        codes = notice(data, [row["requester_code"]], "Your change was rejected",
                       f"{row.get('target_title')}: {row.get('target_label')} was not changed."
                       + (f" {body.note}" if body.note else ""), code)
    push_soon(request.app, codes)
    return to_public(row)
