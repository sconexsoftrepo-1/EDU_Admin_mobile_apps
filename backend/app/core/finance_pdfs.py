"""Finance PDFs in the college layout (pdf_kit): fee receipts and report exports."""
from datetime import date
from decimal import Decimal

from . import assignment_workspace as aw
from .payroll_workspace import words
from .pdf_kit import Document, amount, inr

METHODS = {"cash": "Cash", "bank_transfer": "Bank transfer", "upi": "UPI", "card": "Card", "cheque": "Cheque"}


def _charge_rows(data, student_code):
    """Each fee charge of the student with head, term, due date and charged / paid / balance."""
    from app.modules.finance.transactions.api import calculate_ledger
    try:
        ledger = calculate_ledger(data, student_code)
    except Exception:
        return [], {}
    structures = data["records"].get("fee_structures", {})
    rows = []
    for ch in ledger["charges"]:
        st = structures.get(ch.get("fee_structure_code"), {})
        rows.append({**ch, "term": f"Semester {st['semester_number']}" if st.get("semester_number") else (
            f"Instalment {st['installment_number']}" if st.get("installment_number") else "")})
    return rows, ledger["totals"]


def _due_label(due, today):
    try:
        d = date.fromisoformat(str(due)[:10])
    except ValueError:
        return ""
    days = (d - today).days
    return f"Overdue {-days} day{'s' if days != -1 else ''}" if days < 0 else "Due today" if days == 0 else f"Due in {days} days"


def fee_receipt_pdf(data, receipt, payment):
    from .pdf_kit import HexColor
    from .student_leave_workspace import student_context
    records = data["records"]
    student = records.get("students", {}).get(payment.get("student_code"), {})
    place = student_context(data, payment.get("student_code"))
    number = receipt.get("receipt_number") or receipt.get("code")
    paid_on = str(payment.get("paid_on") or receipt.get("issued_on") or "")[:10]
    charges, totals = _charge_rows(data, payment.get("student_code"))
    by_charge = {c["code"]: c for c in charges}
    balance = amount(totals.get("outstanding")) if totals else Decimal("0")
    concessions = amount(totals.get("discount")) + amount(totals.get("scholarship")) if totals else Decimal("0")
    mode = METHODS.get(payment.get("method"), str(payment.get("method") or "").title())
    status = str(payment.get("status") or "").lower()

    doc = Document(data, "FEE RECEIPT", f"No. {number}", campus_code=student.get("campus_code"),
                   reference=f"Issued {paid_on}")
    doc.tiles([("Total fee", f"INR {inr(totals.get('gross'))}" if totals else "—", f"Concessions INR {inr(concessions)}"),
               ("Paid to date", f"INR {inr(totals.get('paid'))}" if totals else "—", "Including this receipt"),
               ("Balance due", f"INR {inr(balance)}", "Fully paid" if balance <= 0 else "See balance statement (page 2)"),
               ("Amount received", f"INR {inr(payment.get('amount'))}", f"{mode} · {paid_on}")])
    payment_type = "Full settlement" if balance <= 0 else "Part payment (instalment)"
    doc.panels([
        ("Student", [("Name", place.get("student_name")), ("Admission no.", student.get("admission_number")),
                     ("Course", place.get("course_name")), ("Academic year", place.get("academic_year_name")),
                     ("Section", place.get("section_name")), ("Student ID", student.get("code"))]),
        ("Payment", [("Receipt no.", number), ("Payment date", paid_on), ("Mode of payment", mode),
                     ("Transaction no.", payment.get("transaction_reference") or ("Cash — no reference" if payment.get("method") == "cash" else "—")),
                     ("Payment type", payment_type), ("Status", status.title() or "—")]),
    ])
    rows = []
    for alloc in aw.rows(data, "payment_allocations"):
        if alloc.get("payment_code") != payment.get("code"):
            continue
        ch = by_charge.get(alloc.get("charge_code"), {})
        rows.append([ch.get("fee_head") or alloc.get("charge_code"), ch.get("term", ""), str(ch.get("due_date") or "")[:10],
                     inr(ch.get("gross")) if ch else "", inr(alloc.get("amount"))])
    if not rows:
        rows = [["Fee payment", "", "", "", inr(payment.get("amount"))]]
    doc.section("What this payment was for")
    doc.table(["Fee head", "Term", "Due date", "Charged (INR)", "Paid now (INR)"], rows, widths=[3, 1.4, 1.3, 1.5, 1.5],
              align="LLLRR", totals=["Total received", "", "", "", inr(payment.get("amount"))])
    doc.highlight("Amount received", f"INR {inr(payment.get('amount'))}", words(payment.get("amount")),
                  stamp={"settled": "PAID", "pending": "PENDING", "failed": "FAILED", "refunded": "REFUNDED"}.get(status, "RECEIVED"),
                  stamp_color=None if status in {"settled", ""} else HexColor("#b43540"))
    if balance > 0:
        doc.note(f"A balance of INR {inr(balance)} remains on this student's fee account. The balance statement on the next "
                 "page lists every outstanding fee with its due date, and all payments received so far.")
    doc.signature("Received from (parent / student)", "Cashier / Accounts")
    doc.note("Keep this receipt for your records. Fees once paid are refundable only as per the college refund policy. "
             "Verify any receipt with the accounts office using the receipt number.")
    if balance > 0:
        today = date.today()
        open_rows = [c for c in charges if amount(c.get("outstanding")) > 0]
        open_rows.sort(key=lambda c: str(c.get("due_date") or ""))
        doc.page_break("BALANCE STATEMENT", f"As on {today.isoformat()}")
        doc.tiles([("Total fee", f"INR {inr(totals.get('gross'))}"), ("Paid to date", f"INR {inr(totals.get('paid'))}"),
                   ("Next due", str(open_rows[0].get("due_date") or "—")[:10] if open_rows else "—",
                    _due_label(open_rows[0].get("due_date"), today) if open_rows else ""),
                   ("Balance due", f"INR {inr(balance)}", f"{len(open_rows)} fee item(s) open")])
        doc.panels([("Student", [("Name", place.get("student_name")), ("Admission no.", student.get("admission_number")),
                                 ("Course", place.get("course_name"))]),
                    ("Statement", [("Against receipt", number), ("Statement date", today.isoformat()),
                                   ("Concessions", f"INR {inr(concessions)}")])])
        doc.section("Outstanding fees")
        doc.table(["Fee head", "Term", "Due date", "Charged", "Paid", "Balance", "Status"],
                  [[c.get("fee_head"), c.get("term", ""), str(c.get("due_date") or "")[:10], inr(c.get("gross")), inr(c.get("paid")),
                    inr(c.get("outstanding")), _due_label(c.get("due_date"), today)] for c in open_rows],
                  widths=[2.4, 1.2, 1.2, 1.3, 1.3, 1.3, 1.5], align="LLLRRRL",
                  totals=["Balance due", "", "", "", "", inr(balance), ""], font=8)
        receipts = {r.get("payment_code"): r for r in aw.rows(data, "receipts")}
        heads = {}
        for alloc in aw.rows(data, "payment_allocations"):
            name = by_charge.get(alloc.get("charge_code"), {}).get("fee_head")
            if name:
                heads.setdefault(alloc.get("payment_code"), []).append(name)
        history = sorted((p for p in aw.rows(data, "payments") if p.get("student_code") == payment.get("student_code")
                          and p.get("status") == "settled"), key=lambda p: str(p.get("paid_on") or ""))
        doc.section("Payment history")
        doc.table(["Date", "Receipt no.", "Mode", "Transaction no.", "Paid for", "Amount"],
                  [[str(p.get("paid_on") or "")[:10], receipts.get(p["code"], {}).get("receipt_number") or p["code"][-10:],
                    METHODS.get(p.get("method"), p.get("method")), p.get("transaction_reference") or "—",
                    ", ".join(dict.fromkeys(heads.get(p["code"], []))) or "Fees", inr(p.get("amount"))] for p in history],
                  widths=[1.2, 1.6, 1.1, 1.8, 2.3, 1.3], align="LLLLLR",
                  totals=["Total paid", "", "", "", "", inr(sum((amount(p.get("amount")) for p in history), Decimal("0")))], font=8)
        doc.note("Pay the balance at the accounts office or through the college app (Fees → Pay). Overdue fees may attract "
                 "a late fee as per the fee policy. Contact the accounts office for instalment requests.")
    return doc.finish()


# ---- Report exports -----------------------------------------------------------------------
TITLES = {"finance": "Student fee ledger report", "outstanding": "Outstanding fees report", "cashbook": "Cashbook",
          "collections": "Fee collections report", "external_remittances": "External remittances", "expenses": "Expenses report",
          "payroll": "Payroll report", "admissions": "Admissions report"}
MONEY = {"amount", "gross", "discount", "scholarship", "paid", "outstanding", "receipt", "payment", "balance", "gross_amount",
         "deduction_amount", "net_amount"}
SKIP = {"code", "request", "idempotency_key", "storage_key", "revision", "created_at", "updated_at", "created_by", "updated_by",
        "deleted_at", "currency", "payroll_run_code", "demo_run"}


def label(key):
    return {"student_code": "Student ID", "employee_code": "Employee", "student": "Student", "paid_on": "Paid on",
            "expense_date": "Date", "applied_on": "Applied on", "transaction_reference": "Reference"}.get(
        key, key.replace("_code", "").replace("_", " ").capitalize())


def resolve(data, key, value):
    """Show names instead of codes where the code points at a person."""
    records = data["records"]
    if key == "student_code":
        s = records.get("students", {}).get(value, {})
        return f"{' '.join(aw.name(s).split())} ({s.get('admission_number') or value})" if s else value
    if key == "employee_code":
        e = records.get("employees", {}).get(value, {})
        return " ".join(aw.name(e).split()) or value
    if key in {"method", "payment_mode"}:
        return METHODS.get(value, value)
    return value


def report_pdf(data, name, rows, start, end):
    if any("payroll_run_code" in r for r in rows):
        from .payroll_workspace import period_label
        runs = data["records"].get("payroll_runs", {})
        rows = sorted(({"month": period_label(runs.get(r.get("payroll_run_code"), {})), **r} for r in rows),
                      key=lambda r: (str(runs.get(r.get("payroll_run_code"), {}).get("period_start")), str(r.get("employee_code"))))
    columns = [k for k in dict.fromkeys(k for r in rows for k in r) if k not in SKIP]
    if "student" in columns and "student_code" in columns:
        columns.remove("student_code")
    wide = len(columns) > 6
    doc = Document(data, TITLES.get(name, name.replace("_", " ").title()).upper(),
                   f"Period: {start or 'All'} to {end or 'All'}", wide=wide, reference=f"{len(rows)} record(s)")
    numeric = [c in MONEY for c in columns]
    body = []
    totals = {c: Decimal("0") for c, n in zip(columns, numeric) if n and c not in {"balance"}}
    for r in rows:
        line = []
        for c, n in zip(columns, numeric):
            v = r.get(c)
            if n:
                if c in totals:
                    totals[c] += amount(v)
                line.append(inr(v))
            else:
                text = resolve(data, c, v)
                line.append("" if text is None else str(text)[:80] if not isinstance(text, (dict, list)) else "")
        body.append(line)
    total_row = None
    if totals:
        total_row = [("Total" if i == 0 else "") if not n or c not in totals else inr(totals[c]) for i, (c, n) in enumerate(zip(columns, numeric))]
        if numeric and numeric[0]:
            total_row[0] = inr(totals.get(columns[0], 0))
    doc.table([label(c) for c in columns] or ["Report"], body, widths=[1.6 if n else 2 for n in numeric] or [1],
              align="".join("R" if n else "L" for n in numeric), totals=total_row, font=7.8 if wide else 8.6)
    return doc.finish()
