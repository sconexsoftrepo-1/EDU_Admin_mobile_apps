"""Salary structure and formatted monthly payslips (dashboard, staff app and PDF).

* ``salary_structure`` — an employee's monthly earnings and deductions (from their salary
  components), with gross, deductions, net, take-home and annual CTC from the onboarding profile.
* ``payslip_view`` — one month's payslip with readable period, employee details and grouped lines.
* ``payslip_pdf`` — the same payslip as a professionally laid-out A4 PDF.

* ``run_payroll`` — creates a month's payroll run per campus, calculates every active employee's
  payslip from their salary components (staff without a salary structure are skipped and listed,
  not a reason to fail the whole run) and publishes it.
* ``form16_pdf`` / ``issue_form16`` — Form 16 Part B (salary and tax statement) for a financial
  year built from that year's published payslips, stored like an uploaded Form 16.

Dashboard: ``GET /api/v1/hr/salary-workspace`` lists employees (payslip viewers) and
``GET /api/v1/hr/salary-workspace/{employee_code}`` returns one employee's structure and payslips.
``POST /api/v1/hr/salary-workspace/runs`` runs payroll for a month and
``POST /api/v1/hr/salary-workspace/{employee_code}/form16`` generates Form 16. Staff see only their own.
"""
import hashlib
import io
import re
from datetime import date, timedelta
from decimal import Decimal, InvalidOperation

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import Field

from . import assignment_workspace as aw
from .security import StrictModel, current_user, has_permission
from .storage import audit, new_code, now

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


def staff_kind(data, employee):
    from .hr_workspace import staff_kind as kind
    return kind(data, employee)


def employee_summary(data, code):
    employee, profile, department = employee_details(data, code)
    return {"code": code, "name": " ".join(aw.name(employee).split()) or code, "designation": employee.get("designation"),
            "department": department.get("name"), "employee_type": employee.get("employee_type"),
            "join_date": employee.get("join_date"), "status": employee.get("status"),
            "pan": mask(profile.get("pan_number")), "bank": f"{profile.get('bank_name') or ''} {mask(profile.get('bank_account_number'))}".strip(),
            "net_monthly": str(amount(profile.get("net_monthly")) or amount(salary_structure(data, code)["net_monthly"])),
            "staff_kind": staff_kind(data, employee)}


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
    return {"items": sorted(items, key=lambda r: r["name"]), "can_manage": True, "runs": run_summaries(data),
            "can_run": can_run(data, user), "can_publish_tax": can_publish_tax(data, user)}


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
    """A4 payslip with the college logo (layout in hr_workspace / pdf_kit)."""
    from .hr_workspace import payslip_document
    return payslip_document(data, slip)


# ---- Payroll runs -------------------------------------------------------------------------
EARNING = {"earning", "earnings", "allowance"}
DEDUCTION = {"deduction", "deductions"}


def can_run(data, user):
    return not aw.personal(user) and has_permission(data, user, "payroll_runs", "create")


def can_publish_tax(data, user):
    return not aw.personal(user) and has_permission(data, user, "employee_tax_documents", "create")


def month_bounds(month: str):
    start = date.fromisoformat(month + "-01")
    end = (start.replace(day=28) + timedelta(days=4)).replace(day=1) - timedelta(days=1)
    return start.isoformat(), end.isoformat()


def run_summaries(data):
    records = data["records"]
    counts, net = {}, {}
    for slip in aw.rows(data, "payslips"):
        run = slip.get("payroll_run_code")
        counts[run] = counts.get(run, 0) + 1
        net[run] = net.get(run, Decimal("0.00")) + amount(slip.get("net_amount"))
    items = [{"code": r["code"], "period": period_label(r), "period_start": r.get("period_start"),
              "campus": records.get("campuses", {}).get(r.get("campus_code"), {}).get("name") or r.get("campus_code"),
              "status": r.get("status"), "payslips": counts.get(r["code"], 0), "net_total": str(net.get(r["code"], Decimal("0.00")))}
             for r in aw.rows(data, "payroll_runs")]
    return sorted(items, key=lambda r: str(r.get("period_start") or ""), reverse=True)


def components_for(data, employee_code, start, end):
    return [c for c in aw.rows(data, "employee_salary_components") if c.get("employee_code") == employee_code
            and str(c.get("effective_from") or "")[:10] <= end and (not c.get("effective_to") or str(c["effective_to"])[:10] >= start)]


def calculate_run(data, run):
    """Payslips for every active employee of the run's campus. Returns (created, skipped)."""
    if run.get("status") not in {"draft", "pending"}:
        raise HTTPException(409, "This payroll run is already calculated")
    if any(p.get("payroll_run_code") == run["code"] for p in aw.rows(data, "payslips")):
        raise HTTPException(409, "Payslips were already calculated for this run")
    start, end = str(run["period_start"])[:10], str(run["period_end"])[:10]
    records = data["records"]
    created, skipped = 0, []
    for employee in aw.rows(data, "employees"):
        if employee.get("campus_code") != run.get("campus_code") or employee.get("status", "active") != "active":
            continue
        if str(employee.get("join_date") or "")[:10] > end:
            continue
        label = " ".join(aw.name(employee).split()) or employee["code"]
        components = components_for(data, employee["code"], start, end)
        if not components:
            skipped.append({"code": employee["code"], "name": label, "reason": "No salary structure"})
            continue
        adjustments = [a for a in aw.rows(data, "payroll_adjustments") if a.get("employee_code") == employee["code"]
                       and a.get("payroll_run_code") == run["code"] and a.get("status") == "approved"]
        lines = components + adjustments
        gross = sum((amount(c["amount"]) for c in lines if c.get("component_type") in EARNING), Decimal("0.00"))
        less = sum((amount(c["amount"]) for c in lines if c.get("component_type") in DEDUCTION), Decimal("0.00"))
        if less > gross:
            skipped.append({"code": employee["code"], "name": label, "reason": "Deductions exceed earnings"})
            continue
        slip_code = new_code("SLIP")
        records.setdefault("payslips", {})[slip_code] = {
            "code": slip_code, "payroll_run_code": run["code"], "employee_code": employee["code"],
            "gross_amount": str(gross), "deduction_amount": str(less), "net_amount": str(gross - less)}
        for line in lines:
            line_code = new_code("LINE")
            records.setdefault("payslip_lines", {})[line_code] = {
                "code": line_code, "payslip_code": slip_code, "component": line["component"],
                "component_type": "deduction" if line.get("component_type") in DEDUCTION else "earning",
                "amount": str(amount(line["amount"]))}
        created += 1
    run["status"] = "calculated"
    return created, skipped


def run_payroll(data, month, campus_code=None, publish=True, actor=None):
    """Create (or continue) the month's payroll run for each campus with active staff."""
    start, end = month_bounds(month)
    campuses = sorted({e.get("campus_code") for e in aw.rows(data, "employees")
                       if e.get("status", "active") == "active" and e.get("campus_code")})
    if campus_code:
        campuses = [c for c in campuses if c == campus_code]
    if not campuses:
        raise HTTPException(409, "No active employees to pay")
    results = []
    for campus in campuses:
        run = next((r for r in aw.rows(data, "payroll_runs") if r.get("campus_code") == campus
                    and str(r.get("period_start") or "")[:10] == start), None)
        fresh = not run
        if fresh:
            code = new_code("PAYRUN")
            run = data["records"].setdefault("payroll_runs", {})[code] = {
                "code": code, "campus_code": campus, "period_start": start, "period_end": end, "status": "draft"}
        created, skipped = 0, []
        if run["status"] in {"draft", "pending"}:
            created, skipped = calculate_run(data, run)
        if fresh and not created:
            # Nobody at this campus could be paid: leave no empty run behind.
            del data["records"]["payroll_runs"][run["code"]]
            if skipped:
                results.append({"code": None, "campus": data["records"].get("campuses", {}).get(campus, {}).get("name") or campus,
                                "status": "not_run", "payslips": 0, "skipped": skipped})
            continue
        if publish and run["status"] == "calculated":
            run["status"] = "published"
        audit(data, actor, "payroll_run", "payroll_runs", run["code"])
        results.append({"code": run["code"], "campus": data["records"].get("campuses", {}).get(campus, {}).get("name") or campus,
                        "status": run["status"], "payslips": created, "skipped": skipped})
    return {"period": period_label({"period_start": start}), "runs": results}


class RunInput(StrictModel):
    month: str = Field(pattern=r"^\d{4}-(0[1-9]|1[0-2])$")
    campus_code: str | None = Field(default=None, max_length=60)
    publish: bool = True


@router.post("/runs")
def create_run(body: RunInput, request: Request, user=Depends(current_user)):
    with request.app.state.store.transaction() as data:
        if not can_run(data, user):
            raise HTTPException(403, "Running payroll is not assigned to this role")
        if body.publish and not has_permission(data, user, "payroll_runs", "approve"):
            raise HTTPException(403, "Publishing payroll is not assigned to this role")
        return run_payroll(data, body.month, body.campus_code, body.publish, user.get("code"))


# ---- Form 16 ------------------------------------------------------------------------------
def fy_bounds(financial_year: str):
    first, second = (int(x) for x in financial_year.split("-"))
    if second != first + 1:
        raise HTTPException(422, "Financial year must be like 2025-2026")
    return f"{first}-04-01", f"{second}-03-31"


def is_tax(component):
    return bool(re.search(r"\b(tds|income ?tax)\b", str(component or ""), re.I))


def form16_statement(data, employee_code, financial_year):
    start, end = fy_bounds(financial_year)
    slips = [s for s in employee_payslips(data, employee_code, published_only=True)
             if start <= str(s.get("period_start") or "")[:10] <= end]
    if not slips:
        raise HTTPException(409, f"No published payslips in financial year {financial_year}")
    earnings, deductions = {}, {}
    for slip in slips:
        for line in slip["earnings"]:
            earnings[line["component"]] = earnings.get(line["component"], Decimal("0.00")) + amount(line["amount"])
        for line in slip["deductions"]:
            deductions[line["component"]] = deductions.get(line["component"], Decimal("0.00")) + amount(line["amount"])
    gross = sum(earnings.values(), Decimal("0.00"))
    tax = sum((v for k, v in deductions.items() if is_tax(k)), Decimal("0.00"))
    other = sum((v for k, v in deductions.items() if not is_tax(k)), Decimal("0.00"))
    months = sorted(slips, key=lambda s: str(s.get("period_start") or ""))
    return {"financial_year": financial_year, "assessment_year": f"{int(financial_year[:4]) + 1}-{int(financial_year[:4]) + 2}",
            "period_from": str(months[0]["period_start"])[:10], "period_to": str(months[-1]["period_end"] or end)[:10],
            "months": len(slips), "earnings": earnings, "deductions": deductions, "gross": gross,
            "tax": tax, "other_deductions": other, "net": gross - tax - other,
            "quarters": quarter_tax(months)}


def quarter_tax(slips):
    quarters = {"Q1 (Apr–Jun)": Decimal("0.00"), "Q2 (Jul–Sep)": Decimal("0.00"),
                "Q3 (Oct–Dec)": Decimal("0.00"), "Q4 (Jan–Mar)": Decimal("0.00")}
    keys = list(quarters)
    for slip in slips:
        month = int(str(slip["period_start"])[5:7])
        index = 3 if month <= 3 else (month - 4) // 3
        quarters[keys[index]] += sum((amount(l["amount"]) for l in slip["deductions"] if is_tax(l["component"])), Decimal("0.00"))
    return quarters


def form16_pdf(data, employee_code, financial_year):
    """Form 16 Part B: employer and employee details, salary paid, deductions and tax deducted."""
    from .hr_workspace import person_block
    from .pdf_kit import Document

    st = form16_statement(data, employee_code, financial_year)
    employee = data["records"]["employees"][employee_code]
    doc = Document(data, "FORM 16 — PART B", f"FY {financial_year} · AY {st['assessment_year']}",
                   campus_code=employee.get("campus_code"),
                   reference="Certificate under section 203 of the Income-tax Act, 1961")
    person_block(doc, data, employee_code, [("Period of employment", f"{st['period_from']} to {st['period_to']}"),
                                            ("Months paid", st["months"])])
    doc.section("1. Salary paid during the year")
    doc.table(["Component", "Amount (INR)"], [[k, inr(v)] for k, v in sorted(st["earnings"].items())],
              widths=[4, 1.5], align="LR", totals=["Gross salary", inr(st["gross"])])
    doc.section("2. Deductions from salary")
    doc.table(["Deduction", "Amount (INR)"], [[k, inr(v)] for k, v in sorted(st["deductions"].items()) if not is_tax(k)],
              widths=[4, 1.5], align="LR", totals=["Total deductions (other than tax)", inr(st["other_deductions"])])
    doc.section("3. Tax deducted at source")
    doc.table(["Quarter", "TDS (INR)"], [[q, inr(v)] for q, v in st["quarters"].items()],
              widths=[4, 1.5], align="LR", totals=["Total tax deducted", inr(st["tax"])])
    doc.highlight("Net salary paid", f"INR {inr(st['net'])}", words(st["net"]))
    doc.note("Prepared from the payslips published for this financial year. Part A (TDS deposited, TAN and challan "
             "details) is issued from the TRACES portal.")
    doc.signature("Employee", "Employer / authorised signatory")
    return doc.finish(), st


def issue_form16(data, files, employee_code, financial_year, actor_user=None, actor_employee=None):
    """Store the generated Form 16 PDF and record it as the employee's tax document (new revision)."""
    from app.modules.documents.files.api import folder_segment, person_folder

    if employee_code not in data["records"].get("employees", {}):
        raise HTTPException(404, "Employee not found")
    if not actor_employee:
        raise HTTPException(422, "Sign in with an employee account to publish Form 16")
    raw, st = form16_pdf(data, employee_code, financial_year)
    key = f"{person_folder(data, 'form_16', employee_code)}/{folder_segment('form_16')}/{new_code('FILE')}.pdf"
    table = data["records"].setdefault("employee_tax_documents", {})
    revision = 1 + max((r.get("revision") or 0 for r in table.values() if r.get("employee_code") == employee_code
                        and r.get("financial_year") == financial_year and r.get("document_type") == "form_16"), default=0)
    code = new_code("TAX")
    employee = data["records"]["employees"][employee_code]
    filename = f"Form16-{financial_year}-{folder_segment(employee.get('employee_number') or employee_code)}.pdf"
    stored = files.metadata(key) if hasattr(files, "metadata") else {"storage_provider": "local"}
    sha = hashlib.sha256(raw).hexdigest()
    record = {"code": code, "employee_code": employee_code, "financial_year": financial_year, "document_type": "form_16",
              "revision": revision, "storage_key": key, "sha256": sha,
              "published_by_employee_code": actor_employee, "published_at": now(), "original_filename": filename,
              "mime_type": "application/pdf", "size_bytes": len(raw), "document_url": f"/api/v1/documents/tax-document/{code}/view",
              "uploaded_at": now(), "uploaded_by_user_code": actor_user, "generated": True, **stored}
    files.put(key, raw, "application/pdf")
    table[code] = record
    data["records"].setdefault("file_storage_objects", {})[code] = {
        **{k: record.get(k) for k in ("original_filename", "mime_type", "size_bytes", "sha256", "document_url", "uploaded_at",
                                      "storage_provider", "s3_bucket", "s3_key", "s3_uri")},
        "code": code, "owner_type": "employee", "owner_code": employee_code, "document_table": "employee_tax_documents",
        "document_code": code, "storage_key": key, "uploaded_by_user_code": actor_user, "deleted_at": None}
    audit(data, actor_user, "form16_generate", "employee_tax_documents", code)
    return key, {k: v for k, v in record.items() if k != "storage_key"}


class Form16Input(StrictModel):
    financial_year: str = Field(pattern=r"^\d{4}-\d{4}$")


@router.post("/{employee_code}/form16", status_code=201)
def generate_form16(employee_code: str, body: Form16Input, request: Request, user=Depends(current_user)):
    files = request.app.state.files
    key = None
    try:
        with request.app.state.store.transaction() as data:
            if not can_publish_tax(data, user):
                raise HTTPException(403, "Publishing Form 16 is not assigned to this role")
            key, record = issue_form16(data, files, employee_code, body.financial_year, user.get("code"),
                                       user.get("person_code") if user.get("person_type") == "employee" else None)
            return record
    except Exception:
        if key:
            try:
                files.delete(key)
            except Exception:
                pass
        raise


@router.get("/{employee_code}/tax-documents")
def employee_tax_documents(employee_code: str, request: Request, user=Depends(current_user)):
    data = request.app.state.store.snapshot()
    if not can_manage(data, user) and not (user.get("person_type") == "employee" and user.get("person_code") == employee_code):
        raise HTTPException(404, "Employee not found")
    items = [{k: v for k, v in r.items() if k != "storage_key"} for r in aw.rows(data, "employee_tax_documents")
             if r.get("employee_code") == employee_code and not r.get("deleted_at")]
    return sorted(items, key=lambda r: (str(r.get("financial_year")), r.get("revision") or 0), reverse=True)


class PaidInput(StrictModel):
    paid_on: date | None = None
    payment_mode: str = Field(default="bank_transfer", pattern="^(bank_transfer|cheque|cash|upi)$")


def mark_paid(data, run, paid_on, mode="bank_transfer"):
    """Every payslip of the run gets a payment reference and receipt number."""
    if run.get("status") not in PUBLISHED:
        raise HTTPException(409, "Publish the payroll before marking it paid")
    period = str(run.get("period_start") or "")[:7].replace("-", "")
    for i, slip in enumerate(sorted((s for s in aw.rows(data, "payslips") if s.get("payroll_run_code") == run["code"]),
                                    key=lambda s: s.get("employee_code") or ""), 1):
        if not slip.get("paid_on"):
            slip.update(paid_on=str(paid_on), payment_mode=mode, receipt_number=f"SAL-{period}-{i:04d}",
                        transaction_reference=f"NEFT{period}{int(hashlib.sha256(slip['code'].encode()).hexdigest()[:8], 16) % 10**8:08d}")
    run.update(status="paid", paid_on=str(paid_on))


@router.post("/runs/{code}/paid")
def run_paid(code: str, body: PaidInput, request: Request, user=Depends(current_user)):
    with request.app.state.store.transaction() as data:
        if not has_permission(data, user, "payroll_runs", "approve"):
            raise HTTPException(403, "Paying payroll is not assigned to this role")
        run = data["records"].get("payroll_runs", {}).get(code)
        if not run:
            raise HTTPException(404, "Payroll run not found")
        mark_paid(data, run, body.paid_on or date.today(), body.payment_mode)
        audit(data, user.get("code"), "payroll_paid", "payroll_runs", code)
        return {"code": code, "status": run["status"]}
