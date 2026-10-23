"""Public enquiries and registration intake; no public reads of personal records."""

import hashlib
import time
from datetime import date

from fastapi import APIRouter, HTTPException, Request
from pydantic import Field

from app.core.security import StrictModel
from app.core.storage import audit, new_code, now

router = APIRouter(prefix="/public", tags=["Public college intake"])


def query_rows(data, table):
    return list(data["records"].get(table, {}).values())


def query_save(data, table, record):
    data["records"].setdefault(table, {})[record["code"]] = record
    return record


def limited(data, request):
    key = (
        "public:"
        + hashlib.sha256(
            (request.client.host if request.client else "unknown").encode()
        ).hexdigest()
    )
    values = [t for t in data["login_attempts"].get(key, []) if t > time.time() - 900]
    if len(values) >= 20:
        raise HTTPException(429, "Please wait before submitting another enquiry")
    data["login_attempts"][key] = values + [time.time()]


@router.get("/options")
def options(request: Request):
    data = request.app.state.store.snapshot()
    return {
        "programs": [
            {"code": r["code"], "name": r["name"]} for r in query_rows(data, "programs")
        ],
        "sources": [
            {"code": r["code"], "name": r["name"]}
            for r in query_rows(data, "admission_sources")
            if r["is_active"]
        ],
    }


class ApplicationInput(StrictModel):
    name: str = Field(min_length=2, max_length=200)
    email: str = Field(min_length=5, max_length=254)
    guardian: str = Field(min_length=2, max_length=200)
    contact: str = Field(min_length=7, max_length=40)
    program: str = Field(max_length=200)
    source: str = Field(max_length=100)
    scholarship: str = Field(default="None", max_length=100)
    documents: str = Field(default="", max_length=3000)
    consent: bool


@router.post("/applications", status_code=201)
def apply(body: ApplicationInput, request: Request):
    if not body.consent:
        raise HTTPException(422, "Consent to process the application is required")
    if "@" not in body.email:
        raise HTTPException(422, "Enter a valid email")
    with request.app.state.store.transaction() as data:
        limited(data, request)
        program = next(
            (
                r
                for r in query_rows(data, "programs")
                if r["code"] == body.program or r["name"] == body.program
            ),
            None,
        )
        if not program:
            raise HTTPException(
                409, "The selected program has not opened for applications"
            )
        department = (
            data["records"].get("departments", {}).get(program["department_code"])
        )
        if not department:
            raise HTTPException(409, "Program campus is not configured")
        cycle = next(
            (
                r
                for r in query_rows(data, "admission_cycles")
                if r["campus_code"] == department["campus_code"]
                and r["opens_on"] <= date.today().isoformat() <= r["closes_on"]
            ),
            None,
        )
        if not cycle:
            raise HTTPException(409, "No admission cycle is currently open")
        source = next(
            (
                r
                for r in query_rows(data, "admission_sources")
                if r["is_active"]
                and (
                    r["code"] == body.source
                    or r["name"].casefold() == body.source.casefold()
                )
            ),
            None,
        )
        if not source:
            raise HTTPException(422, "Select an available admission source")
        first, *rest = body.name.strip().split()
        last = " ".join(rest) or first
        enquiry = query_save(
            data,
            "admission_enquiries",
            {
                "code": new_code("ENQ"),
                "campus_code": department["campus_code"],
                "source_code": source["code"],
                "cycle_code": cycle["code"],
                "program_code": program["code"],
                "first_name": first,
                "last_name": last,
                "phone": body.contact,
                "email": body.email,
                "parent_name": body.guardian,
                "parent_phone": body.contact,
                "status": "applied",
                "communication_consent": True,
                "consent_recorded_at": now(),
            },
        )
        application = query_save(
            data,
            "admission_applications",
            {
                "code": new_code("APP"),
                "program_code": program["code"],
                "academic_year_code": cycle["academic_year_code"],
                "first_name": first,
                "last_name": last,
                "email": body.email,
                "phone": body.contact,
                "applied_on": date.today().isoformat(),
                "status": "submitted",
                "student_code": None,
                "enquiry_code": enquiry["code"],
                "cycle_code": cycle["code"],
                "source_code": source["code"],
                "consent_at": now(),
                "submitted_at": now(),
                "admission_category": "regular",
            },
        )
        first, *rest = body.guardian.strip().split()
        query_save(
            data,
            "application_guardians",
            {
                "code": new_code("AG"),
                "application_code": application["code"],
                "relationship": "guardian",
                "first_name": first,
                "last_name": " ".join(rest) or first,
                "phone": body.contact,
                "email": body.email,
                "is_primary": True,
            },
        )
        data.setdefault("import_metadata", {}).setdefault("admission_applications", {})[
            application["code"]
        ] = {
            "scholarship_interest": body.scholarship,
            "document_checklist": body.documents,
        }
        audit(
            data, "public-web", "apply", "admission_applications", application["code"]
        )
        return {"reference": application["code"], "status": "submitted"}


class ContactInput(StrictModel):
    name: str = Field(min_length=2, max_length=200)
    email: str = Field(min_length=5, max_length=254)
    visit_date: date
    message: str = Field(min_length=3, max_length=3000)


@router.post("/contact", status_code=201)
def contact(body: ContactInput, request: Request):
    with request.app.state.store.transaction() as data:
        limited(data, request)
        institution = next(iter(data["records"].get("institutions", {}).values()), None)
        if not institution:
            raise HTTPException(409, "College contact intake is not configured yet")
        r = query_save(
            data,
            "contact_enquiries",
            {
                "code": new_code("CONTACT"),
                "institution_code": institution["code"],
                "name": body.name,
                "email": body.email,
                "phone": "",
                "message": body.message
                + "\nRequested visit: "
                + body.visit_date.isoformat(),
                "status": "new",
            },
        )
        audit(data, "public-web", "contact", "contact_enquiries", r["code"])
        return {"reference": r["code"], "status": "received"}
