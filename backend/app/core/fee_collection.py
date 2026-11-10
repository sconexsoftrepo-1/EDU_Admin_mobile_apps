"""Fee payments recorded from one form: student, fee head, method; every payment gets a receipt.

The amount is matched to the student's unpaid charges of the chosen fee head (oldest due date
first), so ledgers, overdue figures and receipts stay consistent. Fees without a charge, such as
a transfer certificate, are recorded against the fee head itself. Certificate fee heads are
offered from the start and created the first time one is used; "Other" creates a custom head.
"""
from datetime import date
from decimal import Decimal

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request
from pydantic import Field, model_validator

from . import assignment_workspace as aw
from .resources import staff_only
from .security import StrictModel, current_user, has_permission
from .storage import audit, new_code, next_number, now

router = APIRouter(prefix="/finance/fee-payments", tags=["Fee payments"])
ZERO = Decimal("0.00")
METHODS = {"cash": "Cash", "upi": "UPI", "bank_transfer": "Bank transfer"}
# Offered before they exist; the first payment creates the fee head.
CERTIFICATE_HEADS = [
    ("tc", "Transfer certificate (TC) fee"),
    ("od", "Original documents (OD) fee"),
    ("study", "Study & conduct certificate fee"),
    ("bonafide", "Bonafide certificate fee"),
    ("migration", "Migration certificate fee"),
    ("duplicate", "Duplicate certificate fee"),
]
LEVELS = {"intermediate": "Intermediate", "degree": "Degree", "polytechnic": "Polytechnic", "bped": "B.P.Ed", "mped": "M.P.Ed"}
# Every payment must point to a student record. Fees taken before a student is enrolled point to
# this one system record; the details typed in the form are kept on the payment itself.
PAYER_CODE = "FEE-PAYERS"


def is_fee_payer(student):
    return (student or {}).get("code") == PAYER_CODE


def ensure_payer(data):
    students = data["records"].setdefault("students", {})
    if PAYER_CODE not in students:
        campus = next(iter(data["records"].get("campuses", {})), None)
        if not campus:
            raise HTTPException(422, "Set up the campus before recording fees")
        students[PAYER_CODE] = {
            "code": PAYER_CODE, "campus_code": campus, "admission_number": PAYER_CODE, "first_name": "Fee payers",
            "last_name": "(not enrolled)", "date_of_birth": "2000-01-01", "gender": "prefer_not_to_say",
            "admission_date": date.today().isoformat(), "address": "Not applicable", "city": "Not applicable",
            "state": "Not applicable", "postal_code": "000000", "country": "India", "emergency_contact_name": "Not applicable",
            "emergency_contact_phone": "0000000000", "status": "relieved",
            "relieving_reason": "System record for fees paid by students who are not enrolled yet"}
    return students[PAYER_CODE]


def require(data, user, action):
    staff_only(user)
    if not has_permission(data, user, "payments", action):
        raise HTTPException(403, "Payments are not assigned to this role")


def money(value) -> Decimal:
    return Decimal(str(value or 0)).quantize(Decimal("0.01"))


def next_receipt_number(data):
    """Receipts are numbered in one short running sequence: RCT-0001, RCT-0002, ..."""
    used = [r.get("receipt_number") for r in aw.rows(data, "receipts")]
    return next_number(used, "RCT", taken=set(used))


METHOD_NAMES = {"cash": "cash", "upi": "UPI", "bank_transfer": "bank transfer", "card": "card", "cheque": "cheque"}


def payment_notices(data, payment, receipt):
    """Payment received: tell the student and their parents; the notice opens that payment."""
    from .certificate_workspace import personal_accounts
    from .pdf_kit import inr
    student = payment.get("student_code")
    if not student or payment.get("payer"):
        return []
    made = []
    for account in sorted(personal_accounts(data, student)):
        code = new_code("PNOTICE")
        data["records"].setdefault("notifications", {})[code] = {
            "code": code, "user_code": account, "title": "Payment received",
            "body": f"Rs. {inr(payment['amount'])} received by {METHOD_NAMES.get(payment.get('method'), payment.get('method'))}"
                    f" on {payment['paid_on']}. Receipt {receipt['receipt_number']}.",
            "channel": "in_app", "status": "sent", "sent_at": now(), "screen": "fees",
            "payment_code": payment["code"], "receipt_number": receipt["receipt_number"], "student_code": student}
        made.append(code)
    return made


def student_info(data, student):
    """Everything the payment form shows about a student, from the existing records."""
    records = data["records"]
    profile = next((p for p in aw.rows(data, "student_admission_profiles") if p.get("student_code") == student["code"]), {})
    enrollment = next((e for e in aw.rows(data, "student_enrollments")
                       if e.get("student_code") == student["code"] and e.get("status") == "active"), {})
    section = records.get("sections", {}).get(enrollment.get("section_code"), {})
    batch = records.get("batches", {}).get(section.get("batch_code") or profile.get("batch_code"), {})
    program = records.get("programs", {}).get(profile.get("program_code") or batch.get("program_code"), {})
    year = records.get("academic_years", {}).get(profile.get("academic_year_code"), {})
    if not year and batch:
        # Students enrolled before the wizard have no profile year: use their batch's academic year.
        year = next((y for y in records.get("academic_years", {}).values() if y.get("batch_code") == batch.get("code")), None) \
            or next((y for y in records.get("academic_years", {}).values()
                     if y.get("program_code") == batch.get("program_code")
                     and str(y.get("start_date") or "")[:4] == str(batch.get("entry_year") or "")), {})
    level = profile.get("course_level") or program.get("course_level")
    return {
        "code": student["code"],
        "name": " ".join(aw.name(student).split()) or student["code"],
        "roll_number": enrollment.get("roll_number"),
        "reference_number": profile.get("reference_number") or profile.get("registration_number"),
        "admission_number": student.get("admission_number"),
        "course_level": level,
        "course_level_label": LEVELS.get(level, str(level or "").capitalize() or None),
        "program_code": program.get("code"),
        "course_name": program.get("name"),
        "branch": program.get("branch"),
        "academic_year_code": year.get("code") or profile.get("academic_year_code"),
        "academic_year": year.get("name") or batch.get("name"),
    }


def outstanding_by_head(data, student_code):
    from app.modules.finance.transactions.api import balance

    records = data["records"]
    heads = {}
    for charge in aw.rows(data, "student_fee_charges"):
        if charge.get("student_code") != student_code:
            continue
        structure = records.get("fee_structures", {}).get(charge.get("fee_structure_code"), {})
        remaining = balance(data, charge)["outstanding"]
        if remaining <= 0:
            continue
        item = heads.setdefault(structure.get("fee_head_code"), {"amount": ZERO, "charges": []})
        item["amount"] += remaining
        item["charges"].append((str(charge.get("due_date") or ""), charge["code"], remaining))
    return heads


@router.get("/students")
def students(request: Request, q: str = Query("", max_length=100), course_level: str | None = None,
             program_code: str | None = None, academic_year_code: str | None = None, user=Depends(current_user)):
    data = request.app.state.store.snapshot()
    require(data, user, "create")
    text = q.strip().casefold()
    items = []
    for student in aw.rows(data, "students"):
        if is_fee_payer(student):
            continue
        info = student_info(data, student)
        haystack = " ".join(str(info.get(k) or "") for k in ("name", "roll_number", "reference_number", "admission_number")).casefold()
        if text and text not in haystack:
            continue
        if (course_level and info["course_level"] != course_level) or (program_code and info["program_code"] != program_code) \
                or (academic_year_code and info["academic_year_code"] != academic_year_code):
            continue
        items.append(info)
    items.sort(key=lambda i: i["name"].casefold())
    return {"items": items[:30], "total": len(items)}


@router.get("/options")
def options(request: Request, student_code: str | None = None, user=Depends(current_user)):
    data = request.app.state.store.snapshot()
    require(data, user, "create")
    heads = sorted(aw.rows(data, "fee_heads"), key=lambda h: str(h.get("name") or "").casefold())
    names = {str(h.get("name") or "").casefold() for h in heads}
    due = outstanding_by_head(data, student_code) if student_code else {}
    programs = aw.rows(data, "programs")
    return {
        "methods": [{"key": k, "label": v} for k, v in METHODS.items()],
        "levels": [{"key": k, "label": v} for k, v in LEVELS.items()],
        "programs": sorted(({"code": p["code"], "name": p.get("name"), "branch": p.get("branch"), "level": p.get("course_level")}
                            for p in programs), key=lambda p: str(p["name"])),
        "academic_years": sorted(({"code": y["code"], "name": y.get("name"), "program_code": y.get("program_code")}
                                  for y in aw.rows(data, "academic_years")), key=lambda y: str(y["name"])),
        "fee_heads": [{"code": h["code"], "name": h.get("name"), "category": h.get("category_label") or h.get("category"),
                       "outstanding": str(due.get(h["code"], {}).get("amount", ZERO))} for h in heads]
                     + [{"code": f"certificate:{key}", "name": name, "category": "Certificate", "outstanding": "0.00"}
                        for key, name in CERTIFICATE_HEADS if name.casefold() not in names],
        "student": student_info(data, data["records"]["students"][student_code]) if student_code in data["records"].get("students", {}) else None,
    }


class PayerDetails(StrictModel):
    """The student as typed on the form, for fees paid before the student is enrolled."""

    name: str = Field(min_length=2, max_length=200)
    roll_or_reference: str | None = Field(default=None, max_length=60)
    admission_number: str | None = Field(default=None, max_length=60)
    course_level: str = Field(pattern="^(intermediate|degree|polytechnic|bped|mped)$")
    course_branch: str = Field(min_length=1, max_length=150)
    academic_year: str = Field(min_length=2, max_length=40)


class FeePaymentInput(StrictModel):
    student_code: str | None = None
    payer: PayerDetails | None = None
    fee_head_code: str | None = Field(default=None, max_length=100)
    custom_fee_head: str | None = Field(default=None, min_length=2, max_length=150, description="Name for an 'Other' fee head")
    amount: Decimal = Field(gt=0, max_digits=14, decimal_places=2)
    method: str = Field(pattern="^(cash|upi|bank_transfer)$")
    transaction_reference: str | None = Field(default=None, max_length=100)
    transaction_date: date | None = Field(default=None, description="When the UPI / bank transfer was made")
    paid_on: date
    note: str | None = Field(default=None, max_length=300)
    semester: int | None = Field(default=None, ge=1, le=12, description="Student's current semester")

    @model_validator(mode="after")
    def rules(self):
        if not self.fee_head_code and not self.custom_fee_head:
            raise ValueError("Choose what the fee is paid for")
        if not self.student_code and not self.payer:
            raise ValueError("Enter the student's details")
        if self.payer and self.semester is None:
            raise ValueError("Choose the student's current semester")
        if self.method == "bank_transfer" and not (self.transaction_reference or "").strip():
            raise ValueError("Enter the bank transaction number")
        if self.method == "cash":
            self.transaction_date = None
        elif self.transaction_date is None:
            self.transaction_date = self.paid_on
        elif self.transaction_date > date.today() or self.transaction_date > self.paid_on:
            raise ValueError("The transaction date cannot be after the payment date")
        return self


def fee_head_for(data, body, actor):
    heads = data["records"].setdefault("fee_heads", {})
    wanted = body.custom_fee_head
    if body.fee_head_code and body.fee_head_code.startswith("certificate:"):
        wanted = dict(CERTIFICATE_HEADS).get(body.fee_head_code.split(":", 1)[1])
        if not wanted:
            raise HTTPException(422, "Unknown certificate fee")
    if not wanted:
        head = heads.get(body.fee_head_code)
        if not head:
            raise HTTPException(422, "Unknown fee head")
        return head
    existing = next((h for h in heads.values() if str(h.get("name") or "").casefold() == wanted.strip().casefold()), None)
    if existing:
        return existing
    certificate = body.fee_head_code and body.fee_head_code.startswith("certificate:")
    code = new_code("FH")
    heads[code] = {"code": code, "name": wanted.strip(), "collection_ownership": "internal", "scholarship_eligible": False,
                   "category": "other", "category_label": "Certificate" if certificate else "Other",
                   "description": "Created when the first fee was recorded"}
    audit(data, actor, "create", "fee_heads", code)
    return heads[code]


@router.post("", status_code=201)
def record(body: FeePaymentInput, request: Request, background: BackgroundTasks, user=Depends(current_user)):
    with request.app.state.store.transaction() as data:
        require(data, user, "create")
        if body.student_code:
            student = data["records"].get("students", {}).get(body.student_code)
            if not student or is_fee_payer(student):
                raise HTTPException(404, "Student not found")
        else:
            student = ensure_payer(data)
        reference = (body.transaction_reference or "").strip() or None
        if reference and any(p.get("transaction_reference") == reference and p.get("method") == body.method
                             for p in aw.rows(data, "payments")):
            raise HTTPException(409, "This transaction number is already recorded")
        head = fee_head_for(data, body, user["code"])
        payer = body.payer.model_dump(mode="json") if body.payer else None
        if payer:
            payer["course_level_label"] = LEVELS[payer["course_level"]]
        info = student_info(data, student) if not payer else {
            "code": None, "name": payer["name"], "roll_number": payer["roll_or_reference"], "reference_number": None,
            "admission_number": payer["admission_number"], "course_level": payer["course_level"],
            "course_level_label": payer["course_level_label"], "program_code": None, "course_name": payer["course_branch"],
            "branch": payer["course_branch"], "academic_year_code": None, "academic_year": payer["academic_year"]}
        payment = {
            "code": new_code("PAY"), "student_code": student["code"], "amount": str(money(body.amount)), "currency": "INR",
            "paid_on": body.paid_on.isoformat(), "method": body.method, "transaction_reference": reference,
            "status": "settled", "recorded_at": now(), "recorded_by": user["code"],
            "fee_head_code": head["code"], "fee_head_name": head.get("name"), "academic_year_code": info["academic_year_code"],
            "note": body.note, "payer": payer,
            "transaction_date": body.transaction_date.isoformat() if body.transaction_date else None,
            "semester": body.semester,
        }
        data["records"].setdefault("payments", {})[payment["code"]] = payment
        # Settle the oldest unpaid charges of this fee head; anything left is kept as an advance.
        left = money(body.amount)
        allocations = []
        charges = [] if payer else outstanding_by_head(data, student["code"]).get(head["code"], {}).get("charges", [])
        for _, charge_code, remaining in sorted(charges):
            if left <= 0:
                break
            share = min(left, remaining)
            allocation = {"code": new_code("ALC"), "payment_code": payment["code"], "charge_code": charge_code, "amount": str(share)}
            data["records"].setdefault("payment_allocations", {})[allocation["code"]] = allocation
            allocations.append(allocation)
            left -= share
        receipt = {"code": new_code("RCT"), "payment_code": payment["code"], "receipt_number": next_receipt_number(data),
                   "issued_on": body.paid_on.isoformat()}
        data["records"].setdefault("receipts", {})[receipt["code"]] = receipt
        audit(data, user["code"], "collect", "payments", payment["code"])
        notices = payment_notices(data, payment, receipt)
        result = {"payment": payment, "receipt": receipt, "allocations": allocations, "advance": str(left), "student": info}
    if notices:
        from .push_delivery import deliver
        background.add_task(deliver, request, notices)
    return result


class PaymentEditInput(StrictModel):
    """A correction to a payment recorded on the manual payments screen (the receipt number stays)."""

    payer: PayerDetails
    semester: int = Field(ge=1, le=12)
    amount: Decimal = Field(gt=0, max_digits=14, decimal_places=2)
    method: str = Field(pattern="^(cash|upi|bank_transfer)$")
    transaction_reference: str | None = Field(default=None, max_length=100)
    transaction_date: date | None = None
    paid_on: date
    note: str | None = Field(default=None, max_length=300)

    @model_validator(mode="after")
    def rules(self):
        self.transaction_reference = (self.transaction_reference or "").strip() or None
        if self.method == "bank_transfer" and not self.transaction_reference:
            raise ValueError("Enter the bank transaction number")
        if self.method == "cash":
            self.transaction_date = None
        elif self.transaction_date is None:
            self.transaction_date = self.paid_on
        elif self.transaction_date > self.paid_on:
            raise ValueError("The transaction date cannot be after the payment date")
        return self


@router.patch("/{code}")
def edit(code: str, body: PaymentEditInput, request: Request, user=Depends(current_user)):
    """Admins save directly; other roles' edits wait for the admin's approval (edit_approvals gate)."""
    with request.app.state.store.transaction() as data:
        require(data, user, "edit")
        payment = data["records"].get("payments", {}).get(code)
        if not payment:
            raise HTTPException(404, "Payment not found")
        if not payment.get("payer"):
            raise HTTPException(409, "Only payments from the manual payments screen can be edited")
        reference = body.transaction_reference
        if reference and any(p["code"] != code and p.get("transaction_reference") == reference and p.get("method") == body.method
                             for p in aw.rows(data, "payments")):
            raise HTTPException(409, "This transaction number is already recorded")
        payer = body.payer.model_dump(mode="json")
        payer["course_level_label"] = LEVELS[payer["course_level"]]
        payment.update(payer=payer, semester=body.semester, amount=str(money(body.amount)), method=body.method,
                       transaction_reference=reference, paid_on=body.paid_on.isoformat(), note=body.note,
                       transaction_date=body.transaction_date.isoformat() if body.transaction_date else None,
                       edited_at=now(), edited_by=user["code"])
        data["records"]["payments"][code] = payment
        receipt = next((r for r in aw.rows(data, "receipts") if r.get("payment_code") == code), None)
        if receipt:
            receipt["issued_on"] = body.paid_on.isoformat()
            data["records"]["receipts"][receipt["code"]] = receipt
        audit(data, user["code"], "edit", "payments", code)
        return dict(payment)


@router.get("")
def history(request: Request, method: str | None = None, start: date | None = None, end: date | None = None,
            q: str = Query("", max_length=100), source: str = Query("all", pattern="^(all|manual|linked)$"),
            user=Depends(current_user)):
    data = request.app.state.store.snapshot()
    require(data, user, "view")
    receipts = {r.get("payment_code"): r for r in aw.rows(data, "receipts")}
    students = data["records"].get("students", {})
    heads = data["records"].get("fee_heads", {})
    allocations = {}
    for a in aw.rows(data, "payment_allocations"):
        allocations.setdefault(a.get("payment_code"), []).append(a)
    charges = data["records"].get("student_fee_charges", {})
    structures = data["records"].get("fee_structures", {})
    text = q.strip().casefold()
    items = []
    for p in aw.rows(data, "payments"):
        day = str(p.get("paid_on") or "")[:10]
        if (method and p.get("method") != method) or (start and day < start.isoformat()) or (end and day > end.isoformat()):
            continue
        # Manual payments carry the student as typed; linked ones point to an enrolled student.
        if (source == "manual" and not p.get("payer")) or (source == "linked" and p.get("payer")):
            continue
        student = students.get(p.get("student_code"), {})
        payer = p.get("payer") or {}
        purpose = p.get("fee_head_name") or ", ".join(sorted({
            heads.get(structures.get(charges.get(a.get("charge_code"), {}).get("fee_structure_code"), {}).get("fee_head_code"), {}).get("name") or "Fee"
            for a in allocations.get(p["code"], [])})) or "Not allocated"
        row = {"code": p["code"], "paid_on": day, "amount": str(p.get("amount")), "method": p.get("method"),
               "method_label": METHODS.get(p.get("method"), str(p.get("method") or "").replace("_", " ").capitalize()),
               "transaction_reference": p.get("transaction_reference"), "status": p.get("status"), "purpose": purpose,
               "transaction_date": p.get("transaction_date"),
               "student_code": None if payer else p.get("student_code"),
               "student_name": payer.get("name") or " ".join(aw.name(student).split()) or p.get("student_code"),
               "admission_number": payer.get("admission_number") if payer else student.get("admission_number"),
               "roll_or_reference": payer.get("roll_or_reference") if payer else None,
               "course_level": payer.get("course_level_label"), "course_branch": payer.get("course_branch"),
               "academic_year": payer.get("academic_year"), "note": p.get("note"), "semester": p.get("semester"),
               "recorded_at": p.get("recorded_at"), "course_level_code": payer.get("course_level"),
               "edited_at": p.get("edited_at"),
               "receipt_code": receipts.get(p["code"], {}).get("code"), "receipt_number": receipts.get(p["code"], {}).get("receipt_number")}
        if text and text not in " ".join(str(v or "") for v in row.values()).casefold():
            continue
        items.append(row)
    items.sort(key=lambda r: (r["paid_on"], r["code"]), reverse=True)
    totals = {}
    for row in items:
        if row["status"] == "settled":
            totals[row["method"]] = str(money(totals.get(row["method"], 0)) + money(row["amount"]))
    return {"items": items[:500], "total": len(items), "totals_by_method": totals}


@router.get("/collected-students")
def collected_students(request: Request, user=Depends(current_user)):
    """Students captured on the manual payment screen, for enrolling them later."""
    data = request.app.state.store.snapshot()
    require(data, user, "view")
    people = {}
    for p in aw.rows(data, "payments"):
        payer = p.get("payer")
        if not payer or p.get("status") != "settled":
            continue
        key = (str(payer.get("admission_number") or "").casefold() or None,
               str(payer.get("roll_or_reference") or "").casefold() or None,
               " ".join(str(payer.get("name") or "").casefold().split()))
        # The same student is matched by admission number, then roll/reference, then name and course.
        key = ("admission", key[0]) if key[0] else ("roll", key[1]) if key[1] else \
            ("name", key[2], str(payer.get("course_branch") or "").casefold())
        item = people.setdefault(key, {"name": payer.get("name"), "roll_or_reference": payer.get("roll_or_reference"),
                                       "admission_number": payer.get("admission_number"),
                                       "course_level": payer.get("course_level_label"), "course_branch": payer.get("course_branch"),
                                       "academic_year": payer.get("academic_year"), "semester": p.get("semester"),
                                       "payments": 0, "total_paid": ZERO,
                                       "first_paid_on": None, "last_paid_on": None})
        day = str(p.get("paid_on") or "")[:10]
        item["payments"] += 1
        item["total_paid"] += money(p.get("amount"))
        item["first_paid_on"] = min(filter(None, [item["first_paid_on"], day]))
        item["last_paid_on"] = max(filter(None, [item["last_paid_on"], day]))
        for field in ("roll_or_reference", "admission_number"):
            item[field] = item[field] or payer.get(field)
        if day >= item["last_paid_on"] and p.get("semester"):
            item["semester"] = p.get("semester")
    items = sorted(people.values(), key=lambda i: str(i["name"]).casefold())
    return {"items": [{**i, "total_paid": str(i["total_paid"])} for i in items], "total": len(items)}



@router.get("/analytics")
def analytics(request: Request, start: date | None = None, end: date | None = None,
              source: str = Query("all", pattern="^(all|manual|linked)$"), user=Depends(current_user)):
    """Settled fee collections broken down by day, semester, payment source, fee head and course level."""
    data = request.app.state.store.snapshot()
    require(data, user, "view")
    students = data["records"].get("students", {})
    heads = data["records"].get("fee_heads", {})
    infos: dict = {}
    groups: dict[str, dict] = {}

    def add(kind, key, amount, payer_key, **extra):
        slot = groups.setdefault(kind, {}).setdefault(key, {"amount": ZERO, "payments": 0, "payers": set(), **extra})
        slot["amount"] += amount
        slot["payments"] += 1
        slot["payers"].add(payer_key)

    days = {}
    for p in aw.rows(data, "payments"):
        if p.get("status") != "settled":
            continue
        payer = p.get("payer") or {}
        if (source == "manual" and not payer) or (source == "linked" and payer):
            continue
        # UPI and bank payments count on the day the money actually moved.
        day = str(p.get("transaction_date") or p.get("paid_on") or "")[:10]
        if not day or (start and day < start.isoformat()) or (end and day > end.isoformat()):
            continue
        amount = money(p.get("amount"))
        student = students.get(p.get("student_code"), {})
        who = ("payer", str(payer.get("admission_number") or payer.get("roll_or_reference") or payer.get("name") or "").casefold()) \
            if payer else ("student", p.get("student_code"))
        method = p.get("method") or "other"
        add("summary", "all", amount, who)
        add("method", method, amount, who, label=METHODS.get(method, method.replace("_", " ").capitalize()))
        semester = p.get("semester")
        add("semester", semester or 0, amount, who, label=f"Semester {semester}" if semester else "Not recorded")
        head = p.get("fee_head_name") or heads.get(p.get("fee_head_code"), {}).get("name") or "Other fees"
        add("head", head, amount, who)
        if not payer and p.get("student_code") not in infos:
            infos[p.get("student_code")] = student_info(data, student) if student else {}
        level = payer.get("course_level_label") or infos.get(p.get("student_code"), {}).get("course_level_label") or "Not recorded"
        add("level", level, amount, who)
        add("source", "manual" if payer else "linked", amount, who,
            label="Manual payments screen" if payer else "Payments & receipts")
        slot = days.setdefault(day, {"amount": ZERO, "payments": 0, "payers": set(), "by_method": {}})
        slot["amount"] += amount
        slot["payments"] += 1
        slot["payers"].add(who)
        slot["by_method"][method] = slot["by_method"].get(method, ZERO) + amount

    def out(slot, **keys):
        extra = {k: v for k, v in slot.items() if k not in ("amount", "payments", "payers", "by_method")}
        return {**keys, **extra, "amount": str(slot["amount"]), "payments": slot["payments"], "payers": len(slot["payers"])}

    def ranked(kind, key_name):
        return sorted((out(v, **{key_name: k}) for k, v in groups.get(kind, {}).items()),
                      key=lambda r: money(r["amount"]), reverse=True)

    total = groups.get("summary", {}).get("all", {"amount": ZERO, "payments": 0, "payers": set()})
    ordered = sorted(days)
    semesters = sorted((out(v, semester=k or None) for k, v in groups.get("semester", {}).items()),
                       key=lambda r: (r["semester"] is None, r["semester"] or 0))
    return {
        "summary": {**out(total), "average": str((total["amount"] / total["payments"]).quantize(Decimal("0.01")))
                    if total["payments"] else "0.00",
                    "first_day": ordered[0] if ordered else None, "last_day": ordered[-1] if ordered else None},
        "daily": [{**out(days[d], date=d), "by_method": {k: str(v) for k, v in days[d]["by_method"].items()}} for d in ordered],
        "by_semester": semesters,
        "by_method": ranked("method", "method"),
        "by_head": ranked("head", "name"),
        "by_level": ranked("level", "label"),
        "by_source": ranked("source", "source"),
    }
