"""Device push for inbox notifications (chat messages, leave, certificates, …).

Delivery goes straight to Firebase Cloud Messaging (HTTP v1) when a Firebase service-account key is
configured (``EDUNEXA_FCM_SERVICE_ACCOUNT_FILE``), otherwise through the configured push adapter
(``EDUNEXA_PUSH_ADAPTER_URL`` / ``_TOKEN``). Without either, notifications stay in the in-app inbox.

Every push carries ``notification_code``, ``screen`` and, for chats, ``thread_code`` and the sender,
so tapping it opens the right screen in the app.
* Android: data-only, high priority — the app draws the notification (app icon, sender, message
  preview, one notification group per conversation).
* iOS: an APNs alert (sender as title, message preview as body, grouped by conversation).
"""
import base64
import json
import logging
import threading
import time
from pathlib import Path

import httpx

from .storage import now

log = logging.getLogger(__name__)
DATA_KEYS = ("screen", "thread_code", "certificate_request_code", "certificate_code", "academic_year_code",
             "semester_number", "charge_code", "assignment_code", "assessment_code", "syllabus_code", "calendar_event_code",
             "leave_code", "sender_name", "conversation_title", "kind", "cash_transfer_code",
             "edit_request_code", "payment_code", "receipt_number", "announcement_code", "student_code",
             "attendance_code", "student_leave_code")
_token_lock = threading.Lock()
_token_cache: dict = {}


def _b64(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


def _service_account(settings):
    inline = getattr(settings, "fcm_service_account_json", None)
    if inline:
        try:
            return json.loads(inline.get_secret_value())
        except ValueError:
            log.error("EDUNEXA_FCM_SERVICE_ACCOUNT_JSON is not valid JSON")
            return None
    path = getattr(settings, "fcm_service_account_file", None)
    if not path:
        return None
    file = Path(path)
    if not file.exists():
        log.error("FCM service account file not found: %s", path)
        return None
    return json.loads(file.read_text(encoding="utf-8"))


def _access_token(account):
    """OAuth token for FCM from the service account (signed JWT bearer grant), cached ~55 min."""
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import padding

    with _token_lock:
        cached = _token_cache.get(account["client_email"])
        if cached and cached[1] > time.time() + 60:
            return cached[0]
        issued = int(time.time())
        header = _b64(json.dumps({"alg": "RS256", "typ": "JWT"}).encode())
        claims = _b64(json.dumps({"iss": account["client_email"], "scope": "https://www.googleapis.com/auth/firebase.messaging",
                                  "aud": account.get("token_uri", "https://oauth2.googleapis.com/token"),
                                  "iat": issued, "exp": issued + 3600}).encode())
        key = serialization.load_pem_private_key(account["private_key"].encode(), password=None)
        signature = _b64(key.sign(f"{header}.{claims}".encode(), padding.PKCS1v15(), hashes.SHA256()))
        response = httpx.post(account.get("token_uri", "https://oauth2.googleapis.com/token"), timeout=15, data={
            "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer", "assertion": f"{header}.{claims}.{signature}"})
        response.raise_for_status()
        token = response.json()["access_token"]
        _token_cache[account["client_email"]] = (token, issued + int(response.json().get("expires_in", 3600)))
        return token


def build_message(token, platform, notice, badge=None):
    """FCM v1 message for one device."""
    data = {k: str(notice[k]) for k in DATA_KEYS if notice.get(k) not in (None, "")}
    data.update(notification_code=notice["code"], title=str(notice.get("title") or "College update"),
                body=str(notice.get("body") or ""))
    group = notice.get("thread_code") or notice.get("screen") or "college"
    if platform == "android":
        # A notification payload is drawn by Android itself, so it appears even when the app was
        # swiped away or the phone (ColorOS, MIUI, ...) blocks apps from waking in the background.
        # While the app is open it draws the push instead (same channel, icon and tap action).
        chat = notice.get("screen") == "messages" or bool(notice.get("thread_code"))
        return {"token": token, "data": data,
                "notification": {"title": data["title"], "body": data["body"][:240]},
                "android": {"priority": "high", "ttl": "86400s", "notification": {
                    "channel_id": "chat_messages" if chat else "college_updates",
                    "icon": "ic_notification", "color": "#A46A27", "default_sound": True,
                    "notification_priority": "PRIORITY_HIGH" if chat else "PRIORITY_DEFAULT"}}}
    aps = {"alert": {"title": data["title"], "body": data["body"][:180]}, "sound": "default", "thread-id": group}
    if badge is not None:
        aps["badge"] = badge
    return {"token": token, "data": data, "notification": {"title": data["title"], "body": data["body"][:180]},
            "apns": {"headers": {"apns-priority": "10", "apns-collapse-id": notice["code"][:64]}, "payload": {"aps": aps}}}


def _fcm_send(account, message):
    url = f"https://fcm.googleapis.com/v1/projects/{account['project_id']}/messages:send"
    response = httpx.post(url, json={"message": message}, timeout=15,
                          headers={"Authorization": f"Bearer {_access_token(account)}"})
    if response.status_code == 404 or "UNREGISTERED" in response.text:
        return "unregistered"
    response.raise_for_status()
    return "sent"


def deliver(request, notice_codes):
    """Push each inbox notification to its recipient's registered devices (background task)."""
    settings = request.app.state.settings
    account = _service_account(settings)
    adapter = settings.push_adapter_url and settings.push_adapter_token
    if not account and not adapter:
        return
    for code in notice_codes:
        with request.app.state.store.transaction() as data:
            notice = data["records"].get("notifications", {}).get(code)
            if not notice:
                continue
            devices = [(d["code"], d["token"], d.get("platform") or "android") for d in data["records"].get("device_tokens", {}).values()
                       if d.get("user_code") == notice["user_code"]]
            unread = sum(1 for n in data["records"].get("notifications", {}).values()
                         if n.get("user_code") == notice["user_code"] and n.get("status") != "read")
            notice = dict(notice)
        if not devices:
            continue
        status, stale = "failed", []
        if account:
            for device_code, token, platform in devices:
                try:
                    result = _fcm_send(account, build_message(token, platform, notice, badge=unread))
                    if result == "unregistered":
                        stale.append(device_code)
                    else:
                        status = "accepted"
                except Exception:
                    log.exception("FCM push failed for notification %s", code)
        else:
            from .integrations_api import adapter_post
            payload = {"idempotency_key": code, "tokens": [t for _, t, _ in devices], "title": notice.get("title"),
                       "body": notice.get("body"), "data": build_message("", "ios", notice)["data"],
                       "android": {"priority": "high"}, "apns": {"thread_id": notice.get("thread_code") or notice.get("screen")}}
            try:
                status = "accepted" if adapter_post(settings.push_adapter_url, settings.push_adapter_token, payload).get("accepted") is True else "failed"
            except Exception:
                log.exception("Push adapter failed for notification %s", code)
        with request.app.state.store.transaction() as data:
            record = data["records"].get("notifications", {}).get(code)
            if record:
                record.update(push_status=status, pushed_at=now())
            for device_code in stale:  # the app was uninstalled or the token rotated
                data["records"].get("device_tokens", {}).pop(device_code, None)
