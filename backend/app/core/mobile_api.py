"""Personal-data endpoints derive identity from the session, never a caller-supplied user ID."""

from fastapi import APIRouter, Depends, HTTPException, Request

from app.modules.finance.transactions.api import calculate_ledger, calculate_summary

from .security import current_user, require

router = APIRouter(prefix="/mobile", tags=["Mobile applications"])


def student_codes(data, user):
    if user["person_type"] == "student":
        return {user["person_code"]}
    if user["person_type"] == "parent":
        return {
            r["student_code"]
            for r in data["records"].get("student_parents", {}).values()
            if r["parent_code"] == user["person_code"]
        }
    raise HTTPException(403, "Student or parent account required")


@router.get("/profile")
def profile(request: Request, user=Depends(current_user)):
    data = request.app.state.store.snapshot()
    table = {"employee": "employees", "student": "students", "parent": "parents"}.get(
        user["person_type"]
    )
    person = data["records"].get(table, {}).get(user["person_code"]) if table else None
    return {"account": user, "person": person}


@router.get("/students")
def students(request: Request, user=Depends(current_user)):
    data = request.app.state.store.snapshot()
    codes = student_codes(data, user)
    return [
        data["records"]["students"][c]
        for c in codes
        if c in data["records"].get("students", {})
    ]


@router.get("/students/{code}/fees")
def fees(code: str, request: Request, user=Depends(current_user)):
    data = request.app.state.store.snapshot()
    if code not in student_codes(data, user):
        raise HTTPException(404, "Student not found")
    return calculate_ledger(data, code)


@router.get("/students/{code}/attendance")
def attendance(code: str, request: Request, user=Depends(current_user)):
    data = request.app.state.store.snapshot()
    if code not in student_codes(data, user):
        raise HTTPException(404, "Student not found")
    return [
        r
        for r in data["records"].get("student_attendance", {}).values()
        if r["student_code"] == code
    ]


@router.get("/teacher/payslips")
def payslips(request: Request, user=Depends(current_user)):
    if user["person_type"] != "employee" or user["client"] != "teacher-mobile":
        raise HTTPException(403, "Teacher mobile employee login required")
    data = request.app.state.store.snapshot()
    published = {
        p["code"]
        for p in data["records"].get("payroll_runs", {}).values()
        if p["status"] == "published"
    }
    return [
        {
            **r,
            "lines": [
                l
                for l in data["records"].get("payslip_lines", {}).values()
                if l["payslip_code"] == r["code"]
            ],
        }
        for r in data["records"].get("payslips", {}).values()
        if r["employee_code"] == user["person_code"]
        and r["payroll_run_code"] in published
    ]


@router.get("/teacher/tax-documents")
def tax_docs(request: Request, user=Depends(current_user)):
    if user["person_type"] != "employee" or user["client"] != "teacher-mobile":
        raise HTTPException(403, "Teacher mobile employee login required")
    data = request.app.state.store.snapshot()
    return [
        {k: v for k, v in r.items() if k != "storage_key"}
        for r in data["records"].get("employee_tax_documents", {}).values()
        if r["employee_code"] == user["person_code"] and r.get("published_at")
    ]


@router.get("/admin/overview")
def overview(request: Request, user=Depends(require("reports", "view"))):
    if user["client"] not in {"admin-mobile", "admin-web"}:
        raise HTTPException(403, "Admin client access required")
    return calculate_summary(request.app.state.store.snapshot())
