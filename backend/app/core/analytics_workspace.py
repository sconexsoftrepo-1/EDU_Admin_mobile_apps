"""Detailed data behind the dashboard's Admission Analytics and Campus Insights tabs.

Rows are sent rather than totals so that every filter updates all charts instantly in the browser.
Figures reuse the existing ledger, cashbook and enquiry rules. Personal details are removed from a
row unless the role may view enquiries or the enquiry is the viewer's own.
"""
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request

from . import academic_progress as academics
from . import admission_insights as admissions
from . import assignment_workspace as aw
from . import calendar_workspace as calendar
from .dashboard_overview import amount, counts_section, pending, ZERO
from .security import current_user, has_permission

router = APIRouter(prefix="/dashboard", tags=["Dashboard analytics"])
# Every category the enquiry form offers, in the form's order, even with no enquiries yet.
REFERENCE_ORDER = ["walk_in", "employee", "staff", "relative", "advertising", "post", "social_media", "other"]


def staff_only(user):
    if user.get("person_type") not in {"employee", "system"}:
        raise HTTPException(403, "The dashboard is for college staff")


def stage_of(status, has_application=False):
    if status == "joined":
        return "joined"
    if status == "applied" or has_application:
        return "application"
    return "enquiry"


def admission_rows(data, user, can_view_all):
    records = data["records"]
    programs, years = records.get("programs", {}), records.get("academic_years", {})
    employees = records.get("employees", {})
    applications = aw.rows(data, "admission_applications")
    linked = {a.get("enquiry_code") for a in applications if a.get("enquiry_code")}
    followups = {}
    for row in aw.rows(data, "enquiry_followups"):
        followups.setdefault(row.get("enquiry_code"), []).append(row)
    person, account = user.get("person_code"), user.get("code")
    enquiries = []
    by_code = {}
    for enquiry in aw.rows(data, admissions.TABLE):
        base = admissions.enquiry_row(data, enquiry)
        program = programs.get(enquiry.get("program_code"), {})
        year = years.get(enquiry.get("academic_year_code"), {})
        done = sorted(followups.get(enquiry.get("code"), []), key=lambda f: str(f.get("occurred_at") or ""))
        latest_next = done[-1].get("next_follow_up_at") if done else None
        mine = bool((person and enquiry.get("assigned_employee_code") == person) or enquiry.get("recorded_by") == account)
        visible = can_view_all or mine
        row = {
            "key": enquiry.get("code"), "visible": visible, "mine": mine,
            "course_level": enquiry.get("course_level") or program.get("course_level"),
            "program_code": enquiry.get("program_code"), "course_name": base["course_name"],
            "academic_year_code": enquiry.get("academic_year_code"), "academic_year": year.get("name"),
            "reference_type": base["reference_type"], "reference_label": base["reference_label"],
            "status": base["status"], "stage": stage_of(base["status"], enquiry.get("code") in linked),
            "has_application": enquiry.get("code") in linked,
            "next_follow_up_at": enquiry.get("next_follow_up_at") or latest_next,
            "followups_done": len(done), "recorded_at": base["recorded_at"],
            # Personal details only for those allowed to see them.
            "code": base["code"] if visible else None, "name": base["name"] if visible else None,
            "phone": enquiry.get("phone") if visible else None,
            "reference_name": base["reference_name"] if visible else None,
            "assigned_to": aw.name(employees.get(enquiry.get("assigned_employee_code"), {})).strip() or None if visible else None,
        }
        enquiries.append(row)
        by_code[enquiry.get("code")] = row
    apps = []
    sources = records.get("admission_sources", {})
    for app in applications:
        program = programs.get(app.get("program_code"), {})
        year = years.get(app.get("academic_year_code"), {})
        origin = by_code.get(app.get("enquiry_code"))
        reference = (origin or {}).get("reference_type") or sources.get(app.get("source_code"), {}).get("channel") or "other"
        apps.append({
            "key": app.get("code"), "visible": can_view_all, "code": app.get("code") if can_view_all else None,
            "name": " ".join(aw.name(app).split()) if can_view_all else None,
            "phone": app.get("phone") if can_view_all else None, "course_level": program.get("course_level"),
            "program_code": app.get("program_code"), "course_name": program.get("name"),
            "academic_year_code": app.get("academic_year_code"), "academic_year": year.get("name"),
            "reference_type": reference, "reference_label": admissions.label(reference),
            "status": app.get("status"), "applied_on": app.get("applied_on"), "enquiry_code": app.get("enquiry_code"),
        })
    return enquiries, apps


@router.get("/admission-analytics")
def admission_analytics(request: Request, user=Depends(current_user)):
    staff_only(user)
    data = getattr(request.state, "auth_data", None) or request.app.state.store.snapshot()
    can_view_all = not aw.teaching(user) and has_permission(data, user, admissions.TABLE, "view")
    enquiries, applications = admission_rows(data, user, can_view_all)
    seen = {r["reference_type"] for r in enquiries + applications}
    keys = REFERENCE_ORDER + sorted(seen - set(REFERENCE_ORDER))
    return {
        "can_view_all": can_view_all,
        "today": academics.local_now().date().isoformat(),
        "enquiries": enquiries,
        "applications": applications,
        "options": {
            "references": [{"key": k, "label": admissions.label(k)} for k in keys],
            "courses": sorted(({"code": p["code"], "name": p.get("name"), "level": p.get("course_level")}
                               for p in aw.rows(data, "programs")), key=lambda c: str(c["name"])),
            "years": sorted(({"code": y["code"], "name": y.get("name"), "program_code": y.get("program_code")}
                             for y in aw.rows(data, "academic_years")), key=lambda y: str(y["name"])),
        },
    }


def collection_rows(data):
    records = data["records"]
    allocations = {}
    for row in aw.rows(data, "payment_allocations"):
        allocations.setdefault(row.get("payment_code"), []).append(row)
    charges, structures = records.get("student_fee_charges", {}), records.get("fee_structures", {})
    heads, programs = records.get("fee_heads", {}), records.get("programs", {})
    rows = []
    for payment in aw.rows(data, "payments"):
        if payment.get("status") != "settled":
            continue
        common = {"date": str(payment.get("paid_on") or "")[:10], "method": payment.get("method")}
        left = amount(payment.get("amount"))
        for allocation in allocations.get(payment.get("code"), []):
            structure = structures.get(charges.get(allocation.get("charge_code"), {}).get("fee_structure_code"), {})
            value = amount(allocation.get("amount"))
            left -= value
            rows.append({**common, "amount": float(value), "purpose": heads.get(structure.get("fee_head_code"), {}).get("name") or "Other",
                         "year": structure.get("academic_year_code"),
                         "department": programs.get(structure.get("program_code"), {}).get("department_code")})
        # Money received but not yet matched to a fee still counts as collected, as in the ledger.
        if left > 0:
            rows.append({**common, "amount": float(left), "purpose": "Not allocated to a fee", "year": None, "department": None})
    methods = {p.get("code"): p.get("method") for p in aw.rows(data, "payments")}
    for refund in aw.rows(data, "refunds"):
        rows.append({"date": str(refund.get("refunded_on") or "")[:10], "method": methods.get(refund.get("payment_code")),
                     "amount": -float(amount(refund.get("amount"))), "purpose": "Refunds", "year": None, "department": None})
    return rows


def due_rows(data, today):
    from app.modules.finance.transactions.api import build_ledger_index, calculate_ledger

    records = data["records"]
    structures, programs = records.get("fee_structures", {}), records.get("programs", {})
    rows = []
    index = build_ledger_index(data)
    for student in aw.rows(data, "students"):
        for charge in calculate_ledger(data, student["code"], index=index)["charges"]:
            remaining = amount(charge.get("outstanding"))
            if remaining <= 0:
                continue
            structure = structures.get(charge.get("fee_structure_code"), {})
            due = str(charge.get("due_date") or "")[:10]
            rows.append({"student_code": student["code"], "student": " ".join(aw.name(student).split()) or student["code"],
                         "course": programs.get(structure.get("program_code"), {}).get("name"),
                         "department": programs.get(structure.get("program_code"), {}).get("department_code"),
                         "year": structure.get("academic_year_code"), "purpose": charge.get("fee_head"),
                         "due_date": due, "amount": float(remaining),
                         "days_overdue": (today - date.fromisoformat(due)).days if due and due < today.isoformat() else 0})
    return rows


def cashbook_section(data, today):
    from app.modules.reports.downloads.api import cash_entries

    day = today.isoformat()
    entries = [{**e, "date": str(e["date"])[:10]} for e in cash_entries(data)]
    balance = lambda rows: sum((amount(r["receipt"]) - amount(r["payment"]) for r in rows), ZERO)
    opening = balance(e for e in entries if e["date"] < day)
    todays = [e for e in entries if e["date"] == day]
    receipts = sum((amount(e["receipt"]) for e in todays), ZERO)
    payments = sum((amount(e["payment"]) for e in todays), ZERO)
    return {"opening": float(opening), "receipts": float(receipts), "payments": float(payments),
            "closing": float(opening + receipts - payments),
            "recent": [{"date": e["date"], "description": e["description"], "reference": e["reference"],
                        "receipt": float(amount(e["receipt"])), "payment": float(amount(e["payment"]))}
                       for e in entries[-5:][::-1]]}


def operations_section(data, user):
    metrics = counts_section(data, user)["metrics"]
    allowed = lambda table: has_permission(data, user, table, "view")
    if allowed("hostel_permissions"):
        metrics["hostel_permissions"] = {"label": "Pending permissions", "value": pending(aw.rows(data, "hostel_permissions")), "module": "hostel-permissions", "hint": "Hostel leave requests"}
    if allowed("purchase_requests"):
        metrics["purchases"] = {"label": "Purchase approvals", "value": pending(aw.rows(data, "purchase_requests")), "module": "purchase-requests", "hint": "Waiting for approval"}
    if allowed("vehicles"):
        metrics["vehicles"] = {"label": "Transport vehicles", "value": len(aw.rows(data, "vehicles")), "module": "buses", "hint": "Registered buses"}
    return {k: {"label": v["label"], "value": v["value"], "module": v.get("module"), "hint": v.get("hint"), "kind": v.get("kind", "number")}
            for k, v in metrics.items() if k in {"certificates", "hostel", "student_leave", "staff_leave", "payroll_pending", "hostel_permissions", "purchases", "vehicles"}}


@router.get("/campus-analytics")
def campus_analytics(request: Request, user=Depends(current_user)):
    staff_only(user)
    data = getattr(request.state, "auth_data", None) or request.app.state.store.snapshot()
    today = academics.local_now().date()
    teaching = aw.teaching(user)
    allowed = lambda table: not teaching and has_permission(data, user, table, "view")
    result = {"today": today.isoformat(), "collections": None, "dues": None, "cashbook": None, "expenses": None,
              "operations": {}, "activity": None, "options": {"departments": [], "years": []}}
    if allowed("payments"):
        result["collections"] = collection_rows(data)
        result["dues"] = due_rows(data, today)
        result["cashbook"] = cashbook_section(data, today)
        result["options"]["years"] = sorted(({"code": y["code"], "name": y.get("name")} for y in aw.rows(data, "academic_years")), key=lambda y: str(y["name"]))
    if allowed("departments") or allowed("payments"):
        result["options"]["departments"] = sorted(({"code": d["code"], "name": d.get("name")} for d in aw.rows(data, "departments")), key=lambda d: str(d["name"]))
    if allowed("expenses"):
        result["expenses"] = [{"date": str(e.get("expense_date") or "")[:10], "amount": float(amount(e.get("amount"))),
                               "category": str(e.get("category") or "Uncategorised"), "description": e.get("description"),
                               "status": e.get("payment_status")} for e in aw.rows(data, "expenses")]
    if not teaching:
        result["operations"] = operations_section(data, user)
    if teaching or calendar.staff_can_view(data, user):
        events = calendar.listing(request, None, user)["items"]
        since = (today - timedelta(days=14)).isoformat()
        result["activity"] = [{"code": e.get("code"), "title": e.get("title"), "starts_at": e.get("starts_at"),
                               "detail": e.get("place") or e.get("short_description")}
                              for e in events if str(e.get("starts_at") or "")[:10] >= since][:6]
    return result
