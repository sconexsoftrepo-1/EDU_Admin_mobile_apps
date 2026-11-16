"""Staff sign-in with a one-time code sent by email (admin dashboard and the EduDesk app).

POST /api/v1/auth/otp/request  {login, client}        -> always the same neutral answer
POST /api/v1/auth/otp/verify   {login, code, client}   -> the same tokens as POST /auth/login

- Staff only (employee and system logins); parents and students keep password sign-in.
- 6-digit code, valid 5 minutes, at most 5 wrong tries; one code per 60 seconds, 5 per hour per login;
  only an HMAC of the code is stored (in documents "login_otps"), never the code itself.
- The answer to a request never says whether the login or email exists.
"""

import hashlib
import hmac
import secrets
import time
from html import escape
from typing import Literal

from fastapi import APIRouter, BackgroundTasks, HTTPException, Request, Response
from pydantic import Field

from . import email_layout as layout
from .email_delivery import send_email
from .security import StrictModel, account_client_allowed, digest, issue
from .storage import audit

router = APIRouter(prefix="/auth/otp", tags=["Authentication"])

STAFF_CLIENTS = ("admin-web", "admin-mobile", "teacher-mobile")
APP_NAMES = {"admin-web": "EduNexa Admin", "admin-mobile": "EduDesk", "teacher-mobile": "EduDesk"}
CODE_MINUTES = 5
MAX_TRIES = 5
RESEND_SECONDS = 60
PER_HOUR = 5
IP_PER_HOUR = 30
NEUTRAL = ("If this login is assigned to the selected role and has an email address, a 6-digit sign-in code "
           "has been sent to it. It is valid for 5 minutes.")


class OtpRequest(StrictModel):
    login: str = Field(min_length=3, max_length=254)  # login ID or the login's email
    client: Literal["admin-web", "admin-mobile", "teacher-mobile"]
    # The role chosen on the sign-in page: a code is only sent when the login holds it.
    role_code: str | None = Field(default=None, max_length=100)


class OtpVerify(StrictModel):
    login: str = Field(min_length=3, max_length=254)
    code: str = Field(pattern=r"^\d{6}$")
    client: Literal["admin-web", "admin-mobile", "teacher-mobile"]
    role_code: str | None = Field(default=None, max_length=100)


def store(data):
    return data.setdefault("documents", {}).setdefault("login_otps", {})


def staff_account(data, login):
    """The active staff login whose login ID or email is ``login`` (case-insensitive), or None."""
    wanted = login.strip().casefold()
    for account in data["accounts"].values():
        if not account.get("active") or account.get("person_type") in ("student", "parent"):
            continue
        if account["login_id"].casefold() == wanted or (account.get("email") or "").casefold() == wanted:
            return account
    return None


def code_hash(settings, account_code, code):
    return hmac.new(settings.jwt_secret.encode(), f"otp:{account_code}:{code}".encode(), hashlib.sha256).hexdigest()


def display_name(data, account):
    person = data["records"].get("employees", {}).get(account.get("person_code"), {}) if account.get("person_type") == "employee" else {}
    name = " ".join(filter(None, [person.get("first_name"), person.get("last_name")])).strip()
    return name or account.get("display_name") or account["login_id"]


def code_email(settings, name, app_name, code):
    subject = f"{code} is your {app_name} sign-in code"
    title = f"Your {app_name} sign-in code"
    lines = f"Use the one-time code below to sign in to {app_name}. The code is valid for {CODE_MINUTES} minutes."
    care = ("Never share this code with anyone. College staff will never ask for it. "
            "If you did not try to sign in, please ignore this email and inform the college office.")
    html = layout.page(settings, title, f"Your sign-in code is {code}",
                       layout.p(f"Dear {escape(name)},") + layout.p(escape(lines)) + layout.code_box(code)
                       + layout.notice(care))
    text = layout.text_page(title, f"Dear {name},\n\n{lines}\n\n    Sign-in code: {code}\n\n{care}")
    return subject, text, html


@router.post("/request")
def request_code(body: OtpRequest, request: Request, response: Response, background: BackgroundTasks):
    response.headers["Cache-Control"] = "no-store"
    settings = request.app.state.settings
    outgoing = None
    now = time.time()
    ip_key = "otp-ip:" + digest(request.client.host if request.client else "unknown")
    with request.app.state.store.transaction() as data:
        attempts = data["login_attempts"]
        attempts[ip_key] = [t for t in attempts.get(ip_key, []) if t > now - 3600]
        if len(attempts[ip_key]) >= IP_PER_HOUR:
            raise HTTPException(429, "Too many code requests. Try again later.", headers={"Retry-After": "3600"})
        attempts[ip_key].append(now)
        account = staff_account(data, body.login)
        if account and account.get("email") and account_client_allowed(account, body.client) \
                and (not body.role_code or body.role_code in account["role_codes"]):
            codes = store(data)
            entry = codes.get(account["code"], {})
            sent = [t for t in entry.get("sent", []) if t > now - 3600]
            if (not sent or now - sent[-1] >= RESEND_SECONDS) and len(sent) < PER_HOUR:
                code = f"{secrets.randbelow(1_000_000):06d}"
                codes[account["code"]] = {"hash": code_hash(settings, account["code"], code), "client": body.client,
                                          "expires": now + CODE_MINUTES * 60, "tries": 0, "sent": sent + [now]}
                audit(data, account["code"], "otp_requested", "accounts", account["code"])
                outgoing = (account["email"], *code_email(settings, display_name(data, account), APP_NAMES[body.client], code))
    if outgoing:
        to, subject, text, html = outgoing
        background.add_task(send_email, settings, to, subject, text, html)
    return {"sent": True, "message": NEUTRAL}


@router.post("/verify")
def verify_code(body: OtpVerify, request: Request, response: Response):
    response.headers["Cache-Control"] = "no-store"
    settings = request.app.state.settings
    now = time.time()
    result, error = None, None
    ip_key = "ip:" + digest(request.client.host if request.client else "unknown")
    with request.app.state.store.transaction() as data:
        attempts = data["login_attempts"]
        attempts[ip_key] = [t for t in attempts.get(ip_key, []) if t > now - 900]
        if len(attempts[ip_key]) >= 50:
            raise HTTPException(429, "Too many sign-in attempts. Retry after 15 minutes.", headers={"Retry-After": "900"})
        account = staff_account(data, body.login)
        codes = store(data)
        entry = codes.get(account["code"]) if account else None
        if not entry or not entry.get("hash") or entry.get("client") != body.client or entry.get("expires", 0) < now:
            if entry and entry.get("hash") and entry.get("expires", 0) < now:
                entry.update(hash="", expires=0)  # expired; the send history stays for the limits
            error = (401, "The code is wrong or has expired. Request a new code.")
        elif not hmac.compare_digest(entry["hash"], code_hash(settings, account["code"], body.code)):
            entry["tries"] = entry.get("tries", 0) + 1
            if entry["tries"] >= MAX_TRIES:
                entry.update(hash="", expires=0)  # void; resends still wait 60 s and count towards 5 an hour
            audit(data, account["code"], "otp_failed", "accounts", account["code"])
            error = (401, "The code is wrong or has expired. Request a new code.")
        elif not account_client_allowed(account, body.client):
            error = (401, "This login cannot sign in here")
        elif body.role_code and body.role_code not in account["role_codes"]:
            error = (403, "This account is not assigned to the selected role")
        else:
            codes.pop(account["code"], None)  # one use only
            result = issue(data, account, body.client, settings)
            result["roles"] = [data["roles"][r] for r in account["role_codes"] if r in data["roles"]]
            audit(data, account["code"], "login_otp", "accounts", account["code"])
        if error and error[0] == 401:
            attempts[ip_key].append(now)
    if error:
        raise HTTPException(*error)
    return result
