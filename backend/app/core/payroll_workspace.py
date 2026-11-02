"""Salary structure and formatted monthly payslips (dashboard, staff app and PDF).

* ``salary_structure`` — an employee's monthly earnings and deductions (from their salary
  components), with gross, deductions, net, take-home and annual CTC from the onboarding profile.
* ``payslip_view`` — one month's payslip with readable period, employee details and grouped lines.
* ``payslip_pdf`` — the same payslip as a professionally laid-out A4 PDF.

Dashboard: ``GET /api/v1/hr/salary-workspace`` lists employees (payslip viewers) and
``GET /api/v1/hr/salary-workspace/{employee_code}`` returns one employee's structure and payslips.
Staff see only their own.
"""
import io
from datetime import date
from decimal import Decimal, InvalidOperation

from fastapi import APIRouter, Depends, HTTPException, Request

from . import assignment_workspace as aw
from .security import current_user, has_permission

router = APIRouter(prefix="/hr/salary-workspace", tags=["Salary and payslips"])

MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September",
          "October", "November", "December"]
PUBLISHED = {"published", "paid"}


def amount(value) -> Decimal:
    try:
        return Decimal(str(value or 0)).quantize(Decimal("0.01"))
    except (InvalidOperation, ValueError):
        return Decimal("0.00")


def inr(value) -> str:
    """Indian grouping: 1,23,456.00"""
    number = amount(value)
    sign = "-" if number < 0 else ""
    whole, _, fraction = f"{abs(number):.2f}".partition(".")
    if len(whole) > 3:
        head, tail = whole[:-3], whole[-3:]
        groups = []
        while len(head) > 2:
            groups.insert(0, head[-2:])
            head = head[:-2]
        if head:
            groups.insert(0, head)
        whole = ",".join(groups + [tail])
    return f"{sign}{whole}.{fraction}"


def words(value) -> str:
    """Rupees in words (Indian system), e.g. "Forty-seven thousand two hundred rupees only"."""
    ones = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven",
            "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"]
    tens = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"]

    def below_hundred(n):
        return ones[n] if n < 20 else tens[n // 10] + ("-" + ones[n % 10] if n % 10 else "")

    def below_thousand(n):
        hundred, rest = divmod(n, 100)
        parts = ([ones[hundred] + " hundred"] if hundred else []) + ([below_hundred(rest)] if rest else [])
        return " ".join(parts)

    n = int(amount(value))
    paise = int((amount(value) - n) * 100)
    if n == 0:
        text = "zero"
    else:
        parts = []
        for size, label in ((10 ** 7, "crore"), (10 ** 5, "lakh"), (10 ** 3, "thousand")):
            if n >= size:
                parts.append(f"{below_thousand(n // size) if n // size < 1000 else words(n // size).lower()} {label}")
                n %= size
        if n:
            parts.append(below_thousand(n))
        text = " ".join(parts)
    text = text[0].upper() + text[1:] + " rupees"
    if paise:
        text += f" and {below_hundred(paise)} paise"
    return text + " only"


def mask(value, keep=4):
    value = str(value or "")
    return ("X" * max(0, len(value) - keep) + value[-keep:]) if value else ""


def period_label(run):
    start = str((run or {}).get("period_start") or "")[:10]
    try:
        d = date.fromisoformat(start)
        return f"{MONTHS[d.month - 1]} {d.year}"
    except ValueError:
        return "Salary statement"


def employee_details(data, code):
    records = data["records"]
    employee = records.get("employees", {}).get(code, {})
    profile = next((p for p in aw.rows(data, "employee_profiles") if p.get("employee_code") == code), {})
    department = records.get("departments", {}).get(employee.get("department_code"), {})
    return employee, profile, department


def salary_structure(data, code):
    employee, profile, _ = employee_details(data, code)
    components = sorted((c for c in aw.rows(data, "employee_salary_components") if c.get("employee_code") == code
                         and not c.get("effective_to")), key=lambda c: (c.get("component_type") != "earning", c.get("component", "")))
    earnings = [{"component": c["component"], "amount": str(amount(c["amount"]))} for c in components
                if c.get("component_type") == "earning"]
    deductions = [{"component": c["component"], "amount": str(amount(c["amount"]))} for c in components
                  if c.get("component_type") == "deduction"]
    gross = sum((amount(c["amount"]) for c in earnings), Decimal("0.00")) or amount(profile.get("gross_monthly"))
    total_deductions = sum((amount(c["amount"]) for c in deductions), Decimal("0.00")) or amount(profile.get("deductions_monthly"))
    net = gross - total_deductions
    return {"employee_code": code, "earnings": earnings, "deductions": deductions,
            "gross_monthly": str(gross), "deductions_monthly": str(total_deductions), "net_monthly": str(net),
            "in_hand_monthly": str(amount(profile.get("in_hand_monthly")) or net),
            "ctc_annual": str(amount(profile.get("ctc_annual")) or gross * 12),
            "salary_basis": profile.get("salary_basis") or "monthly",
            "effective_from": min((str(c.get("effective_from") or "") for c in components), default="") or employee.get("join_date")}


def payslip_view(data, slip):
    runs = data["records"].get("payroll_runs", {})
    run = runs.get(slip.get("payroll_run_code"), {})
    lines = [l for l in aw.rows(data, "payslip_lines") if l.get("payslip_code") == slip["code"]]
    earnings = [{"component": l["component"], "amount": str(amount(l["amount"]))} for l in lines if l.get("component_type") != "deduction"]
    deductions = [{"component": l["component"], "amount": str(amount(l["amount"]))} for l in lines if l.get("component_type") == "deduction"]
    return {**slip, "period": period_label(run), "period_start": run.get("period_start"), "period_end": run.get("period_end"),
            "run_status": run.get("status"), "earnings": earnings, "deductions": deductions,
            "gross_amount": str(amount(slip.get("gross_amount"))), "deduction_amount": str(amount(slip.get("deduction_amount"))),
            "net_amount": str(amount(slip.get("net_amount"))), "net_in_words": words(slip.get("net_amount"))}


def employee_summary(data, code):
    employee, profile, department = employee_details(data, code)
    return {"code": code, "name": " ".join(aw.name(employee).split()) or code, "designation": employee.get("designation"),
            "department": department.get("name"), "employee_type": employee.get("employee_type"),
            "join_date": employee.get("join_date"), "status": employee.get("status"),
            "pan": mask(profile.get("pan_number")), "bank": f"{profile.get('bank_name') or ''} {mask(profile.get('bank_account_number'))}".strip(),
            "net_monthly": str(amount(profile.get("net_monthly")))}


def employee_payslips(data, code, published_only=True):
    runs = data["records"].get("payroll_runs", {})
    slips = [s for s in aw.rows(data, "payslips") if s.get("employee_code") == code
             and (not published_only or runs.get(s.get("payroll_run_code"), {}).get("status") in PUBLISHED)]
    views = [payslip_view(data, s) for s in slips]
    return sorted(views, key=lambda v: str(v.get("period_start") or ""), reverse=True)


def can_manage(data, user):
    return not aw.personal(user) and has_permission(data, user, "payslips", "view")


@router.get("")
def list_employees(request: Request, user=Depends(current_user)):
    data = request.app.state.store.snapshot()
    if aw.personal(user):
        raise HTTPException(403, "Salary details are for staff")
    if not can_manage(data, user):
        own = user.get("person_code")
        return {"items": [employee_summary(data, own)] if user.get("person_type") == "employee" else [], "can_manage": False}
    counts = {}
    for slip in aw.rows(data, "payslips"):
        counts[slip.get("employee_code")] = counts.get(slip.get("employee_code"), 0) + 1
    items = [{**employee_summary(data, e["code"]), "payslips": counts.get(e["code"], 0)}
             for e in aw.rows(data, "employees") if e.get("status", "active") == "active"]
    return {"items": sorted(items, key=lambda r: r["name"]), "can_manage": True}


@router.get("/{employee_code}")
def employee_salary(employee_code: str, request: Request, user=Depends(current_user)):
    data = request.app.state.store.snapshot()
    manager = can_manage(data, user)
    if not manager and not (user.get("person_type") == "employee" and user.get("person_code") == employee_code):
        raise HTTPException(404, "Employee not found")
    if employee_code not in data["records"].get("employees", {}):
        raise HTTPException(404, "Employee not found")
    return {"employee": employee_summary(data, employee_code), "structure": salary_structure(data, employee_code),
            "payslips": employee_payslips(data, employee_code, published_only=not manager)}


def college_header(data, employee):
    campus = data["records"].get("campuses", {}).get(employee.get("campus_code"), {})
    institution = data["records"].get("institutions", {}).get(campus.get("institution_code"), {}) or next(
        iter(data["records"].get("institutions", {}).values()), {})
    address = ", ".join(str(x) for x in (campus.get("address") or institution.get("address"), campus.get("city") or institution.get("city"),
                                          campus.get("state") or institution.get("state")) if x and not isinstance(x, dict))
    return institution.get("name") or "Edu-Pragathi College", campus.get("name") or "", address


def payslip_pdf(data, slip):
    """A4 payslip: college header, employee details, earnings / deductions table and net pay."""
    from reportlab.lib.colors import HexColor, white
    from reportlab.lib.pagesizes import A4
    from reportlab.pdfgen.canvas import Canvas

    view = payslip_view(data, slip)
    employee, profile, department = employee_details(data, slip["employee_code"])
    college, campus, address = college_header(data, employee)
    ink, muted, line, band, accent = HexColor("#1f2937"), HexColor("#6b7280"), HexColor("#d9dee5"), HexColor("#f3f6f8"), HexColor("#365b45")
    out = io.BytesIO()
    c = Canvas(out, pagesize=A4)
    width, height = A4
    left, right = 40, width - 40
    c.setTitle(f"Payslip {view['period']} - {aw.name(employee)}")

    # Header band.
    c.setFillColor(accent)
    c.rect(0, height - 92, width, 92, stroke=0, fill=1)
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 18)
    c.drawString(left, height - 44, college)
    c.setFont("Helvetica", 9.5)
    c.drawString(left, height - 60, " · ".join(x for x in (campus, address) if x)[:110])
    c.setFont("Helvetica-Bold", 13)
    c.drawRightString(right, height - 44, "PAYSLIP")
    c.setFont("Helvetica", 10)
    c.drawRightString(right, height - 60, view["period"])

    # Employee details (two columns).
    y = height - 122
    c.setFillColor(ink)
    c.setFont("Helvetica-Bold", 11)
    c.drawString(left, y, "Employee details")
    y -= 8
    c.setStrokeColor(line)
    c.line(left, y, right, y)
    details = [
        ("Employee name", " ".join(aw.name(employee).split())), ("Employee ID", employee.get("code", "")),
        ("Designation", employee.get("designation") or "—"), ("Department", department.get("name") or "—"),
        ("Date of joining", str(employee.get("join_date") or "—")[:10]), ("Pay period", view["period"]),
        ("PAN", mask(profile.get("pan_number")) or "—"),
        ("Bank account", f"{profile.get('bank_name') or ''} {mask(profile.get('bank_account_number'))}".strip() or "—"),
    ]
    y -= 18
    for i, (label, value) in enumerate(details):
        x = left if i % 2 == 0 else width / 2 + 10
        c.setFont("Helvetica", 9)
        c.setFillColor(muted)
        c.drawString(x, y, label)
        c.setFont("Helvetica-Bold", 10)
        c.setFillColor(ink)
        c.drawString(x + 100, y, str(value)[:38])
        if i % 2 == 1:
            y -= 18

    # Earnings | Deductions table.
    y -= 14
    col = (right - left) / 2
    c.setFillColor(band)
    c.rect(left, y - 6, right - left, 22, stroke=0, fill=1)
    c.setFillColor(ink)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(left + 8, y + 1, "Earnings")
    c.drawRightString(left + col - 8, y + 1, "Amount (INR)")
    c.drawString(left + col + 8, y + 1, "Deductions")
    c.drawRightString(right - 8, y + 1, "Amount (INR)")
    rows = max(len(view["earnings"]), len(view["deductions"]), 1)
    c.setFont("Helvetica", 10)
    for i in range(rows):
        y -= 20
        if i < len(view["earnings"]):
            c.drawString(left + 8, y, view["earnings"][i]["component"][:34])
            c.drawRightString(left + col - 8, y, inr(view["earnings"][i]["amount"]))
        if i < len(view["deductions"]):
            c.drawString(left + col + 8, y, view["deductions"][i]["component"][:34])
            c.drawRightString(right - 8, y, inr(view["deductions"][i]["amount"]))
    y -= 14
    c.setStrokeColor(line)
    c.line(left, y, right, y)
    c.line(left + col, y, left + col, y + 20 * rows + 34)
    y -= 16
    c.setFont("Helvetica-Bold", 10)
    c.drawString(left + 8, y, "Gross earnings")
    c.drawRightString(left + col - 8, y, inr(view["gross_amount"]))
    c.drawString(left + col + 8, y, "Total deductions")
    c.drawRightString(right - 8, y, inr(view["deduction_amount"]))

    # Net pay.
    y -= 54
    c.setFillColor(HexColor("#e8efe2"))
    c.roundRect(left, y - 18, right - left, 50, 8, stroke=0, fill=1)
    c.setFillColor(accent)
    c.setFont("Helvetica-Bold", 12)
    c.drawString(left + 14, y + 12, "Net pay")
    c.setFont("Helvetica-Bold", 16)
    c.drawRightString(right - 14, y + 10, f"INR {inr(view['net_amount'])}")
    c.setFont("Helvetica", 9)
    c.setFillColor(ink)
    c.drawString(left + 14, y - 6, view["net_in_words"][:110])

    # Footer.
    c.setFont("Helvetica", 8)
    c.setFillColor(muted)
    c.drawString(left, 44, "This is a computer-generated payslip and does not require a signature.")
    c.drawRightString(right, 44, f"Payslip {slip['code']}")
    c.save()
    return out.getvalue()
