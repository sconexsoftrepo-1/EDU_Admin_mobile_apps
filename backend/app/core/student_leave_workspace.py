"""Student leave management for the dashboard (Student operations).

Students and parents request leave from the app (``student_leave_requests``). Staff with the
student-leave permission see every request with the student's name, admission number, course,
academic year and section, and approve or reject it; the student and linked parents are notified.
Approved leave is what the attendance register uses to mark a student absent by default.
"""
from datetime import date
from typing import Literal

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from pydantic import Field

from . import assignment_workspace as aw
from .security import StrictModel, current_user, has_permission
from .storage import audit, new_code, now

router = APIRouter(prefix="/students/leave-workspace", tags=["Student leave"])
TABLE = "student_leave_requests"


def allowed(data, user, action="view"):
    return user.get("person_type") in {"employee", "system"} and not aw.teaching(user) and has_permission(data, user, TABLE, action)


def student_context(data, code):
    records = data["records"]
    student = records.get("students", {}).get(code, {})
    enrollment = next((e for e in aw.rows(data, "student_enrollments")
                       if e.get("student_code") == code and e.get("status") == "active"), {})
    section = records.get("sections", {}).get(enrollment.get("section_code"), {})
    batch = records.get("batches", {}).get(section.get("batch_code"), {})
    profile = next((p for p in aw.rows(data, "student_admission_profiles") if p.get("student_code") == code), {})
    program = records.get("programs", {}).get(batch.get("program_code") or profile.get("program_code"), {})
    year = records.get("academic_years", {}).get(batch.get("academic_year_code") or profile.get("academic_year_code"), {})
    return {"student_name": " ".join(aw.name(student).split()) or code, "admission_number": student.get("admission_number"),
            "course_name": program.get("name"), "academic_year_name": year.get("name") or batch.get("name"),
            "section_name": section.get("name")}


def view(data, row):
    days = None
    try:
        days = (date.fromisoformat(str(row.get("end_date"))[:10]) - date.fromisoformat(str(row.get("start_date"))[:10])).days + 1
    except ValueError:
        pass
    approver = data["records"].get("employees", {}).get(row.get("approved_by_code") or "", {})
    return {**row, **student_context(data, row.get("student_code")), "days": days,
            "approved_by_name": " ".join(aw.name(approver).split()) or None}


@router.get("")
def listing(request: Request, user=Depends(current_user)):
    data = request.app.state.store.snapshot()
    if not allowed(data, user):
        raise HTTPException(403, "Student leave management is not assigned to this role")
    items = sorted((view(data, r) for r in aw.rows(data, TABLE)),
                   key=lambda r: (r.get("status") != "pending", str(r.get("start_date") or "")), reverse=False)
    pending = [r for r in items if r.get("status") == "pending"]
    others = sorted((r for r in items if r.get("status") != "pending"), key=lambda r: str(r.get("start_date") or ""), reverse=True)
    return {"items": pending + others, "total": len(items),
            "can_decide": allowed(data, user, "approve") or allowed(data, user, "edit"),
            "counts": {s: sum(1 for r in items if r.get("status") == s) for s in ("pending", "approved", "rejected")}}


class Decision(StrictModel):
    status: Literal["approved", "rejected"]
    note: str = Field(default="", max_length=500)


@router.post("/{code}/decision")
def decide(code: str, body: Decision, request: Request, background: BackgroundTasks, user=Depends(current_user)):
    from .certificate_workspace import push
    with request.app.state.store.transaction() as data:
        if not (allowed(data, user, "approve") or allowed(data, user, "edit")):
            raise HTTPException(403, "Approving student leave is not assigned to this role")
        record = data["records"].get(TABLE, {}).get(code)
        if not record:
            raise HTTPException(404, "Leave request not found")
        if record.get("status") != "pending":
            raise HTTPException(409, "This leave request was already decided")
        record.update(status=body.status, approved_by_code=user.get("person_code") if user.get("person_type") == "employee" else None,
                      decision_note=body.note.strip(), decided_at=now())
        # Tell the student and their parents.
        student = record["student_code"]
        people = {student} | {r["parent_code"] for r in aw.rows(data, "student_parents") if r.get("student_code") == student}
        accounts = [a["code"] for a in data.get("accounts", {}).values()
                    if a.get("active") and a.get("person_code") in people and a.get("person_type") in {"student", "parent"}]
        name = student_context(data, student)["student_name"]
        notices = []
        for account in accounts:
            notice = new_code("LNOTICE")
            data["records"].setdefault("notifications", {})[notice] = {
                "code": notice, "user_code": account, "channel": "in_app", "status": "sent", "sent_at": now(),
                "title": f"Leave {body.status}", "screen": "leave",
                "body": f"{name}'s leave from {record.get('start_date')} to {record.get('end_date')} was {body.status}."
                        + (f" Note: {body.note.strip()}" if body.note.strip() else "")}
            notices.append(notice)
        audit(data, user["code"], f"student_leave_{body.status}", TABLE, code)
        result = view(data, record)
    background.add_task(push, request, notices)
    return result
