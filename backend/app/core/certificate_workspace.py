"""Certificate request, approval and template workspace."""
from typing import Literal

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from pydantic import Field

from app.core.security import StrictModel, current_user, has_permission
from app.core.storage import audit, new_code, now
from app.modules.documents.files.api import CertificateInput, issue as issue_certificate

router = APIRouter(prefix="/certificates/workspace", tags=["Certificate workspace"])
TEMPLATES = [
    ("study_certificate", "Study Certificate", "Confirms the student’s enrollment, course and academic period."),
    ("conduct_certificate", "Conduct Certificate", "Certifies conduct during the period of study."),
    ("attendance_certificate", "Attendance Certificate", "Confirms attendance for the selected academic period."),
    ("course_completion", "Course Completion Certificate", "Confirms successful completion of the registered course."),
    ("achievement", "Certificate of Achievement", "Recognizes an academic or institutional achievement."),
]


def rows(data, table):
    return list(data["records"].get(table, {}).values())


def person_name(person):
    return " ".join(str(person.get(k) or "").strip() for k in ("first_name", "middle_name", "last_name")).strip()


def personal_student_codes(data, user):
    if user.get("person_type") == "student":
        return {user.get("person_code")}
    if user.get("person_type") == "parent":
        return {r["student_code"] for r in rows(data, "student_parents") if r["parent_code"] == user.get("person_code")}
    return set()


def staff(data, user, action="view"):
    if user.get("person_type") not in {"employee", "system"} or not has_permission(data, user, "certificates", action):
        raise HTTPException(403, "Certificate access is not assigned to this role")


def notify(data, account_codes, title, body, request_code=None, certificate_code=None):
    made = []
    for account_code in sorted(set(filter(None, account_codes))):
        account = data.get("accounts", {}).get(account_code)
        if not account or not account.get("active"):
            continue
        code = new_code("CNOTICE")
        data["records"].setdefault("notifications", {})[code] = {
            "code": code, "user_code": account_code, "title": title, "body": body,
            "channel": "in_app", "status": "sent", "sent_at": now(), "screen": "certificates",
            "certificate_request_code": request_code, "certificate_code": certificate_code,
        }
        made.append(code)
    return made


def personal_accounts(data, student_code):
    parent_codes = {r["parent_code"] for r in rows(data, "student_parents")
                    if r["student_code"] == student_code and r.get("receives_notifications", True)}
    return {a["code"] for a in data.get("accounts", {}).values() if a.get("active") and
            ((a.get("person_type") == "student" and a.get("person_code") == student_code) or
             (a.get("person_type") == "parent" and a.get("person_code") in parent_codes))}


def push(request, notices):
    settings = request.app.state.settings
    if not settings.push_adapter_url or not settings.push_adapter_token:
        return
    from app.core.integrations_api import adapter_post
    for code in notices:
        with request.app.state.store.transaction() as data:
            item = data["records"]["notifications"].get(code)
            if not item:
                continue
            tokens = [r["token"] for r in rows(data, "device_tokens") if r["user_code"] == item["user_code"]]
            payload = {"idempotency_key": code, "tokens": tokens, "title": item["title"], "body": item["body"],
                       "data": {k: item.get(k) for k in ("screen", "certificate_request_code", "certificate_code")}}
        if tokens:
            try:
                adapter_post(settings.push_adapter_url, settings.push_adapter_token, payload)
            except Exception:
                pass


def public_request(data, row):
    student = data["records"].get("students", {}).get(row.get("student_code"), {})
    kind = data["records"].get("certificate_types", {}).get(row.get("type_code"), {})
    result = {**row, "student_name": person_name(student), "admission_number": student.get("admission_number"),
              "template_name": kind.get("name", row.get("type_code", "Certificate"))}
    profile = next((p for p in rows(data, "student_admission_profiles") if p.get("student_code") == row.get("student_code")), {})
    result["program_code"] = profile.get("program_code")
    result["academic_year_code"] = profile.get("academic_year_code")
    return result


def seed_types(data):
    table = data["records"].setdefault("certificate_types", {})
    for code, name, description in TEMPLATES:
        table.setdefault(code, {"code": code, "name": name, "template_reference": "builtin:" + code,
                                "description": description, "status": "active"})


class RequestInput(StrictModel):
    student_code: str | None = None
    template_code: str = Field(min_length=1, max_length=80)
    reason: str = Field(default="", max_length=2000)


class DecisionInput(StrictModel):
    message: str = Field(default="", max_length=2000)


class IssueInput(StrictModel):
    student_code: str = Field(min_length=1, max_length=100)
    template_code: str = Field(min_length=1, max_length=80)
    program_code: str = Field(min_length=1, max_length=100)
    academic_year_code: str = Field(min_length=1, max_length=100)
    reason: str = Field(default="", max_length=2000)


@router.get("/options")
def options(request: Request, course_level: str | None = None, program_code: str | None = None,
            academic_year_code: str | None = None, user=Depends(current_user)):
    data = request.app.state.store.snapshot()
    if user.get("person_type") not in {"student", "parent"}:
        staff(data, user)
        courses = rows(data, "programs")
        years = rows(data, "academic_years")
        students = rows(data, "students")
    else:
        codes = personal_student_codes(data, user)
        courses, years = rows(data, "programs"), rows(data, "academic_years")
        students = [s for s in rows(data, "students") if s["code"] in codes]
    if course_level:
        courses = [p for p in courses if p.get("course_level") == course_level]
    if program_code:
        years = [y for y in years if y.get("program_code") == program_code]
    if program_code and academic_year_code:
        selected_year = data["records"].get("academic_years", {}).get(academic_year_code, {})
        matching_batches = {b["code"] for b in rows(data, "batches") if b.get("program_code") == program_code and
                            (b.get("academic_year_code") == academic_year_code or
                             str(b.get("entry_year")) == str(selected_year.get("start_date", ""))[:4] and
                             str(b.get("graduation_year")) == str(selected_year.get("end_date", ""))[:4])}
        matching_sections = {s["code"] for s in rows(data, "sections") if s.get("batch_code") in matching_batches}
        eligible = {p.get("student_code") for p in rows(data, "student_admission_profiles")
                    if p.get("program_code") == program_code and p.get("academic_year_code") == academic_year_code}
        eligible.update(e["student_code"] for e in rows(data, "student_enrollments")
                        if e.get("status") == "active" and e.get("section_code") in matching_sections)
        students = [s for s in students if s["code"] in eligible]
    return {"templates": [{"code": c, "name": n, "description": d} for c, n, d in TEMPLATES],
            "courses": [{"code": p["code"], "name": p.get("name"), "specialization": p.get("specialization") or p.get("branch") or p.get("qualification"), "course_level": p.get("course_level")} for p in courses],
            "academic_years": [{"code": y["code"], "name": y.get("name"), "program_code": y.get("program_code")} for y in years],
            "students": [{"code": s["code"], "name": person_name(s), "admission_number": s.get("admission_number")} for s in students]}


@router.get("")
def listing(request: Request, student_code: str | None = None, user=Depends(current_user)):
    data = request.app.state.store.snapshot()
    if user.get("person_type") in {"student", "parent"}:
        allowed = personal_student_codes(data, user)
        if student_code and student_code not in allowed:
            raise HTTPException(404, "Student not found")
        allowed = {student_code} if student_code else allowed
        items = [public_request(data, r) for r in rows(data, "certificate_requests") if r.get("student_code") in allowed]
        certificates = [r for r in rows(data, "certificates") if r.get("request_code") in {x["code"] for x in items}]
        return {"items": items, "certificates": certificates, "can_review": False}
    staff(data, user)
    items = [public_request(data, r) for r in rows(data, "certificate_requests")]
    return {"items": items, "certificates": rows(data, "certificates"), "can_review": True}


@router.post("/requests", status_code=201)
def create_request(body: RequestInput, request: Request, background: BackgroundTasks, user=Depends(current_user)):
    with request.app.state.store.transaction() as data:
        seed_types(data)
        allowed = personal_student_codes(data, user)
        student_code = body.student_code or (user.get("person_code") if user.get("person_type") == "student" else None)
        if student_code not in allowed:
            raise HTTPException(404, "Choose a student linked to your account")
        if body.template_code not in data["records"]["certificate_types"]:
            raise HTTPException(422, "Select a supported certificate template")
        if any(r.get("student_code") == student_code and r.get("type_code") == body.template_code and r.get("status") in {"pending", "approved"} for r in rows(data, "certificate_requests")):
            raise HTTPException(409, "A request for this certificate is already awaiting review")
        code = new_code("CREQ")
        record = {"code": code, "student_code": student_code, "type_code": body.template_code,
                  "requested_on": now(), "reason": body.reason.strip(), "status": "pending", "decision_message": ""}
        data["records"].setdefault("certificate_requests", {})[code] = record
        admins = {a["code"] for a in data.get("accounts", {}).values() if a.get("active") and a.get("person_type") in {"employee", "system"} and has_permission(data, a, "certificates", "approve")}
        notices = notify(data, admins, "Certificate request received", "A student has requested a certificate. Open Certificates to review.", code)
        audit(data, user["code"], "certificate_request", "certificate_requests", code)
        result = public_request(data, record)
    background.add_task(push, request, notices)
    return result


@router.post("/requests/{code}/approve", status_code=201)
def approve(code: str, request: Request, background: BackgroundTasks, user=Depends(current_user)):
    data = request.app.state.store.snapshot()
    staff(data, user, "approve")
    record = data["records"].get("certificate_requests", {}).get(code)
    if not record or record.get("status") != "pending":
        raise HTTPException(404, "Pending certificate request not found")
    result = issue_certificate(CertificateInput(request_code=code), request, user)
    with request.app.state.store.transaction() as current:
        cert = next((c for c in rows(current, "certificates") if c.get("request_code") == code), {})
        result["download_path"] = f"/api/v1/documents/certificate/{cert.get('code')}/download" if cert else None
        notices = notify(current, personal_accounts(current, record["student_code"]), "Certificate approved", "Your certificate is ready to preview and download.", code, cert.get("code"))
    background.add_task(push, request, notices)
    return result


@router.post("/requests/{code}/reject")
def reject(code: str, body: DecisionInput, request: Request, background: BackgroundTasks, user=Depends(current_user)):
    with request.app.state.store.transaction() as data:
        staff(data, user, "approve")
        record = data["records"].get("certificate_requests", {}).get(code)
        if not record or record.get("status") != "pending":
            raise HTTPException(404, "Pending certificate request not found")
        record.update(status="rejected", decision_message=body.message.strip() or "Please contact the administrative chamber for certificates.", decided_at=now(), decided_by=user["code"])
        notices = notify(data, personal_accounts(data, record["student_code"]), "Certificate request not approved", "Please contact the administrative chamber for certificates.", code)
        audit(data, user["code"], "certificate_reject", "certificate_requests", code)
        result = public_request(data, record)
    background.add_task(push, request, notices)
    return result


@router.post("/issue", status_code=201)
def issue(body: IssueInput, request: Request, background: BackgroundTasks, user=Depends(current_user)):
    with request.app.state.store.transaction() as data:
        staff(data, user, "approve")
        seed_types(data)
        if body.template_code not in data["records"]["certificate_types"] or body.student_code not in data["records"].get("students", {}):
            raise HTTPException(422, "Choose a registered student and certificate template")
        year = data["records"].get("academic_years", {}).get(body.academic_year_code)
        if not year or year.get("program_code") != body.program_code:
            raise HTTPException(422, "Choose an academic year belonging to the selected course")
        profiles = rows(data, "student_admission_profiles")
        enrolled_profiles = {p["student_code"] for p in profiles if p.get("student_code") == body.student_code and
                             p.get("program_code") == body.program_code and p.get("academic_year_code") == body.academic_year_code}
        matching_batches = {b["code"] for b in rows(data, "batches") if b.get("program_code") == body.program_code and
                            (b.get("academic_year_code") == body.academic_year_code or
                             str(b.get("entry_year")) == str(year.get("start_date", ""))[:4] and str(b.get("graduation_year")) == str(year.get("end_date", ""))[:4])}
        matching_sections = {s["code"] for s in rows(data, "sections") if s.get("batch_code") in matching_batches}
        active_enrolled = any(e.get("student_code") == body.student_code and e.get("status") == "active" and e.get("section_code") in matching_sections for e in rows(data, "student_enrollments"))
        if body.student_code not in enrolled_profiles and not active_enrolled:
            raise HTTPException(422, "The selected student is not enrolled in this course and academic year")
        code = new_code("CREQ")
        data["records"].setdefault("certificate_requests", {})[code] = {
            "code": code, "student_code": body.student_code, "type_code": body.template_code,
            "requested_on": now(), "reason": body.reason, "status": "pending", "created_by_admin": user["code"],
            "program_code": body.program_code, "academic_year_code": body.academic_year_code}
    result = issue_certificate(CertificateInput(request_code=code), request, user)
    with request.app.state.store.transaction() as data:
        cert = next((c for c in rows(data, "certificates") if c.get("request_code") == code), {})
        notices = notify(data, personal_accounts(data, body.student_code), "Certificate issued", "Your certificate is ready to preview and download.", code, cert.get("code"))
    background.add_task(push, request, notices)
    return result
