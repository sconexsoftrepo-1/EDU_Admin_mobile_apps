from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Request

from app.core.resources import ResourceRepository, ResourceService, staff_only
from app.core.security import require
from app.core.storage import audit, new_code, now
from app.workflows.schemas import EnrollmentInput, ReviewInput

ZERO = Decimal("0.00")
router = APIRouter(tags=["Admissions workflows"])


def query_rows(data, table):
    return data["records"].setdefault(table, {})


def query_record(data, table, code):
    value = query_rows(data, table).get(code)
    if not value:
        raise HTTPException(404, f"{table} record not found")
    return value


def review_admission_document(data, code, body, user):
    doc = query_record(data, "admission_documents", code)
    if not doc.get("is_current"):
        raise HTTPException(409, "Only current document revisions can be reviewed")
    if doc.get("status") in {"verified", "waived"}:
        raise HTTPException(
            409, "Document already reviewed; create a new revision for corrections"
        )
    actor = user["person_code"] if user["person_type"] == "employee" else user["code"]
    if body.status == "verified":
        kind = query_record(data, "document_types", doc["document_type_code"])
        if (
            not doc.get("storage_key")
            or not doc.get("sha256")
            or not __import__("re").fullmatch(r"[0-9a-fA-F]{64}", doc["sha256"])
        ):
            raise HTTPException(422, "Document storage reference and SHA256 required")
        if kind.get("original_sighting_required") and (not doc.get("original_sighted")):
            raise HTTPException(422, "Original document must be sighted first")
        if kind.get("expiry_required") and (not doc.get("expires_on")):
            raise HTTPException(422, "Expiry date required")
        if doc.get("expires_on") and doc["expires_on"] < now()[:10]:
            raise HTTPException(422, "Document has expired")
    old = doc.get("status")
    doc.update(
        status=body.status,
        review_notes=body.reason,
        reviewed_by_employee_code=actor,
        reviewed_at=now(),
    )
    if body.status == "waived":
        doc["waiver_reason"] = body.reason
    event = {
        "code": new_code("DVE"),
        "admission_document_code": code,
        "actor_employee_code": actor,
        "old_status": old,
        "new_status": body.status,
        "reason": body.reason,
        "occurred_at": now(),
    }
    query_rows(data, "document_verification_events")[event["code"]] = event
    audit(data, user["code"], "review", "admission_documents", code)
    return doc


def enroll_application(data, code, body, user):
    application = query_record(data, "admission_applications", code)
    if application.get("student_code") or application["status"] == "enrolled":
        raise HTTPException(409, "Application already enrolled")
    if application["status"] not in {"verified", "accepted"}:
        raise HTTPException(409, "Application must be verified or accepted")
    section = query_record(data, "sections", body.section_code)
    batch = query_record(data, "batches", section["batch_code"])
    if batch["program_code"] != application["program_code"]:
        raise HTTPException(422, "Section does not match the application program")
    if not section.get("semester_code"):
        raise HTTPException(422, "Assign the section to an academic semester before confirming admission")
    semester = query_record(data, "semesters", section["semester_code"])
    if semester["academic_year_code"] != application["academic_year_code"]:
        raise HTTPException(422, "Academic year mismatch")
    existing = [
        e
        for e in query_rows(data, "student_enrollments").values()
        if e["section_code"] == body.section_code and e["status"] == "active"
    ]
    if len(existing) >= int(section["capacity"]):
        raise HTTPException(409, "Section is full")
    if any((e["roll_number"] == body.roll_number for e in existing)):
        raise HTTPException(409, "Roll number already assigned in this section")
    requirements = [
        r
        for r in query_rows(data, "program_document_requirements").values()
        if r["program_code"] == application["program_code"]
        and r["academic_year_code"] == application["academic_year_code"]
        and (
            r.get("admission_category") in {None, "all"}
            or r["admission_category"] == application.get("admission_category")
        )
        and r["is_required"]
        and (r["required_stage"] in {"submission", "offer", "enrollment"})
    ]
    documents = [
        d
        for d in query_rows(data, "admission_documents").values()
        if d["application_code"] == code and d["is_current"]
    ]
    missing = []
    for requirement in requirements:
        valid = any(
            (
                d["document_type_code"] == requirement["document_type_code"]
                and (
                    d["status"] == "verified"
                    or (d["status"] == "waived" and requirement["waiver_allowed"])
                )
                and (not d.get("expires_on") or d["expires_on"] >= now()[:10])
                for d in documents
            )
        )
        if not valid:
            missing.append(requirement["document_type_code"])
    if missing:
        raise HTTPException(
            409,
            {"message": "Required documents not verified", "document_types": missing},
        )
    guardians = [
        g
        for g in query_rows(data, "application_guardians").values()
        if g["application_code"] == code
    ]
    if not guardians or not any((g["is_primary"] for g in guardians)):
        raise HTTPException(409, "Primary guardian details required")
    details = {
        **body.student_details,
        "first_name": application["first_name"],
        "last_name": application["last_name"],
        "admission_application_code": code,
        "status": "active",
    }
    if any(
        (
            s["admission_number"] == details.get("admission_number")
            for s in query_rows(data, "students").values()
        )
    ):
        raise HTTPException(409, "Admission number already exists")
    student = ResourceService(ResourceRepository("students")).create(
        data, details, user["code"]
    )
    for guardian in guardians:
        if guardian.get("parent_code"):
            parent = query_record(data, "parents", guardian["parent_code"])
        else:
            parent = ResourceService(ResourceRepository("parents")).create(
                data,
                {
                    k: guardian[k]
                    for k in [
                        "first_name",
                        "last_name",
                        "phone",
                        "email",
                        "occupation",
                        "address",
                    ]
                    if guardian.get(k) is not None
                },
                user["code"],
            )
            guardian["parent_code"] = parent["code"]
        link = {
            "code": new_code("SP"),
            "student_code": student["code"],
            "parent_code": parent["code"],
            "relationship": guardian["relationship"],
            "is_primary": guardian["is_primary"],
            "can_pickup": False,
            "receives_notifications": True,
        }
        query_rows(data, "student_parents")[link["code"]] = link
    enrollment = {
        "code": new_code("ENR"),
        "student_code": student["code"],
        "section_code": body.section_code,
        "roll_number": body.roll_number,
        "enrolled_on": now()[:10],
        "status": "active",
    }
    query_rows(data, "student_enrollments")[enrollment["code"]] = enrollment
    history = {
        "code": new_code("ASH"),
        "application_code": code,
        "old_status": application["status"],
        "new_status": "enrolled",
        "actor_user_code": user["code"],
        "reason": "Enrollment workflow completed",
        "occurred_at": now(),
    }
    query_rows(data, "admission_status_history")[history["code"]] = history
    # Order matters for the database rules: the authorized enrollment event is recorded while the
    # application is still accepted, then the application becomes enrolled, then documents move.
    event = {
        "code": new_code("AEE"),
        "application_code": code,
        "student_code": student["code"],
        "enrollment_code": enrollment["code"],
        "authorized_by_employee_code": user["person_code"],
        "enrolled_at": now(),
        "notes": "Required document and guardian checks completed",
    }
    query_rows(data, "admission_enrollment_events")[event["code"]] = event
    application.update(status="enrolled", student_code=student["code"])
    for doc in documents:
        if doc["status"] in {"verified", "waived"}:
            link = {
                "code": new_code("SDL"),
                "student_code": student["code"],
                "admission_document_code": doc["code"],
                "transferred_by_employee_code": user["person_code"],
            }
            query_rows(data, "student_document_links")[link["code"]] = link
    audit(data, user["code"], "enroll", "admission_applications", code)
    return {
        "student": student,
        "enrollment": enrollment,
        "linked_documents": len(documents),
    }


@router.post("/admissions/documents/{code}/review")
def review_document(
    code: str,
    body: ReviewInput,
    request: Request,
    user=Depends(require("admission_documents", "approve")),
):
    staff_only(user)
    with request.app.state.store.transaction() as data:
        return review_admission_document(data, code, body, user)


@router.post("/admissions/applications/{code}/enroll", status_code=201)
def enroll(
    code: str,
    body: EnrollmentInput,
    request: Request,
    user=Depends(require("admission_applications", "approve")),
):
    staff_only(user)
    with request.app.state.store.transaction() as data:
        return enroll_application(data, code, body, user)
