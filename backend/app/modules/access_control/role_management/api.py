from fastapi import APIRouter, Depends, HTTPException, Request

from app.core.security import (
    AccountInput,
    AccountUpdate,
    RoleInput,
    has_permission,
    hasher,
    public_account,
    require,
    revoke_user,
)
from app.core.storage import audit, new_code
from app.modules.administration.workspace.api import SCREENS as WORKSPACE_SCREENS
from app.modules.mobile.workspace.api import FORM_ACTIONS

router = APIRouter(prefix="/administration", tags=["Roles and accounts"])


def valid_roles(data, roles, actor=None):
    if len(roles) != len(set(roles)) or any(
        r not in data["roles"] or data["roles"][r].get("system_admin") for r in roles
    ):
        raise HTTPException(422, "Unknown, duplicate or protected role")
    if actor:
        for code in roles:
            check_grant(data, actor, data["roles"][code]["permissions"])


def check_grant(data, actor, permissions):
    if any(
        not has_permission(data, actor, screen, action)
        for screen, actions in permissions.items()
        for action in actions
    ):
        raise HTTPException(
            403, "You cannot grant or manage privileges beyond your own permissions"
        )


def validate_permissions(request, body, actor):
    screens = (
        set(request.app.state.catalog) | {"mobile." + a for a in FORM_ACTIONS}
    ) | {
        "accounts",
        "roles",
        "forms",
        "reports",
        "audit",
        "mobile",
    }
    if set(body.permissions) - screens:
        raise HTTPException(422, "Unknown screen permission")
    if body.screens is not None and set(body.screens) - {s["key"] for s in WORKSPACE_SCREENS}:
        raise HTTPException(422, "Unknown workspace screen")
    check_grant(request.app.state.store.snapshot(), actor, body.permissions)


@router.get("/screens")
def screens(request: Request, user=Depends(require("roles", "view"))):
    return {
        "screens": sorted(
            (set(request.app.state.catalog) | {"mobile." + a for a in FORM_ACTIONS})
            | {"accounts", "roles", "forms", "reports", "audit", "mobile"}
        ),
        "actions": ["view", "create", "edit", "delete", "approve", "export"],
        # Screens a role can be allocated (the role's "screens" list).
        "workspace_screens": [{"key": s["key"], "title": s["title"]} for s in WORKSPACE_SCREENS],
    }


@router.get("/roles")
def roles(request: Request, user=Depends(require("roles", "view"))):
    data = request.app.state.store.snapshot()
    return [
        {
            **r,
            "assigned_accounts": [
                {
                    **public_account(a),
                    "employee": data["records"]
                    .get("employees", {})
                    .get(a.get("person_code"))
                    if a.get("person_type") == "employee"
                    else None,
                }
                for a in data["accounts"].values()
                if r["code"] in a["role_codes"]
            ],
        }
        for r in data["roles"].values()
    ]


@router.post("/roles", status_code=201)
def create_role(
    body: RoleInput, request: Request, user=Depends(require("roles", "create"))
):
    validate_permissions(request, body, user)
    with request.app.state.store.transaction() as data:
        if any(
            r["name"].casefold() == body.name.casefold() for r in data["roles"].values()
        ):
            raise HTTPException(409, "Role name exists")
        role = {"code": new_code("ROLE"), **body.model_dump(), "system_admin": False}
        data["roles"][role["code"]] = role
        audit(data, user["code"], "create", "roles", role["code"])
        return role


@router.put("/roles/{code}")
def edit_role(
    code: str, body: RoleInput, request: Request, user=Depends(require("roles", "edit"))
):
    validate_permissions(request, body, user)
    with request.app.state.store.transaction() as data:
        role = data["roles"].get(code)
        if not role:
            raise HTTPException(404, "Role not found")
        if role.get("system_admin"):
            raise HTTPException(409, "System administrator role is protected")
        if any(
            r["code"] != code and r["name"].casefold() == body.name.casefold()
            for r in data["roles"].values()
        ):
            raise HTTPException(409, "Role name exists")
        check_grant(data, user, role["permissions"])
        role.update(body.model_dump())
        audit(data, user["code"], "edit", "roles", code)
        return role


@router.delete("/roles/{code}", status_code=204)
def delete_role(code: str, request: Request, user=Depends(require("roles", "delete"))):
    with request.app.state.store.transaction() as data:
        role = data["roles"].get(code)
        if not role:
            raise HTTPException(404, "Role not found")
        if role.get("system_admin") or any(
            code in a["role_codes"] for a in data["accounts"].values()
        ):
            raise HTTPException(
                409, "Protected or assigned role; unassign accounts first"
            )
        check_grant(data, user, role["permissions"])
        del data["roles"][code]
        audit(data, user["code"], "delete", "roles", code)


@router.get("/accounts")
def accounts(request: Request, user=Depends(require("accounts", "view"))):
    return [
        public_account(a)
        for a in request.app.state.store.snapshot()["accounts"].values()
    ]


@router.get("/people/{person_type}/{person_code}/logins")
def person_logins(person_type: str, person_code: str, request: Request, user=Depends(require("accounts", "view"))):
    data = request.app.state.store.snapshot()
    table = {"student": "students", "employee": "employees"}.get(person_type)
    if not table or person_code not in data["records"].get(table, {}):
        raise HTTPException(404, "Person not found")
    people = [(person_type, data["records"][table][person_code], "Student" if person_type == "student" else "Teacher / staff")]
    if person_type == "student":
        seen = set()
        for link in data["records"].get("student_parents", {}).values():
            code = link.get("parent_code")
            parent = data["records"].get("parents", {}).get(code)
            if link.get("student_code") == person_code and parent and code not in seen:
                seen.add(code)
                people.append(("parent", parent, link.get("relationship") or "Guardian"))
    result = []
    for kind, person, relationship in people:
        account = next((a for a in data["accounts"].values() if a.get("person_type") == kind and a.get("person_code") == person["code"]), None)
        manageable = True
        if account:
            try:
                valid_roles(data, account["role_codes"], user)
            except HTTPException:
                manageable = False
        result.append({"person_type": kind, "person_code": person["code"], "name": " ".join(str(person.get(k) or "") for k in ("first_name", "middle_name", "last_name")).strip(), "relationship": relationship, "account": public_account(account) if account else None, "manageable": manageable})
    grantable = []
    for role in data["roles"].values():
        try:
            valid_roles(data, [role["code"]], user)
        except HTTPException:
            continue
        grantable.append({"code": role["code"], "name": role["name"], "scope": role.get("scope", "college")})
    return {"people": result, "roles": grantable, "can_create": has_permission(data, user, "accounts", "create"), "can_edit": has_permission(data, user, "accounts", "edit")}


def personal_access(data, person_type):
    role_code = {"student": "STUDENT", "parent": "PARENT"}.get(person_type)
    if not role_code:
        return None
    role = data["roles"].get(role_code)
    if not role or role.get("scope") != "self" or role.get("system_admin"):
        raise HTTPException(409, "Configure the default Student and Parent self-service roles before creating mobile logins")
    return {"role_codes": [role_code], "clients": ["student-mobile" if person_type == "student" else "parent-mobile"]}


@router.post("/accounts", status_code=201)
def create_account(
    body: AccountInput, request: Request, user=Depends(require("accounts", "create"))
):
    with request.app.state.store.transaction() as data:
        access = personal_access(data, body.person_type)
        valid_roles(data, access["role_codes"] if access else body.role_codes, user)
        table = {"employee": "employees", "student": "students", "parent": "parents"}[
            body.person_type
        ]
        if body.person_code not in data["records"].get(table, {}):
            raise HTTPException(422, "Create the employee/student/parent record first")
        if any(
            a["login_id"].casefold() == body.login_id.casefold()
            for a in data["accounts"].values()
        ):
            raise HTTPException(409, "Login ID exists")
        if any(
            a["person_type"] == body.person_type
            and a["person_code"] == body.person_code
            for a in data["accounts"].values()
        ):
            raise HTTPException(409, "Person already has an account")
        account = {
            **body.model_dump(exclude={"password"}),
            **(access or {}),
            "code": new_code("USR"),
            "active": True,
            "password_hash": hasher.hash(body.password),
        }
        data["accounts"][account["code"]] = account
        audit(data, user["code"], "create", "accounts", account["code"])
        return public_account(account)


@router.patch("/accounts/{code}")
def update_account(
    code: str,
    body: AccountUpdate,
    request: Request,
    user=Depends(require("accounts", "edit")),
):
    with request.app.state.store.transaction() as data:
        account = data["accounts"].get(code)
        if not account:
            raise HTTPException(404, "Account not found")
        if any(
            data["roles"].get(r, {}).get("system_admin") for r in account["role_codes"]
        ):
            raise HTTPException(409, "Bootstrap account is protected")
        valid_roles(data, account["role_codes"], user)
        access = personal_access(data, account["person_type"])
        if access:
            valid_roles(data, access["role_codes"], user)
        elif body.role_codes is not None:
            valid_roles(data, body.role_codes, user)
        if body.login_id is not None and any(a["code"] != code and a["login_id"].casefold() == body.login_id.casefold() for a in data["accounts"].values()):
            raise HTTPException(409, "Login ID exists")
        account.update({**body.model_dump(exclude_none=True), **(access or {})})
        revoke_user(data, code)
        audit(data, user["code"], "edit", "accounts", code)
        return public_account(account)


@router.delete("/accounts/{code}", status_code=204)
def disable_account(
    code: str, request: Request, user=Depends(require("accounts", "delete"))
):
    return update_account(code, AccountUpdate(active=False), request, user)


@router.get("/audit")
def audit_log(
    request: Request,
    offset: int = 0,
    limit: int = 50,
    user=Depends(require("audit", "view")),
):
    if not 0 <= offset or not 1 <= limit <= 200:
        raise HTTPException(422, "Invalid pagination")
    return request.app.state.store.snapshot()["audit"][::-1][offset : offset + limit]


from pydantic import Field

from app.core.security import StrictModel


class AdminPasswordInput(StrictModel):
    new_password: str = Field(min_length=12, max_length=128)


@router.post("/accounts/{code}/reset-password", status_code=204)
def admin_reset_password(
    code: str,
    body: AdminPasswordInput,
    request: Request,
    user=Depends(require("accounts", "edit")),
):
    with request.app.state.store.transaction() as data:
        account = data["accounts"].get(code)
        if not account:
            raise HTTPException(404, "Account not found")
        if any(
            data["roles"].get(r, {}).get("system_admin") for r in account["role_codes"]
        ):
            raise HTTPException(
                409, "Use authenticated change-password for the protected administrator"
            )
        valid_roles(data, account["role_codes"], user)
        account["password_hash"] = hasher.hash(body.new_password)
        revoke_user(data, code)
        audit(data, user["code"], "admin_password_reset", "accounts", code)


class EmployeeLinkInput(StrictModel):
    employee_code: str


@router.post("/bootstrap/link-employee")
def link_bootstrap(
    body: EmployeeLinkInput, request: Request, user=Depends(require("accounts", "edit"))
):
    with request.app.state.store.transaction() as data:
        link_bootstrap_employee(data, user, body.employee_code)
        revoke_user(data, user["code"])
        return {"reauthenticate": True}


def link_bootstrap_employee(data, user, employee_code):
    account = data["accounts"][user["code"]]
    if account["person_type"] != "system" or not any(
        data["roles"].get(r, {}).get("system_admin") for r in account["role_codes"]
    ):
        raise HTTPException(
            409, "Only an unlinked bootstrap administrator can use this action"
        )
    if employee_code not in data["records"].get("employees", {}):
        raise HTTPException(422, "Create the employee record first")
    if any(
        a.get("person_type") == "employee" and a.get("person_code") == employee_code
        for a in data["accounts"].values()
    ):
        raise HTTPException(409, "Employee already has a login")
    account.update(person_type="employee", person_code=employee_code)
    audit(data, user["code"], "link_employee", "accounts", user["code"])
