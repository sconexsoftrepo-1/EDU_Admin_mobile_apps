"""Staff onboarding: teaching staff, non-teaching staff and daily labour.

Every employee gets the next employee ID of the institution, one sequence for all staff:
EMP-<first three letters of the institution>-<number>, e.g. EMP-PRA-005. POST
/master-data/staff-onboarding writes, in one transaction, the employee, the teacher or staff
record, the employee profile (qualification, certificates, Aadhaar, PAN, bank account, previous
experience, employment history, achievements, salary summary) and the monthly salary components.
Files (certificates, Aadhaar and PAN copies, experience letters) follow with POST
/documents/upload (kind employee_document, document_label = the checklist key), which ticks the
profile's document checklist.
"""

import re
from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, Request

from app.core.resources import staff_only
from app.core.security import current_user
from app.core.storage import audit, new_code

from ..onboarding.api import create, department_for, need, table_service
from .schemas import StaffOnboardingInput

router = APIRouter(prefix="/master-data/staff-onboarding", tags=["Master data entry"])

PROFILES = "employee_profiles"
EMPLOYEE_TYPE = {"teaching": "teacher", "non_teaching": "staff", "labour": "labour"}
GRANTS = [("employees", "create")]
KIND_GRANTS = {"teaching": [("teachers", "create")], "non_teaching": [("staff_profiles", "create")], "labour": []}
DEFAULT_DEPARTMENT = {"teaching": "General Studies", "non_teaching": "Administration", "labour": "Support Services"}


def rows(data, table):
    return list(data["records"].get(table, {}).values())


def money(value) -> Decimal:
    return Decimal(str(value or 0)).quantize(Decimal("0.01"))


def institution_prefix(data):
    institution = next(iter(rows(data, "institutions")), None)
    letters = re.sub(r"[^A-Z]", "", str((institution or {}).get("name", "")).upper())
    return (letters[:3] or "EDU").ljust(3, "X")


def next_employee_id(data):
    """EMP-PRA-005: one sequence for every employee of the institution."""
    prefix = f"EMP-{institution_prefix(data)}-"
    used = [int(code[len(prefix):]) for code in data["records"].get("employees", {})
            if code.startswith(prefix) and code[len(prefix):].isdigit()]
    return f"{prefix}{max(used, default=0) + 1:03d}"


def slug(text):
    return re.sub(r"[^a-z0-9]+", "_", text.lower()).strip("_")[:50] or "certificate"


def checklist(body: StaffOnboardingInput):
    """Documents expected for this staff member; files are uploaded after onboarding."""
    items = {"aadhaar_copy": "Aadhaar copy"}
    if body.pan_number:
        items["pan_copy"] = "PAN card copy"
    for name in body.certificates:
        items[f"certificate_{slug(name)}"] = name
    for i, e in enumerate(body.previous_experience, 1):
        items[f"experience_{i}"] = f"Experience certificate: {e.organization}"
    items["bank_proof"] = "Bank passbook / cancelled cheque"
    return {k: {"label": v, "uploaded": False} for k, v in items.items()}


def salary_summary(body: StaffOnboardingInput):
    s = body.salary
    if body.kind == "labour":
        amount = money(s.amount)
        if not amount:
            raise HTTPException(422, "Enter the wage amount")
        monthly = {"monthly": amount, "yearly": amount / 12, "daily": amount * 26}[s.basis].quantize(Decimal("0.01"))
        return {"salary_basis": s.basis, "salary_amount": str(amount), "gross_monthly": str(monthly),
                "deductions_monthly": "0.00", "net_monthly": str(monthly), "in_hand_monthly": str(monthly),
                "ctc_annual": str((monthly * 12).quantize(Decimal("0.01")))}
    earnings = sum((money(c.amount) for c in s.components if c.component_type == "earning"), Decimal("0.00"))
    deductions = sum((money(c.amount) for c in s.components if c.component_type == "deduction"), Decimal("0.00"))
    if not earnings:
        raise HTTPException(422, "Add the salary breakdown (at least one earning)")
    if deductions > earnings:
        raise HTTPException(422, "Deductions cannot exceed earnings")
    net = earnings - deductions
    return {"salary_basis": "monthly", "salary_amount": str(earnings), "gross_monthly": str(earnings),
            "deductions_monthly": str(deductions), "net_monthly": str(net),
            "in_hand_monthly": str(money(s.in_hand_monthly) if s.in_hand_monthly is not None else net),
            "ctc_annual": str(money(s.ctc_annual) if s.ctc_annual is not None else earnings * 12)}


def onboard(data, body: StaffOnboardingInput, actor, employee_code=None):
    existing = data["records"].get("employees", {}).get(employee_code) if employee_code else None
    if employee_code and not existing:
        raise HTTPException(404, "Employee not found")
    if existing and existing.get("employee_type") != EMPLOYEE_TYPE[body.kind]:
        raise HTTPException(422, "Staff kind cannot be changed through onboarding edits")
    old_profile = next((p for p in rows(data, PROFILES) if p["employee_code"] == employee_code), {})
    others = [p for p in rows(data, PROFILES) if p["employee_code"] != employee_code]
    if any(p.get("aadhaar_number") == body.aadhaar_number for p in others):
        raise HTTPException(409, "An employee with this Aadhaar number already exists")
    if body.pan_number and any(p.get("pan_number") == body.pan_number for p in others):
        raise HTTPException(409, "An employee with this PAN already exists")
    if body.kind != "labour" and not body.qualification:
        raise HTTPException(422, "Choose the highest qualification")
    if body.kind != "labour" and not (body.personal.phone and body.personal.email):
        raise HTTPException(422, "Enter the phone number and email")
    summary = salary_summary(body)
    campuses = rows(data, "campuses")
    campus = body.job.campus_code or (existing or {}).get("campus_code") or (campuses[0]["code"] if campuses else None)
    if not campus:
        raise HTTPException(409, "Create the campus first (Settings)")
    department = department_for(data, body.job.department or DEFAULT_DEPARTMENT[body.kind], campus, actor)

    values = {
        **body.personal.model_dump(mode="json", exclude_none=not bool(existing)),
        "code": employee_code or next_employee_id(data),
        "campus_code": campus,
        "department_code": department,
        "employee_type": EMPLOYEE_TYPE[body.kind],
        "designation": body.job.designation,
        "join_date": body.job.join_date.isoformat(),
        "employment_type": "daily_wage" if body.kind == "labour" and body.job.employment_type == "permanent"
        else body.job.employment_type,
        "status": (existing or {}).get("status", "active"),
    }
    if existing:
        employee = table_service("employees").update(data, employee_code, values, actor)
    else:
        employee = create(data, "employees", values, actor)
    q = body.qualification
    qualification_text = (f"{q.level.replace('_', ' ').title()}" + (f" — {q.specialization}" if q.specialization else "")
                          if q else None)
    years = sum(max(0, ((e.to_date or date.today()) - e.from_date).days) for e in body.previous_experience
                if e.from_date) // 365
    role = None
    if body.kind == "teaching":
        table = "teachers"
        role_values = {"employee_code": employee["code"], "qualification": qualification_text,
                       "specialization": q.specialization, "experience_years": years}
    elif body.kind == "non_teaching":
        table = "staff_profiles"
        role_values = {"employee_code": employee["code"], "responsibility": body.job.designation}
    if body.kind != "labour":
        old_role = next((r for r in rows(data, table) if r["employee_code"] == employee["code"]), None)
        role = (table_service(table).update(data, old_role["code"], role_values, actor)
                if old_role else create(data, table, role_values, actor))

    components = []
    old_components = [c for c in rows(data, "employee_salary_components") if c["employee_code"] == employee["code"]]
    if body.kind != "labour":
        for i, c in enumerate(body.salary.components):
            component_values = {
                "employee_code": employee["code"], "component": c.component, "component_type": c.component_type,
                "amount": str(money(c.amount)), "effective_from": body.job.join_date.isoformat()}
            service = table_service("employee_salary_components")
            components.append(service.update(data, old_components[i]["code"], component_values, actor)
                              if i < len(old_components) else create(data, "employee_salary_components", component_values, actor))
    for c in old_components[len(components):]:
        table_service("employee_salary_components").delete(data, c["code"], actor)

    b = body.bank
    profile = {
        **old_profile,
        "code": old_profile.get("code") or new_code("EMPP"),
        "employee_code": employee["code"],
        "staff_kind": body.kind,
        "qualification_level": q.level if q else None,
        "specialization": q.specialization if q else None,
        "aadhaar_number": body.aadhaar_number,
        "pan_number": body.pan_number,
        "bank_account_holder": b.account_holder,
        "bank_account_number": b.account_number,
        "bank_name": b.bank_name,
        "bank_ifsc": b.ifsc,
        "bank_branch": b.branch,
        "qualification_certificates": [{"name": n, "key": f"certificate_{slug(n)}"} for n in body.certificates],
        "previous_experience": [e.model_dump(mode="json") for e in body.previous_experience],
        "employment_history": [h.model_dump(mode="json") for h in body.employment_history],
        "achievements": [a.model_dump(mode="json") for a in body.achievements],
        "document_checklist": {key: {**item, **(old_profile.get("document_checklist", {}).get(key, {})), "label": item["label"]}
                               for key, item in checklist(body).items()},
        **summary,
        "created_by_user_code": old_profile.get("created_by_user_code", actor),
    }
    data["records"].setdefault(PROFILES, {})[profile["code"]] = profile
    audit(data, actor, "edit" if existing else "create", PROFILES, profile["code"])
    return {"employee": employee, "role": role, "profile": profile, "salary_components": components}


@router.get("/options")
def options(request: Request, user=Depends(current_user)):
    """Next employee ID, departments and campuses for the staff forms."""
    staff_only(user)
    data = request.app.state.store.snapshot()
    return {
        "employee_id": next_employee_id(data),
        "departments": sorted({d["name"] for d in rows(data, "departments")}),
        "campuses": [{"code": c["code"], "name": c["name"]} for c in rows(data, "campuses")],
    }


@router.post("", status_code=201)
def post_staff(body: StaffOnboardingInput, request: Request, user=Depends(current_user)):
    staff_only(user)
    with request.app.state.store.transaction() as data:
        need(data, user, *GRANTS, *KIND_GRANTS[body.kind])
        return onboard(data, body, user["code"])


def mask(value, keep=4):
    value = str(value or "")
    return ("•" * max(0, len(value) - keep) + value[-keep:]) if value else None


@router.get("")
def list_staff(request: Request, kind: str = Query("teaching", pattern="^(teaching|non_teaching|labour)$"),
               user=Depends(current_user)):
    """Staff of one kind for the tables: identity, role, qualification, contact, pay and documents.
    Aadhaar, PAN and account numbers are masked."""
    staff_only(user)
    data = request.app.state.store.snapshot()
    need(data, user, ("employees", "view"))
    profiles = {p["employee_code"]: p for p in rows(data, PROFILES)}
    departments = {d["code"]: d["name"] for d in rows(data, "departments")}
    out = []
    for e in sorted(rows(data, "employees"), key=lambda e: e["code"]):
        if e.get("employee_type") != EMPLOYEE_TYPE[kind]:
            continue
        p = profiles.get(e["code"], {})
        docs = p.get("document_checklist") or {}
        out.append({
            "employee_id": e["code"], "name": f"{e['first_name']} {e['last_name']}",
            "designation": e.get("designation"), "department": departments.get(e.get("department_code")),
            "qualification": (p.get("qualification_level") or "").replace("_", " ").title() or None,
            "specialization": p.get("specialization"), "phone": e.get("phone"), "email": e.get("email"),
            "join_date": e.get("join_date"), "employment_type": e.get("employment_type"), "status": e.get("status"),
            "salary_basis": p.get("salary_basis"), "salary_amount": p.get("salary_amount"),
            "gross_monthly": p.get("gross_monthly"), "net_monthly": p.get("net_monthly"),
            "in_hand_monthly": p.get("in_hand_monthly"), "ctc_annual": p.get("ctc_annual"),
            "aadhaar": mask(p.get("aadhaar_number")), "pan": mask(p.get("pan_number")),
            "bank": f"{p.get('bank_name')} {mask(p.get('bank_account_number'))}" if p.get("bank_name") else None,
            "documents_uploaded": sum(1 for d in docs.values() if d.get("uploaded")),
            "documents_expected": len(docs),
        })
    return {"items": out, "total": len(out)}


@router.get("/{employee_code}")
def staff_detail(employee_code: str, request: Request, user=Depends(current_user)):
    staff_only(user)
    data = request.app.state.store.snapshot()
    need(data, user, ("employees", "view"))
    employee = data["records"].get("employees", {}).get(employee_code)
    if not employee:
        raise HTTPException(404, "Employee not found")
    profile = next((p for p in rows(data, PROFILES) if p["employee_code"] == employee_code), None)
    components = [c for c in rows(data, "employee_salary_components") if c["employee_code"] == employee_code]
    role = next((r for table in ("teachers", "staff_profiles") for r in rows(data, table)
                 if r["employee_code"] == employee_code), None)
    department = data["records"].get("departments", {}).get(employee.get("department_code"), {})
    return {"employee": employee, "profile": profile, "salary_components": components,
            "role": role, "department": department.get("name")}


@router.put("/{employee_code}")
def update_staff(employee_code: str, body: StaffOnboardingInput, request: Request, user=Depends(current_user)):
    """Edit the complete onboarding record atomically, retaining employee and document IDs."""
    staff_only(user)
    with request.app.state.store.transaction() as data:
        grants = [("employees", "edit")]
        if body.kind != "labour":
            grants.extend([("teachers" if body.kind == "teaching" else "staff_profiles", "edit"),
                           ("employee_salary_components", "edit")])
        need(data, user, *grants)
        return onboard(data, body, user["code"], employee_code)
