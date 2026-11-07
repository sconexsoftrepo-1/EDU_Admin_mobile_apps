"""Semester fee reminders and late fees.

* From six days before a semester's due date until the due day, the student's and parents' app
  accounts get three reminders a day with the balance still to pay. Nothing is sent once the
  semester is paid. After the due date the weekly overdue reminder continues.
* The day after an unpaid due date, the late fee set on that batch's fee structure is added to the
  student's dues as a "Late fee" charge, once per semester. Only an admin can cancel it.
"""
import hashlib
from datetime import date
from decimal import Decimal

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request

from . import assignment_workspace as aw
from .edit_approvals import is_super_admin
from .security import current_user, has_permission
from .storage import audit, new_code, now

router = APIRouter(prefix="/finance/late-fees", tags=["Late fees"])

LATE_HEAD = "FH-LATE-FEE"
LATE_BASIS = "late_fee"
LOG = "late_fees"
REMINDER_HOURS = (9, 13, 18)  # three reminders a day, local time
REMINDER_DAYS = 6  # start six days before the due date
ZERO = Decimal("0.00")


def money(value) -> Decimal:
    return Decimal(str(value or 0)).quantize(Decimal("0.01"))


def inr(value) -> str:
    """Indian digit grouping, e.g. 125000 -> ₹1,25,000."""
    amount = money(value)
    whole, paise = f"{abs(amount):.2f}".split(".")
    head, tail = whole[:-3], whole[-3:]
    while len(head) > 2:
        tail = f"{head[-2:]},{tail}"
        head = head[:-2]
    text = f"{head},{tail}" if head else tail
    return f"{'-' if amount < 0 else ''}₹{text}" + ("" if paise == "00" else f".{paise}")


def is_late_structure(structure) -> bool:
    return (structure or {}).get("fee_basis") == LATE_BASIS


def term_label(semester) -> str:
    return f"Semester {semester}" if semester else "college"


def late_fee_amount(data, academic_year_code) -> Decimal:
    """The late fee set on the batch's fee structure (the highest, if rows disagree)."""
    amounts = [money(s.get("late_fee_amount")) for s in aw.rows(data, "fee_structures")
               if s.get("academic_year_code") == academic_year_code and not is_late_structure(s)]
    return max(amounts, default=ZERO)


def semester_dues(data):
    """Unpaid fees per (student, batch, semester, due date), late fees excluded."""
    from .academic_progress import fee_progress
    structures = {s["code"]: s for s in aw.rows(data, "fee_structures")}
    students = {c["student_code"] for c in aw.rows(data, "student_fee_charges")}
    groups = {}
    for item in fee_progress(data, students):
        if is_late_structure(structures.get(item.get("fee_structure_code"))) or not item.get("due_date"):
            continue
        key = (item["student_code"], item.get("academic_year_code"), item.get("semester_number"), str(item["due_date"])[:10])
        slot = groups.setdefault(key, {"outstanding": ZERO, "total": ZERO, "paid": ZERO})
        slot["outstanding"] += money(item.get("outstanding"))
        slot["total"] += money(item.get("amount"))
        slot["paid"] += money(item.get("paid"))
    return groups


def notify(data, student_code, title, body, extra):
    from .certificate_workspace import personal_accounts
    made = []
    for account in sorted(personal_accounts(data, student_code)):
        code = new_code("FNOTICE")
        data["records"].setdefault("notifications", {})[code] = {
            "code": code, "user_code": account, "title": title, "body": body, "screen": "fees",
            "channel": "in_app", "status": "sent", "sent_at": now(), **extra}
        made.append(code)
    return made


def fee_reminders(data, at):
    """Three reminders a day in the six days up to the due date; weekly once it is overdue."""
    sent = data.setdefault("documents", {}).setdefault("semester_fee_reminders", {})
    today = at.date()
    passed = [h for h in REMINDER_HOURS if at.hour >= h]
    made = []
    for (student, year, semester, due), slot in semester_dues(data).items():
        if slot["outstanding"] <= 0:
            continue
        left = (date.fromisoformat(due) - today).days
        if 0 <= left <= REMINDER_DAYS:
            if not passed:
                continue
            # Only the latest reminder slot that has passed: a late start never sends a burst.
            stage = f"{today.isoformat()}@{passed[-1]}"
        elif left < 0:
            stage = f"overdue-{(-left - 1) // 7}"
        else:
            continue
        key = "FREM-" + hashlib.sha256(f"{student}|{year}|{semester}|{due}|{stage}".encode()).hexdigest()[:32]
        if key in sent:
            continue
        term = term_label(semester)
        late = late_fee_amount(data, year)
        balance = inr(slot["outstanding"])
        due_text = date.fromisoformat(due).strftime("%d %b %Y")
        if left > 0:
            title = f"{left} day{'s' if left != 1 else ''} left to pay the {term} fee"
            body = (f"{left} day{'s' if left != 1 else ''} for the deadline to pay the remaining balance of {term} fee. "
                    f"Balance: {balance}, due on {due_text}.")
        elif left == 0:
            title = f"Last day to pay the {term} fee"
            body = f"Today is the last day to pay the remaining balance of {term} fee. Balance: {balance}."
        else:
            title = f"{term[0].upper() + term[1:]} fee overdue"
            body = f"The {term} fee of {balance} was due on {due_text}. Please pay it at the earliest."
        if left >= 0 and late > 0:
            body += f" A late fee of {inr(late)} is added if it is not paid by the due date."
        made += notify(data, student, title, body, {"academic_year_code": year, "semester_number": semester,
                                                    "due_date": due, "balance": str(slot["outstanding"])})
        sent[key] = {"created_at": now(), "stage": stage}
    return made


def ensure_late_head(data):
    heads = data["records"].setdefault("fee_heads", {})
    if LATE_HEAD not in heads:
        heads[LATE_HEAD] = {"code": LATE_HEAD, "name": "Late fee", "category": "other",
                            "collection_ownership": "internal", "scholarship_eligible": False}
    return heads[LATE_HEAD]


def late_structure(data, year_code, semester, amount, today):
    """One "Late fee" structure per batch and semester; it is never assigned at enrollment."""
    structures = data["records"].setdefault("fee_structures", {})
    code = f"LATE-{year_code}-S{semester or 0}"
    if code not in structures:
        year = data["records"].get("academic_years", {}).get(year_code, {})
        program = year.get("program_code") or next(
            (s["program_code"] for s in structures.values() if s.get("academic_year_code") == year_code), None)
        structures[code] = {"code": code, "program_code": program, "academic_year_code": year_code,
                            "fee_head_code": ensure_late_head(data)["code"], "semester_number": semester or 1,
                            "amount": str(amount), "due_date": today.isoformat(), "currency": "INR",
                            "installment_number": 1, "billing_frequency": "one_time", "fee_basis": LATE_BASIS,
                            "term_count": 1, "term_due_dates": []}
    return structures[code]


def apply_late_fees(data, today):
    """Add the late fee once per unpaid semester whose due date has passed."""
    log = data.setdefault("documents", {}).setdefault(LOG, {})
    charges = data["records"].setdefault("student_fee_charges", {})
    made = []
    for (student, year, semester, due), slot in semester_dues(data).items():
        if slot["outstanding"] <= 0 or date.fromisoformat(due) >= today or not year:
            continue
        key = "LATE-" + hashlib.sha256(f"{student}|{year}|{semester}|{due}".encode()).hexdigest()[:24]
        amount = late_fee_amount(data, year)
        if key in log or amount <= 0:
            continue
        structure = late_structure(data, year, semester, amount, today)
        if not structure.get("program_code"):
            continue
        code = new_code("LATE")
        charges[code] = {"code": code, "student_code": student, "fee_structure_code": structure["code"],
                         "amount": str(amount), "due_date": today.isoformat(), "tax_amount": "0.00",
                         "semester_number": semester, "late_fee_key": key}
        log[key] = {"charge_code": code, "student_code": student, "academic_year_code": year,
                    "semester_number": semester, "missed_due_date": due, "amount": str(amount),
                    "applied_on": today.isoformat(), "status": "applied"}
        term = term_label(semester)
        made += notify(data, student, f"Late fee added to the {term} fee",
                       f"The {term} fee was not paid by {date.fromisoformat(due).strftime('%d %b %Y')}. "
                       f"A late fee of {inr(amount)} has been added. Balance now: {inr(slot['outstanding'] + amount)}.",
                       {"academic_year_code": year, "semester_number": semester, "charge_code": code})
    return made


def run_fee_jobs(data, at):
    """What the hourly worker does: reminders, then late fees for the days that have passed."""
    return fee_reminders(data, at) + apply_late_fees(data, at.date())


# --- Late fee dues screen ------------------------------------------------------------------

def require(data, user, action="view"):
    if not has_permission(data, user, "student_fee_charges", action):
        raise HTTPException(403, "Fee administration permission required")


def current_semester(data, year_code):
    from .academic_progress import semester_state
    year = data["records"].get("academic_years", {}).get(year_code)
    if not year:
        return None
    try:
        return semester_state(data, year).get("current")
    except Exception:  # an incomplete semester calendar should not hide the late fee list
        return None


def overview(data):
    from app.modules.finance.transactions.api import build_ledger_index, calculate_ledger
    from .fee_collection import student_info
    log = data.get("documents", {}).get(LOG, {})
    students = data["records"].get("students", {})
    charges = data["records"].get("student_fee_charges", {})
    dues = semester_dues(data)
    index = build_ledger_index(data)
    people = {}
    for key, entry in log.items():
        people.setdefault(entry["student_code"], []).append((key, entry))
    items = []
    for student_code, entries in people.items():
        student = students.get(student_code)
        if not student:
            continue
        ledger = calculate_ledger(data, student_code, index=index)
        by_charge = {c["code"]: c for c in ledger["charges"]}
        info = student_info(data, student)
        late = []
        for key, entry in sorted(entries, key=lambda e: (str(e[1].get("missed_due_date")), str(e[1].get("semester_number")))):
            charge = by_charge.get(entry.get("charge_code"))
            status = "cancelled" if entry.get("status") == "cancelled" else \
                "paid" if charge and money(charge["outstanding"]) <= 0 else "unpaid"
            semester_left = dues.get((student_code, entry["academic_year_code"], entry.get("semester_number"),
                                      entry["missed_due_date"]), {}).get("outstanding", ZERO)
            late.append({"key": key, "charge_code": entry.get("charge_code"), "semester_number": entry.get("semester_number"),
                         "label": term_label(entry.get("semester_number")).capitalize(),
                         "missed_due_date": entry["missed_due_date"], "amount": entry["amount"],
                         "applied_on": entry.get("applied_on"), "status": status,
                         "outstanding": str(money(charge["outstanding"])) if charge else "0.00",
                         "semester_outstanding": str(money(semester_left)),
                         "cancelled_on": entry.get("cancelled_on"), "cancelled_by": entry.get("cancelled_by_name")})
        active = [x for x in late if x["status"] != "cancelled"]
        if not late:
            continue
        pending = sum((money(x["outstanding"]) + money(x["semester_outstanding"]) for x in active), ZERO)
        items.append({
            "student_code": student_code, "name": info["name"], "admission_number": info["admission_number"],
            "course": info["course_name"], "course_level": info["course_level_label"], "branch": info.get("branch"),
            "academic_year": info["academic_year"],
            "current_semester": current_semester(data, info["academic_year_code"]),
            "paid": ledger["totals"]["paid"], "pending": ledger["totals"]["outstanding"],
            "late_fees_applied": len(active), "late_fees_cancelled": len(late) - len(active),
            "late_fee_total": str(sum((money(x["amount"]) for x in active), ZERO)),
            "late_fee_pending": str(sum((money(x["outstanding"]) for x in active if x["status"] == "unpaid"), ZERO)),
            "status": "no_late_fee" if not active else "cleared" if pending <= 0 else "uncleared",
            "late_fees": late})
    items.sort(key=lambda i: ({"uncleared": 0, "cleared": 1, "no_late_fee": 2}[i["status"]], i["name"].casefold()))
    with_fee = [i for i in items if i["late_fees_applied"]]
    return {
        "summary": {
            "students": len(with_fee),
            "cleared": sum(i["status"] == "cleared" for i in items),
            "uncleared": sum(i["status"] == "uncleared" for i in items),
            "late_fee_total": str(sum((money(i["late_fee_total"]) for i in items), ZERO)),
            "late_fee_pending": str(sum((money(i["late_fee_pending"]) for i in items), ZERO)),
            "cancelled": sum(i["late_fees_cancelled"] for i in items),
        },
        "items": items,
        "unpaid_charges": sum(1 for c in charges.values() if c.get("late_fee_key")),
    }


@router.get("")
def list_late_fees(request: Request, user=Depends(current_user)):
    data = request.app.state.store.snapshot()
    require(data, user)
    return {**overview(data), "can_cancel": is_super_admin(data, user)}


@router.post("/run")
def run_now(request: Request, background: BackgroundTasks, user=Depends(current_user)):
    """Apply late fees for due dates that have passed, without waiting for the hourly job."""
    from .academic_progress import local_now
    from .certificate_workspace import push
    with request.app.state.store.transaction() as data:
        require(data, user, "create")
        notices = apply_late_fees(data, local_now().date())
        audit(data, user["code"], "apply_late_fees", "student_fee_charges", str(len(notices)))
    background.add_task(push, request, notices)
    return {"notifications": len(notices)}


@router.post("/{key}/cancel")
def cancel(key: str, request: Request, user=Depends(current_user)):
    """Admin only: remove a late fee from the student's dues. The reason is not recorded."""
    with request.app.state.store.transaction() as data:
        if not is_super_admin(data, user):
            raise HTTPException(403, "Only an admin can cancel a late fee")
        entry = data.get("documents", {}).get(LOG, {}).get(key)
        if not entry:
            raise HTTPException(404, "Late fee not found")
        if entry.get("status") == "cancelled":
            raise HTTPException(409, "This late fee is already cancelled")
        code = entry.get("charge_code")
        if any(a.get("charge_code") == code for a in aw.rows(data, "payment_allocations")):
            raise HTTPException(409, "This late fee is already paid and cannot be cancelled")
        charges = data["records"].get("student_fee_charges", {})
        if code in charges:
            del charges[code]
        account = data.get("accounts", {}).get(user["code"], {})
        # Kept as cancelled so the same semester is not charged again.
        data["documents"][LOG][key] = {**entry, "status": "cancelled", "cancelled_on": date.today().isoformat(),
                                       "cancelled_by": user["code"],
                                       "cancelled_by_name": account.get("display_name") or account.get("login_id")}
        audit(data, user["code"], "cancel_late_fee", "student_fee_charges", code)
    return {"cancelled": key}


@router.get("/rules")
def rules(request: Request, academic_year_code: str = Query(...), user=Depends(current_user)):
    data = request.app.state.store.snapshot()
    require(data, user)
    return {"academic_year_code": academic_year_code, "late_fee_amount": str(late_fee_amount(data, academic_year_code)),
            "reminder_days": REMINDER_DAYS, "reminders_per_day": len(REMINDER_HOURS)}

