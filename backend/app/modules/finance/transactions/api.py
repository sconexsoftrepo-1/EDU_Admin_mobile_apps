import csv
import io
from decimal import Decimal

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from fastapi.responses import StreamingResponse

from app.core.resources import staff_only
from app.core.security import require
from app.core.storage import audit, new_code
from app.workflows.schemas import AdjustmentInput, PaymentInput, ScholarshipInput

ZERO = Decimal("0.00")
router = APIRouter(tags=["Finance workflows"])


def money(value):
    return Decimal(str(value or 0)).quantize(Decimal(".01"))


def query_rows(data, table):
    return data["records"].setdefault(table, {})


def query_record(data, table, code):
    value = query_rows(data, table).get(code)
    if not value:
        raise HTTPException(404, f"{table} record not found")
    return value


def balance(data, charge):
    gross = money(charge["amount"]) + money(charge.get("tax_amount"))
    discount = sum(
        (
            money(a["amount"])
            for a in query_rows(data, "fee_adjustments").values()
            if a["charge_code"] == charge["code"]
        ),
        ZERO,
    )
    approve_award = sum(
        (
            money(a["amount"])
            for a in query_rows(data, "charge_scholarship_allocations").values()
            if a["charge_code"] == charge["code"]
        ),
        ZERO,
    )
    paid = sum(
        (
            money(a["amount"])
            for a in query_rows(data, "payment_allocations").values()
            if a["charge_code"] == charge["code"]
        ),
        ZERO,
    )
    refunded = sum(
        (
            money(a["amount"])
            for a in query_rows(data, "refund_allocations").values()
            if a["charge_code"] == charge["code"]
        ),
        ZERO,
    )
    return {
        "gross": gross,
        "discount": discount,
        "scholarship": approve_award,
        "paid": paid - refunded,
        "outstanding": gross - discount - approve_award - paid + refunded,
    }


def calculate_ledger(data, student_code):
    query_record(data, "students", student_code)
    result = []
    totals = {
        k: ZERO for k in ["gross", "discount", "scholarship", "paid", "outstanding"]
    }
    for charge in query_rows(data, "student_fee_charges").values():
        if charge["student_code"] != student_code:
            continue
        structure = query_record(data, "fee_structures", charge["fee_structure_code"])
        head = query_record(data, "fee_heads", structure["fee_head_code"])
        values = balance(data, charge)
        for k, v in values.items():
            totals[k] += v
        result.append(
            {
                **charge,
                "fee_head": head["name"],
                "ownership": head["collection_ownership"],
                "currency": structure["currency"],
                **{k: str(v) for k, v in values.items()},
            }
        )
    if any((row["currency"] != "INR" for row in result)):
        raise HTTPException(409, "Mixed/foreign currency ledger is not supported yet")
    return {
        "student_code": student_code,
        "currency": "INR",
        "charges": result,
        "totals": {k: str(v) for k, v in totals.items()},
    }


def record_payment(data, body, key, actor):
    old = next(
        (
            p
            for p in query_rows(data, "payments").values()
            if p.get("idempotency_key") == key
        ),
        None,
    )
    signature = body.model_dump(mode="json")
    if old:
        if old.get("request") != signature:
            raise HTTPException(409, "Idempotency key was used for a different payment")
        return {
            "payment": old,
            "receipt": next(
                (
                    r
                    for r in query_rows(data, "receipts").values()
                    if r["payment_code"] == old["code"]
                )
            ),
        }
    query_record(data, "students", body.student_code)
    if body.currency != "INR":
        raise HTTPException(422, "Only INR is enabled")
    if body.method != "cash" and any(
        (
            p["transaction_reference"] == body.transaction_reference
            and p["method"] == body.method
            for p in query_rows(data, "payments").values()
        )
    ):
        raise HTTPException(409, "Transaction reference already recorded")
    for code, amount in body.allocations.items():
        charge = query_record(data, "student_fee_charges", code)
        if charge["student_code"] != body.student_code:
            raise HTTPException(422, "Charge does not belong to this student")
        structure = query_record(data, "fee_structures", charge["fee_structure_code"])
        if structure["currency"] != body.currency:
            raise HTTPException(422, "Currency mismatch")
        if amount > balance(data, charge)["outstanding"]:
            raise HTTPException(409, "Allocation exceeds outstanding balance")
    payment = {
        "code": new_code("PAY"),
        "student_code": body.student_code,
        "amount": str(sum(body.allocations.values(), ZERO)),
        "currency": body.currency,
        "paid_on": body.paid_on.isoformat(),
        "method": body.method,
        "transaction_reference": body.transaction_reference,
        "status": "settled",
        "idempotency_key": key,
        "request": signature,
    }
    query_rows(data, "payments")[payment["code"]] = payment
    for code, amount in body.allocations.items():
        allocation = {
            "code": new_code("ALC"),
            "payment_code": payment["code"],
            "charge_code": code,
            "amount": str(amount),
        }
        query_rows(data, "payment_allocations")[allocation["code"]] = allocation
    receipt = {
        "code": new_code("RCT"),
        "payment_code": payment["code"],
        "receipt_number": new_code("EDU-RCT"),
        "issued_on": body.paid_on.isoformat(),
    }
    query_rows(data, "receipts")[receipt["code"]] = receipt
    audit(data, actor, "collect", "payments", payment["code"])
    return {"payment": payment, "receipt": receipt}


def record_adjustment(data, body, actor):
    charge = query_record(data, "student_fee_charges", body.charge_code)
    if body.amount > balance(data, charge)["outstanding"]:
        raise HTTPException(409, "Adjustment exceeds outstanding balance")
    result = {
        **body.model_dump(mode="json"),
        "code": new_code("ADJ"),
        "approved_by_code": actor_employee(data, actor),
    }
    query_rows(data, "fee_adjustments")[result["code"]] = result
    audit(data, actor, "approve", "fee_adjustments", result["code"])
    return result


def approve_award(data, body, actor):
    award = query_record(data, "student_scholarships", body.student_scholarship_code)
    if award["status"] == "approved":
        raise HTTPException(409, "Scholarship already approved")
    definition = query_record(data, "scholarships", award["scholarship_code"])
    total = sum(body.allocations.values(), ZERO)
    if total > money(award["amount"]) or total > money(definition["maximum_amount"]):
        raise HTTPException(409, "Scholarship exceeds award or scheme maximum")
    for code, amount in body.allocations.items():
        charge = query_record(data, "student_fee_charges", code)
        head = query_record(
            data,
            "fee_heads",
            query_record(data, "fee_structures", charge["fee_structure_code"])[
                "fee_head_code"
            ],
        )
        if (
            charge["student_code"] != award["student_code"]
            or not head["scholarship_eligible"]
        ):
            raise HTTPException(422, "Ineligible charge")
        if amount > balance(data, charge)["outstanding"]:
            raise HTTPException(409, "Scholarship exceeds balance")
    # The award is approved before its allocations are written: the database accepts allocations
    # only for approved awards.
    award["status"] = "approved"
    for code, amount in body.allocations.items():
        item = {
            "code": new_code("SCH"),
            "charge_code": code,
            "student_scholarship_code": award["code"],
            "amount": str(amount),
            "allocated_by_employee_code": actor_employee(data, actor),
        }
        query_rows(data, "charge_scholarship_allocations")[item["code"]] = item
    audit(data, actor, "approve", "student_scholarships", award["code"])
    return award


def calculate_summary(data):
    totals = {
        k: ZERO for k in ["gross", "discount", "scholarship", "paid", "outstanding"]
    }
    for student in query_rows(data, "students").values():
        result = calculate_ledger(data, student["code"])
        for k, v in result["totals"].items():
            totals[k] += money(v)
    internal = ZERO
    external = ZERO
    for allocation in query_rows(data, "payment_allocations").values():
        charge = query_record(data, "student_fee_charges", allocation["charge_code"])
        head = query_record(
            data,
            "fee_heads",
            query_record(data, "fee_structures", charge["fee_structure_code"])[
                "fee_head_code"
            ],
        )
        if head["collection_ownership"] == "external":
            external += money(allocation["amount"])
        else:
            internal += money(allocation["amount"])
    for refund in query_rows(data, "refund_allocations"):
        charge = query_record(data, "student_fee_charges", refund["charge_code"])
        head = query_record(
            data,
            "fee_heads",
            query_record(data, "fee_structures", charge["fee_structure_code"])[
                "fee_head_code"
            ],
        )
        if head["collection_ownership"] == "external":
            external -= money(refund["amount"])
        else:
            internal -= money(refund["amount"])
    return {
        "currency": "INR",
        **{k: str(v) for k, v in totals.items()},
        "internal_collections": str(internal),
        "external_collections": str(external),
        "external_remitted": str(
            sum(
                (
                    money(r["amount"])
                    for r in query_rows(data, "external_remittances").values()
                    if r["status"] == "paid"
                ),
                ZERO,
            )
        ),
        "recorded_expenses": str(
            sum(
                (money(e["amount"]) for e in query_rows(data, "expenses").values()),
                ZERO,
            )
        ),
    }


@router.get("/finance/students/{code}/ledger")
def ledger(
    code: str, request: Request, user=Depends(require("student_fee_charges", "view"))
):
    staff_only(user)
    return calculate_ledger(request.app.state.store.snapshot(), code)


@router.post("/finance/collect", status_code=201)
def collect(
    body: PaymentInput,
    request: Request,
    idempotency_key: str = Header(min_length=16, max_length=100),
    user=Depends(require("payments", "create")),
):
    staff_only(user)
    with request.app.state.store.transaction() as data:
        return record_payment(data, body, idempotency_key, user["code"])


@router.post("/finance/adjustments", status_code=201)
def adjust(
    body: AdjustmentInput,
    request: Request,
    user=Depends(require("fee_adjustments", "approve")),
):
    staff_only(user)
    with request.app.state.store.transaction() as data:
        return record_adjustment(data, body, user["code"])


@router.post("/finance/scholarships/approve")
def approve_scholarship(
    body: ScholarshipInput,
    request: Request,
    user=Depends(require("student_scholarships", "approve")),
):
    staff_only(user)
    with request.app.state.store.transaction() as data:
        return approve_award(data, body, user["code"])


@router.get("/finance/summary")
def summary(request: Request, user=Depends(require("reports", "view"))):
    staff_only(user)
    return calculate_summary(request.app.state.store.snapshot())


@router.get("/finance/cashbook")
def cashbook(
    request: Request,
    start: str | None = None,
    end: str | None = None,
    user=Depends(require("reports", "view")),
):
    staff_only(user)
    from datetime import date

    try:
        if start:
            date.fromisoformat(start)
        if end:
            date.fromisoformat(end)
    except ValueError:
        raise HTTPException(422, "Use ISO dates")
    if start and end and start > end:
        raise HTTPException(422, "Invalid date range")
    data = request.app.state.store.snapshot()
    items = []
    for p in query_rows(data, "payments").values():
        if p["status"] == "settled" and p["method"] == "cash":
            items.append(
                {
                    "date": p["paid_on"],
                    "reference": p["code"],
                    "receipt": p["amount"],
                    "payment": "0.00",
                }
            )
    # Expenses currently have no payment-method field; report them separately rather than falsely labeling cash.
    items = [
        r
        for r in items
        if (not start or r["date"] >= start) and (not end or r["date"] <= end)
    ]
    return {
        "items": sorted(items, key=lambda r: r["date"]),
        "note": "Cash receipts only. Expense payment-mode capture is required for the full cash book.",
    }


@router.get("/finance/ledger-export.csv")
def export(request: Request, user=Depends(require("reports", "export"))):
    staff_only(user)
    data = request.app.state.store.snapshot()
    out = io.StringIO()
    writer = csv.writer(out)
    writer.writerow(
        [
            "Student Code",
            "Gross INR",
            "Discount INR",
            "Scholarship INR",
            "Paid INR",
            "Outstanding INR",
        ]
    )
    for student in query_rows(data, "students").values():
        t = calculate_ledger(data, student["code"])["totals"]
        code = student["code"]
        code = "'" + code if code.startswith(("=", "+", "-", "@")) else code
        writer.writerow(
            [
                code,
                *[
                    t[k]
                    for k in ["gross", "discount", "scholarship", "paid", "outstanding"]
                ],
            ]
        )
    with request.app.state.store.transaction() as state:
        audit(state, user["code"], "export", "reports", "student_ledger")
    return StreamingResponse(
        iter([out.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="student-ledger.csv"'},
    )


def actor_employee(data, actor):
    account = data["accounts"].get(actor, {})
    code = account.get("person_code")
    if account.get("person_type") != "employee" or code not in data["records"].get(
        "employees", {}
    ):
        raise HTTPException(
            409,
            "Link the administrator to an employee record before authorizing college transactions",
        )
    return code
