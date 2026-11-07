"""Physical cash: who holds it, daily cash ledger and bank deposits made by clerks.

Flow: the admin assigns part of the cash in hand to a clerk → the clerk accepts it in the staff
app ("collected") → after visiting the bank the clerk records the amount actually deposited →
uploads a photo of the bank slip → the admin accepts or rejects it. Only an accepted deposit
leaves the cash ledger. Whatever the clerk has not deposited stays "with the clerk" (still the
college's cash) until another deposit is accepted or the admin records it as returned.

Records live in the workspace document store, so no new database table is needed.
"""
import base64
import binascii
from datetime import date, timedelta
from decimal import Decimal

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from fastapi.responses import Response
from pydantic import Field

from . import assignment_workspace as aw
from .security import StrictModel, current_user, has_permission
from .storage import audit, new_code, now

router = APIRouter(prefix="/finance/cash", tags=["Cash custody"])
CLERK_ROLE = "CASH_CLERK"
CLERK_SCREENS = ["profile", "cash", "leave", "payslips", "tax-documents", "calendar", "announcements", "notifications"]
ZERO = Decimal("0.00")
PROOF_TYPES = {"image/jpeg": "jpg", "image/png": "png", "application/pdf": "pdf"}
MAX_PROOF = 700_000


def money(value) -> Decimal:
    return Decimal(str(value or 0)).quantize(Decimal("0.01"))


def store(data):
    return data.setdefault("documents", {}).setdefault("cash_transfers", {})


def ensure_clerk_role(data):
    """The "Cash Clerk" role: staff app with the cash deposit screen."""
    roles = data.setdefault("roles", {})
    if CLERK_ROLE not in roles and not any(r.get("name", "").casefold() == "cash clerk" for r in roles.values()):
        roles[CLERK_ROLE] = {"code": CLERK_ROLE, "name": "Cash Clerk", "scope": "teaching", "system_admin": False,
                             "screens": CLERK_SCREENS,
                             "permissions": {"leave_requests": ["view", "create"], "payslips": ["view"],
                                             "employee_tax_documents": ["view"], "calendar_events": ["view"],
                                             "announcements": ["view"], "notifications": ["view"]}}
    return roles.get(CLERK_ROLE)


def is_clerk(data, user):
    return CLERK_ROLE in data.get("accounts", {}).get(user.get("code"), {}).get("role_codes", [])


def can_manage(data, user):
    roles = data.get("accounts", {}).get(user.get("code"), {}).get("role_codes", [])
    return any(data["roles"].get(c, {}).get("system_admin") for c in roles) or has_permission(data, user, "payments", "approve")


def require_manager(data, user):
    if user.get("person_type") not in {"employee", "system"} or not can_manage(data, user):
        raise HTTPException(403, "Only the admin can manage cash transfers")


def account_name(data, code):
    account = data.get("accounts", {}).get(code, {})
    person = data["records"].get("employees", {}).get(account.get("person_code"), {})
    return " ".join(aw.name(person).split()) or account.get("display_name") or account.get("login_id") or code


def accepted(transfer):
    return sum((money(d["amount"]) for d in transfer.get("deposits", []) if d["status"] == "accepted"), ZERO)


def pending(transfer):
    return sum((money(d["amount"]) for d in transfer.get("deposits", []) if d["status"] in {"awaiting_proof", "awaiting_review"}), ZERO)


def returned(transfer):
    return sum((money(r["amount"]) for r in transfer.get("returns", [])), ZERO)


def with_clerk(transfer):
    """Cash the clerk still holds for this transfer (including deposits not yet accepted)."""
    if transfer["status"] in {"assigned", "cancelled"}:
        return ZERO
    return money(transfer["amount"]) - accepted(transfer) - returned(transfer)


def refresh_status(transfer):
    if transfer["status"] in {"assigned", "cancelled"}:
        return
    if with_clerk(transfer) <= 0:
        transfer["status"] = "settled"
    elif any(d["status"] == "awaiting_review" for d in transfer.get("deposits", [])):
        transfer["status"] = "awaiting_review"
    elif any(d["status"] == "awaiting_proof" for d in transfer.get("deposits", [])):
        transfer["status"] = "deposited"
    else:
        transfer["status"] = "collected"


def public(data, transfer):
    item = {k: v for k, v in transfer.items() if k != "deposits"}
    item["deposits"] = [{k: v for k, v in d.items() if k != "proof_key"} | {"has_proof": bool(d.get("proof_key"))}
                        for d in transfer.get("deposits", [])]
    item.update(accepted_amount=str(accepted(transfer)), pending_amount=str(pending(transfer)),
                returned_amount=str(returned(transfer)), with_clerk=str(with_clerk(transfer)),
                can_deposit=str(with_clerk(transfer) - pending(transfer)))
    return item


def notify(data, accounts, title, body, transfer_code):
    """In-app notices (opening the cash screen); returns their codes for the phone push."""
    made = []
    for account in accounts:
        code = new_code("CNOTICE")
        data["records"].setdefault("notifications", {})[code] = {
            "code": code, "user_code": account, "title": title, "body": body, "channel": "in_app",
            "status": "sent", "sent_at": now(), "cash_transfer_code": transfer_code, "screen": "cash"}
        made.append(code)
    return made


def push_later(background, request, codes):
    """Send the notices to the recipients' phones (Firebase) after the response."""
    if codes:
        from .push_delivery import deliver
        background.add_task(deliver, request, codes)


def managers(data):
    users = []
    for code, account in data.get("accounts", {}).items():
        roles = [data["roles"].get(r, {}) for r in account.get("role_codes", [])]
        if account.get("active") and any(r.get("system_admin") or "approve" in r.get("permissions", {}).get("payments", []) for r in roles):
            users.append(code)
    return users


def ledger(data, today):
    """Daily cash book, plus how much of each day's closing cash is with clerks."""
    from app.modules.reports.downloads.api import cash_entries

    days = {}

    def day(key):
        return days.setdefault(key, {"date": key, "received": ZERO, "paid": ZERO, "deposited": ZERO,
                                     "to_clerks": ZERO, "from_clerks": ZERO})

    for entry in cash_entries(data):
        row = day(str(entry["date"])[:10])
        row["received"] += money(entry["receipt"])
        row["paid"] += money(entry["payment"])
    for transfer in store(data).values():
        if transfer["status"] in {"assigned", "cancelled"} or not transfer.get("collected_at"):
            continue
        day(transfer["collected_at"][:10])["to_clerks"] += money(transfer["amount"])
        for deposit in transfer.get("deposits", []):
            if deposit["status"] == "accepted":
                day(deposit["deposited_on"])["deposited"] += money(deposit["amount"])
        for item in transfer.get("returns", []):
            day(item["returned_on"])["from_clerks"] += money(item["amount"])
    if not days:
        return []
    start = min(days)
    closing = clerks = ZERO
    rows = []
    current = date.fromisoformat(start)
    while current.isoformat() <= today.isoformat():
        row = day(current.isoformat())
        opening = closing
        closing = opening + row["received"] - row["paid"] - row["deposited"]
        clerks = clerks + row["to_clerks"] - row["deposited"] - row["from_clerks"]
        rows.append({"date": row["date"], "opening": str(opening), "received": str(row["received"]),
                     "paid": str(row["paid"]), "deposited": str(row["deposited"]), "closing": str(closing),
                     "with_clerks": str(clerks), "with_admin": str(closing - clerks)})
        current += timedelta(days=1)
    return rows


def positions(data, today):
    rows = ledger(data, today)
    closing = money(rows[-1]["closing"]) if rows else ZERO
    clerks = money(rows[-1]["with_clerks"]) if rows else ZERO
    assigned = sum((money(t["amount"]) for t in store(data).values() if t["status"] == "assigned"), ZERO)
    return rows, closing, clerks, assigned


@router.get("/overview")
def overview(request: Request, user=Depends(current_user)):
    data = request.app.state.store.snapshot()
    if user.get("person_type") not in {"employee", "system"}:
        raise HTTPException(403, "Cash records are for college staff")
    from .academic_progress import local_now

    today = local_now().date()
    manager = can_manage(data, user)
    clerk = is_clerk(data, user)
    if not manager and not clerk and not has_permission(data, user, "payments", "view"):
        raise HTTPException(403, "Cash records are not assigned to this role")
    rows, closing, clerks, assigned = positions(data, today)
    transfers = [public(data, t) for t in store(data).values() if manager or t["clerk_account"] == user["code"]
                 or has_permission(data, user, "payments", "view")]
    transfers.sort(key=lambda t: t["assigned_at"], reverse=True)
    mine = [t for t in transfers if t["clerk_account"] == user["code"]]
    return {
        "today": today.isoformat(), "can_manage": manager, "is_clerk": clerk, "account_code": user["code"],
        "cash_in_hand": str(closing), "with_clerks": str(clerks), "awaiting_collection": str(assigned),
        # What the admin can still hand over: cash in hand not already with or promised to a clerk.
        "with_admin": str(closing - clerks - assigned),
        "ledger": rows[-90:],
        "transfers": transfers[:200],
        "my_in_hand": str(sum((money(t["with_clerk"]) for t in mine), ZERO)),
        "clerks": [{"account_code": code, "name": account_name(data, code)} for code, a in data.get("accounts", {}).items()
                   if a.get("active") and CLERK_ROLE in a.get("role_codes", [])] if manager else [],
    }


class AssignInput(StrictModel):
    clerk_account: str
    amount: Decimal = Field(gt=0, max_digits=14, decimal_places=2)
    note: str | None = Field(default=None, max_length=300)


@router.post("/transfers", status_code=201)
def assign(body: AssignInput, request: Request, background: BackgroundTasks, user=Depends(current_user)):
    from .academic_progress import local_now

    with request.app.state.store.transaction() as data:
        require_manager(data, user)
        clerk = data.get("accounts", {}).get(body.clerk_account)
        if not clerk or not clerk.get("active") or CLERK_ROLE not in clerk.get("role_codes", []):
            raise HTTPException(422, "Choose an active cash clerk")
        _, closing, clerks, assigned = positions(data, local_now().date())
        available = closing - clerks - assigned
        if money(body.amount) > available:
            raise HTTPException(409, f"Only Rs. {available} cash is with the admin")
        code = new_code("CASH")
        store(data)[code] = {"code": code, "clerk_account": body.clerk_account, "clerk_name": account_name(data, body.clerk_account),
                             "amount": str(money(body.amount)), "note": body.note, "status": "assigned",
                             "assigned_by": user["code"], "assigned_by_name": account_name(data, user["code"]),
                             "assigned_at": now(), "collected_at": None, "deposits": [], "returns": []}
        push_later(background, request, notify(data, [body.clerk_account], "Cash to deposit",
                                               f"Rs. {money(body.amount)} assigned to you for bank deposit. Collect it from the accounts office.", code))
        audit(data, user["code"], "cash_assign", "cash_transfers", code)
        return public(data, store(data)[code])


def own_transfer(data, user, code):
    transfer = store(data).get(code)
    if not transfer:
        raise HTTPException(404, "Cash transfer not found")
    if transfer["clerk_account"] != user["code"]:
        raise HTTPException(403, "This cash was assigned to another clerk")
    return transfer


@router.post("/transfers/{code}/collect")
def collect(code: str, request: Request, background: BackgroundTasks, user=Depends(current_user)):
    with request.app.state.store.transaction() as data:
        transfer = own_transfer(data, user, code)
        if transfer["status"] != "assigned":
            raise HTTPException(409, "This cash was already collected")
        transfer.update(status="collected", collected_at=now())
        store(data)[code] = transfer
        push_later(background, request, notify(data, managers(data), "Cash collected by clerk",
                                               f"{transfer['clerk_name']} collected Rs. {transfer['amount']}.", code))
        audit(data, user["code"], "cash_collect", "cash_transfers", code)
        return public(data, transfer)


@router.post("/transfers/{code}/cancel")
def cancel(code: str, request: Request, background: BackgroundTasks, user=Depends(current_user)):
    with request.app.state.store.transaction() as data:
        require_manager(data, user)
        transfer = store(data).get(code)
        if not transfer or transfer["status"] != "assigned":
            raise HTTPException(409, "Only cash not yet collected can be cancelled")
        transfer["status"] = "cancelled"
        store(data)[code] = transfer
        push_later(background, request, notify(data, [transfer["clerk_account"]], "Cash handover cancelled",
                                               f"The admin cancelled Rs. {transfer['amount']}; nothing to collect.", code))
        audit(data, user["code"], "cash_cancel", "cash_transfers", code)
        return public(data, transfer)


class DepositInput(StrictModel):
    amount: Decimal = Field(gt=0, max_digits=14, decimal_places=2)
    deposited_on: date
    bank_reference: str | None = Field(default=None, max_length=100)


@router.post("/transfers/{code}/deposits", status_code=201)
def deposited(code: str, body: DepositInput, request: Request, background: BackgroundTasks, user=Depends(current_user)):
    with request.app.state.store.transaction() as data:
        transfer = own_transfer(data, user, code)
        if transfer["status"] in {"assigned", "cancelled", "settled"}:
            raise HTTPException(409, "Collect the cash before recording a deposit")
        room = with_clerk(transfer) - pending(transfer)
        if money(body.amount) > room:
            raise HTTPException(409, f"You can deposit at most Rs. {room}")
        deposit = {"code": new_code("DEP"), "amount": str(money(body.amount)), "deposited_on": body.deposited_on.isoformat(),
                   "bank_reference": body.bank_reference, "recorded_at": now(), "status": "awaiting_proof"}
        transfer["deposits"].append(deposit)
        refresh_status(transfer)
        store(data)[code] = transfer
        push_later(background, request, notify(data, managers(data), "Amount deposited, not confirmed",
               f"{transfer['clerk_name']} reports Rs. {deposit['amount']} deposited; the bank slip follows.", code))
        audit(data, user["code"], "cash_deposit", "cash_transfers", code)
        return public(data, transfer)


class ProofInput(StrictModel):
    filename: str = Field(min_length=1, max_length=150)
    mime_type: str
    content_base64: str = Field(min_length=10)


@router.post("/transfers/{code}/deposits/{deposit_code}/proof")
def proof(code: str, deposit_code: str, body: ProofInput, request: Request, background: BackgroundTasks,
          user=Depends(current_user)):
    if body.mime_type not in PROOF_TYPES:
        raise HTTPException(422, "Upload a JPG, PNG or PDF of the bank slip")
    try:
        raw = base64.b64decode(body.content_base64, validate=True)
    except (binascii.Error, ValueError):
        raise HTTPException(422, "The slip image could not be read")
    if len(raw) > MAX_PROOF:
        raise HTTPException(413, "The slip image is too large; take the photo again")
    with request.app.state.store.transaction() as data:
        transfer = own_transfer(data, user, code)
        deposit = next((d for d in transfer["deposits"] if d["code"] == deposit_code), None)
        if not deposit or deposit["status"] not in {"awaiting_proof", "rejected"}:
            raise HTTPException(409, "This deposit does not need a slip")
        key = f"cash-deposits/{code}/{deposit_code}-{new_code('SLIP')}.{PROOF_TYPES[body.mime_type]}"
        request.app.state.files.put(key, raw, body.mime_type)
        deposit.update(proof_key=key, proof_name=body.filename, proof_mime=body.mime_type, proof_uploaded_at=now(),
                       status="awaiting_review", review_note=None)
        refresh_status(transfer)
        store(data)[code] = transfer
        push_later(background, request, notify(data, managers(data), "Deposit slip to review",
               f"{transfer['clerk_name']} submitted the bank slip for Rs. {deposit['amount']}. Accept or reject it.", code))
        audit(data, user["code"], "cash_deposit_proof", "cash_transfers", code)
        return public(data, transfer)


@router.get("/transfers/{code}/deposits/{deposit_code}/proof")
def proof_file(code: str, deposit_code: str, request: Request, user=Depends(current_user)):
    data = request.app.state.store.snapshot()
    transfer = store(data).get(code)
    if not transfer:
        raise HTTPException(404, "Cash transfer not found")
    if transfer["clerk_account"] != user["code"] and not can_manage(data, user):
        raise HTTPException(403, "Not allowed")
    deposit = next((d for d in transfer["deposits"] if d["code"] == deposit_code and d.get("proof_key")), None)
    raw = request.app.state.files.get(deposit["proof_key"]) if deposit else None
    if raw is None:
        raise HTTPException(404, "No slip uploaded")
    return Response(raw, media_type=deposit["proof_mime"], headers={"Cache-Control": "private, no-store"})


class ReviewInput(StrictModel):
    decision: str = Field(pattern="^(accept|reject)$")
    note: str | None = Field(default=None, max_length=300)


@router.post("/transfers/{code}/deposits/{deposit_code}/review")
def review(code: str, deposit_code: str, body: ReviewInput, request: Request, background: BackgroundTasks,
           user=Depends(current_user)):
    with request.app.state.store.transaction() as data:
        require_manager(data, user)
        transfer = store(data).get(code)
        deposit = next((d for d in (transfer or {}).get("deposits", []) if d["code"] == deposit_code), None)
        if not deposit or deposit["status"] != "awaiting_review":
            raise HTTPException(409, "This deposit is not waiting for review")
        if body.decision == "reject" and not (body.note or "").strip():
            raise HTTPException(422, "Give the reason for rejecting the slip")
        deposit.update(status="accepted" if body.decision == "accept" else "rejected", reviewed_by=user["code"],
                       reviewed_at=now(), review_note=body.note)
        refresh_status(transfer)
        store(data)[code] = transfer
        push_later(background, request, notify(data, [transfer["clerk_account"]],
               "Deposit accepted" if body.decision == "accept" else "Deposit slip rejected",
               f"Rs. {deposit['amount']}: " + ("confirmed by the admin." if body.decision == "accept"
                                               else f"{body.note} Upload the slip again."), code))
        audit(data, user["code"], f"cash_deposit_{body.decision}", "cash_transfers", code)
        return public(data, transfer)


class ReturnInput(StrictModel):
    amount: Decimal = Field(gt=0, max_digits=14, decimal_places=2)
    returned_on: date
    note: str | None = Field(default=None, max_length=300)


@router.post("/transfers/{code}/returns")
def cash_returned(code: str, body: ReturnInput, request: Request, background: BackgroundTasks, user=Depends(current_user)):
    """The clerk handed undeposited cash back to the admin."""
    with request.app.state.store.transaction() as data:
        require_manager(data, user)
        transfer = store(data).get(code)
        if not transfer or transfer["status"] in {"assigned", "cancelled", "settled"}:
            raise HTTPException(409, "No cash is with the clerk for this transfer")
        room = with_clerk(transfer) - pending(transfer)
        if money(body.amount) > room:
            raise HTTPException(409, f"At most Rs. {room} can be returned")
        transfer["returns"].append({"amount": str(money(body.amount)), "returned_on": body.returned_on.isoformat(),
                                    "note": body.note, "recorded_by": user["code"], "recorded_at": now()})
        refresh_status(transfer)
        store(data)[code] = transfer
        push_later(background, request, notify(data, [transfer["clerk_account"]], "Cash return recorded",
                                               f"The admin recorded Rs. {money(body.amount)} returned by you.", code))
        audit(data, user["code"], "cash_return", "cash_transfers", code)
        return public(data, transfer)
