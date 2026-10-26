"""Validate complete client workbooks, preview row errors, then commit atomically."""

import base64
import copy
import hashlib
import io
import json
import re
import zipfile
from datetime import date, datetime, time
from decimal import Decimal
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Request
from openpyxl import load_workbook
from pydantic import Field

from app.core.resources import CATALOG, ensure_references, validate_record
from app.core.security import StrictModel, has_permission, require, role_limit
from app.core.storage import audit, new_code, now

router = APIRouter(prefix="/imports/excel", tags=["Client Excel imports"])
CONTRACT = json.loads(
    (Path(__file__).parents[3] / "contracts/client-import-contract.json").read_text()
)
ALIASES = {
    "course_code": "program_code",
    "course_name": "name",
    "subject_name": "name",
    "official_email": "email",
    "teaching_experience_years": "experience_years",
    "staff_function": "responsibility",
    "shift_name": "shift",
    "fee_head_name": "name",
    "fee_structure_line_code": "fee_structure_code",
    "base_amount": "amount",
    "scholarship_name": "name",
    "maximum_award_amount": "maximum_amount",
    "approved_amount": "amount",
    "allocated_amount": "amount",
    "route_name": "name",
    "stop_name": "name",
    "leave_type_name": "name",
    "annual_entitlement_days": "annual_days",
    "event_title": "title",
    "work_phone": "work_contact",
}


def normalize(value):
    return re.sub(r"[^a-z0-9]+", "_", str(value or "").lower()).strip("_")


def query_rows(data, table):
    return list(data["records"].get(table, {}).values())


def query_save(data, table, record):
    data["records"].setdefault(table, {})[record["code"]] = record
    return record


def scalar(value):
    if isinstance(value, (date, datetime, time)):
        return value.isoformat()
    return value


def mapped_record(data, sheet, values):
    target = sheet["target"].split(";")[0].strip()
    known = {f["name"] for f in CATALOG.get(target, {}).get("fields", [])}
    mapped = {
        ALIASES.get(k, k): v
        for k, v in values.items()
        if ALIASES.get(k, k) in known and v is not None
    }
    mapped["code"] = values[sheet["fields"][0]["key"]]

    def save(table, record):
        record = validate_record(table, record)
        ensure_references(data, table, record)
        existing = data["records"].get(table, {}).get(record["code"])
        if existing:
            if any(existing.get(k) != v for k, v in record.items()):
                raise ValueError(f"{table} code already exists with different data")
            return existing
        query_save(data, table, record)
        return record

    def year():
        label = str(
            values.get("academic_year") or values.get("effective_academic_year") or ""
        )
        existing = next(
            (
                r
                for r in query_rows(data, "academic_years")
                if r["code"] == label or r["name"] == label
            ),
            None,
        )
        if not existing:
            raise ValueError(
                "Academic year must be configured before importing this row"
            )
        return existing["code"]

    def address(prefix=""):
        for key, source in [
            ("address", prefix + "address_line_1"),
            ("city", prefix + "city"),
            ("state", prefix + "state"),
            ("postal_code", prefix + "postal_code"),
            ("country", prefix + "country"),
        ]:
            if key in known and values.get(source) is not None:
                mapped[key] = values[source]
        if values.get(prefix + "address_line_2"):
            mapped["address"] = (
                mapped.get("address", "") + " " + values[prefix + "address_line_2"]
            ).strip()

    if target == "students":
        address("current_")
        mapped["current_address_details"] = {
            k: v for k, v in values.items() if k.startswith("current_")
        }
        mapped["permanent_address"] = {
            k: v for k, v in values.items() if k.startswith("permanent_")
        }
        mapped.setdefault("status", "active")
    elif target in {"parents", "employees"}:
        address()
        mapped.setdefault("status", "active") if target == "employees" else None
    elif target == "programs":
        mapped["duration_semesters"] = (
            values.get("duration_semesters") or int(values.get("duration_years", 0)) * 2
        )
        mapped.setdefault(
            "qualification", values.get("course_level") or values.get("course_name")
        )
        mapped.setdefault("intake_capacity", values.get("intake_capacity", 0))
    elif target == "curriculum_subjects":
        mapped["is_required"] = str(
            values.get("requirement_type", "required")
        ).lower() in {"required", "core", "mandatory"}
    elif target == "fee_structures":
        mapped["academic_year_code"] = year()
    elif target == "scholarships":
        mapped["academic_year_code"] = year()
        mapped["maximum_amount"] = (
            values.get("maximum_award_amount") or values.get("fixed_award_amount") or 0
        )
        mapped.setdefault("award_method", "fixed")
        mapped.setdefault("eligibility_rules", {})
    elif target == "student_scholarships":
        mapped.setdefault("status", "pending")
    elif target == "student_fee_charges":
        mapped["fee_structure_code"] = values["fee_structure_line_code"]
        mapped["amount"] = values["base_amount"]
        mapped.setdefault("tax_amount", 0)
        if (
            Decimal(str(values.get("discount_amount") or 0))
            or Decimal(str(values.get("scholarship_applied") or 0))
            or Decimal(str(values.get("fine_amount") or 0))
        ):
            raise ValueError(
                "Import base charges first; apply discounts, scholarships and fines through approval workflows"
            )
    elif target == "student_enrollments":
        ay = year()
        batch_code = values["batch_code"]
        sem_code = f"{ay}-SEM-{values['semester_number']}"
        save(
            "batches",
            {
                "code": batch_code,
                "program_code": values["course_code"],
                "name": values["batch_name"],
                "entry_year": values["entry_year"],
                "graduation_year": values["expected_graduation_year"],
            },
        )
        academic = next(
            r for r in query_rows(data, "academic_years") if r["code"] == ay
        )
        save(
            "semesters",
            {
                "code": sem_code,
                "academic_year_code": ay,
                "name": "Semester " + str(values["semester_number"]),
                "semester_number": values["semester_number"],
                "start_date": values.get("semester_start") or academic["start_date"],
                "end_date": values.get("semester_end") or academic["end_date"],
            },
        )
        save(
            "sections",
            {
                "code": values["section_code"],
                "batch_code": batch_code,
                "semester_code": sem_code,
                "name": values["section_name"],
                "capacity": values.get("capacity", 1000),
            },
        )
    elif target == "transport_routes":
        if values.get("vehicle_code"):
            save(
                "vehicles",
                {
                    "code": values["vehicle_code"],
                    "campus_code": values["campus_code"],
                    "registration_number": values["vehicle_registration"],
                    "capacity": values["seating_capacity"],
                    "driver_employee_code": values.get("driver_employee_code"),
                },
            )
    elif (
        target == "hostels"
    ):  # Room sheet targets hostels; expands into hostel, room, bed records.
        hostel = save(
            "hostels",
            {
                "code": values["hostel_code"],
                "campus_code": values["campus_code"],
                "name": values["hostel_name"],
                "warden_employee_code": values.get("warden_employee_code"),
            },
        )
        save(
            "hostel_rooms",
            {
                "code": values["room_code"],
                "hostel_code": hostel["code"],
                "room_number": str(values["room_number"]),
                "capacity": int(values["capacity"]),
            },
        )
        labels = str(values.get("bed_labels") or "").split(",")
        for label in labels:
            if label.strip():
                save(
                    "hostel_beds",
                    {
                        "code": values["room_code"] + "-" + label.strip(),
                        "room_code": values["room_code"],
                        "bed_number": label.strip(),
                    },
                )
        return {"table": "hostel_rooms", "code": values["room_code"]}
    elif target == "hostel_allocations":
        mapped["bed_code"] = values["room_code"] + "-" + str(values["bed_label"])
    elif target == "calendar_events":
        mapped["starts_at"] = (
            str(values["start_date"])
            + "T"
            + str(values.get("start_time") or "00:00:00")
        )
        mapped["ends_at"] = (
            str(values["end_date"]) + "T" + str(values.get("end_time") or "23:59:59")
        )
    # Financial history imports are privileged, balanced as one workbook and never mark online payments verified.
    if target == "payments":
        if mapped.get("status") not in {"settled", "completed"}:
            raise ValueError("Only settled historical receipts can be imported")
        mapped["status"] = "settled"
    record = save(target, mapped)
    if target == "payments" and values.get("receipt_number"):
        save(
            "receipts",
            {
                "code": "RCT-" + record["code"],
                "payment_code": record["code"],
                "receipt_number": values["receipt_number"],
                "issued_on": values.get("receipt_date") or mapped["paid_on"],
            },
        )
    # Preserve every collected field, including information not yet represented in SQL columns.
    data.setdefault("import_metadata", {}).setdefault(target, {})[record["code"]] = (
        values
    )
    return {"table": target, "code": record["code"]}


class WorkbookInput(StrictModel):
    filename: str = Field(max_length=200)
    content_base64: str = Field(max_length=950000)


@router.get("/contract")
def contract(request: Request, user=Depends(require("import_jobs", "view"))):
    allowed = role_limit(request.app.state.store.snapshot(), user, "import_files")
    if allowed is None:
        return CONTRACT
    return {**CONTRACT, "files": [f for f in CONTRACT["files"] if f["file"] in allowed]}


@router.post("/validate", status_code=201)
def validate(
    body: WorkbookInput,
    request: Request,
    user=Depends(require("import_jobs", "create")),
):
    definition = next(
        (f for f in CONTRACT["files"] if f["file"] == body.filename), None
    )
    if not definition:
        raise HTTPException(
            422, "Select one of the 13 supplied client workbook filenames"
        )
    allowed = role_limit(request.app.state.store.snapshot(), user, "import_files")
    if allowed is not None and body.filename not in allowed:
        raise HTTPException(403, "Your role cannot import this workbook")
    try:
        raw = base64.b64decode(body.content_base64, validate=True)
        with zipfile.ZipFile(io.BytesIO(raw)) as z:
            if sum(i.file_size for i in z.infolist()) > 15_000_000:
                raise ValueError("Expanded workbook too large")
        workbook = load_workbook(io.BytesIO(raw), read_only=True, data_only=False)
    except Exception:
        raise HTTPException(422, "Invalid or oversized XLSX workbook")
    data = request.app.state.store.snapshot()
    trial = copy.deepcopy(data)
    rows = []
    errors = []
    for sheet in definition["sheets"]:
        if sheet["name"] not in workbook.sheetnames:
            errors.append({"sheet": sheet["name"], "error": "Sheet missing"})
            continue
        ws = workbook[sheet["name"]]
        iterator = ws.iter_rows(values_only=True)
        for _ in range(CONTRACT["header_row"] - 1):
            next(iterator, None)
        headers = next(iterator, ())
        expected = [normalize(f["label"]) for f in sheet["fields"]]
        if [normalize(h) for h in headers[: len(expected)]] != expected:
            errors.append(
                {
                    "sheet": sheet["name"],
                    "error": "Headers do not match the supplied template",
                }
            )
            continue
        for number, row in enumerate(iterator, start=CONTRACT["first_data_row"]):
            if not any(v is not None for v in row[: len(expected)]):
                continue
            if len(rows) + len(errors) > 2000:
                raise HTTPException(422, "Maximum 2000 populated rows per workbook")
            values = {
                f["key"]: scalar(row[i]) if i < len(row) else None
                for i, f in enumerate(sheet["fields"])
            }
            try:
                if any(
                    isinstance(v, str) and v.startswith("=") for v in values.values()
                ):
                    raise ValueError(
                        "Formula cells must be replaced with values before import"
                    )
                for field in sheet["fields"]:
                    value = values[field["key"]]
                    if field["required"] and value in (None, ""):
                        raise ValueError(field["label"] + " is required")
                    if value is not None and field["type"] == "boolean":
                        if str(value).lower() not in {
                            "true",
                            "false",
                            "yes",
                            "no",
                            "1",
                            "0",
                        }:
                            raise ValueError("Invalid boolean: " + field["label"])
                        values[field["key"]] = str(value).lower() in {
                            "true",
                            "yes",
                            "1",
                        }
                    if (
                        field["choices"]
                        and value is not None
                        and value not in field["choices"]
                    ):
                        raise ValueError("Invalid choice: " + field["label"])
                before = copy.deepcopy(trial)
                record = mapped_record(trial, sheet, values)
                rows.append(
                    {
                        "sheet": sheet["name"],
                        "row": number,
                        "values": values,
                        "result": record,
                    }
                )
            except Exception as error:
                if "before" in locals():
                    trial = before
                errors.append(
                    {
                        "sheet": sheet["name"],
                        "row": number,
                        "error": str(getattr(error, "detail", error)),
                    }
                )
    workbook.close()
    # Historical allocations must not exceed either payments or charges.
    for payment in trial["records"].get("payments", {}).values():
        allocated = sum(
            Decimal(str(a["amount"]))
            for a in query_rows(trial, "payment_allocations")
            if a["payment_code"] == payment["code"]
        )
        if allocated > Decimal(str(payment["amount"])):
            errors.append({"error": "Allocations exceed payment " + payment["code"]})
    from app.modules.documents.files.api import file_transaction
    with file_transaction(request) as (live, pending):
        code = new_code("IMP")
        job = {
            "code": code,
            "uploaded_by_code": user["code"],
            "filename": body.filename,
            "file_sha256": hashlib.sha256(raw).hexdigest(),
            "status": "validated" if not errors else "failed",
            "total_rows": len(rows) + len(errors),
            "successful_rows": len(rows),
            "failed_rows": len(errors),
            "contract_version": "2.0",
            "errors": errors,
            "staged_rows": rows,
        }
        from app.modules.documents.files.api import file_metadata, file_store
        key = f"Imports/{code}/{new_code('FILE')}.xlsx"
        mime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        metadata = file_metadata(request, key, body.filename, mime, raw, "import-workbook", code)
        job.update(metadata, storage_key=key)
        pending.append(key)
        file_store(request).put(key, raw, mime)
        query_save(live, "file_storage_objects", {
            **metadata, "code": code, "owner_type": "import", "owner_code": code,
            "document_table": "import_jobs", "document_code": code, "storage_key": key,
            "uploaded_by_user_code": user["code"], "deleted_at": None})
        query_save(live, "import_jobs", job)
        audit(live, user["code"], "validate", "import_jobs", code)
    return {k: v for k, v in job.items() if k != "staged_rows"}


@router.post("/{code}/commit")
def commit(
    code: str, request: Request, user=Depends(require("import_jobs", "approve"))
):
    with request.app.state.store.transaction() as data:
        job = data["records"].get("import_jobs", {}).get(code)
        if not job or job.get("deleted_at"):
            raise HTTPException(404, "Import not found")
        if job["status"] != "validated":
            raise HTTPException(
                409, "Import must be validated without errors before commit"
            )
        definition = next(f for f in CONTRACT["files"] if f["file"] == job["filename"])
        sheets = {s["name"]: s for s in definition["sheets"]}
        results = []
        for row in job["staged_rows"]:
            target = sheets[row["sheet"]]["target"].split(";")[0].strip()
            if not has_permission(data, user, target, "create"):
                raise HTTPException(403, "Import target permission denied: " + target)
            try:
                result = mapped_record(data, sheets[row["sheet"]], row["values"])
            except Exception as error:
                raise HTTPException(
                    409,
                    "Data changed since validation: "
                    + str(getattr(error, "detail", error)),
                )
            results.append(result)
            query_save(
                data,
                "import_rows",
                {
                    "code": new_code("IR"),
                    "job_code": code,
                    "sheet_name": row["sheet"],
                    "row_number": row["row"],
                    "entity_code": result["code"],
                    "status": "imported",
                    "raw_data": row["values"],
                    "mapped_data": result,
                },
            )
        job.update(
            status="committed",
            reviewed_by_user_code=user["code"],
            approved_at=now(),
            finished_at=now(),
        )
        job.pop("staged_rows", None)
        audit(data, user["code"], "commit", "import_jobs", code)
        return {"code": code, "status": "committed", "imported": len(results)}
