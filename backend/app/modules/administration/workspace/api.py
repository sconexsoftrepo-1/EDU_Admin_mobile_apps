"""All admin screens: descriptors and their authorization-filtered data queries."""

import json
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Request

from app.core.resources import CATALOG, IMMUTABLE, MANAGED, RESOURCE_DEFAULTS, staff_only
from app.core.security import current_user, has_permission, role_limit

router = APIRouter(prefix="/workspace", tags=["Admin screen coverage"])
ROOT = Path(__file__).parents[3]
SCREENS = json.loads((ROOT / "contracts/screens.json").read_text())
RESOURCES = {
    e["screen"]: e
    for e in json.loads((ROOT / "contracts/resources.json").read_text())
    if e["generic_api"]
}


def permitted(data, user, screen):
    return has_permission(data, user, screen, "view")


def lookup_permitted(data, user, table):
    if permitted(data, user, table):
        return True
    # A record writer needs reference choices even when the role cannot open the
    # related module. Expose only the code/label projection, never full records.
    return any(
        any(field.get("reference") == table for field in spec["fields"])
        and any(has_permission(data, user, source, action) for action in ("create", "edit"))
        for source, spec in CATALOG.items()
        if source in RESOURCES and source not in MANAGED
    )


@router.get("/screens")
def screens(request: Request, user=Depends(current_user)):
    staff_only(user)
    data = request.app.state.store.snapshot()
    allowed = role_limit(data, user, "screens")
    items = []
    for screen in SCREENS:
        if allowed is not None and screen["key"] not in allowed:
            continue
        resources = [
            name for name in screen["resources"] if permitted(data, user, name)
        ]
        special = {
            "roles": "roles",
            "accounts": "accounts",
            "credentials": "accounts",
            "forms": "forms",
            "audit-logs": "audit",
            "reports": "reports",
        }
        special_access = screen["key"] in special and permitted(
            data, user, special[screen["key"]]
        )
        if (
            resources
            or special_access
            or screen["key"]
            in {
                "dashboard",
                "mobile-apps",
                "admin-app",
                "parent-app",
                "teacher-app",
                "student-app",
            }
            and permitted(data, user, "reports")
        ):
            items.append({**screen, "resources": resources})
    return {"screens": items}


@router.get("/screens/{key}")
def screen(key: str, request: Request, user=Depends(current_user)):
    staff_only(user)
    data = request.app.state.store.snapshot()
    definition = next((s for s in SCREENS if s["key"] == key), None)
    if not definition:
        raise HTTPException(404, "Unknown screen")
    allowed = role_limit(data, user, "screens")
    if allowed is not None and key not in allowed:
        raise HTTPException(403, "Screen access denied")
    output = []
    for table in definition["resources"]:
        if not permitted(data, user, table):
            continue
        entry = RESOURCES[table]
        path = entry["path"]
        paths = request.app.openapi()["paths"]
        actions = [
            a
            for a in ["view", "create", "edit", "delete", "approve", "export"]
            if has_permission(data, user, table, a)
        ]
        if table in MANAGED or "post" not in paths.get(path, {}):
            actions = [a for a in actions if a not in {"create", "edit", "delete"}]
        if table in IMMUTABLE:
            actions = [a for a in actions if a not in {"edit", "delete"}]
        output.append(
            {
                "name": table,
                "title": table.replace("_", " ").title(),
                "path": path,
                "fields": CATALOG[table]["fields"],
                "actions": actions,
            }
        )
    special = {
        "roles": "roles",
        "accounts": "accounts",
        "credentials": "accounts",
        "forms": "forms",
        "audit-logs": "audit",
        "reports": "reports",
    }
    if not output and not has_permission(
        data, user, special.get(key, "reports"), "view"
    ):
        raise HTTPException(403, "Screen access denied")
    return {**definition, "resources": output, "storage": request.app.state.settings.storage_backend}


@router.get("/lookups/{table}")
def lookup(table: str, request: Request, user=Depends(current_user)):
    staff_only(user)
    data = request.app.state.store.snapshot()
    if table == "users":
        if not permitted(data, user, "accounts"):
            raise HTTPException(403, "Lookup denied")
        return [
            {"value": a["code"], "label": a["login_id"]}
            for a in data["accounts"].values()
        ]
    if table not in RESOURCES or not lookup_permitted(data, user, table):
        raise HTTPException(403, "Lookup denied")
    return [
        {
            "value": r["code"],
            "label": r.get("name")
            or r.get("title")
            or " ".join(str(r.get(k, "")) for k in ["first_name", "last_name"]).strip()
            or r.get("registration_number")
            or (f"{r.get('trip_date')} · {r.get('route_code')}" if table == "vehicle_trips" else None)
            or r["code"],
        }
        for r in data["records"].get(table, {}).values()
    ][:1000]


from app.core.security import StrictModel


class WorkspaceInput(StrictModel):
    values: dict
    form_code: str | None = None
    form_revision: int | None = None


@router.get("/resources/{table}/form")
def resource_form(
    table: str,
    request: Request,
    entity_code: str | None = None,
    user=Depends(current_user),
):
    staff_only(user)
    data = request.app.state.store.snapshot()
    if table not in RESOURCES or not has_permission(data, user, table, "view"):
        raise HTTPException(403, "Form access denied")
    form = next(
        (f for f in data["forms"].values() if f["screen"] == table and f["published"]),
        None,
    )
    previous = next(
        (
            r
            for r in sorted(
                data["submissions"].values(),
                key=lambda r: r["submitted_at"],
                reverse=True,
            )
            if form
            and r["form_code"] == form["code"]
            and r.get("entity_code") == entity_code
        ),
        None,
    )
    return {
        "form": form,
        "values": previous["values"] if previous else {},
        "defaults": RESOURCE_DEFAULTS.get(table, {}) if not entity_code else {},
        "resource": {
            "name": table,
            "title": table.replace("_", " ").title(),
            "path": RESOURCES[table]["path"],
            "fields": CATALOG[table]["fields"],
            "actions": ["create"] if table not in MANAGED and has_permission(data, user, table, "create") else [],
        },
    }


@router.post("/resources/{table}", status_code=201)
def create_with_form(
    table: str, body: WorkspaceInput, request: Request, user=Depends(current_user)
):
    return save_with_form(table, None, body, request, user)


@router.patch("/resources/{table}/{code}")
def update_with_form(
    table: str,
    code: str,
    body: WorkspaceInput,
    request: Request,
    user=Depends(current_user),
):
    return save_with_form(table, code, body, request, user)


def save_with_form(table, code, body, request, user):
    import importlib

    from app.modules.access_control.forms.api import Service as FormService
    from app.modules.access_control.forms.schemas import SubmissionInput

    staff_only(user)
    if table not in RESOURCES:
        raise HTTPException(404, "Unknown resource")
    with request.app.state.store.transaction() as data:
        if not has_permission(data, user, table, "edit" if code else "create"):
            raise HTTPException(403, "Record permission denied")
        form = next(
            (
                f
                for f in data["forms"].values()
                if f["screen"] == table and f["published"]
            ),
            None,
        )
        if form and (
            body.form_code != form["code"] or body.form_revision != form["revision"]
        ):
            raise HTTPException(409, "Form changed; reload before saving")
        known = {f["name"] for f in CATALOG[table]["fields"]}
        extras = set(body.values) - known
        if extras and (not form or extras - {f["key"] for f in form["fields"]}):
            raise HTTPException(422, "Unknown fields")
        module = importlib.import_module(
            f"app.modules.{RESOURCES[table]['module']}.{table}.api"
        )
        record_values = {k: v for k, v in body.values.items() if k in known}
        result = (
            module.service.update(data, code, record_values, user["code"])
            if code
            else module.service.create(data, record_values, user["code"])
        )
        if form:
            values = {f["key"]: body.values.get(f["key"]) for f in form["fields"]}
            submission = FormService().submit(
                data,
                form["code"],
                SubmissionInput(revision=form["revision"], values=values),
                user["code"],
            )
            submission["entity_code"] = result["code"]
        return result
