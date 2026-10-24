"""Configured HTTP integration adapters; endpoint, queries and callback checks together.
Adapters translate this contract to the college's selected provider. No provider credentials
are assumed and no delivery/settlement is fabricated when configuration is missing.
"""

import hashlib
import hmac
from datetime import date
from decimal import Decimal
from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import Field

from app.core.security import StrictModel, current_user, has_permission, require
from app.core.storage import audit, new_code, now
from app.modules.finance.transactions.api import balance, record_payment
from app.workflows.schemas import PaymentInput

router = APIRouter(prefix="/integrations", tags=["External integrations"])


def query_rows(data, table):
    return list(data["records"].get(table, {}).values())


def query_get(data, table, code):
    r = data["records"].get(table, {}).get(code)
    if not r:
        raise HTTPException(404, "Record not found")
    return r


def query_save(data, table, record):
    data["records"].setdefault(table, {})[record["code"]] = record
    return record


def adapter_post(url, token, payload):
    if urlparse(url).scheme != "https":
        raise HTTPException(503, "Integration adapter must use HTTPS")
    try:
        response = httpx.post(
            url,
            json=payload,
            headers={
                "Authorization": "Bearer " + token.get_secret_value(),
                "Idempotency-Key": payload["idempotency_key"],
            },
            timeout=15,
        )
        response.raise_for_status()
        result = response.json()
        if not isinstance(result, dict):
            raise ValueError()
        return result
    except Exception:
        raise HTTPException(502, "Integration provider did not accept the request")


@router.get("/status")
def status(request: Request, user=Depends(require("reports", "view"))):
    s = request.app.state.settings
    return {
        "sql": "postgres" if s.storage_backend == "postgres" else "disabled",
        "sms": "configured"
        if s.sms_adapter_url and s.sms_adapter_token
        else "not_configured",
        "payment_gateway": "configured"
        if s.payment_adapter_url
        and s.payment_adapter_token
        and s.payment_callback_secret
        else "not_configured",
        "certificate_signing": "local-development-ed25519",
        "document_storage": "local-private-files",
    }


class SmsInput(StrictModel):
    charge_code: str
    parent_code: str
    cutoff_date: date


@router.post("/sms/send")
def sms(
    request: Request,
    body: SmsInput | None = None,
    user=Depends(require("notifications", "create")),
):
    settings = request.app.state.settings
    if not settings.sms_adapter_url or not settings.sms_adapter_token:
        raise HTTPException(503, "SMS provider is not configured; no message was sent")
    if body is None:
        raise HTTPException(422, "Charge, parent and cut-off date required")
    with request.app.state.store.transaction() as data:
        charge = query_get(data, "student_fee_charges", body.charge_code)
        parent = query_get(data, "parents", body.parent_code)
        if not any(
            r["student_code"] == charge["student_code"]
            and r["parent_code"] == parent["code"]
            and r["receives_notifications"]
            for r in query_rows(data, "student_parents")
        ):
            raise HTTPException(
                403, "Parent is not an opted-in contact for this student"
            )
        if not any(
            r.get("parent_code") == parent["code"]
            and r.get("student_code") == charge["student_code"]
            and r["purpose"] == "fee_reminders"
            and r["granted"]
            and not r.get("withdrawn_at")
            for r in query_rows(data, "consents")
        ):
            raise HTTPException(409, "Explicit fee-reminder consent is required")
        due = balance(data, charge)["outstanding"]
        if due <= 0:
            raise HTTPException(409, "No outstanding fee for this charge")
        job = next(
            (
                r
                for r in query_rows(data, "fee_reminder_jobs")
                if r["charge_code"] == charge["code"]
                and r["parent_code"] == parent["code"]
                and r["cutoff_date"] == body.cutoff_date.isoformat()
                and r["channel"] == "sms"
            ),
            None,
        )
        if job and job["status"] == "sent":
            return {"code": job["code"], "status": "sent", "duplicate_request": True}
        if not job:
            job = query_save(
                data,
                "fee_reminder_jobs",
                {
                    "code": new_code("REMINDER"),
                    "charge_code": charge["code"],
                    "parent_code": parent["code"],
                    "cutoff_date": body.cutoff_date.isoformat(),
                    "scheduled_at": now(),
                    "channel": "sms",
                    "message_template": "fee-due-v1",
                    "consent_checked_at": now(),
                    "status": "queued",
                    "sent_at": None,
                },
            )
        job_code = job["code"]
        payload = {
            "idempotency_key": job_code,
            "to": parent["phone"],
            "template": "fee-due-v1",
            "values": {
                "amount": str(due),
                "currency": "INR",
                "cutoff_date": body.cutoff_date.isoformat(),
                "student_code": charge["student_code"],
            },
        }
    result = adapter_post(settings.sms_adapter_url, settings.sms_adapter_token, payload)
    if not result.get("message_id") or result.get("status") not in {"accepted", "sent"}:
        raise HTTPException(502, "Provider did not confirm acceptance")
    with request.app.state.store.transaction() as data:
        job = query_get(data, "fee_reminder_jobs", job_code)
        job.update(status="sent", sent_at=now())
        query_save(
            data,
            "notification_delivery_attempts",
            {
                "code": new_code("DEL"),
                "reminder_code": job_code,
                "notification_code": None,
                "provider": "configured-adapter",
                "provider_message_id": str(result["message_id"]),
                "attempt_number": 1,
                "status": "sent",
                "attempted_at": now(),
                "error_code": None,
            },
        )
        audit(data, user["code"], "send_sms", "fee_reminder_jobs", job_code)
    return {"code": job_code, "status": "sent", "delivery_status": "provider_accepted"}


class OrderInput(StrictModel):
    student_code: str
    charge_code: str
    amount: Decimal = Field(gt=0, max_digits=12, decimal_places=2)


@router.post("/payments/order", status_code=201)
def order(request: Request, body: OrderInput | None = None, user=Depends(current_user)):
    settings = request.app.state.settings
    if (
        not settings.payment_adapter_url
        or not settings.payment_adapter_token
        or not settings.payment_callback_secret
    ):
        raise HTTPException(
            503, "Payment gateway is not configured; no charge was created"
        )
    if body is None:
        raise HTTPException(422, "Student, charge and amount required")
    with request.app.state.store.transaction() as data:
        student = query_get(data, "students", body.student_code)
        own = (
            user["person_type"] == "student"
            and user["person_code"] == student["code"]
            or user["person_type"] == "parent"
            and any(
                r["student_code"] == student["code"]
                and r["parent_code"] == user["person_code"]
                for r in query_rows(data, "student_parents")
            )
        )
        if not own and not has_permission(
            data, user, "payment_gateway_orders", "create"
        ):
            raise HTTPException(403, "Payment permission denied")
        charge = query_get(data, "student_fee_charges", body.charge_code)
        if (
            charge["student_code"] != student["code"]
            or body.amount > balance(data, charge)["outstanding"]
        ):
            raise HTTPException(
                409, "Invalid charge or amount exceeds outstanding balance"
            )
        existing = next(
            (
                r
                for r in query_rows(data, "payment_gateway_orders")
                if r["student_code"] == student["code"]
                and r.get("charge_code") == charge["code"]
                and r["status"] in {"created", "pending"}
            ),
            None,
        )
        if existing:
            if Decimal(existing["amount"]) != body.amount:
                raise HTTPException(
                    409, "An unpaid checkout already exists for another amount"
                )
            if existing.get("checkout_url"):
                return {
                    "order_code": existing["code"],
                    "checkout_url": existing["checkout_url"],
                    "amount": existing["amount"],
                    "currency": "INR",
                }
            record = existing
        else:
            record = query_save(
                data,
                "payment_gateway_orders",
                {
                    "code": new_code("ORDER"),
                    "student_code": student["code"],
                    "charge_code": charge["code"],
                    "provider": "configured-adapter",
                    "provider_order_reference": "pending",
                    "idempotency_key": new_code("CHECKOUT"),
                    "amount": str(body.amount),
                    "currency": "INR",
                    "status": "created",
                    "payment_code": None,
                    "created_by_user_code": user["code"],
                },
            )
        code = record["code"]
        payload = {
            "idempotency_key": record["idempotency_key"],
            "order_code": code,
            "amount": record["amount"],
            "currency": "INR",
            "callback_url": settings.public_api_url.rstrip("/")
            + "/api/v1/integrations/payments/callback",
        }
    result = adapter_post(
        settings.payment_adapter_url, settings.payment_adapter_token, payload
    )
    if (
        not result.get("order_reference")
        or urlparse(str(result.get("checkout_url", ""))).scheme != "https"
    ):
        raise HTTPException(502, "Payment adapter returned an invalid checkout")
    with request.app.state.store.transaction() as data:
        record = query_get(data, "payment_gateway_orders", code)
        record.update(
            provider_order_reference=str(result["order_reference"]),
            checkout_url=result["checkout_url"],
            status="pending",
        )
        audit(data, user["code"], "create_checkout", "payment_gateway_orders", code)
    return {
        "order_code": code,
        "checkout_url": result["checkout_url"],
        "amount": record["amount"],
        "currency": "INR",
    }


class CallbackInput(StrictModel):
    order_code: str
    event_id: str = Field(min_length=1, max_length=100)
    transaction_reference: str = Field(min_length=1, max_length=100)
    amount: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    currency: str
    status: str


@router.post("/payments/callback")
async def payment_callback(request: Request):
    secret = request.app.state.settings.payment_callback_secret
    if not secret:
        raise HTTPException(503, "Payment callbacks are not configured")
    raw = await request.body()
    expected = hmac.new(
        secret.get_secret_value().encode(), raw, hashlib.sha256
    ).hexdigest()
    if not hmac.compare_digest(
        expected, request.headers.get("X-Payment-Signature", "")
    ):
        raise HTTPException(401, "Invalid callback signature")
    try:
        body = CallbackInput.model_validate_json(raw)
    except ValueError:
        raise HTTPException(422, "Invalid payment callback")
    with request.app.state.store.transaction() as data:
        record = query_get(data, "payment_gateway_orders", body.order_code)
        duplicate = next(
            (
                r
                for r in query_rows(data, "payment_gateway_events")
                if r["provider_event_id"] == body.event_id
            ),
            None,
        )
        if duplicate:
            return {"accepted": True, "duplicate": True}
        if (
            body.amount != Decimal(record["amount"])
            or body.currency != record["currency"]
        ):
            raise HTTPException(409, "Callback amount/currency mismatch")
        if body.status not in {"paid", "failed", "cancelled"}:
            raise HTTPException(422, "Unknown settlement status")
        if record["status"] == "paid":
            return {"accepted": True, "duplicate": True}
        if body.status == "paid":
            payment = PaymentInput.model_construct(
                student_code=record["student_code"],
                currency=record["currency"],
                method="card",
                transaction_reference=body.transaction_reference,
                paid_on=date.today(),
                allocations={record["charge_code"]: body.amount},
            )
            settled = record_payment(
                data,
                payment,
                "gateway:" + record["code"],
                record["created_by_user_code"],
            )
            record["payment_code"] = settled["payment"]["code"]
        record["status"] = body.status
        query_save(
            data,
            "payment_gateway_events",
            {
                "code": new_code("EVENT"),
                "order_code": record["code"],
                "provider": "configured-adapter",
                "provider_event_id": body.event_id,
                "signature_verified": True,
                "received_at": now(),
                "processed_at": now(),
                "payload_sha256": hashlib.sha256(raw).hexdigest(),
                "status": "processed",
            },
        )
        return {"accepted": True, "order_code": record["code"]}


@router.post("/certificates/sign")
def sign(user=Depends(require("certificates", "approve"))):
    raise HTTPException(
        503,
        "An official college signing provider is not configured; use the explicitly labeled local development issuance flow for the demo",
    )
