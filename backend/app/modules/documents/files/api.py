"""Private file metadata/bytes, generated reports, certificates and download audit."""

import base64
import binascii
import hashlib
import io
import os
import secrets
import re
import logging
from contextlib import contextmanager
from urllib.parse import quote
from datetime import date
from pathlib import Path

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import (
    Ed25519PrivateKey,
    Ed25519PublicKey,
)
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response
from pydantic import Field
from reportlab.lib.pagesizes import A4, landscape
from reportlab.pdfgen.canvas import Canvas

from app.core.security import StrictModel, current_user, has_permission
from app.core.storage import audit, new_code, now

router = APIRouter(prefix="/documents", tags=["Private documents and downloads"])


def query_get(data, table, code):
    r = data["records"].get(table, {}).get(code)
    if not r:
        raise HTTPException(404, "Document record not found")
    return r


def query_rows(data, table):
    return list(data["records"].get(table, {}).values())


def query_save(data, table, record):
    data["records"].setdefault(table, {})[record["code"]] = record
    return record


def pdf(title, lines):
    out = io.BytesIO()
    canvas = Canvas(out, pagesize=A4)
    canvas.setTitle(title)
    canvas.setFont("Helvetica-Bold", 18)
    canvas.drawString(46, 790, "EduNexa College")
    canvas.setFont("Helvetica-Bold", 13)
    canvas.drawString(46, 760, title)
    y = 728
    canvas.setFont("Helvetica", 10)
    for line in lines:
        # Wrap long content instead of printing beyond page bounds.
        for start in range(0, max(1, len(str(line))), 86):
            if y < 55:
                canvas.showPage()
                canvas.setFont("Helvetica", 10)
                y = 785
            canvas.drawString(46, y, str(line)[start : start + 86])
            if str(line).startswith("Verify: "):
                canvas.linkURL(str(line)[8:], (46, y - 2, 549, y + 12), relative=0)
            y -= 16
    canvas.save()
    return out.getvalue()


def certificate_pdf(title, student, kind, enrollment, data, code, issued, verify_url, issuer=None, academic_year_code=None):
    """Render each certificate family in its own printable, verifiable design."""
    from reportlab.lib.colors import HexColor

    out = io.BytesIO()
    template = kind.get("code")
    page = A4 if template == "attendance_certificate" else landscape(A4)
    c = Canvas(out, pagesize=page)
    width, height = page
    settings = next(iter(query_rows(data, "institution_settings")), {})
    institution = data["records"].get("institutions", {}).get(settings.get("institution_code")) or next(iter(query_rows(data, "institutions")), {})
    institution_name = institution.get("name") or "EduNexa College"
    section = data["records"].get("sections", {}).get(enrollment.get("section_code"), {})
    batch = data["records"].get("batches", {}).get(section.get("batch_code"), {})
    program = data["records"].get("programs", {}).get(enrollment.get("program_code") or batch.get("program_code"), {})
    year = data["records"].get("academic_years", {}).get(academic_year_code or batch.get("academic_year_code"), {})
    if not year:
        year = next((y for y in query_rows(data, "academic_years") if y.get("program_code") == batch.get("program_code")
                     and str(batch.get("entry_year")) == str(y.get("start_date", ""))[:4]
                     and str(batch.get("graduation_year")) == str(y.get("end_date", ""))[:4]), {})
    profile = next((p for p in query_rows(data, "student_admission_profiles") if p.get("student_code") == student["code"]), {})
    name = " ".join(str(student.get(k) or "").strip() for k in ("first_name", "middle_name", "last_name")).strip()
    course = program.get("name") or "the registered course"
    branch = program.get("branch") or program.get("specialization")
    if branch and branch != course:
        course += " — " + branch
    academic = year.get("name") or (f"{year.get('start_date', '')} – {year.get('end_date', '')}" if year else "")
    address = ", ".join(str(institution.get(k) or "").strip() for k in ("address", "city", "state", "postal_code") if institution.get(k))
    contacts = " • ".join(str(institution.get(k) or "").strip() for k in ("phone", "email") if institution.get(k))
    admission = student.get("admission_number") or profile.get("admission_number") or "—"
    roll = enrollment.get("university_roll_number") or enrollment.get("roll_number") or "—"
    issuer_name = " ".join(str((issuer or {}).get(k) or "").strip() for k in ("first_name", "middle_name", "last_name")).strip()
    designation = (issuer or {}).get("designation") or "Authorized signatory"

    def frame(paper, primary, accent):
        c.setFillColor(paper); c.rect(0, 0, width, height, fill=1, stroke=0)
        c.setStrokeColor(primary); c.setLineWidth(3); c.rect(24, 24, width-48, height-48, fill=0, stroke=1)
        c.setStrokeColor(accent); c.setLineWidth(1); c.rect(32, 32, width-64, height-64, fill=0, stroke=1)

    def header(color, top):
        c.setFillColor(color); c.setFont("Helvetica-Bold", 19 if width > height else 17)
        c.drawCentredString(width/2, top, institution_name[:90])
        c.setFillColor(HexColor("#555e67")); c.setFont("Helvetica", 8)
        if address: c.drawCentredString(width/2, top-15, address[:140])
        if contacts: c.drawCentredString(width/2, top-27, contacts[:130])

    def seal_and_signature(y):
        cx = width/2
        c.setStrokeColor(HexColor("#bd963f")); c.setLineWidth(2); c.circle(cx, y, 25, fill=0, stroke=1)
        c.setFillColor(HexColor("#173e4b")); c.setFont("Helvetica-Bold", 6.5); c.drawCentredString(cx, y+2, "OFFICIAL SEAL")
        c.setFont("Helvetica", 6); c.drawCentredString(cx, y-7, "COLLEGE")
        for x in (95, width-95):
            c.setStrokeColor(HexColor("#33424c")); c.setLineWidth(.7); c.line(x-70, y-3, x+70, y-3)
            if issuer_name and x > width/2:
                c.setFillColor(HexColor("#183d4c")); c.setFont("Times-Italic", 12); c.drawCentredString(x, y+5, issuer_name[:28])
            c.setFillColor(HexColor("#33424c")); c.setFont("Helvetica-Bold", 7); c.drawCentredString(x, y-16, designation[:32] if x > width/2 else "CLASS / RECORDS OFFICE")

    c.setTitle(title)
    if template == "study_certificate":
        # Formal cream paper and black double rule, following the supplied study certificate.
        frame(HexColor("#fffde2"), HexColor("#171717"), HexColor("#171717"))
        c.setFont("Helvetica-Bold", 20); c.setFillColor(HexColor("#111111")); c.drawCentredString(width/2, height-75, title.upper())
        c.setFont("Helvetica-Bold", 10); c.drawCentredString(width/2, height-99, institution_name[:100])
        c.setFont("Helvetica", 8); c.drawCentredString(width/2, height-114, (address + (" • " + contacts if contacts else ""))[:150])
        c.setFont("Helvetica", 11); c.drawCentredString(width/2, height-173, f"This is to certify that {name} (Admission No. {admission})")
        c.drawCentredString(width/2, height-198, f"is studying {course} during the academic year {academic or 'as recorded by the institution'}.")
        c.setFont("Helvetica", 10)
        c.drawString(76, height-246, f"University roll number: {roll}")
        dob = student.get("date_of_birth") or profile.get("date_of_birth") or "—"
        guardian = profile.get("guardian_name") or student.get("guardian_name") or "—"
        c.drawString(76, height-267, f"Date of birth: {dob}")
        c.drawString(76, height-288, f"Parent / guardian: {guardian}")
        c.setFont("Helvetica", 10); c.drawString(76, height-347, "The above particulars are true according to the records maintained by the institution.")
        c.drawString(76, 126, f"Place: {institution.get('city') or '________________'}")
        c.drawString(76, 105, f"Date: {issued}")
        seal_and_signature(96)
    elif template == "attendance_certificate":
        # Portrait layout, teal side rail and gold award mark, following the supplied sample.
        c.setFillColor(HexColor("#f8fcfc")); c.rect(0, 0, width, height, fill=1, stroke=0)
        c.setFillColor(HexColor("#168c91")); c.rect(0, 0, 28, height, fill=1, stroke=0)
        c.setFillColor(HexColor("#f5c400")); c.circle(width-77, height-87, 30, fill=1, stroke=0)
        c.setFillColor(HexColor("#fff")); c.circle(width-77, height-87, 20, fill=0, stroke=1)
        c.setStrokeColor(HexColor("#168c91")); c.setLineWidth(1.2); c.rect(43, 42, width-69, height-84, fill=0, stroke=1)
        header(HexColor("#116b75"), height-76)
        c.setFillColor(HexColor("#168c91")); c.setFont("Helvetica-Bold", 22); c.drawCentredString(width/2, height-170, "CERTIFICATE OF ATTENDANCE")
        c.setFillColor(HexColor("#53636a")); c.setFont("Helvetica", 11); c.drawCentredString(width/2, height-203, "This certificate is awarded to")
        c.setFillColor(HexColor("#117c83")); c.setFont("Times-Italic", 27); c.drawCentredString(width/2, height-249, name[:55])
        c.setStrokeColor(HexColor("#52aeb0")); c.line(85, height-262, width-58, height-262)
        c.setFillColor(HexColor("#3c4b50")); c.setFont("Helvetica", 10)
        body = f"for regular attendance in {course} during {academic or 'the recorded academic period'} at {institution_name}."
        y = height-298
        for line in wrap(body, 52): c.drawCentredString(width/2, y, line); y -= 18
        c.setFont("Helvetica", 9); c.drawCentredString(width/2, y-7, f"Admission No. {admission}   •   Roll No. {roll}")
        seal_and_signature(105)
        c.setFillColor(HexColor("#58676c")); c.setFont("Helvetica", 8); c.drawCentredString(width/2, 57, f"Certificate {code}  •  Issued {issued}")
    elif template == "achievement":
        # Burgundy and gold award design adapted from the supplied achievement certificate.
        frame(HexColor("#fbfaf7"), HexColor("#681719"), HexColor("#bd9b51"))
        c.setFillColor(HexColor("#681719")); path = c.beginPath(); path.moveTo(0,height); path.lineTo(138,height); path.lineTo(65,height-145); path.lineTo(0,height-198); path.close(); c.drawPath(path,fill=1,stroke=0)
        path = c.beginPath(); path.moveTo(width,0); path.lineTo(width-145,0); path.lineTo(width-70,145); path.lineTo(width,190); path.close(); c.drawPath(path,fill=1,stroke=0)
        c.setFillColor(HexColor("#c6a65c")); c.setFont("Helvetica-Bold", 31); c.drawCentredString(width/2, height-109, "CERTIFICATE")
        c.setFillColor(HexColor("#681719")); c.setFont("Helvetica-Bold", 18); c.drawCentredString(width/2, height-140, "OF ACHIEVEMENT")
        c.setFont("Helvetica", 10); c.drawCentredString(width/2, height-187, "This certificate is presented to")
        c.setFillColor(HexColor("#8a5a12")); c.setFont("Times-Italic", 30); c.drawCentredString(width/2, height-229, name[:54])
        c.setStrokeColor(HexColor("#7a2528")); c.line(160, height-242, width-160, height-242)
        c.setFillColor(HexColor("#542629")); c.setFont("Helvetica", 11)
        c.drawCentredString(width/2, height-278, f"in recognition of an academic achievement at {institution_name}.")
        c.setFont("Helvetica", 9); c.drawCentredString(width/2, height-300, f"{course}  •  {academic or 'Academic year on record'}")
        c.setFillColor(HexColor("#d5ad3f")); c.circle(width/2, 120, 33, fill=1, stroke=0)
        c.setFillColor(HexColor("#fff9e8")); c.circle(width/2, 120, 23, fill=0, stroke=1)
        c.setFillColor(HexColor("#704d16")); c.setFont("Helvetica-Bold", 7); c.drawCentredString(width/2, 118, "AWARD")
        for x, caption in ((width*.27, "ACADEMIC OFFICE"), (width*.73, designation[:30])):
            c.setStrokeColor(HexColor("#6a292b")); c.line(x-58, 105, x+58, 105)
            if x > width/2 and issuer_name:
                c.setFillColor(HexColor("#6a292b")); c.setFont("Times-Italic", 11); c.drawCentredString(x, 118, issuer_name[:28])
            c.setFillColor(HexColor("#62282a")); c.setFont("Helvetica-Bold", 8); c.drawCentredString(x, 91, caption)
        c.setFont("Helvetica", 8); c.drawCentredString(width/2, 52, f"Certificate {code}  •  Issued {issued}")
    elif template == "conduct_certificate":
        frame(HexColor("#f4f7fa"), HexColor("#233f5c"), HexColor("#7c9aaf"))
        c.setFillColor(HexColor("#233f5c")); c.rect(34, 34, 13, height-68, fill=1, stroke=0)
        header(HexColor("#233f5c"), height-78)
        c.setFillColor(HexColor("#233f5c")); c.setFont("Times-Bold", 23); c.drawCentredString(width/2+22, height-168, "CONDUCT CERTIFICATE")
        c.setStrokeColor(HexColor("#9bb0c0")); c.line(130, height-186, width-98, height-186)
        c.setFillColor(HexColor("#354654")); c.setFont("Helvetica", 12)
        body = f"This is to certify that {name}, Admission No. {admission}, has maintained good conduct during the period of study in {course} at {institution_name}."
        y = height-230
        for line in wrap(body, 86): c.drawCentredString(width/2+15, y, line); y-=22
        c.setFont("Helvetica", 10); c.drawCentredString(width/2+15, y-11, f"Academic period: {academic or 'As recorded by the institution'}")
        c.drawCentredString(width/2+15, y-32, f"University roll number: {roll}     Issued on {issued}")
        seal_and_signature(102)
    else:
        # Forest green completion design with a centered completion medallion.
        frame(HexColor("#f8faf5"), HexColor("#245843"), HexColor("#a7bd86"))
        c.setFillColor(HexColor("#245843")); c.setFont("Helvetica-Bold", 19); c.drawCentredString(width/2, height-76, institution_name[:90])
        if address: c.setFont("Helvetica", 8); c.drawCentredString(width/2, height-93, address[:130])
        c.setStrokeColor(HexColor("#a7bd86")); c.setLineWidth(1.5); c.line(92,height-123,width-92,height-123)
        c.setFillColor(HexColor("#245843")); c.setFont("Helvetica-Bold", 22); c.drawCentredString(width/2,height-164,"COURSE COMPLETION CERTIFICATE")
        body = f"This is to certify that {name}, Admission No. {admission}, has successfully completed the prescribed course of study in {course} at {institution_name}."
        c.setFillColor(HexColor("#30463a")); c.setFont("Helvetica", 12); y=height-211
        for line in wrap(body, 90): c.drawCentredString(width/2,y,line); y-=21
        c.setFont("Helvetica", 10); c.drawCentredString(width/2,y-10,f"Academic period: {academic or 'As recorded by the institution'}    •    University roll number: {roll}")
        c.setFillColor(HexColor("#a7bd86")); c.circle(width/2, 113, 25, fill=1, stroke=0)
        c.setFillColor(HexColor("#245843")); c.setFont("Helvetica-Bold", 7); c.drawCentredString(width/2, 111, "COMPLETED")
        for x, caption in ((105, "ACADEMIC OFFICE"), (width-105, designation[:30])):
            c.setStrokeColor(HexColor("#476451")); c.line(x-62, 108, x+62, 108)
            if x > width/2 and issuer_name:
                c.setFillColor(HexColor("#245843")); c.setFont("Times-Italic", 11); c.drawCentredString(x, 120, issuer_name[:28])
            c.setFillColor(HexColor("#30463a")); c.setFont("Helvetica-Bold", 8); c.drawCentredString(x, 94, caption)
        c.setFont("Helvetica", 8); c.drawCentredString(width/2, 55, f"Issued {issued}  •  Certificate {code}")

    c.setFillColor(HexColor("#53636a")); c.setFont("Helvetica", 6.5)
    c.drawCentredString(width/2, 34, f"Verify this signed certificate: {verify_url}")
    c.linkURL(verify_url, (45, 27, width-45, 42), relative=0)
    c.save()
    return out.getvalue()


def mark_admission_document(data, student_code, label, record, key):
    """Tick the enrollment checklist entry for this document; the photo becomes the profile photo."""
    profiles = data["records"].get("student_admission_profiles", {})
    profile = next((p for p in profiles.values() if p["student_code"] == student_code), None)
    if profile is not None:
        checklist = dict(profile.get("document_checklist") or {})
        entry = dict(checklist.get(label) or {"label": label.replace("_", " ").capitalize()})
        entry.update(submitted=True, uploaded=True, document_code=record["code"])
        checklist[label] = entry
        profile["document_checklist"] = checklist
    if label == "student_photo" and record["mime_type"].startswith("image/"):
        data["records"]["students"][student_code]["profile_photo_storage_key"] = key


def mark_employee_document(data, employee_code, label, record):
    """Tick the staff onboarding checklist entry for this document."""
    profiles = data["records"].get("employee_profiles", {})
    profile = next((p for p in profiles.values() if p["employee_code"] == employee_code), None)
    if profile is not None:
        checklist = dict(profile.get("document_checklist") or {})
        entry = dict(checklist.get(label) or {"label": label.replace("_", " ").capitalize()})
        entry.update(uploaded=True, document_code=record["code"])
        checklist[label] = entry
        profile["document_checklist"] = checklist


def permitted_person(data, user, kind, code):
    if kind == "employee":
        return user["person_type"] == "employee" and user["person_code"] == code
    if user["person_type"] == "student":
        return user["person_code"] == code
    return user["person_type"] == "parent" and any(
        r["student_code"] == code and r["parent_code"] == user["person_code"]
        for r in query_rows(data, "student_parents")
    )


def file_store(request, record=None):
    """Resolve recorded providers and preserve reads of legacy files still on local disk."""
    if record:
        from app.core.files import LocalFiles, S3Files, SupabaseFiles
        settings = request.app.state.settings
        provider = record.get("storage_provider")
        local = LocalFiles(settings.data_dir / "files")
        if provider == "local" or (not provider and record.get("storage_key") and local.get(record["storage_key"]) is not None):
            return local
        if provider == "s3" and settings.file_storage != "s3":
            return S3Files(settings)
        if provider == "supabase" and settings.file_storage != "supabase":
            if not settings.supabase_url or not settings.supabase_service_role_key:
                raise HTTPException(503, "The original Supabase file storage needs configuration")
            return SupabaseFiles(settings.supabase_url, settings.supabase_service_role_key.get_secret_value(), settings.supabase_bucket)
    return request.app.state.files


@contextmanager
def file_transaction(request):
    """Remove newly written objects if the database transaction rolls back."""
    pending = []
    try:
        with request.app.state.store.transaction() as data:
            yield data, pending
    except Exception:
        for key in pending:
            try:
                file_store(request).delete(key)
            except Exception:
                logging.getLogger(__name__).error("Could not remove an uncommitted uploaded object")
        raise


def folder_segment(value):
    # Retain recognizable IDs and append a digest when normalization changes one.
    value = str(value)
    safe = re.sub(r"[^A-Za-z0-9_.-]", "_", value).replace("..", "_")[:60].strip(".")
    return (safe or "record") + ("-" + hashlib.sha256(value.encode()).hexdigest()[:10] if safe != value else "")


def person_folder(data, kind, code):
    if kind == "admission_document":
        person = query_get(data, "admission_applications", code)
        category, identifier = "Applications", person.get("application_number") or code
    elif kind == "student_document":
        person = query_get(data, "students", code)
        category, identifier = "Students", person.get("admission_number") or code
    else:
        person = query_get(data, "employees", code)
        category = {"teacher": "Teaching_Staff", "staff": "Non_Teaching_Staff", "labour": "Labour"}.get(person.get("employee_type"), "Employees")
        identifier = person.get("employee_number") or code
    return f"{category}/{folder_segment(identifier)}/{folder_segment(code)}"


def file_metadata(request, key, filename, mime, raw, kind, code):
    path = f"/api/v1/documents/{kind}/{code}/view"
    return {"original_filename": Path(filename.replace("\\", "/")).name,
            "mime_type": mime, "size_bytes": len(raw), "sha256": hashlib.sha256(raw).hexdigest(),
            "document_url": path, "uploaded_at": now(),
            **(file_store(request).metadata(key) if hasattr(file_store(request), "metadata")
               else {"storage_provider": request.app.state.settings.file_storage})}


class UploadInput(StrictModel):
    kind: str = Field(
        pattern=r"^(form_16|form_16a|employee_document|student_document|admission_document)$"
    )
    person_code: str
    filename: str = Field(min_length=1, max_length=200)
    content_base64: str = Field(max_length=900000)
    financial_year: str | None = None
    document_type_code: str | None = None
    # Student/employee documents: what the file is (e.g. aadhaar_copy, transfer_certificate,
    # student_photo); stored as documents.document_type. Defaults to the kind.
    document_label: str | None = Field(default=None, pattern=r"^[a-z][a-z0-9_]{1,59}$")


@router.post("/upload", status_code=201)
def upload(body: UploadInput, request: Request, user=Depends(current_user)):
    data = request.app.state.store.snapshot()
    table = (
        "employee_tax_documents"
        if body.kind.startswith("form_")
        else "admission_documents"
        if body.kind == "admission_document"
        else "documents"
    )
    if user["person_type"] not in {"employee", "system"} or not has_permission(
        data, user, table, "create"
    ):
        raise HTTPException(403, "Upload permission denied")
    try:
        raw = base64.b64decode(body.content_base64, validate=True)
    except (binascii.Error, ValueError):
        raise HTTPException(422, "Invalid file encoding")
    if not raw or len(raw) > 650000:
        raise HTTPException(422, "File must be 1–650000 bytes")
    mime = (
        "application/pdf"
        if raw.startswith(b"%PDF-")
        else "image/png"
        if raw.startswith(b"\x89PNG\r\n\x1a\n")
        else "image/jpeg"
        if raw.startswith(b"\xff\xd8\xff")
        else None
    )
    if not mime:
        raise HTTPException(422, "Only PDF, PNG and JPEG documents are accepted")
    if body.kind.startswith("form_") and (
        mime != "application/pdf"
        or not body.financial_year
        or not __import__("re").fullmatch(r"\d{4}-\d{4}", body.financial_year)
    ):
        raise HTTPException(
            422, "Tax documents require PDF and a YYYY-YYYY financial year"
        )
    key = new_code("FILE")
    sha = hashlib.sha256(raw).hexdigest()
    with file_transaction(request) as (data, pending):
        key = person_folder(data, body.kind, body.person_code) + "/" + folder_segment(body.document_label or body.kind) + "/" + key + {"application/pdf": ".pdf", "image/png": ".png", "image/jpeg": ".jpg"}[mime]
        if table == "employee_tax_documents":
            query_get(data, "employees", body.person_code)
            revision = 1 + max(
                [
                    r["revision"]
                    for r in query_rows(data, table)
                    if r["employee_code"] == body.person_code
                    and r["financial_year"] == body.financial_year
                    and r["document_type"] == body.kind
                ],
                default=0,
            )
            record = {
                "code": new_code("TAX"),
                "employee_code": body.person_code,
                "financial_year": body.financial_year,
                "document_type": body.kind,
                "revision": revision,
                "storage_key": key,
                "sha256": sha,
                "published_by_employee_code": user["person_code"],
                "published_at": now(),
            }
        elif table == "admission_documents":
            query_get(data, "admission_applications", body.person_code)
            kind = query_get(data, "document_types", body.document_type_code)
            if len(raw) > int(kind.get("maximum_file_bytes", 650000)):
                raise HTTPException(422, "Document exceeds the type limit")
            accepted = kind.get("accepted_mime_types") or []
            if accepted and mime not in accepted:
                raise HTTPException(422, "File type is not accepted for this document")
            docs = [
                r
                for r in query_rows(data, table)
                if r["application_code"] == body.person_code
                and r["document_type_code"] == body.document_type_code
            ]
            for r in docs:
                r["is_current"] = False
            record = {
                "code": new_code("ADOC"),
                "application_code": body.person_code,
                "document_type_code": body.document_type_code,
                "revision": 1 + max([r["revision"] for r in docs], default=0),
                "is_current": True,
                "storage_key": key,
                "original_filename": Path(body.filename).name,
                "mime_type": mime,
                "size_bytes": len(raw),
                "sha256": sha,
                "uploaded_by_user_code": user["code"],
                "received_at": now(),
                "status": "pending_verification",
                "original_sighted": False,
            }
        else:
            person = "employees" if body.kind == "employee_document" else "students"
            query_get(data, person, body.person_code)
            record = {
                "code": new_code("DOC"),
                "employee_code": body.person_code if person == "employees" else None,
                "student_code": body.person_code if person == "students" else None,
                "parent_code": None,
                "document_type": body.document_label or body.kind,
                "storage_key": key,
                "original_filename": Path(body.filename).name,
                "mime_type": mime,
                "sha256": sha,
            }
            if person == "students" and body.document_label:
                mark_admission_document(data, body.person_code, body.document_label, record, key)
            if person == "employees" and body.document_label:
                mark_employee_document(data, body.person_code, body.document_label, record)
        download_kind = {"documents": "document", "admission_documents": "admission-document", "employee_tax_documents": "tax-document"}[table]
        record.update(file_metadata(request, key, body.filename, mime, raw, download_kind, record["code"]))
        record["uploaded_by_user_code"] = user["code"]
        if body.kind in {"student_document", "employee_document"} and body.document_label in {"student_photo", "employee_photo", "profile_photo", "staff_photo"} and mime.startswith("image/"):
            person_table = "students" if body.kind == "student_document" else "employees"
            person = query_get(data, person_table, body.person_code)
            person["profile_photo_url"] = record["document_url"]
            person["profile_photo_storage_key"] = key
        # File key is server generated; user filenames never become storage paths.
        pending.append(key)
        file_store(request).put(key, raw, mime)
        query_save(data, table, record)
        query_save(data, "file_storage_objects", {
            **{k: record[k] for k in ("original_filename", "mime_type", "size_bytes", "sha256", "document_url", "uploaded_at", "storage_provider")},
            **{k: record.get(k) for k in ("s3_bucket", "s3_key", "s3_uri")},
            "code": record["code"], "owner_type": "application" if body.kind == "admission_document" else "student" if body.kind == "student_document" else "employee",
            "owner_code": body.person_code, "document_table": table, "document_code": record["code"],
            "storage_key": key, "uploaded_by_user_code": user["code"], "deleted_at": None})
        audit(data, user["code"], "upload", table, record["code"])
        return {k: v for k, v in record.items() if k != "storage_key"}


class CertificateInput(StrictModel):
    request_code: str


def signing_key(request):
    configured = request.app.state.settings.certificate_signing_key
    if configured is not None:  # deployments: the key comes from the environment
        return Ed25519PrivateKey.from_private_bytes(base64.b64decode(configured.get_secret_value()))
    if os.environ.get("VERCEL"):  # a key file on serverless disk would change on every restart
        raise HTTPException(503, "Certificate signing is not configured: set EDUNEXA_CERTIFICATE_SIGNING_KEY")
    path = request.app.state.settings.data_dir / "certificate-ed25519.key"
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    if not path.exists():
        raw = Ed25519PrivateKey.generate().private_bytes(
            serialization.Encoding.Raw,
            serialization.PrivateFormat.Raw,
            serialization.NoEncryption(),
        )
        try:
            fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
            with os.fdopen(fd, "wb") as out:
                out.write(raw)
        except FileExistsError:
            pass
    return Ed25519PrivateKey.from_private_bytes(path.read_bytes())


@router.post("/certificates/issue", status_code=201)
def issue(body: CertificateInput, request: Request, user=Depends(current_user)):
    if request.app.state.settings.file_storage != "s3":
        raise HTTPException(503, "Certificate issuance requires EDUNEXA_FILE_STORAGE=s3 and configured S3 access")
    with file_transaction(request) as (data, pending):
        if user["person_type"] not in {"employee", "system"} or not has_permission(
            data, user, "certificates", "approve"
        ):
            raise HTTPException(403, "Certificate authorization required")
        req = query_get(data, "certificate_requests", body.request_code)
        if req["status"] != "pending":
            raise HTTPException(409, "Request already processed")
        student = query_get(data, "students", req["student_code"])
        kind = query_get(data, "certificate_types", req["type_code"])
        acceptable_status = {"active", "completed"} if kind.get("code") == "course_completion" else {"active"}
        candidate_enrollments = [e for e in query_rows(data, "student_enrollments")
                                 if e["student_code"] == student["code"] and e["status"] in acceptable_status]
        required_program, required_year = req.get("program_code"), req.get("academic_year_code")
        def matches_selection(enrollment):
            section = data["records"].get("sections", {}).get(enrollment.get("section_code"), {})
            batch = data["records"].get("batches", {}).get(section.get("batch_code"), {})
            if required_program and batch.get("program_code") != required_program: return False
            if required_year and batch.get("academic_year_code") != required_year:
                year = data["records"].get("academic_years", {}).get(required_year, {})
                if not (str(batch.get("entry_year")) == str(year.get("start_date", ""))[:4] and str(batch.get("graduation_year")) == str(year.get("end_date", ""))[:4]): return False
            return True
        enrollment = next((e for e in candidate_enrollments if matches_selection(e)), None)
        if not enrollment:
            raise HTTPException(409, "Active enrollment and roll number required")
        code = new_code("CERT")
        token = secrets.token_urlsafe(32)
        issuer = data["records"].get("employees", {}).get(user.get("person_code"), {})
        raw = certificate_pdf(kind["name"], student, kind, enrollment, data, code,
                              date.today().isoformat(), request.app.state.settings.public_portal_url.rstrip("/")
                              + "/verify-certificate/" + token, issuer, req.get("academic_year_code"))
        key = signing_key(request)
        signature = base64.b64encode(key.sign(raw)).decode()
        sha = hashlib.sha256(raw).hexdigest()
        public = base64.b64encode(
            key.public_key().public_bytes(
                serialization.Encoding.Raw, serialization.PublicFormat.Raw
            )
        ).decode()
        storage = person_folder(data, "student_document", student["code"]) + "/Certificates/" + new_code("CERT-FILE") + ".pdf"
        pending.append(storage)
        file_store(request).put(storage, raw, "application/pdf")
        record = query_save(
            data,
            "certificates",
            {
                "code": code,
                "request_code": req["code"],
                "certificate_number": code,
                "issued_on": date.today().isoformat(),
                "issued_by_code": user["person_code"],
                "verification_token": token,
                "storage_key": storage,
                **file_metadata(request, storage, code + ".pdf", "application/pdf", raw, "certificate", code),
                "revoked_on": None,
            },
        )
        query_save(data, "file_storage_objects", {
            **file_metadata(request, storage, code + ".pdf", "application/pdf", raw, "certificate", code),
            "code": code, "owner_type": "student", "owner_code": student["code"],
            "document_table": "certificates", "document_code": code, "storage_key": storage,
            "uploaded_by_user_code": user["code"], "deleted_at": None})
        query_save(
            data,
            "certificate_signatures",
            {
                "code": new_code("SIG"),
                "certificate_code": code,
                "signing_provider": "local-development-ed25519",
                "key_reference": "certificate-ed25519.key",
                "signature_algorithm": "Ed25519",
                "signature": signature,
                "public_key": public,
                "signed_document_storage_key": storage,
                "document_sha256": sha,
                "signed_by_employee_code": user["person_code"],
                "signed_at": now(),
                "revoked_at": None,
            },
        )
        req["status"] = "issued"
        audit(data, user["code"], "issue", "certificates", code)
        return {
            k: v
            for k, v in record.items()
            if k not in {"storage_key", "verification_token"}
        }


@router.get("/certificates/verify/{token}")
def verify(token: str, request: Request):
    if len(token) > 100:
        raise HTTPException(404, "Certificate not found")
    data = request.app.state.store.snapshot()
    record = next(
        (
            r
            for r in query_rows(data, "certificates")
            if r["verification_token"] == token
        ),
        None,
    )
    if not record:
        raise HTTPException(404, "Certificate not found")
    signature = next(
        (
            r
            for r in query_rows(data, "certificate_signatures")
            if r["certificate_code"] == record["code"]
        ),
        None,
    )
    valid = False
    if signature and not record.get("revoked_on") and not signature.get("revoked_at"):
        try:
            raw = file_store(request, record).get(record.get("storage_key"))
            if raw is None:
                raise ValueError("certificate file missing")
            Ed25519PublicKey.from_public_bytes(
                base64.b64decode(signature["public_key"])
            ).verify(base64.b64decode(signature["signature"]), raw)
            valid = hashlib.sha256(raw).hexdigest() == signature["document_sha256"]
        except Exception:
            valid = False
    return {
        "certificate_number": record["certificate_number"],
        "valid": valid,
        "issued_on": record["issued_on"],
        "signer_type": "local-development",
        "revoked": bool(record.get("revoked_on")),
    }


@router.get("/{kind}/{code}/download")
def download(kind: str, code: str, request: Request, user=Depends(current_user), inline: bool = False):
    with request.app.state.store.transaction() as data:
        if kind == "payslip":
            slip = query_get(data, "payslips", code)
            run = query_get(data, "payroll_runs", slip["payroll_run_code"])
            if run["status"] not in {"published", "paid"}:
                raise HTTPException(409, "Payslip is not published")
            if not permitted_person(
                data, user, "employee", slip["employee_code"]
            ) and not has_permission(data, user, "payslips", "view"):
                raise HTTPException(404, "Payslip not found")
            raw = pdf(
                "Salary payslip",
                [f"{k.replace('_', ' ').title()}: {v}" for k, v in slip.items()]
                + [
                    f"{r['component']} ({r['component_type']}): INR {r['amount']}"
                    for r in query_rows(data, "payslip_lines")
                    if r["payslip_code"] == code
                ],
            )
            mime = "application/pdf"
        elif kind in {"tax-document", "document", "admission-document", "certificate", "import-workbook"}:
            table = {
                "tax-document": "employee_tax_documents",
                "document": "documents",
                "admission-document": "admission_documents",
                "certificate": "certificates",
                "import-workbook": "import_jobs",
            }[kind]
            record = query_get(data, table, code)
            if record.get("deleted_at"):
                raise HTTPException(404, "Document was deleted")
            if kind == "certificate":
                req = query_get(data, "certificate_requests", record["request_code"])
                if record.get("revoked_on"):
                    raise HTTPException(409, "Certificate revoked")
                allowed = permitted_person(data, user, "student", req["student_code"])
            elif kind == "tax-document":
                allowed = permitted_person(
                    data, user, "employee", record["employee_code"]
                )
            elif kind == "admission-document":
                allowed = any(link.get("admission_document_code") == code and permitted_person(data, user, "student", link.get("student_code"))
                              for link in query_rows(data, "student_document_links"))
            elif kind == "import-workbook":
                allowed = False
            else:
                allowed = permitted_person(
                    data,
                    user,
                    "employee" if record.get("employee_code") else "student",
                    record.get("employee_code") or record.get("student_code"),
                )
            if not allowed and not (
                user["person_type"] in {"employee", "system"}
                and has_permission(data, user, table, "view")
            ):
                raise HTTPException(404, "Document not found")
            raw = file_store(request, record).get(record.get("storage_key"))
            if raw is None:
                raise HTTPException(404, "Document bytes are not available")
            mime = record.get("mime_type", "application/pdf")
            if kind == "certificate":
                query_save(
                    data,
                    "certificate_download_events",
                    {
                        "code": new_code("CDE"),
                        "certificate_code": code,
                        "user_code": user["code"],
                        "downloaded_at": now(),
                        "channel": user["client"],
                        "document_sha256": hashlib.sha256(raw).hexdigest(),
                        "request_id": new_code("REQ"),
                    },
                )
        elif kind == "receipt":
            receipt = query_get(data, "receipts", code)
            payment = query_get(data, "payments", receipt["payment_code"])
            if not permitted_person(
                data, user, "student", payment["student_code"]
            ) and not has_permission(data, user, "receipts", "view"):
                raise HTTPException(404, "Receipt not found")
            raw = pdf(
                "Fee receipt",
                [f"{k}: {v}" for k, v in receipt.items()]
                + [
                    f"{k}: {v}"
                    for k, v in payment.items()
                    if k not in {"request", "idempotency_key"}
                ],
            )
            mime = "application/pdf"
        else:
            raise HTTPException(404, "Download type not found")
        audit(data, user["code"], "download", kind, code)
        return Response(
            raw,
            media_type=mime,
            headers={
                "Cache-Control": "private, no-store",
                "X-Content-Type-Options": "nosniff",
                "Content-Disposition": ("inline" if inline else "attachment") + "; filename*=UTF-8''" + quote(record.get("original_filename") or f"{kind}-{code}.pdf", safe="") if kind in {"tax-document", "document", "admission-document", "certificate", "import-workbook"} else f'attachment; filename="{kind}-{code}.pdf"'
            },
        )


class RevokeInput(StrictModel):
    reason: str = Field(min_length=5, max_length=1000)


@router.post("/certificates/{code}/revoke")
def revoke(code: str, body: RevokeInput, request: Request, user=Depends(current_user)):
    with request.app.state.store.transaction() as data:
        if user["person_type"] not in {"employee", "system"} or not has_permission(
            data, user, "certificates", "approve"
        ):
            raise HTTPException(403, "Certificate authorization required")
        record = query_get(data, "certificates", code)
        if record.get("revoked_on"):
            raise HTTPException(409, "Already revoked")
        record.update(
            revoked_on=date.today().isoformat(), revocation_reason=body.reason
        )
        for signature in query_rows(data, "certificate_signatures"):
            if signature["certificate_code"] == code:
                signature["revoked_at"] = now()
        audit(data, user["code"], "revoke", "certificates", code)
        return {"code": code, "revoked": True}


@router.get("/{kind}/{code}/view")
def view(kind: str, code: str, request: Request, user=Depends(current_user)):
    return download(kind, code, request, user, inline=True)


@router.get("/files/{person_kind}/{person_code}")
def list_files(person_kind: str, person_code: str, request: Request, user=Depends(current_user)):
    table = {"student": "students", "employee": "employees", "application": "admission_applications"}.get(person_kind)
    if not table:
        raise HTTPException(404, "Unknown owner type")
    data = request.app.state.store.snapshot()
    query_get(data, table, person_code)
    owner_field = {"student": "student_code", "employee": "employee_code", "application": "application_code"}[person_kind]
    result = []
    for documents, kind in [("documents", "document"), ("employee_tax_documents", "tax-document"), ("admission_documents", "admission-document")]:
        allowed = (person_kind != "application" and permitted_person(data, user, person_kind, person_code)) or (user["person_type"] in {"employee", "system"} and has_permission(data, user, documents, "view"))
        if allowed:
            for row in query_rows(data, documents):
                if row.get(owner_field) == person_code and not row.get("deleted_at"):
                    result.append({**{k: v for k, v in row.items() if k != "storage_key"}, "download_kind": kind})
    if person_kind == "student" and (permitted_person(data, user, "student", person_code) or (user["person_type"] in {"employee", "system"} and has_permission(data, user, "admission_documents", "view"))):
        linked = {row.get("admission_document_code") for row in query_rows(data, "student_document_links") if row.get("student_code") == person_code}
        for row in query_rows(data, "admission_documents"):
            if row["code"] in linked and not row.get("deleted_at"):
                result.append({**{k: v for k,v in row.items() if k != "storage_key"}, "download_kind": "admission-document"})
    if person_kind == "student" and (permitted_person(data, user, "student", person_code) or (user["person_type"] in {"employee", "system"} and has_permission(data, user, "certificates", "view"))):
        requests = {row["code"] for row in query_rows(data, "certificate_requests") if row.get("student_code") == person_code}
        for row in query_rows(data, "certificates"):
            if row.get("request_code") in requests:
                result.append({**{k: v for k, v in row.items() if k not in {"storage_key", "verification_token"}}, "original_filename": row.get("original_filename") or row["code"] + ".pdf", "download_kind": "certificate"})
    return {"items": result}


@router.delete("/{kind}/{code}/file")
def delete_file(kind: str, code: str, request: Request, user=Depends(current_user)):
    table = {"document": "documents", "admission-document": "admission_documents", "tax-document": "employee_tax_documents", "import-workbook": "import_jobs"}.get(kind)
    if not table:
        raise HTTPException(409, "Retained generated document; revoke certificates instead")
    with request.app.state.store.transaction() as data:
        if user["person_type"] not in {"employee", "system"} or not has_permission(data, user, table, "delete"):
            raise HTTPException(403, "Delete permission denied")
        record = query_get(data, table, code)
        # Keep metadata and references for audit; deny reads before removing bytes.
        record["deleted_at"] = record.get("deleted_at") or now()
        if table == "admission_documents":
            record["is_current"] = False
        key = record.get("storage_key")
        inventory = data["records"].get("file_storage_objects", {}).get(code)
        if inventory:
            inventory["deleted_at"] = record["deleted_at"]
        for profiles in ("student_admission_profiles", "employee_profiles"):
            for profile in query_rows(data, profiles):
                checklist = dict(profile.get("document_checklist") or {})
                for label, entry in checklist.items():
                    if entry.get("document_code") == code:
                        checklist[label] = {**entry, "uploaded": False, "document_code": None}
                profile["document_checklist"] = checklist
        for people in ("students", "employees"):
            owner = record.get("student_code" if people == "students" else "employee_code")
            if owner:
                person = query_get(data, people, owner)
                if person.get("profile_photo_storage_key") == key:
                    person.update(profile_photo_storage_key=None, profile_photo_url=None)
        audit(data, user["code"], "delete_file", table, code)
    if key:
        file_store(request, record).delete(key)
    return {"code": code, "deleted": True}
