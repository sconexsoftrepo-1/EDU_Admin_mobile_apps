"""Identity-bound device registration and explicit college alert delivery."""
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import Field
from app.core.security import StrictModel, current_user, require
from app.core.storage import audit, new_code, now
from app.core.integrations_api import adapter_post

router = APIRouter(prefix="/mobile", tags=["Mobile alerts"])

class DeviceInput(StrictModel):
    token: str = Field(min_length=20, max_length=4096)
    platform: Literal["android", "ios", "web"]

class TokenInput(StrictModel):
    token: str = Field(min_length=20, max_length=4096)

@router.post("/devices/register")
def register_device(body: DeviceInput, request: Request, user=Depends(current_user)):
    with request.app.state.store.transaction() as data:
        devices = data["records"].setdefault("device_tokens", {})
        existing = next((r for r in devices.values() if r["token"] == body.token), None)
        code = existing["code"] if existing else new_code("DEVICE")
        # An installation may switch accounts; move the token instead of duplicating it.
        devices[code] = {"code": code, "user_code": user["code"], "token": body.token,
                         "platform": body.platform, "last_seen_at": now()}
        audit(data, user["code"], "register_device", "device_tokens", code)
    return {"registered": True}

@router.post("/devices/unregister")
def unregister_device(body: TokenInput, request: Request, user=Depends(current_user)):
    with request.app.state.store.transaction() as data:
        devices = data["records"].setdefault("device_tokens", {})
        for code in [r["code"] for r in devices.values()
                     if r["token"] == body.token and r["user_code"] == user["code"]]:
            del devices[code]
            audit(data, user["code"], "unregister_device", "device_tokens", code)
    return {"registered": False}

class AlertInput(StrictModel):
    recipient_user_code: str = Field(min_length=1, max_length=100)
    title: str = Field(min_length=1, max_length=200)
    body: str = Field(min_length=1, max_length=4000)
    push: bool = False

@router.post("/alerts", status_code=201)
def send_alert(body: AlertInput, request: Request, user=Depends(require("notifications", "create"))):
    settings = request.app.state.settings
    if body.push and not (settings.push_adapter_url and settings.push_adapter_token):
        raise HTTPException(503, "Push delivery is not configured. Send an in-app alert instead.")
    code = new_code("NOTICE")
    with request.app.state.store.transaction() as data:
        account = data["accounts"].get(body.recipient_user_code)
        if not account or not account["active"]:
            raise HTTPException(404, "Recipient account not found")
        tokens = [r["token"] for r in data["records"].get("device_tokens", {}).values()
                  if r["user_code"] == account["code"]]
        if body.push and not tokens:
            raise HTTPException(409, "Recipient has no registered device. Send an in-app alert instead.")
        data["records"].setdefault("notifications", {})[code] = {
            "code": code, "user_code": account["code"], "title": body.title, "body": body.body,
            "channel": "push" if body.push else "in_app", "status": "queued" if body.push else "sent",
            "sent_at": now() if not body.push else None,
        }
        audit(data, user["code"], "send_alert", "notifications", code)
    if body.push:
        try:
            result = adapter_post(settings.push_adapter_url, settings.push_adapter_token, {
                "idempotency_key": code, "tokens": tokens, "title": body.title,
                "body": body.body, "data": {"notification_code": code},
            })
            if result.get("accepted") is not True:
                raise HTTPException(502, "Push provider did not confirm delivery acceptance")
        except HTTPException:
            with request.app.state.store.transaction() as data:
                data["records"]["notifications"][code]["status"] = "failed"
            raise
        with request.app.state.store.transaction() as data:
            record = data["records"]["notifications"][code]
            # Preserve a read that arrived while the provider accepted delivery.
            if record["status"] != "read":
                record["status"] = "sent"
            record["sent_at"] = now()
    return {"notification_code": code, "push_accepted": body.push}
