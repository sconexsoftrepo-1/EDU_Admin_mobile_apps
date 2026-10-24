import time

from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.core.security import (
    DUMMY_HASH,
    LoginInput,
    PasswordInput,
    RefreshInput,
    check_password,
    current_user,
    digest,
    hasher,
    issue,
    revoke_user,
)
from app.core.storage import audit

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.get("/roles")
def sign_in_roles(request: Request):
    """Roles offered on the sign-in page (names only; no permissions or accounts)."""
    data = request.app.state.store.snapshot()
    # With the database store, read the roles table alone (one query, no permission rows).
    rows = data.table("roles").load().rows.values() if hasattr(data, "table") else data["roles"].values()
    roles = sorted(rows, key=lambda r: (not (r.get("system_admin") or r.get("is_system_admin")), r["name"].casefold()))
    return {"roles": [{"code": r["code"], "name": r["name"], "scope": r.get("scope", "college")} for r in roles]}


@router.post("/login")
def login(body: LoginInput, request: Request, response: Response):
    denied = False
    limited = False
    wrong_role = False
    result = None
    key = digest(body.login_id.casefold())
    ip_key = "ip:" + digest(request.client.host if request.client else "unknown")
    with request.app.state.store.transaction() as data:
        attempts = data["login_attempts"]
        for k in (key, ip_key):
            attempts[k] = [t for t in attempts.get(k, []) if t > time.time() - 900]
        limited = len(attempts[key]) >= 5 or len(attempts[ip_key]) >= 50
        if not limited:
            account = next(
                (
                    a
                    for a in data["accounts"].values()
                    if a["login_id"].casefold() == body.login_id.casefold()
                ),
                None,
            )
            valid = check_password(
                body.password, account["password_hash"] if account else DUMMY_HASH
            )
            denied = not (
                account
                and valid
                and account["active"]
                and body.client in account["clients"]
            )
            wrong_role = (
                not denied
                and body.role_code is not None
                and body.role_code not in account["role_codes"]
            )
            if wrong_role:
                pass  # correct credentials; the account just does not hold the chosen role
            elif denied:
                attempts[key].append(time.time())
                attempts[ip_key].append(time.time())
            else:
                attempts[key] = []
                result = issue(data, account, body.client, request.app.state.settings)
                # Roles (with permissions and screen allocation) let clients build their
                # navigation right after sign-in, without another request.
                result["roles"] = [data["roles"][r] for r in account["role_codes"] if r in data["roles"]]
                audit(data, account["code"], "login", "accounts", account["code"])
    response.headers["Cache-Control"] = "no-store"
    if limited:
        raise HTTPException(
            429,
            "Too many login attempts. Retry after 15 minutes.",
            headers={"Retry-After": "900"},
        )
    if denied:
        raise HTTPException(401, "Invalid credentials or client access")
    if wrong_role:
        raise HTTPException(403, "This account is not assigned to the selected role")
    return result


@router.post("/refresh")
def refresh(body: RefreshInput, request: Request, response: Response):
    result = None
    with request.app.state.store.transaction() as data:
        session = next(
            (
                s
                for s in data["sessions"].values()
                if s["refresh_hash"] == digest(body.refresh_token)
            ),
            None,
        )
        if session and session["client"] == body.client:
            account = data["accounts"].get(session["user_code"])
            if session["used"]:
                for s in data["sessions"].values():
                    if s["family"] == session["family"]:
                        s["revoked"] = True
                audit(
                    data,
                    session["user_code"],
                    "refresh_reuse_blocked",
                    "sessions",
                    session["code"],
                )
            elif (
                not session["revoked"]
                and session["expires_at"] > time.time()
                and account
                and account["active"]
                and body.client in account["clients"]
            ):
                session["used"] = True
                session["revoked"] = True
                result = issue(
                    data,
                    account,
                    body.client,
                    request.app.state.settings,
                    session["family"],
                )
    response.headers["Cache-Control"] = "no-store"
    if not result:
        raise HTTPException(401, "Invalid, expired or reused refresh token")
    return result


@router.post("/logout", status_code=204)
def logout(request: Request, user=Depends(current_user)):
    with request.app.state.store.transaction() as data:
        family = data["sessions"][user["session_code"]]["family"]
        for session in data["sessions"].values():
            if session["family"] == family:
                session["revoked"] = True
        audit(data, user["code"], "logout", "sessions", user["session_code"])


@router.post("/logout-all", status_code=204)
def logout_all(request: Request, user=Depends(current_user)):
    with request.app.state.store.transaction() as data:
        revoke_user(data, user["code"])
        audit(data, user["code"], "logout_all", "accounts", user["code"])


@router.get("/me")
def me(request: Request, user=Depends(current_user)):
    data = request.app.state.store.snapshot()
    return {
        "account": user,
        "roles": [data["roles"][r] for r in user["role_codes"] if r in data["roles"]],
    }


@router.post("/change-password", status_code=204)
def change_password(body: PasswordInput, request: Request, user=Depends(current_user)):
    with request.app.state.store.transaction() as data:
        account = data["accounts"][user["code"]]
        if not check_password(body.current_password, account["password_hash"]):
            raise HTTPException(401, "Current password incorrect")
        account["password_hash"] = hasher.hash(body.new_password)
        revoke_user(data, user["code"])
        audit(data, user["code"], "password_changed", "accounts", user["code"])
