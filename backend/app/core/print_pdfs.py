"""Printable documents in the college layout (pdf_kit, same look as the fee receipt).

    GET  /print/student/{code}              student profile (identity, course, guardians, fees, documents)
    GET  /print/enquiry/{code}              admission enquiry / application
    GET  /print/employee/{code}             staff profile (teaching, non-teaching, daily labour)
    GET  /print/letter/{kind}/{employee}    offer | joining | acceptance letter
    GET  /print/fee-statement/{student}     fee statement: charges, concessions, receipts, balance
    GET  /print/expense/{code}              expense voucher
    GET  /print/scholarship/{code}          scholarship scheme: award, eligibility, terms & conditions
    GET  /print/scholarships                scholarship schemes with award totals (JSON, for the screen)
    POST /print/table                       any on-screen table as a formatted PDF
Every PDF accepts ``?inline=true`` to open in the browser instead of downloading.
"""
from datetime import date, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import Response
from pydantic import Field

from . import assignment_workspace as aw
from .finance_pdfs import METHODS, _charge_rows, _due_label
from .payroll_workspace import mask, salary_structure, words
from .pdf_kit import Document, HexColor, amount, inr
from .security import StrictModel, current_user, has_permission
from .student_leave_workspace import student_context

router = APIRouter(prefix="/print", tags=["Printable documents"])
KINDS = {"teaching": "Teaching staff", "non_teaching": "Non-teaching staff", "labour": "Daily-wage staff"}


def staff(data, user, *tables):
    if user.get("person_type") not in {"employee", "system"}:
        raise HTTPException(403, "Printable records are for college staff")
    if tables and not any(has_permission(data, user, t, "view") for t in tables):
        raise HTTPException(403, "This record is not assigned to your role")


def pdf_response(raw, filename, inline):
    return Response(raw, media_type="application/pdf", headers={
        "Content-Disposition": f'{"inline" if inline else "attachment"}; filename="{filename}"',
        "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"})


def name(person):
    return " ".join(aw.name(person or {}).split())


def nice(value):
    text = str(value if value not in (None, "") else "—")
    return text.replace("_", " ").title() if text.islower() and "@" not in text else text


def when(value):
    text = str(value or "")[:10]
    try:
        d = date.fromisoformat(text)
        return f"{d.day} {d.strftime('%b')} {d.year}"
    except ValueError:
        return text or "—"


def flat(value):
    if isinstance(value, dict):
        return ", ".join(str(v) for v in value.values() if v not in (None, ""))
    if isinstance(value, list):
        return "; ".join(flat(v) for v in value)
    return "" if value is None else str(value)


# ---- Student ------------------------------------------------------------------------------
def student_pdf(data, code):
    records = data["records"]
    student = records.get("students", {}).get(code)
    if not student:
        raise HTTPException(404, "Student not found")
    profile = next((p for p in aw.rows(data, "student_admission_profiles") if p.get("student_code") == code), {})
    place = student_context(data, code)
    charges, totals = _charge_rows(data, code)
    roll = next((e.get("roll_number") for e in aw.rows(data, "student_enrollments")
                 if e.get("student_code") == code and e.get("status") == "active"), None)
    doc = Document(data, "STUDENT PROFILE", student.get("admission_number") or code, campus_code=student.get("campus_code"),
                   reference=f"Printed {when(date.today())}")
    doc.tiles([("Course", place.get("course_name") or "—", place.get("academic_year_name") or ""),
               ("Section · Roll no.", f"{place.get('section_name') or '—'} · {roll or '—'}", f"Year {student.get('current_year') or '—'}"),
               ("Fees paid", f"INR {inr(totals.get('paid'))}" if totals else "—", f"of INR {inr(totals.get('gross'))}" if totals else ""),
               ("Balance due", f"INR {inr(totals.get('outstanding'))}" if totals else "—", nice(student.get("status")))])
    doc.panels([
        ("Identity", [("Name", name(student)), ("Admission no.", student.get("admission_number")), ("Date of birth", when(student.get("date_of_birth"))),
                      ("Gender", nice(student.get("gender"))), ("Blood group", student.get("blood_group")), ("Aadhaar", mask(student.get("aadhaar_number")))]),
        ("Contact", [("Phone", student.get("phone")), ("Email", student.get("email")), ("City", student.get("city")), ("State", student.get("state")),
                     ("Emergency contact", student.get("emergency_contact_name")), ("Emergency phone", student.get("emergency_contact_phone"))]),
    ])
    doc.section("Admission & registration")
    doc.fields([("Admission date", when(student.get("admission_date"))), ("Category", nice(student.get("admission_category"))),
                ("University reg. no.", student.get("university_registration_number")), ("Nationality", student.get("nationality")),
                ("Previous institution", student.get("previous_institution")), ("Previous score", student.get("previous_score")),
                ("Address", flat(student.get("address") or student.get("current_address_details"))), ("Student ID", code)])
    links = [l for l in aw.rows(data, "student_parents") if l.get("student_code") == code]
    if links:
        parents = records.get("parents", {})
        doc.section("Parents & guardians")
        doc.table(["Name", "Relationship", "Phone", "Email", "Occupation"],
                  [[name(parents.get(l["parent_code"], {})), nice(l.get("relationship") or "Parent"), parents.get(l["parent_code"], {}).get("phone"),
                    parents.get(l["parent_code"], {}).get("email"), parents.get(l["parent_code"], {}).get("occupation")] for l in links],
                  widths=[2, 1.2, 1.4, 2.2, 1.4])
    education = student.get("previous_education")
    if isinstance(education, dict) and education:
        doc.section("Previous education")
        doc.fields([(k.replace("_", " ").capitalize(), flat(v)) for k, v in education.items()][:12])
    if charges:
        doc.section("Fee summary")
        doc.table(["Fee head", "Term", "Due date", "Charged", "Paid", "Balance"],
                  [[c.get("fee_head"), c.get("term"), when(c.get("due_date")), inr(c.get("gross")), inr(c.get("paid")), inr(c.get("outstanding"))]
                   for c in charges], widths=[2.4, 1.2, 1.2, 1.3, 1.3, 1.3], align="LLLRRR",
                  totals=["Total", "", "", inr(totals.get("gross")), inr(totals.get("paid")), inr(totals.get("outstanding"))])
    docs = [d for d in aw.rows(data, "documents") if d.get("student_code") == code and not d.get("deleted_at")]
    if docs:
        doc.section("Documents on file")
        doc.table(["Document", "File", "Type"], [[nice(d.get("document_type")), d.get("original_filename"), d.get("mime_type")] for d in docs],
                  widths=[2, 3, 1.4])
    if profile.get("notes"):
        doc.section("Notes")
        doc.para(profile["notes"])
    doc.signature("Student / parent", "Principal / Admissions office")
    return doc.finish()


# ---- Admission enquiry --------------------------------------------------------------------
def enquiry_pdf(data, code):
    records = data["records"]
    row = records.get("admission_enquiries", {}).get(code)
    if not row:
        raise HTTPException(404, "Enquiry not found")
    program = records.get("programs", {}).get(row.get("program_code"), {})
    year = records.get("academic_years", {}).get(row.get("academic_year_code"), {})
    source = records.get("admission_sources", {}).get(row.get("source_code"), {})
    counsellor = records.get("employees", {}).get(row.get("assigned_employee_code"), {})
    status = row.get("workflow_status") or row.get("status") or "new"
    doc = Document(data, "ADMISSION ENQUIRY", f"{name(row)}", campus_code=row.get("campus_code"),
                   reference=f"Ref. {code[-12:]} · {when(row.get('created_at'))}")
    doc.tiles([("Course", program.get("name") or "—", nice(row.get("course_level"))), ("Academic year", year.get("name") or "—"),
               ("Next follow-up", when(row.get("next_follow_up_at")), counsellor and f"Counsellor: {name(counsellor)}" or ""),
               ("Status", nice(status), "Consent recorded" if row.get("communication_consent") else "Consent not recorded")])
    doc.panels([
        ("Applicant", [("Name", name(row)), ("Phone", row.get("phone")), ("Second phone", row.get("secondary_phone")),
                       ("Email", row.get("email")), ("Course level", nice(row.get("course_level"))), ("Branch", program.get("branch"))]),
        ("Parent / guardian", [("Name", row.get("parent_name")), ("Relationship", nice(row.get("guardian_relationship"))),
                               ("Phone", row.get("parent_phone")), ("Mobile", row.get("guardian_mobile")), ("City", (row.get("address") or {}).get("city") if isinstance(row.get("address"), dict) else ""),
                               ("PIN code", (row.get("address") or {}).get("postal_code") if isinstance(row.get("address"), dict) else "")]),
    ])
    doc.section("Address")
    doc.para(flat(row.get("address")) or "Not recorded")
    doc.section("Source & reference")
    doc.fields([("Enquiry source", source.get("name")), ("Reference type", nice(row.get("reference_type"))),
                ("Referred by", row.get("reference_name") or row.get("referrer_name")), ("Reference mobile", row.get("reference_mobile") or row.get("campaign_reference")),
                ("Assigned counsellor", name(counsellor)), ("Enquiry created", when(row.get("created_at")))])
    fees = [s for s in aw.rows(data, "fee_structures") if s.get("program_code") == row.get("program_code")
            and (not row.get("academic_year_code") or s.get("academic_year_code") == row.get("academic_year_code"))]
    if fees:
        heads = records.get("fee_heads", {})
        doc.section("Fee structure for this course")
        doc.table(["Fee head", "Semester", "Due date", "Amount (INR)"],
                  [[heads.get(s.get("fee_head_code"), {}).get("name") or s.get("fee_head_code"), s.get("semester_number") or "", when(s.get("due_date")),
                    inr(s.get("amount"))] for s in sorted(fees, key=lambda s: (str(s.get("semester_number")), str(s.get("due_date"))))],
                  widths=[3, 1, 1.4, 1.6], align="LLLR", totals=["Total", "", "", inr(sum((amount(s.get("amount")) for s in fees), Decimal("0")))])
    doc.section("Next steps")
    doc.bullets(["Bring the original marks memo, transfer certificate, Aadhaar and 4 passport photographs for verification.",
                 "Pay the admission fee to confirm the seat; the fee receipt is issued at the accounts office or in the app.",
                 "Seats are confirmed in order of completed admission; this enquiry does not reserve a seat."], numbered=True)
    doc.signature("Applicant / parent", "Admissions counsellor")
    return doc.finish()


# ---- Employee -----------------------------------------------------------------------------
def employee_bits(data, code):
    records = data["records"]
    employee = records.get("employees", {}).get(code)
    if not employee:
        raise HTTPException(404, "Employee not found")
    profile = next((p for p in aw.rows(data, "employee_profiles") if p.get("employee_code") == code), {})
    department = records.get("departments", {}).get(employee.get("department_code"), {})
    kind = profile.get("staff_kind") or ("teaching" if employee.get("employee_type") == "teacher" else
                                          "labour" if employee.get("employee_type") == "labour" else "non_teaching")
    return employee, profile, department, kind


def employee_pdf(data, code):
    employee, profile, department, kind = employee_bits(data, code)
    st = salary_structure(data, code)
    doc = Document(data, "STAFF PROFILE", employee.get("employee_number") or code, campus_code=employee.get("campus_code"),
                   reference=KINDS.get(kind, "Staff"))
    doc.tiles([("Designation", employee.get("designation") or "—", department.get("name") or ""),
               ("Date of joining", when(employee.get("join_date")), nice(employee.get("employment_type"))),
               ("Gross / month", f"INR {inr(st['gross_monthly'])}", f"CTC INR {inr(st['ctc_annual'])}"),
               ("Status", nice(employee.get("status") or "active"), KINDS.get(kind, ""))])
    doc.panels([
        ("Personal", [("Name", name(employee)), ("Date of birth", when(employee.get("date_of_birth"))), ("Gender", nice(employee.get("gender"))),
                      ("Phone", employee.get("phone")), ("Email", employee.get("email") or employee.get("personal_email")), ("Aadhaar", mask(profile.get("aadhaar_number")))]),
        ("Employment", [("Employee ID", employee.get("employee_number") or code), ("Category", KINDS.get(kind)), ("Department", department.get("name")),
                        ("Employment type", nice(employee.get("employment_type"))), ("PAN", mask(profile.get("pan_number"))),
                        ("Bank", f"{profile.get('bank_name') or ''} {mask(profile.get('bank_account_number'))}".strip())]),
    ])
    doc.section("Address & emergency contact")
    doc.fields([("Address", flat(employee.get("address_details") or employee.get("address"))), ("City", employee.get("city")),
                ("Emergency contact", employee.get("emergency_contact_name")), ("Emergency phone", employee.get("emergency_contact_phone"))])
    if profile.get("qualification_level") or profile.get("specialization"):
        doc.section("Qualifications")
        doc.fields([("Highest qualification", nice(profile.get("qualification_level"))), ("Specialisation", profile.get("specialization"))])
    for key, title in (("previous_experience", "Previous experience"), ("employment_history", "Employment history")):
        items = profile.get(key)
        if isinstance(items, list) and items and isinstance(items[0], dict):
            cols = [k for k in items[0] if k not in {"code"}][:5]
            doc.section(title)
            doc.table([c.replace("_", " ").capitalize() for c in cols], [[flat(i.get(c)) for c in cols] for i in items])
    if st["earnings"] or st["deductions"]:
        doc.section("Salary structure (monthly)")
        doc.statement("Earnings", [(e["component"], e["amount"]) for e in st["earnings"]],
                      "Deductions", [(d["component"], d["amount"]) for d in st["deductions"]], st["gross_monthly"], st["deductions_monthly"])
    docs = [d for d in aw.rows(data, "documents") if d.get("employee_code") == code and not d.get("deleted_at")]
    if docs:
        doc.section("Documents on file")
        doc.table(["Document", "File"], [[nice(d.get("document_type")), d.get("original_filename")] for d in docs], widths=[2, 4])
    doc.signature("Employee", "Principal / HR")
    return doc.finish()


# ---- Letters ------------------------------------------------------------------------------
def letter_pdf(data, kind, code):
    employee, profile, department, staff_kind = employee_bits(data, code)
    st = salary_structure(data, code)
    join = str(employee.get("join_date") or date.today().isoformat())[:10]
    try:
        joined = date.fromisoformat(join)
    except ValueError:
        joined = date.today()
    issued = {"offer": joined - timedelta(days=15), "acceptance": joined - timedelta(days=10), "joining": joined}[kind]
    number = employee.get("employee_number") or code
    ref = f"PJC/HR/{ {'offer': 'OFR', 'joining': 'JNG', 'acceptance': 'ACC'}[kind] }/{joined.year}/{number}".replace(" ", "")
    title = {"offer": "OFFER OF APPOINTMENT", "joining": "JOINING LETTER", "acceptance": "LETTER OF ACCEPTANCE"}[kind]
    doc = Document(data, title, f"Ref. {ref}", campus_code=employee.get("campus_code"), reference=f"Date: {when(issued)}")
    person = name(employee)
    role = employee.get("designation") or KINDS.get(staff_kind, "Staff")
    dept = department.get("name") or "the college"
    address = flat(employee.get("address_details") or employee.get("address")) or employee.get("city") or ""
    basis = profile.get("salary_basis") or "monthly"
    if kind != "acceptance":
        doc.para("To,", gap=0)
        doc.para(person, bold=True, gap=0)
        if address:
            doc.para(address, gap=0)
        if employee.get("phone"):
            doc.para(f"Phone: {employee['phone']}", gap=10)
    if kind == "offer":
        doc.para(f"Subject: Offer of appointment as {role}", bold=True)
        doc.para(f"Dear {employee.get('first_name') or person},")
        doc.para(f"With reference to your application and the interview held with us, we are pleased to offer you the position of "
                 f"{role} in {dept} at {doc.college}. Your appointment will be effective from {when(joined)} on the terms below.")
        doc.tiles([("Position", role, dept), ("Date of joining", when(joined), nice(employee.get("employment_type"))),
                   ("Gross salary", f"INR {inr(st['gross_monthly'])}", f"per month ({basis})"),
                   ("Annual CTC", f"INR {inr(st['ctc_annual'])}", "Cost to college")])
        if st["earnings"]:
            doc.section("Salary structure")
            doc.statement("Earnings", [(e["component"], e["amount"]) for e in st["earnings"]],
                          "Deductions", [(d["component"], d["amount"]) for d in st["deductions"]], st["gross_monthly"], st["deductions_monthly"])
        doc.section("Terms of appointment")
        doc.bullets([
            "Probation: six months from the date of joining; confirmation is subject to satisfactory performance.",
            "Working hours: 9:00 AM to 4:30 PM, Monday to Saturday, with duties as assigned by the Principal / Head of Department.",
            "Leave: 12 days of paid leave and 8 days of sick leave per calendar year, as per the college leave rules.",
            "Notice period: one month on either side after confirmation (15 days during probation), or salary in lieu.",
            "You will maintain confidentiality of college, student and examination records and follow the code of conduct.",
            "Original certificates, identity proof, PAN, bank details and two photographs are to be submitted on joining.",
        ], numbered=True)
        doc.para(f"Please sign and return the enclosed letter of acceptance on or before {when(joined - timedelta(days=5))}. "
                 "We look forward to welcoming you to the college.")
        doc.signature("Accepted by the candidate", "Principal")
    elif kind == "joining":
        doc.para(f"Subject: Joining report — {role}", bold=True)
        doc.para(f"Dear {employee.get('first_name') or person},")
        doc.para(f"We are happy to confirm that you have joined {doc.college} as {role} in {dept} on {when(joined)}. "
                 f"Your employee ID is {number}. Welcome to the college family.")
        doc.panels([("Employment", [("Employee ID", number), ("Designation", role), ("Department", dept),
                                    ("Category", KINDS.get(staff_kind)), ("Employment type", nice(employee.get("employment_type")))]),
                    ("Pay & leave", [("Gross / month", f"INR {inr(st['gross_monthly'])}"), ("Net / month", f"INR {inr(st['net_monthly'])}"),
                                     ("Pay day", "Last working day of the month"), ("Paid leave", "12 days / year"), ("Sick leave", "8 days / year")])])
        doc.section("On your first week")
        doc.bullets(["Collect your staff ID card and app login (EduDesk) from the office.",
                     "Submit originals of certificates for verification; copies are kept in your staff file.",
                     "Meet your Head of Department for your timetable, classes or duties and induction.",
                     "Salary is credited to your bank account monthly; payslips and Form 16 are available in the staff app."], numbered=True)
        doc.signature("Employee", "Principal")
    else:
        doc.para("To,", gap=0)
        doc.para("The Principal", bold=True, gap=0)
        doc.para(doc.college, gap=10)
        doc.para(f"Subject: Acceptance of the offer of appointment as {role}", bold=True)
        doc.para("Respected Sir / Madam,")
        doc.para(f"I, {person}, accept the offer of appointment as {role} in {dept} made to me, with a gross salary of "
                 f"INR {inr(st['gross_monthly'])} per month (annual CTC INR {inr(st['ctc_annual'])}). I will report for duty on {when(joined)}.")
        doc.para("I have read and accept the terms of appointment, including the probation period, working hours, leave rules, "
                 "notice period and the college code of conduct. I confirm that the information and certificates I have "
                 "provided are true.")
        doc.fields([("Name", person), ("Designation", role), ("Phone", employee.get("phone")), ("Date of joining", when(joined))])
        doc.signature(f"Signature of {person}", "Received — HR / Office")
        doc.note("Upload the signed copy of this letter in the employee's staff file (Documents → Acceptance letter).")
    return doc.finish()


# ---- Fee statement & expense voucher --------------------------------------------------------
def fee_statement_pdf(data, code):
    student = data["records"].get("students", {}).get(code)
    if not student:
        raise HTTPException(404, "Student not found")
    place = student_context(data, code)
    charges, totals = _charge_rows(data, code)
    today = date.today()
    receipts = {r.get("payment_code"): r for r in aw.rows(data, "receipts")}
    payments = sorted((p for p in aw.rows(data, "payments") if p.get("student_code") == code and p.get("status") == "settled"),
                      key=lambda p: str(p.get("paid_on") or ""))
    balance = amount(totals.get("outstanding")) if totals else Decimal("0")
    doc = Document(data, "FEE STATEMENT", student.get("admission_number") or code, campus_code=student.get("campus_code"),
                   reference=f"As on {when(today)}")
    doc.tiles([("Total fee", f"INR {inr(totals.get('gross'))}" if totals else "—"),
               ("Concessions", f"INR {inr(amount(totals.get('discount')) + amount(totals.get('scholarship')))}" if totals else "—", "Discounts & scholarships"),
               ("Paid to date", f"INR {inr(totals.get('paid'))}" if totals else "—", f"{len(payments)} receipts"),
               ("Balance due", f"INR {inr(balance)}", "Fully paid" if balance <= 0 else "Pay by the due dates below")])
    doc.panels([("Student", [("Name", place.get("student_name")), ("Admission no.", student.get("admission_number")), ("Course", place.get("course_name"))]),
                ("Class", [("Academic year", place.get("academic_year_name")), ("Section", place.get("section_name")), ("Status", nice(student.get("status")))])])
    doc.section("Fee charges")
    doc.table(["Fee head", "Term", "Due date", "Charged", "Concession", "Paid", "Balance", "Status"],
              [[c.get("fee_head"), c.get("term"), when(c.get("due_date")), inr(c.get("gross")), inr(amount(c.get("discount")) + amount(c.get("scholarship"))),
                inr(c.get("paid")), inr(c.get("outstanding")), "Paid" if amount(c.get("outstanding")) <= 0 else _due_label(c.get("due_date"), today)]
               for c in charges], widths=[2.2, 1, 1.1, 1.2, 1.2, 1.2, 1.2, 1.4], align="LLLRRRRL", font=7.8,
              totals=["Total", "", "", inr(totals.get("gross")), inr(amount(totals.get("discount")) + amount(totals.get("scholarship"))),
                      inr(totals.get("paid")), inr(balance), ""] if totals else None)
    doc.section("Receipts")
    doc.table(["Date", "Receipt no.", "Mode", "Transaction no.", "Amount"],
              [[when(p.get("paid_on")), receipts.get(p["code"], {}).get("receipt_number") or p["code"][-10:], METHODS.get(p.get("method"), p.get("method")),
                p.get("transaction_reference") or "—", inr(p.get("amount"))] for p in payments],
              widths=[1.2, 1.8, 1.2, 2, 1.4], align="LLLLR", totals=["Total paid", "", "", "", inr(sum((amount(p.get("amount")) for p in payments), Decimal("0")))])
    if balance > 0:
        doc.highlight("Balance due", f"INR {inr(balance)}", words(balance))
    else:
        doc.highlight("Fee account", "SETTLED", "No dues on this account", stamp="PAID")
    return doc.finish()


def expense_pdf(data, code):
    records = data["records"]
    expense = records.get("expenses", {}).get(code)
    if not expense:
        raise HTTPException(404, "Expense not found")
    vendor = records.get("vendors", {}).get(expense.get("vendor_code"), {})
    approver = records.get("employees", {}).get(expense.get("approved_by_code"), {})
    entries = [e for e in aw.rows(data, "expense_payment_entries") if e.get("expense_code") == code]
    paid = sum((amount(e.get("amount")) for e in entries), Decimal("0"))
    status = str(expense.get("payment_status") or "unpaid")
    doc = Document(data, "EXPENSE VOUCHER", f"No. {code[-12:]}", campus_code=expense.get("campus_code"),
                   reference=f"Dated {when(expense.get('expense_date'))}")
    doc.tiles([("Category", nice(expense.get("category"))), ("Expense date", when(expense.get("expense_date"))),
               ("Paid", f"INR {inr(paid)}", when(expense.get("paid_on")) if expense.get("paid_on") else "Not paid"),
               ("Amount", f"INR {inr(expense.get('amount'))}", nice(status))])
    doc.panels([("Paid to", [("Vendor / payee", vendor.get("name") or "—"), ("Phone", vendor.get("phone")), ("Email", vendor.get("email")),
                             ("GST / tax ref.", vendor.get("tax_reference"))]),
                ("Approval", [("Approved by", name(approver) or "—"), ("Status", nice(status)), ("Paid on", when(expense.get("paid_on"))),
                              ("Currency", expense.get("currency") or "INR")])])
    doc.section("Particulars")
    doc.table(["Description", "Category", "Amount (INR)"], [[expense.get("description"), nice(expense.get("category")), inr(expense.get("amount"))]],
              widths=[4, 1.6, 1.4], align="LLR", totals=["Total", "", inr(expense.get("amount"))])
    if entries:
        doc.section("Payments")
        doc.table(["Date", "Mode", "Reference", "Amount"], [[when(e.get("paid_on")), METHODS.get(e.get("method"), e.get("method")), e.get("reference") or "—",
                                                            inr(e.get("amount"))] for e in entries], widths=[1.3, 1.3, 2.4, 1.4], align="LLLR")
    doc.highlight("Amount", f"INR {inr(expense.get('amount'))}", words(expense.get("amount")),
                  stamp="PAID" if status == "paid" else "VOID" if status == "void" else None,
                  stamp_color=HexColor("#b43540") if status == "void" else None)
    doc.signature("Prepared by — Accounts", "Approved by — Principal")
    return doc.finish()


# ---- Scholarships -------------------------------------------------------------------------
def scheme_view(data, s):
    awards = [a for a in aw.rows(data, "student_scholarships") if a.get("scholarship_code") == s["code"]]
    rules = s.get("eligibility_rules") if isinstance(s.get("eligibility_rules"), dict) else {}
    year = data["records"].get("academic_years", {}).get(s.get("academic_year_code"), {})
    granted = [a for a in awards if a.get("status") in {"approved", "disbursed"}]
    return {**{k: v for k, v in s.items() if k != "eligibility_rules"}, "rules": rules, "academic_year_name": year.get("name"),
            "awards": len(awards), "granted": len(granted), "pending": sum(1 for a in awards if a.get("status") == "pending"),
            "granted_amount": str(sum((amount(a.get("amount")) for a in granted), Decimal("0")))}


def percent(value):
    number = amount(value)
    return f"{int(number)}" if number == int(number) else f"{number.normalize():f}"


def award_label(s, short=False):
    if s.get("award_method") == "percentage" and s.get("award_percent"):
        return f"{percent(s['award_percent'])}% of tuition" + ("" if short else f" (max INR {inr(s.get('maximum_amount'))})")
    return f"Up to INR {inr(s.get('maximum_amount'))}"


def scholarship_pdf(data, code):
    s = data["records"].get("scholarships", {}).get(code)
    if not s:
        raise HTTPException(404, "Scholarship not found")
    v = scheme_view(data, s)
    rules = v["rules"]
    doc = Document(data, "SCHOLARSHIP SCHEME", s.get("name") or code, reference=f"Academic year {v['academic_year_name'] or '—'}")
    doc.tiles([("Award", award_label(s, short=True), f"max INR {inr(s.get('maximum_amount'))} / student / year"), ("Sponsor", s.get("sponsor") or "College", ""),
               ("Students awarded", str(v["granted"]), f"{v['pending']} pending"), ("Granted so far", f"INR {inr(v['granted_amount'])}")])
    if rules.get("description"):
        doc.section("About the scheme")
        doc.para(rules["description"])
    doc.panels([("Award", [("Award type", nice(s.get("award_method"))), ("Amount", award_label(s)), ("Sponsor", s.get("sponsor") or "College"),
                           ("Academic year", v["academic_year_name"])]),
                ("Application", [("How to apply", rules.get("how_to_apply") or "Accounts office / app"), ("Last date", when(rules.get("last_date"))),
                                 ("Renewal", rules.get("renewal") or "Yearly, on review"), ("Disbursal", rules.get("disbursal") or "Adjusted against fees")])])
    for key, title in (("criteria", "Eligibility criteria"), ("documents", "Documents required"), ("terms", "Terms & conditions")):
        items = rules.get(key)
        if items:
            doc.section(title)
            doc.bullets(items if isinstance(items, list) else [items], numbered=key == "terms")
    awards = [a for a in aw.rows(data, "student_scholarships") if a.get("scholarship_code") == code]
    if awards:
        students = data["records"].get("students", {})
        doc.section("Students awarded")
        doc.table(["Student", "Admission no.", "Course", "Amount", "Status"],
                  [[name(students.get(a.get("student_code"), {})), students.get(a.get("student_code"), {}).get("admission_number"),
                    student_context(data, a.get("student_code")).get("course_name"), inr(a.get("amount")), nice(a.get("status"))]
                   for a in awards], widths=[2, 1.6, 2, 1.3, 1.1], align="LLLRL",
                  totals=["Total granted", "", "", inr(v["granted_amount"]), ""])
    doc.signature("Scholarship committee", "Principal")
    return doc.finish()


# ---- Generic table ------------------------------------------------------------------------
class TableInput(StrictModel):
    title: str = Field(min_length=1, max_length=120)
    subtitle: str = Field(default="", max_length=200)
    columns: list[str] = Field(min_length=1, max_length=20)
    rows: list[list[str | int | float | None]] = Field(max_length=5000)
    filename: str = Field(default="report", max_length=80)


def looks_numeric(values):
    seen = [str(v) for v in values if v not in (None, "", "—")]
    return bool(seen) and all(str(v).replace(",", "").replace("₹", "").replace("INR", "").strip().lstrip("-").replace(".", "", 1).isdigit()
                              for v in seen)


def table_pdf(data, body):
    cols = body.columns
    rows = [[("" if c is None else str(c)) for c in r][:len(cols)] + [""] * max(0, len(cols) - len(r)) for r in body.rows]
    total = None
    if rows and str(rows[-1][0]).strip().lower() in {"total", "grand total"}:
        total, rows = rows[-1], rows[:-1]
    numeric = [looks_numeric([r[i] for r in rows]) for i in range(len(cols))]
    widths = [1.35 if n else max(1.1, min(3.2, max((len(str(r[i])) for r in rows[:200]), default=8) / 9)) for i, n in enumerate(numeric)]
    short = body.subtitle if len(body.subtitle) <= 60 else f"{len(rows)} record(s)"
    doc = Document(data, body.title.upper()[:48], short, wide=len(cols) > 6, reference=f"{len(rows)} record(s) · {when(date.today())}")
    if len(body.subtitle) > 60:
        doc.note(body.subtitle)
    doc.table(cols, rows, widths=widths, align="".join("R" if n else "L" for n in numeric), totals=total,
              font=7.6 if len(cols) > 8 else 8.4)
    return doc.finish()


# ---- Routes -------------------------------------------------------------------------------
@router.get("/student/{code}")
def print_student(code: str, request: Request, user=Depends(current_user), inline: bool = False):
    data = request.app.state.store.snapshot()
    staff(data, user, "students")
    return pdf_response(student_pdf(data, code), f"student-{code}.pdf", inline)


@router.get("/enquiry/{code}")
def print_enquiry(code: str, request: Request, user=Depends(current_user), inline: bool = False):
    data = request.app.state.store.snapshot()
    staff(data, user, "admission_enquiries", "admission_applications")
    return pdf_response(enquiry_pdf(data, code), f"enquiry-{code}.pdf", inline)


@router.get("/employee/{code}")
def print_employee(code: str, request: Request, user=Depends(current_user), inline: bool = False):
    data = request.app.state.store.snapshot()
    staff(data, user, "employees")
    return pdf_response(employee_pdf(data, code), f"staff-{code}.pdf", inline)


@router.get("/letter/{kind}/{code}")
def print_letter(kind: str, code: str, request: Request, user=Depends(current_user), inline: bool = False):
    if kind not in {"offer", "joining", "acceptance"}:
        raise HTTPException(404, "Letter type not found")
    data = request.app.state.store.snapshot()
    own = user.get("person_type") == "employee" and user.get("person_code") == code
    if not own:
        staff(data, user, "employees")
    return pdf_response(letter_pdf(data, kind, code), f"{kind}-letter-{code}.pdf", inline)


@router.get("/fee-statement/{code}")
def print_fee_statement(code: str, request: Request, user=Depends(current_user), inline: bool = False):
    from app.modules.documents.files.api import permitted_person
    data = request.app.state.store.snapshot()
    # Students and parents open their own (their child's) statement in the app.
    if not (user.get("person_type") in {"student", "parent"} and permitted_person(data, user, "student", code)):
        staff(data, user, "student_fee_charges", "payments", "students")
    return pdf_response(fee_statement_pdf(data, code), f"fee-statement-{code}.pdf", inline)


@router.get("/expense/{code}")
def print_expense(code: str, request: Request, user=Depends(current_user), inline: bool = False):
    data = request.app.state.store.snapshot()
    staff(data, user, "expenses")
    return pdf_response(expense_pdf(data, code), f"expense-{code}.pdf", inline)


@router.get("/scholarships")
def list_schemes(request: Request, user=Depends(current_user)):
    data = request.app.state.store.snapshot()
    staff(data, user, "scholarships", "student_scholarships")
    items = [scheme_view(data, s) for s in aw.rows(data, "scholarships")]
    for item in items:
        item["award_label"] = award_label(item)
    return {"items": sorted(items, key=lambda r: str(r.get("name")))}


@router.get("/scholarship/{code}")
def print_scholarship(code: str, request: Request, user=Depends(current_user), inline: bool = False):
    data = request.app.state.store.snapshot()
    staff(data, user, "scholarships", "student_scholarships")
    return pdf_response(scholarship_pdf(data, code), f"scholarship-{code}.pdf", inline)


@router.post("/table")
def print_table(body: TableInput, request: Request, user=Depends(current_user), inline: bool = Query(default=False)):
    data = request.app.state.store.snapshot()
    staff(data, user)
    safe = "".join(ch if ch.isalnum() or ch in "-_" else "-" for ch in body.filename)[:60] or "report"
    return pdf_response(table_pdf(data, body), f"{safe}.pdf", inline)
