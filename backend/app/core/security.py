import hashlib
import secrets
import time
from datetime import datetime, timedelta, timezone
from typing import Literal

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, ConfigDict, Field

from .storage import new_code

hasher = PasswordHasher()
DUMMY_HASH = hasher.hash(secrets.token_urlsafe(32))
bearer = HTTPBearer(auto_error=False)
CLIENTS = {
    "admin-web",
    "admin-mobile",
    "teacher-mobile",
    "parent-mobile",
    "student-mobile",
}
ACTIONS = {"view", "create", "edit", "delete", "approve", "export"}


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class LoginInput(StrictModel):
    login_id: str = Field(min_length=1, max_length=120)
    password: str = Field(min_length=1, max_length=256)
    client: Literal[
        "admin-web", "admin-mobile", "teacher-mobile", "parent-mobile", "student-mobile"
    ]
    # Role chosen on the sign-in page; the account must hold it (GET /auth/roles lists them).
    role_code: str | None = Field(default=None, min_length=1, max_length=100)


class RefreshInput(StrictModel):
    refresh_token: str = Field(min_length=30, max_length=256)
    client: Literal[
        "admin-web", "admin-mobile", "teacher-mobile", "parent-mobile", "student-mobile"
    ]


class PasswordInput(StrictModel):
    current_password: str = Field(min_length=1, max_length=256)
    new_password: str = Field(min_length=12, max_length=128)


class AccountInput(StrictModel):
    login_id: str = Field(min_length=3, max_length=120, pattern=r"^[a-zA-Z0-9@._+-]+$")
    password: str = Field(min_length=12, max_length=128)
    person_type: Literal["employee", "student", "parent"]
    person_code: str = Field(min_length=1, max_length=100)
    role_codes: list[str] = Field(default_factory=list, max_length=30)
    clients: list[
        Literal[
            "admin-web",
            "admin-mobile",
            "teacher-mobile",
            "parent-mobile",
            "student-mobile",
        ]
    ] = Field(min_length=1, max_length=5)


class AccountUpdate(StrictModel):
    login_id: str | None = Field(default=None, min_length=3, max_length=120, pattern=r"^[a-zA-Z0-9@._+-]+$")
    active: bool | None = None
    role_codes: list[str] | None = Field(default=None, max_length=30)
    clients: (
        list[
            Literal[
                "admin-web",
                "admin-mobile",
                "teacher-mobile",
                "parent-mobile",
                "student-mobile",
            ]
        ]
        | None
    ) = Field(default=None, min_length=1, max_length=5)


class RoleInput(StrictModel):
    scope: Literal["college", "teaching", "self"] = "college"
    name: str = Field(min_length=2, max_length=100)
    permissions: dict[
        str, list[Literal["view", "create", "edit", "delete", "approve", "export"]]
    ] = Field(default_factory=dict)
    # Workspace screens allocated to the role (screen keys); None leaves the role unrestricted.
    screens: list[str] | None = Field(default=None, max_length=200)


def account_client_allowed(account, client):
    mobile_client = {"student": "student-mobile", "parent": "parent-mobile"}.get(account.get("person_type"))
    return client in account.get("clients", []) and (mobile_client is None or client == mobile_client)


def public_account(account):
    result = {k: v for k, v in account.items() if k != "password_hash"}
    result["clients"] = [client for client in account.get("clients", []) if account_client_allowed(account, client)]
    return result


def check_password(password, hashed):
    try:
        return hasher.verify(hashed, password)
    except (VerifyMismatchError, InvalidHashError, VerificationError):
        return False


def digest(token):
    return hashlib.sha256(token.encode()).hexdigest()


def issue(data, account, client, settings, family=None):
    sid = new_code("SES")
    refresh = secrets.token_urlsafe(48)
    family = family or new_code("FAM")
    data["sessions"][sid] = {
        "code": sid,
        "family": family,
        "user_code": account["code"],
        "client": client,
        "refresh_hash": digest(refresh),
        "expires_at": time.time() + settings.refresh_days * 86400,
        "revoked": False,
        "used": False,
        "used_at_epoch": None,
    }
    expires = datetime.now(timezone.utc) + timedelta(minutes=settings.access_minutes)
    token = jwt.encode(
        {
            "sub": account["code"],
            "sid": sid,
            "client": client,
            "type": "access",
            "iss": settings.issuer,
            "aud": settings.audience,
            "iat": datetime.now(timezone.utc),
            "exp": expires,
            "jti": new_code("JWT"),
        },
        settings.jwt_secret,
        algorithm="HS256",
    )
    return {
        "access_token": token,
        "refresh_token": refresh,
        "token_type": "bearer",
        "expires_in": settings.access_minutes * 60,
        "account": public_account(account),
    }


def current_user(
    request: Request, credentials: HTTPAuthorizationCredentials | None = Depends(bearer)
):
    if not credentials:
        raise HTTPException(
            401, "Bearer token required", headers={"WWW-Authenticate": "Bearer"}
        )
    settings = request.app.state.settings
    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.jwt_secret,
            algorithms=["HS256"],
            audience=settings.audience,
            issuer=settings.issuer,
            options={"require": ["exp", "iat", "sub", "sid", "type", "client", "jti"]},
        )
    except jwt.PyJWTError:
        raise HTTPException(
            401,
            "Invalid or expired access token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    data = request.app.state.store.snapshot()
    request.state.auth_data = data  # permission checks in this request reuse what was read
    account = data["accounts"].get(payload["sub"])
    session = data["sessions"].get(payload["sid"])
    if (
        payload["type"] != "access"
        or not account
        or not account["active"]
        or not session
        or session["revoked"]
        or session["expires_at"] <= time.time()
        or session["user_code"] != account["code"]
        or session["client"] != payload["client"]
        or not account_client_allowed(account, payload["client"])
    ):
        raise HTTPException(401, "Session revoked or account disabled")
    assigned = [data["roles"][r] for r in account["role_codes"] if r in data["roles"]]
    scope = (
        "college"
        if any(
            r.get("system_admin") or r.get("scope", "college") == "college"
            for r in assigned
        )
        else "teaching"
        if any(r.get("scope") == "teaching" for r in assigned)
        else "self"
    )
    return {
        **public_account(account),
        "workspace_scope": scope,
        "session_code": session["code"],
        "client": session["client"],
    }


def has_permission(data, user, screen, action):
    assigned = [
        data["roles"][r]
        for r in data["accounts"].get(user["code"], {}).get("role_codes", [])
        if r in data["roles"]
    ]
    if not any(
        r.get("system_admin") or r.get("scope", "college") == "college"
        for r in assigned
    ):
        return False
    return any(
        (r := data["roles"].get(code))
        and (r.get("system_admin") or action in r["permissions"].get(screen, []))
        for code in data["accounts"].get(user["code"], {}).get("role_codes", [])
    )


def role_limit(data, user, key):
    """Allowlist a role sets under `key` (e.g. "screens", "import_files"), or None if unrestricted.

    A user is limited only when every assigned role sets the list; system administrators and
    roles without the list are unrestricted. Limits narrow what is shown; table permissions
    still decide what each request may read or change.
    """
    roles = [data["roles"][r] for r in data["accounts"].get(user["code"], {}).get("role_codes", []) if r in data["roles"]]
    if not roles or any(r.get("system_admin") or not r.get(key) for r in roles):
        return None
    return {item for r in roles for item in r[key]}


def require(screen, action):
    def permission(request: Request, user=Depends(current_user)):
        data = getattr(request.state, "auth_data", None) or request.app.state.store.snapshot()
        if not has_permission(data, user, screen, action):
            raise HTTPException(403, "Screen/action permission denied")
        return user

    return permission


def revoke_user(data, code):
    for session in data["sessions"].values():
        if session["user_code"] == code:
            session["revoked"] = True
