"""Private file metadata/bytes, generated reports, certificates and download audit."""

import base64
import binascii
import hashlib
import io
import os
import secrets
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
from reportlab.lib.pagesizes import A4
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


def permitted_person(data, user, kind, code):
    if kind == "employee":
        return user["person_type"] == "employee" and user["person_code"] == code
    if user["person_type"] == "student":
        return user["person_code"] == code
    return user["person_type"] == "parent" and any(
        r["student_code"] == code and r["parent_code"] == user["person_code"]
        for r in query_rows(data, "student_parents")
    )


def private_path(request, key):
    root = request.app.state.settings.data_dir / "files"
    root.mkdir(parents=True, exist_ok=True, mode=0o700)
    if not key or Path(key).name != key:
        raise HTTPException(404, "File unavailable")
    return root / key


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
    path = private_path(request, key)
    with request.app.state.store.transaction() as data:
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
        # File key is server generated; user filenames never become filesystem paths.
        fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, "wb") as out:
            out.write(raw)
        query_save(data, table, record)
        audit(data, user["code"], "upload", table, record["code"])
        return {k: v for k, v in record.items() if k != "storage_key"}


class CertificateInput(StrictModel):
    request_code: str


def signing_key(request):
    path = request.app.state.settings.data_dir / "certificate-ed25519.key"
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
    with request.app.state.store.transaction() as data:
        if user["person_type"] not in {"employee", "system"} or not has_permission(
            data, user, "certificates", "approve"
        ):
            raise HTTPException(403, "Certificate authorization required")
        req = query_get(data, "certificate_requests", body.request_code)
        if req["status"] != "pending":
            raise HTTPException(409, "Request already processed")
        student = query_get(data, "students", req["student_code"])
        kind = query_get(data, "certificate_types", req["type_code"])
        enrollment = next(
            (
                e
                for e in query_rows(data, "student_enrollments")
                if e["student_code"] == student["code"] and e["status"] == "active"
            ),
            None,
        )
        if not enrollment:
            raise HTTPException(409, "Active enrollment and roll number required")
        code = new_code("CERT")
        token = secrets.token_urlsafe(32)
        raw = pdf(
            kind["name"],
            [
                "Certificate number: " + code,
                "Student: " + student["first_name"] + " " + student["last_name"],
                "Roll number: " + enrollment["roll_number"],
                "Issued: " + date.today().isoformat(),
                "Authorized by account: " + user["code"],
                "Development signing key: Ed25519",
                "Verify: "
                + request.app.state.settings.public_portal_url.rstrip("/")
                + "/colleges-institutions/edunexa-college/verify-certificate/"
                + token,
            ],
        )
        key = signing_key(request)
        signature = base64.b64encode(key.sign(raw)).decode()
        sha = hashlib.sha256(raw).hexdigest()
        public = base64.b64encode(
            key.public_key().public_bytes(
                serialization.Encoding.Raw, serialization.PublicFormat.Raw
            )
        ).decode()
        storage = new_code("CERT-FILE")
        path = private_path(request, storage)
        path.write_bytes(raw)
        os.chmod(path, 0o600)
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
                "document_url": "",
                "revoked_on": None,
            },
        )
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
            raw = private_path(request, record.get("storage_key")).read_bytes()
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
def download(kind: str, code: str, request: Request, user=Depends(current_user)):
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
        elif kind in {"tax-document", "document", "admission-document", "certificate"}:
            table = {
                "tax-document": "employee_tax_documents",
                "document": "documents",
                "admission-document": "admission_documents",
                "certificate": "certificates",
            }[kind]
            record = query_get(data, table, code)
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
            path = private_path(request, record.get("storage_key"))
            if not path.exists():
                raise HTTPException(404, "Document bytes are not available")
            raw = path.read_bytes()
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
                "Content-Disposition": f'attachment; filename="{kind}-{code}.pdf"'
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
