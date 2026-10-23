from app.modules.mobile.workspace.api import ACTION_FIELDS


class Repository:
    def get(self, data, code):
        from fastapi import HTTPException

        form = data["forms"].get(code)
        if not form:
            raise HTTPException(404, "Form not found")
        return form


import re
from datetime import date
from decimal import Decimal, InvalidOperation

from fastapi import HTTPException

from app.core.storage import audit, new_code, now


class Service:
    repo = Repository()

    def save(self, data, body, actor, code=None):
        old = self.repo.get(data, code) if code else None
        form = {
            **body.model_dump(),
            "code": code or new_code("FORM"),
            "revision": old["revision"] + 1 if old else 1,
            "updated_at": now(),
        }
        # Previous definitions stay embedded in historical submissions.
        if form["published"]:
            for existing in data["forms"].values():
                if (
                    existing["screen"] == form["screen"]
                    and existing["code"] != form["code"]
                ):
                    existing["published"] = False
        data["forms"][form["code"]] = form
        audit(data, actor, "edit" if old else "create", "forms", form["code"])
        return form

    def submit(self, data, code, body, actor):
        form = self.repo.get(data, code)
        if not form["published"]:
            raise HTTPException(409, "Form is not published")
        if body.revision != form["revision"]:
            raise HTTPException(409, "Form changed. Reload before submitting")
        known = {f["key"] for f in form["fields"]}
        if set(body.values) - known:
            raise HTTPException(422, "Unknown form fields")
        clean = {}
        errors = {}
        for field in form["fields"]:
            key = field["key"]
            value = body.values.get(key)
            kind = field["type"]
            if value is None or value == "":
                if field["required"]:
                    errors[key] = "Required"
                else:
                    clean[key] = None
                continue
            valid = True
            if kind == "boolean":
                valid = isinstance(value, bool)
            elif kind == "integer":
                valid = isinstance(value, int) and not isinstance(value, bool)
            elif kind == "decimal":
                try:
                    number = Decimal(str(value))
                    valid = number.is_finite() and len(str(value)) <= 30
                    if valid:
                        value = str(number)
                except (InvalidOperation, ValueError):
                    valid = False
            else:
                valid = isinstance(value, str) and len(value) <= 20000
                if valid and kind == "date":
                    try:
                        date.fromisoformat(value)
                    except ValueError:
                        valid = False
                if valid and kind == "email":
                    valid = bool(re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", value))
                if valid and kind == "phone":
                    valid = bool(re.fullmatch(r"[+0-9 ()-]{7,25}", value))
                if valid and kind == "select":
                    valid = value in field["options"]
            if not valid:
                errors[key] = f"Invalid {kind} value"
            else:
                clean[key] = value
        if errors:
            raise HTTPException(422, errors)
        result = {
            "code": new_code("SUB"),
            "form_code": code,
            "revision": form["revision"],
            "definition": form,
            "values": clean,
            "submitted_by": actor,
            "submitted_at": now(),
        }
        data["submissions"][result["code"]] = result
        audit(data, actor, "submit", "forms", code)
        return result


from fastapi import APIRouter, Depends, Query, Request

from app.core.security import has_permission, require

from .schemas import FormInput, SubmissionInput

router = APIRouter(prefix="/forms", tags=["Configurable forms"])
service = Service()


@router.get("")
def listing(request: Request, user=Depends(require("forms", "view"))):
    data = request.app.state.store.snapshot()
    return [
        f
        for f in data["forms"].values()
        if has_permission(data, user, f["screen"], "view")
    ]


@router.get("/{code}")
def detail(code: str, request: Request, user=Depends(require("forms", "view"))):
    data = request.app.state.store.snapshot()
    form = service.repo.get(data, code)
    if not has_permission(data, user, form["screen"], "view"):
        raise HTTPException(403, "Screen access denied")
    return form


@router.post("", status_code=201)
def create(body: FormInput, request: Request, user=Depends(require("forms", "create"))):
    if body.screen not in request.app.state.catalog and body.screen not in {
        "mobile." + a for a in ACTION_FIELDS
    }:
        raise HTTPException(422, "Unknown screen binding")
    with request.app.state.store.transaction() as data:
        return service.save(data, body, user["code"])


@router.put("/{code}")
def update(
    code: str, body: FormInput, request: Request, user=Depends(require("forms", "edit"))
):
    if body.screen not in request.app.state.catalog and body.screen not in {
        "mobile." + a for a in ACTION_FIELDS
    }:
        raise HTTPException(422, "Unknown screen binding")
    with request.app.state.store.transaction() as data:
        return service.save(data, body, user["code"], code)


@router.delete("/{code}", status_code=204)
def delete(code: str, request: Request, user=Depends(require("forms", "delete"))):
    with request.app.state.store.transaction() as data:
        service.repo.get(data, code)
        if any(s["form_code"] == code for s in data["submissions"].values()):
            raise HTTPException(409, "Form has submissions. Unpublish instead")
        del data["forms"][code]
        audit(data, user["code"], "delete", "forms", code)


@router.post("/{code}/submissions", status_code=201)
def submit(
    code: str,
    body: SubmissionInput,
    request: Request,
    user=Depends(require("forms", "create")),
):
    with request.app.state.store.transaction() as data:
        form = service.repo.get(data, code)
        if not has_permission(data, user, form["screen"], "create"):
            raise HTTPException(403, "Screen access denied")
        return service.submit(data, code, body, user["code"])


@router.get("/{code}/submissions")
def submissions(
    code: str,
    request: Request,
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    user=Depends(require("forms", "view")),
):
    data = request.app.state.store.snapshot()
    form = service.repo.get(data, code)
    if not has_permission(data, user, form["screen"], "view"):
        raise HTTPException(403, "Screen access denied")
    rows = [s for s in data["submissions"].values() if s["form_code"] == code]
    # Personal clients see their own submissions only.
    if user["person_type"] not in {"employee", "system"}:
        rows = [s for s in rows if s["submitted_by"] == user["code"]]
    return {"items": rows[offset : offset + limit], "total": len(rows)}
