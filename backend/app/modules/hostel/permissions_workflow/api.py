from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Request

from app.core.resources import staff_only
from app.core.security import require
from app.core.storage import audit, now
from app.workflows.schemas import HostelApprovalInput

ZERO = Decimal("0.00")
router = APIRouter(tags=["Hostel workflows"])


def query_rows(data, table):
    return data["records"].setdefault(table, {})


def query_record(data, table, code):
    value = query_rows(data, table).get(code)
    if not value:
        raise HTTPException(404, f"{table} record not found")
    return value


@router.post("/hostel/permissions/{code}/approve")
def hostel_approve(
    code: str,
    body: HostelApprovalInput,
    request: Request,
    user=Depends(require("hostel_permissions", "approve")),
):
    staff_only(user)
    with request.app.state.store.transaction() as data:
        item = query_record(data, "hostel_permissions", code)
        if item["status"] not in {"requested", "pending"}:
            raise HTTPException(409, "Request already processed")
        item.update(
            body.model_dump(),
            status="approved",
            approved_by_code=user["person_code"],
            approved_at=now(),
        )
        audit(data, user["code"], "approve", "hostel_permissions", code)
        return item


@router.post("/hostel/permissions/{code}/depart")
def hostel_depart(
    code: str, request: Request, user=Depends(require("hostel_permissions", "edit"))
):
    staff_only(user)
    with request.app.state.store.transaction() as data:
        item = query_record(data, "hostel_permissions", code)
        if item["status"] != "approved":
            raise HTTPException(409, "Approved permission is required")
        item.update(status="departed", departed_at=now())
        audit(data, user["code"], "depart", "hostel_permissions", code)
        return item


@router.post("/hostel/permissions/{code}/return")
def hostel_return(
    code: str, request: Request, user=Depends(require("hostel_permissions", "edit"))
):
    staff_only(user)
    with request.app.state.store.transaction() as data:
        item = query_record(data, "hostel_permissions", code)
        if item["status"] != "departed":
            raise HTTPException(409, "Student has not departed")
        item.update(status="returned", returned_at=now())
        audit(data, user["code"], "return", "hostel_permissions", code)
        return item
