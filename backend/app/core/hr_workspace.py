"""Staff HR workspace: attendance, leave balances and history, bonuses / incentives, salary
payments (receipts) and the formatted HR PDFs — for the dashboard (HR & payroll) and the staff app.

* ``GET  /hr/staff-workspace?month=YYYY-MM``        every employee with the month's attendance,
  leave balances (paid / sick / …), bonuses this year and take-home pay.
* ``GET  /hr/staff-workspace/me`` / ``/{employee}``  one employee in full: salary structure,
  payslips with payment details, leave balances and history, the month's attendance, bonuses,
  Form 16.
* ``POST /hr/staff-workspace/leave/{code}/decision`` approve / reject a leave request.
* ``POST /hr/staff-workspace/adjustments``           add a bonus, incentive or reimbursement.
* ``POST /hr/salary-workspace/runs/{code}/paid``      mark a published payroll as paid (in
  ``payroll_workspace``) — every payslip gets a payment reference and a receipt.

Leave is counted per calendar year on working days (Sundays and holidays are not counted).
PDFs: ``salary_structure_pdf`` and ``salary_receipt_pdf`` (downloaded through
``/documents/{salary-structure|salary-receipt}/{code}/download``).
"""
from datetime import date, timedelta
from decimal import Decimal
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import Field

from . import assignment_workspace as aw
from .payroll_workspace import (amount, employee_details, employee_payslips, mask, month_bounds, period_label,
                                salary_structure, words)
from .pdf_kit import Document, inr
from .security import StrictModel, current_user, has_permission
from .storage import audit, new_code, now

router = APIRouter(prefix="/hr/staff-workspace", tags=["Staff HR"])
EARNING = {"earning", "earnings", "allowance"}


# ---- helpers ------------------------------------------------------------------------------
def can_manage(data, user):
    return not aw.personal(user) and any(has_permission(data, user, t, "view") for t in
                                         ("employees", "payslips", "leave_requests", "employee_attendance"))


def staff_kind(data, employee):
    teaching = employee.get("employee_type") == "teacher" or any(
        t.get("employee_code") == employee.get("code") for t in aw.rows(data, "teachers"))
    return "Teaching staff" if teaching else "Non-teaching staff"


def working_days(start: date, end: date):
    day = start
    while day <= end:
        if day.weekday() != 6:  # Sunday off
            yield day
        day += timedelta(days=1)


def leave_days(request):
    try:
        start, end = date.fromisoformat(str(request["start_date"])[:10]), date.fromisoformat(str(request["end_date"])[:10])
    except (KeyError, ValueError):
        return 0
    return sum(1 for _ in working_days(start, end))


def days_of(value):
    """Whole days from a stored number: SQL Server returns NUMERIC columns as text ("12.00")."""
    try:
        return int(Decimal(str(value or 0)))
    except (ArithmeticError, ValueError):
        return 0


def leave_balances(data, employee_code, year=None):
    """Per leave type: allowed per year, taken (approved), pending and remaining."""
    year = year or date.today().year
    requests = [r for r in aw.rows(data, "leave_requests") if r.get("employee_code") == employee_code
                and str(r.get("start_date") or "")[:4] == str(year)]
    result = []
    for kind in sorted(aw.rows(data, "leave_types"), key=lambda t: -days_of(t.get("annual_days"))):
        mine = [r for r in requests if r.get("leave_type_code") == kind["code"]]
        taken = sum(leave_days(r) for r in mine if r.get("status") == "approved")
        pending = sum(leave_days(r) for r in mine if r.get("status") == "pending")
        allowed = days_of(kind.get("annual_days"))
        result.append({"code": kind["code"], "name": kind.get("name") or kind["code"], "allowed": allowed, "taken": taken,
                       "pending": pending, "remaining": max(0, allowed - taken)})
    return result


def leave_history(data, employee_code):
    types = {t["code"]: t.get("name") for t in aw.rows(data, "leave_types")}
    employees = data["records"].get("employees", {})
    rows = [{**r, "leave_type_name": types.get(r.get("leave_type_code"), r.get("leave_type_code")), "days": leave_days(r),
             "approved_by_name": " ".join(aw.name(employees.get(r.get("approved_by_code") or "", {})).split()) or None}
            for r in aw.rows(data, "leave_requests") if r.get("employee_code") == employee_code]
    return sorted(rows, key=lambda r: str(r.get("start_date") or ""), reverse=True)


def hhmm(value):
    """"08:45" from a time or a timestamp ("2026-10-05T08:45:00+05:30", "1900-01-01 08:45:00")."""
    text = str(value or "")
    if not text:
        return None
    if "T" in text or " " in text:
        text = text.replace("T", " ").split(" ", 1)[1]
    return text[:5]


def month_attendance(data, employee_code, month):
    start, end = (date.fromisoformat(x) for x in month_bounds(month))
    end = min(end, date.today()) if start <= date.today() else end
    marks = {str(r.get("attendance_date"))[:10]: r for r in aw.rows(data, "employee_attendance")
             if r.get("employee_code") == employee_code and month == str(r.get("attendance_date"))[:7]}
    days = []
    day = start
    while day <= end:
        mark = marks.get(day.isoformat())
        status = mark.get("status") if mark else ("holiday" if day.weekday() == 6 else None)
        days.append({"date": day.isoformat(), "weekday": day.strftime("%a"), "status": status,
                     "check_in": hhmm((mark or {}).get("check_in")), "check_out": hhmm((mark or {}).get("check_out"))})
        day += timedelta(days=1)
    counts = {s: sum(1 for d in days if d["status"] == s) for s in ("present", "absent", "leave", "half_day", "holiday")}
    workdays = sum(1 for d in days if d["status"] not in {"holiday", None})
    attended = counts["present"] + counts["half_day"] * 0.5
    return {"month": month, "label": period_label({"period_start": start.isoformat()}), "days": days, **counts,
            "working_days": workdays, "percent": round(attended * 100 / workdays) if workdays else None}


def adjustments(data, employee_code):
    runs = data["records"].get("payroll_runs", {})
    rows = [{**a, "period": period_label(runs.get(a.get("payroll_run_code"), {})),
             "period_start": runs.get(a.get("payroll_run_code"), {}).get("period_start"),
             "category": a.get("category") or kind_of_adjustment(a.get("component"))}
            for a in aw.rows(data, "payroll_adjustments") if a.get("employee_code") == employee_code]
    return sorted(rows, key=lambda r: str(r.get("period_start") or ""), reverse=True)


def kind_of_adjustment(component):
    text = str(component or "").casefold()
    return "Bonus" if "bonus" in text else "Incentive" if "incentive" in text else "Reimbursement" if "reimburse" in text else "Other"


def summary(data, employee, month, year):
    code = employee["code"]
    _, profile, department = employee_details(data, code)
    structure = salary_structure(data, code)
    bonus = sum((amount(a["amount"]) for a in adjustments(data, code) if a.get("status") == "approved"
                 and str(a.get("period_start") or "")[:4] == str(year) and a.get("component_type") in EARNING), Decimal("0.00"))
    att = month_attendance(data, code, month)
    return {"code": code, "name": " ".join(aw.name(employee).split()) or code, "designation": employee.get("designation"),
            "department": department.get("name"), "staff_kind": staff_kind(data, employee), "employee_type": employee.get("employee_type"),
            "net_monthly": structure["net_monthly"], "gross_monthly": structure["gross_monthly"],
            "attendance": {k: att[k] for k in ("present", "absent", "leave", "half_day", "holiday", "working_days", "percent")},
            "leave": leave_balances(data, code, year), "bonus_ytd": str(bonus)}


def detail(data, code, month, year, manager):
    employee = data["records"].get("employees", {}).get(code)
    if not employee:
        raise HTTPException(404, "Employee not found")
    from .payroll_workspace import employee_summary
    tax = [{k: v for k, v in r.items() if k != "storage_key"} for r in aw.rows(data, "employee_tax_documents")
           if r.get("employee_code") == code and not r.get("deleted_at") and r.get("published_at")]
    return {**summary(data, employee, month, year), "employee": employee_summary(data, code),
            "structure": salary_structure(data, code), "payslips": employee_payslips(data, code, published_only=not manager),
            "leave_history": leave_history(data, code), "attendance_month": month_attendance(data, code, month),
            "adjustments": adjustments(data, code),
            "tax_documents": sorted(tax, key=lambda r: (str(r.get("financial_year")), r.get("revision") or 0), reverse=True)}


def this_month():
    return date.today().strftime("%Y-%m")


# ---- endpoints ----------------------------------------------------------------------------
@router.get("")
def listing(request: Request, user=Depends(current_user), month: str = Query(default="", pattern=r"^(\d{4}-\d{2})?$"),
            year: int = Query(default=0, ge=0, le=2100), kind: str = Query(default="", pattern="^(|teaching|non-teaching)$")):
    data = request.app.state.store.snapshot()
    if not can_manage(data, user):
        raise HTTPException(403, "HR records are not assigned to this role")
    month, year = month or this_month(), year or date.today().year
    items = [summary(data, e, month, year) for e in aw.rows(data, "employees") if e.get("status", "active") == "active"]
    if kind:
        items = [i for i in items if (i["staff_kind"] == "Teaching staff") == (kind == "teaching")]
    items.sort(key=lambda r: (r["staff_kind"], r["name"]))
    pending = [{**r, "employee_name": next((i["name"] for i in items if i["code"] == r.get("employee_code")), r.get("employee_code"))}
               for r in leave_history_all(data) if r.get("status") == "pending"]
    return {"month": month, "label": period_label({"period_start": month + "-01"}), "year": year, "items": items,
            "pending_leave": pending, "leave_types": aw.rows(data, "leave_types"),
            "can_decide": has_permission(data, user, "leave_requests", "approve") or has_permission(data, user, "leave_requests", "edit"),
            "can_adjust": has_permission(data, user, "payroll_adjustments", "create")}


def leave_history_all(data):
    types = {t["code"]: t.get("name") for t in aw.rows(data, "leave_types")}
    return sorted(({**r, "leave_type_name": types.get(r.get("leave_type_code")), "days": leave_days(r)}
                   for r in aw.rows(data, "leave_requests")), key=lambda r: str(r.get("start_date") or ""), reverse=True)


@router.get("/me")
def me(request: Request, user=Depends(current_user), month: str = Query(default="", pattern=r"^(\d{4}-\d{2})?$")):
    if user.get("person_type") != "employee":
        raise HTTPException(403, "Staff records are for employees")
    data = request.app.state.store.snapshot()
    return detail(data, user["person_code"], month or this_month(), date.today().year, manager=False)


@router.get("/{employee_code}")
def employee(employee_code: str, request: Request, user=Depends(current_user),
             month: str = Query(default="", pattern=r"^(\d{4}-\d{2})?$"), year: int = Query(default=0, ge=0, le=2100)):
    data = request.app.state.store.snapshot()
    own = user.get("person_type") == "employee" and user.get("person_code") == employee_code
    if not own and not can_manage(data, user):
        raise HTTPException(404, "Employee not found")
    return detail(data, employee_code, month or this_month(), year or date.today().year, manager=not own)


class Decision(StrictModel):
    status: Literal["approved", "rejected"]
    note: str = Field(default="", max_length=500)


@router.post("/leave/{code}/decision")
def decide(code: str, body: Decision, request: Request, user=Depends(current_user)):
    with request.app.state.store.transaction() as data:
        if not (has_permission(data, user, "leave_requests", "approve") or has_permission(data, user, "leave_requests", "edit")):
            raise HTTPException(403, "Approving staff leave is not assigned to this role")
        record = data["records"].get("leave_requests", {}).get(code)
        if not record:
            raise HTTPException(404, "Leave request not found")
        if record.get("status") != "pending":
            raise HTTPException(409, "This leave request was already decided")
        if body.status == "approved":
            balance = next((b for b in leave_balances(data, record["employee_code"], int(str(record["start_date"])[:4]))
                            if b["code"] == record.get("leave_type_code")), None)
            if balance and balance["taken"] + leave_days(record) > balance["allowed"]:
                raise HTTPException(409, f"Only {balance['remaining']} day(s) of {balance['name'].lower()} remain")
        record.update(status=body.status, decision_note=body.note.strip(), decided_at=now(),
                      approved_by_code=user.get("person_code") if user.get("person_type") == "employee" else None)
        account = next((a["code"] for a in data["accounts"].values() if a.get("person_type") == "employee"
                        and a.get("person_code") == record["employee_code"] and a.get("active")), None)
        if account:
            notice = new_code("LNOTICE")
            data["records"].setdefault("notifications", {})[notice] = {
                "code": notice, "user_code": account, "channel": "in_app", "status": "sent", "sent_at": now(), "screen": "leave",
                "title": f"Leave {body.status}",
                "body": f"Your leave from {record['start_date']} to {record['end_date']} was {body.status}."
                        + (f" Note: {body.note.strip()}" if body.note.strip() else "")}
        audit(data, user["code"], f"staff_leave_{body.status}", "leave_requests", code)
        return record


class AdjustmentInput(StrictModel):
    employee_code: str = Field(min_length=1, max_length=60)
    month: str = Field(pattern=r"^\d{4}-(0[1-9]|1[0-2])$")
    category: Literal["Bonus", "Incentive", "Reimbursement"]
    title: str = Field(min_length=2, max_length=120)
    amount: Decimal = Field(gt=0, le=10_000_000)


def add_adjustment(data, employee_code, month, category, title, value, actor=None, extra=None):
    """Approved earning for that month's payroll; added to the payslip when payroll already ran."""
    employee = data["records"].get("employees", {}).get(employee_code)
    if not employee:
        raise HTTPException(404, "Employee not found")
    start, end = month_bounds(month)
    run = next((r for r in aw.rows(data, "payroll_runs") if r.get("campus_code") == employee.get("campus_code")
                and str(r.get("period_start") or "")[:10] == start), None)
    if not run:
        code = new_code("PAYRUN")
        run = data["records"].setdefault("payroll_runs", {})[code] = {
            "code": code, "campus_code": employee.get("campus_code"), "period_start": start, "period_end": end, "status": "draft"}
    code = new_code("ADJ")
    record = {"code": code, "employee_code": employee_code, "component": title, "component_type": "earning",
              "amount": str(amount(value)), "payroll_run_code": run["code"], "status": "approved", "category": category,
              "created_at": now(), **(extra or {})}
    data["records"].setdefault("payroll_adjustments", {})[code] = record
    slip = next((s for s in aw.rows(data, "payslips") if s.get("payroll_run_code") == run["code"]
                 and s.get("employee_code") == employee_code), None)
    if slip:
        line = new_code("LINE")
        data["records"].setdefault("payslip_lines", {})[line] = {
            "code": line, "payslip_code": slip["code"], "component": title, "component_type": "earning", "amount": record["amount"]}
        slip["gross_amount"] = str(amount(slip.get("gross_amount")) + amount(value))
        slip["net_amount"] = str(amount(slip.get("net_amount")) + amount(value))
    audit(data, actor, "payroll_adjustment", "payroll_adjustments", code)
    return record


@router.post("/adjustments", status_code=201)
def create_adjustment(body: AdjustmentInput, request: Request, user=Depends(current_user)):
    with request.app.state.store.transaction() as data:
        if not has_permission(data, user, "payroll_adjustments", "create"):
            raise HTTPException(403, "Bonuses and incentives are not assigned to this role")
        return add_adjustment(data, body.employee_code, body.month, body.category, body.title.strip(), body.amount, user.get("code"))


# ---- PDFs ---------------------------------------------------------------------------------
def person_block(doc, data, code, extra=()):
    employee, profile, department = employee_details(data, code)
    doc.section("Employee details")
    doc.fields([("Employee name", " ".join(aw.name(employee).split())), ("Employee ID", employee.get("employee_number") or code),
                ("Designation", employee.get("designation")), ("Department", department.get("name")),
                ("Staff category", staff_kind(data, employee)), ("Date of joining", str(employee.get("join_date") or "")[:10]),
                ("PAN", mask(profile.get("pan_number"))),
                ("Bank account", f"{profile.get('bank_name') or ''} {mask(profile.get('bank_account_number'))}".strip()),
                *extra])
    return employee


def salary_structure_pdf(data, code):
    if code not in data["records"].get("employees", {}):
        raise HTTPException(404, "Employee not found")
    st = salary_structure(data, code)
    employee = data["records"]["employees"][code]
    doc = Document(data, "SALARY STRUCTURE", f"Effective {str(st.get('effective_from') or '')[:10]}",
                   campus_code=employee.get("campus_code"), reference=f"Employee {employee.get('employee_number') or code}")
    person_block(doc, data, code)
    doc.section("Monthly salary")
    doc.statement("Earnings", [(e["component"], e["amount"]) for e in st["earnings"]],
                  "Deductions", [(d["component"], d["amount"]) for d in st["deductions"]],
                  st["gross_monthly"], st["deductions_monthly"])
    doc.highlight("Net take-home / month", f"INR {inr(st['net_monthly'])}", words(st["net_monthly"]))
    doc.section("Annual view")
    gross, less = amount(st["gross_monthly"]), amount(st["deductions_monthly"])
    doc.table(["Item", "Per month (INR)", "Per year (INR)"],
              [["Gross salary", inr(gross), inr(gross * 12)], ["Deductions", inr(less), inr(less * 12)],
               ["Net salary", inr(gross - less), inr((gross - less) * 12)], ["Cost to college (CTC)", "", inr(st["ctc_annual"])]],
              widths=[3, 2, 2], align="LRR")
    balances = leave_balances(data, code)
    if balances:
        doc.section(f"Leave entitlement {date.today().year}")
        doc.table(["Leave type", "Per year", "Taken", "Pending", "Remaining"],
                  [[b["name"], b["allowed"], b["taken"], b["pending"], b["remaining"]] for b in balances],
                  widths=[3, 1, 1, 1, 1], align="LRRRR")
    doc.note("Amounts are monthly unless stated. Statutory deductions (provident fund, professional tax, TDS) follow the rates "
             "in force; bonuses and incentives are paid through the monthly payroll when approved.")
    return doc.finish()


def payslip_document(data, slip):
    from .payroll_workspace import is_tax, payslip_view
    view = payslip_view(data, slip)
    code = slip["employee_code"]
    employee, profile, department = employee_details(data, code)
    month = str(view.get("period_start") or "")[:7]
    att = month_attendance(data, code, month) if month else None
    doc = Document(data, "PAYSLIP", view["period"], campus_code=employee.get("campus_code"),
                   reference=f"Payslip no. {slip.get('receipt_number') or slip['code'][-12:]}")
    worked = f"{att['present'] + att['half_day'] * 0.5:g} / {att['working_days']}" if att and att.get("working_days") else "—"
    doc.tiles([("Gross earnings", f"INR {inr(view['gross_amount'])}", f"{len(view['earnings'])} components"),
               ("Deductions", f"INR {inr(view['deduction_amount'])}", f"{len(view['deductions'])} components"),
               ("Days worked", worked, f"{att['leave']} leave · {att['absent']} absent" if att else ""),
               ("Net pay", f"INR {inr(view['net_amount'])}", "Credited " + str(slip["paid_on"])[:10] if slip.get("paid_on") else "Published")])
    doc.panels([
        ("Employee", [("Name", " ".join(aw.name(employee).split())), ("Employee ID", employee.get("employee_number") or code),
                      ("Designation", employee.get("designation")), ("Department", department.get("name")),
                      ("Staff category", staff_kind(data, employee)), ("Date of joining", str(employee.get("join_date") or "")[:10])]),
        ("Pay & bank", [("Pay period", view["period"]), ("Pay date", str(slip.get("paid_on") or "")[:10] or "Not paid yet"),
                        ("Mode", str(slip.get("payment_mode") or "bank_transfer").replace("_", " ").title() if slip.get("paid_on") else "—"),
                        ("Transaction no.", slip.get("transaction_reference")), ("Bank", f"{profile.get('bank_name') or ''} {mask(profile.get('bank_account_number'))}".strip()),
                        ("PAN", mask(profile.get("pan_number")))]),
    ])
    doc.section("Earnings and deductions")
    doc.statement("Earnings", [(e["component"], e["amount"]) for e in view["earnings"]],
                  "Deductions", [(d["component"], d["amount"]) for d in view["deductions"]],
                  view["gross_amount"], view["deduction_amount"])
    doc.highlight("Net pay", f"INR {inr(view['net_amount'])}", view["net_in_words"], stamp="PAID" if slip.get("paid_on") else None)
    if att and att.get("working_days"):
        doc.section(f"Attendance — {att['label']}")
        doc.table(["Working days", "Present", "Half day", "On leave", "Absent", "Holidays", "Attendance"],
                  [[att["working_days"], att["present"], att["half_day"], att["leave"], att["absent"], att["holiday"],
                    f"{att['percent']}%" if att["percent"] is not None else "—"]], align="RRRRRRR")
    balances = leave_balances(data, code, int(month[:4]) if month else None)
    if balances:
        doc.section("Leave balance")
        doc.table(["Leave type", "Per year", "Taken", "Pending", "Remaining"],
                  [[b["name"], b["allowed"], b["taken"], b["pending"], b["remaining"]] for b in balances],
                  widths=[3, 1, 1, 1, 1], align="LRRRR")
    if month:
        start_year = int(month[:4]) if int(month[5:7]) >= 4 else int(month[:4]) - 1
        fy_start = f"{start_year}-04"
        ytd = [p for p in employee_payslips(data, code) if fy_start <= str(p.get("period_start") or "")[:7] <= month]
        tds = sum((amount(d["amount"]) for p in ytd for d in p["deductions"] if is_tax(d["component"])), Decimal("0"))
        doc.section(f"Year to date — FY {start_year}-{start_year + 1}")
        doc.table(["Months", "Gross earnings", "Deductions", "TDS", "Net paid"],
                  [[len(ytd), inr(sum((amount(p["gross_amount"]) for p in ytd), Decimal("0"))),
                    inr(sum((amount(p["deduction_amount"]) for p in ytd), Decimal("0"))), inr(tds),
                    inr(sum((amount(p["net_amount"]) for p in ytd), Decimal("0")))]], align="RRRRR")
    doc.note("This is a computer-generated payslip and does not require a signature. For corrections contact the HR & "
             "payroll office within 7 days of the pay date.")
    return doc.finish()


def salary_receipt_pdf(data, slip):
    from .payroll_workspace import payslip_view
    if not slip.get("paid_on"):
        raise HTTPException(409, "This salary has not been paid yet")
    view = payslip_view(data, slip)
    employee = data["records"].get("employees", {}).get(slip["employee_code"], {})
    doc = Document(data, "SALARY PAYMENT RECEIPT", view["period"], campus_code=employee.get("campus_code"),
                   reference=f"Receipt {slip.get('receipt_number') or slip['code'][-10:]}")
    person_block(doc, data, slip["employee_code"])
    doc.section("Payment")
    doc.fields([("Receipt number", slip.get("receipt_number") or slip["code"]), ("Salary month", view["period"]),
                ("Paid on", str(slip["paid_on"])[:10]), ("Payment mode", str(slip.get("payment_mode") or "bank_transfer").replace("_", " ").title()),
                ("Transaction reference", slip.get("transaction_reference")), ("Credited to", employee_details(data, slip["employee_code"])[1].get("bank_name"))])
    doc.table(["Description", "Amount (INR)"],
              [["Gross salary", inr(view["gross_amount"])], ["Less: deductions", inr(view["deduction_amount"])]],
              widths=[4, 1.4], align="LR", totals=["Net salary credited", inr(view["net_amount"])])
    doc.highlight("Amount paid", f"INR {inr(view['net_amount'])}", view["net_in_words"])
    doc.signature("Received by employee", "For the college — Accounts")
    return doc.finish()
