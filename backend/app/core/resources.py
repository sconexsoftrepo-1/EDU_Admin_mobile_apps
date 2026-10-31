"""Shared resource validation and CRUD. Screen folders bind explicit schema contracts."""

import json
from datetime import date, datetime
from datetime import time as daytime
from decimal import Decimal
from pathlib import Path
from typing import Any, Literal

from fastapi import HTTPException
from pydantic import ConfigDict, Field, ValidationError, create_model

from .storage import audit, new_code

CATALOG = {
    t["name"]: t
    for t in json.loads(
        (Path(__file__).parents[1] / "contracts/schema-catalog.json").read_text()
    )
}
# Security and accounting records must be written through dedicated services, not arbitrary CRUD.
MANAGED = {
    "documents",
    "employee_tax_documents",
    "admission_documents",
    "inventory_movements",
    "library_loans",
    "expense_payment_entries",
    "purchase_orders",
    "passenger_seats",
    "users",
    "roles",
    "permissions",
    "user_roles",
    "role_permissions",
    "refresh_tokens",
    "password_reset_tokens",
    "audit_logs",
    "payments",
    "payment_allocations",
    "receipts",
    "refunds",
    "refund_allocations",
    "fee_adjustments",
    "charge_scholarship_allocations",
    "external_remittances",
    "remittance_allocations",
    "payment_gateway_orders",
    "payment_gateway_events",
    "admission_enrollment_events",
    "admission_status_history",
    "student_status_history",
    "certificate_signatures",
    "certificate_download_events",
    "notification_delivery_attempts",
    "payslips",
    "payslip_lines",
}
IMMUTABLE = {
    "student_fee_charges",
    "student_scholarships",
    "fee_structures",
    "expenses",
    "payroll_runs",
    "admission_documents",
}


def make_model(table, partial=False):
    fields = {}
    for field in CATALOG[table]["fields"]:
        name = field["name"]
        sql = field["type"]
        kind = (
            list[str]
            if sql == "ARRAY" or sql.endswith("[]")
            else bool
            if sql == "boolean"
            else int
            if sql in {"integer", "bigint", "smallint"}
            else Decimal
            if sql in {"numeric", "decimal", "double precision", "real"}
            else datetime
            if "timestamp" in sql
            else date
            if sql == "date"
            else daytime
            if sql.startswith("time ") or sql == "time"
            else dict | list  # JSON columns hold objects or arrays (PostgreSQL jsonb)
            if sql in {"jsonb", "json"}
            else str
        )
        if field.get("choices") and kind is str:
            kind = Literal[tuple(field["choices"])]
        required = field["required"] and name != "code" and not partial
        constraint = {"max_length": 20000} if kind is str else {}
        if table == "fee_heads" and name == "category_label":
            constraint = {"min_length": 1, "max_length": 80}
        if name == "code":
            constraint = {"pattern": r"^[a-zA-Z0-9_-]{1,100}$"}
        annotation = kind if required else kind | None if kind is not Any else Any
        fields[name] = (
            annotation,
            Field(default=... if required else None, **constraint),
        )
    return create_model(
        "".join(w.title() for w in table.split("_"))
        + ("Update" if partial else "Create"),
        __config__=ConfigDict(extra="forbid", allow_inf_nan=False),
        **fields,
    )


def validate_record(table, body, partial=False):
    try:
        return make_model(table, partial)(**body).model_dump(
            mode="json", exclude_unset=True
        )
    except ValidationError as e:
        raise HTTPException(
            422,
            [
                {"field": ".".join(map(str, x["loc"])), "message": x["msg"]}
                for x in e.errors()
            ],
        )


def ensure_references(data, table, record):
    for f in CATALOG[table]["fields"]:
        target = f["reference"]
        value = record.get(f["name"])
        if target and value is not None:
            exists = value in data["records"].get(target, {})
            if target == "users":
                exists = value in data["accounts"]
            if not exists:
                raise HTTPException(
                    422, f"{f['name']}: referenced {target} record not found"
                )
    for a, b in [
        ("start_date", "end_date"),
        ("starts_at", "ends_at"),
        ("period_start", "period_end"),
        ("leave_at", "return_at"),
    ]:
        if record.get(a) and record.get(b) and record[a] > record[b]:
            raise HTTPException(422, f"{b} must be on or after {a}")
    for field, value in record.items():
        if (
            field.endswith("_amount")
            or field
            in {
                "amount",
                "tax_amount",
                "quantity",
                "capacity",
                "intake_capacity",
                "maximum_amount",
            }
        ) and value is not None:
            try:
                if Decimal(str(value)) < 0:
                    raise HTTPException(422, f"{field} cannot be negative")
            except (ValueError, ArithmeticError):
                raise HTTPException(422, f"{field} must be numeric")


# Safe create defaults mirror the database defaults in every storage backend.
RESOURCE_DEFAULTS = {
    "expenses": {"payment_status": "unpaid", "currency": "INR"},
    "scholarships": {"award_method": "fixed_amount", "eligibility_rules": {}},
    "notification_templates": {"is_active": True},
    "admission_sources": {"is_active": True},
    "admission_enquiries": {"status": "new", "communication_consent": False},
    "vehicle_trips": {"status": "scheduled"},
}


class ResourceRepository:
    def __init__(self, table):
        self.table = table

    def list(self, data):
        return list(data["records"].get(self.table, {}).values())

    def save(self, data, record):
        data["records"].setdefault(self.table, {})[record["code"]] = record
        return record

    def delete(self, data, code):
        del data["records"][self.table][code]

    def get(self, data, code):
        item = data["records"].get(self.table, {}).get(code)
        if not item:
            raise HTTPException(404, "Record not found")
        return item


class ResourceService:
    def __init__(self, repo):
        self.repo = repo
        self.table = repo.table

    def create(self, data, body, actor):
        if self.table in MANAGED:
            raise HTTPException(
                409, "Use the dedicated workflow endpoint for this managed resource"
            )
        record = validate_record(
            self.table, {**RESOURCE_DEFAULTS.get(self.table, {}), **body}
        )
        record["code"] = record.get("code") or new_code(self.table[:3].upper())
        rows = data["records"].setdefault(self.table, {})
        if record["code"] in rows:
            raise HTTPException(409, "Record code already exists")
        ensure_references(data, self.table, record)
        self.business_validation(data, record)
        self.repo.save(data, record)
        if self.table == "programs" and record.get("course_level") in {"intermediate", "degree"}:
            from .curriculum_workspace import insert, starter
            insert(data, record, starter(record), generated=True)
        audit(data, actor, "create", self.table, record["code"])
        return record

    def business_validation(self, data, record):
        if self.table == "vehicles":
            if record["capacity"] <= 0:
                raise HTTPException(422, "Passenger capacity must be greater than zero")
            record["registration_number"] = record["registration_number"].strip().upper()
            if not record["registration_number"]:
                raise HTTPException(422, "Vehicle registration is required")
            if any(
                r["code"] != record["code"]
                and r["registration_number"].strip().upper() == record["registration_number"]
                for r in data["records"].get("vehicles", {}).values()
            ):
                raise HTTPException(409, "Vehicle registration already exists")
        if self.table == "expenses":
            if record.get("payment_status") == "paid" and not record.get("paid_on"):
                raise HTTPException(422, "Paid on is required for a paid expense")
        if self.table == "scholarships":
            percent = record.get("award_percent")
            if record["award_method"] == "percentage":
                if percent is None or not 0 <= Decimal(str(percent)) <= 100:
                    raise HTTPException(
                        422, "Percentage scholarships require an award percent between 0 and 100"
                    )
            elif percent is not None:
                raise HTTPException(
                    422, "Award percent must be empty for a fixed amount scholarship"
                )
            if not isinstance(record["eligibility_rules"], dict):
                raise HTTPException(422, "Eligibility rules must be a JSON object")
        if self.table == "transport_attendance":
            if bool(record.get("student_code")) == bool(record.get("employee_code")):
                raise HTTPException(
                    422, "Choose exactly one passenger: a student or an employee"
                )
        if record.get("program_code") and record.get("academic_year_code"):
            year = data["records"].get("academic_years", {}).get(record["academic_year_code"], {})
            if year.get("program_code") and year["program_code"] != record["program_code"]:
                raise HTTPException(422, "The academic year does not belong to the selected course")
        if self.table == "programs" and record.get("course_level") in {"intermediate", "degree"}:
            from .admission_numbers import validate_branch_code
            record["branch_code"] = validate_branch_code(data, record)
        if self.table in {"hostel_beds", "vehicle_seats"}:
            table, key, ref = "hostel_rooms", "room_code", "hostel_beds"
            if self.table == "vehicle_seats":
                table, key, ref = "vehicles", "vehicle_code", "vehicle_seats"
            capacity = int(data["records"][table][record[key]]["capacity"])
            existing = [
                r
                for r in data["records"].get(ref, {}).values()
                if r[key] == record[key] and r["code"] != record["code"]
            ]
            if len(existing) >= capacity:
                raise HTTPException(409, "Room or vehicle capacity exceeded")

        if self.table == "timetable_slots":
            offering = (
                data["records"]
                .get("subject_offerings", {})
                .get(record["offering_code"], {})
            )
            if record["start_time"] >= record["end_time"]:
                raise HTTPException(422, "End time must follow start time")
            for slot in data["records"].get("timetable_slots", {}).values():
                if (
                    slot["code"] == record["code"]
                    or slot["weekday"] != record["weekday"]
                ):
                    continue
                other = (
                    data["records"]
                    .get("subject_offerings", {})
                    .get(slot["offering_code"], {})
                )
                overlap = max(slot["start_time"], record["start_time"]) < min(
                    slot["end_time"], record["end_time"]
                )
                if overlap and (
                    slot["room_code"] == record["room_code"]
                    or offering.get("teacher_code") == other.get("teacher_code")
                    or offering.get("section_code") == other.get("section_code")
                ):
                    raise HTTPException(
                        409, "Timetable conflicts with a teacher, class or room"
                    )
        if self.table == "student_enrollments" and record["status"] == "active":
            section = data["records"]["sections"][record["section_code"]]
            existing = [
                e
                for e in data["records"].get("student_enrollments", {}).values()
                if e["code"] != record["code"]
                and e["section_code"] == record["section_code"]
                and e["status"] == "active"
            ]
            if len(existing) >= int(section["capacity"]):
                raise HTTPException(409, "Section capacity exceeded")
            if any(
                e["roll_number"] == record["roll_number"]
                or e["student_code"] == record["student_code"]
                for e in existing
            ):
                raise HTTPException(409, "Student or roll number already enrolled")
        if self.table in {"student_parents", "application_guardians"} and record.get(
            "is_primary"
        ):
            owner = (
                "student_code"
                if self.table == "student_parents"
                else "application_code"
            )
            if any(
                r["code"] != record["code"]
                and r.get(owner) == record[owner]
                and r.get("is_primary")
                for r in data["records"].get(self.table, {}).values()
            ):
                raise HTTPException(409, "A primary guardian already exists")
        if self.table == "employee_salary_components":
            for component in data["records"].get(self.table, {}).values():
                if (
                    component["code"] == record["code"]
                    or component["employee_code"] != record["employee_code"]
                    or component["component"] != record["component"]
                ):
                    continue
                if max(component["effective_from"], record["effective_from"]) <= min(
                    component.get("effective_to") or "9999-12-31",
                    record.get("effective_to") or "9999-12-31",
                ):
                    raise HTTPException(409, "Salary component effective dates overlap")

        if self.table in {
            "purchase_requests",
            "payroll_adjustments",
            "notification_campaigns",
        } and record.get("status") not in {"pending", "draft"}:
            raise HTTPException(422, "New record must start in pending or draft status")
        if self.table == "payroll_runs" and record.get("status") not in {
            "pending",
            "draft",
        }:
            raise HTTPException(422, "New payroll run must start in draft status")
        if self.table == "fee_heads":
            if record.get("category_label") is not None:
                record["category_label"] = record["category_label"].strip()
                if not record["category_label"]:
                    raise HTTPException(422, "Give the fee category a name")
            if record.get("collection_ownership") == "internal":
                record["external_party_code"] = None
            if record["collection_ownership"] not in {"internal", "external"}:
                raise HTTPException(422, "Invalid collection ownership")
            if record["collection_ownership"] == "external" and not record.get(
                "external_party_code"
            ):
                raise HTTPException(422, "External fee head requires external party")
        if self.table == "program_document_requirements" and record[
            "required_stage"
        ] not in {"submission", "offer", "enrollment"}:
            raise HTTPException(422, "Invalid document requirement stage")
        if self.table == "admission_documents":
            if record["revision"] < 1:
                raise HTTPException(422, "Document revision must be positive")
            for doc in data["records"].get(self.table, {}).values():
                if (
                    doc["application_code"] == record["application_code"]
                    and doc["document_type_code"] == record["document_type_code"]
                ):
                    if doc["revision"] == record["revision"]:
                        raise HTTPException(409, "Document revision already exists")
                    if record["is_current"]:
                        doc["is_current"] = False
        if self.table == "students" and any(
            s["code"] != record["code"]
            and s["admission_number"] == record["admission_number"]
            for s in data["records"].get("students", {}).values()
        ):
            raise HTTPException(409, "Admission number already exists")
        if (
            self.table == "student_fee_charges"
            and Decimal(str(record.get("amount", 0))) <= 0
        ):
            raise HTTPException(422, "Charge must be positive")
        if self.table == "student_scholarships" and record.get("status") == "approved":
            raise HTTPException(
                422, "Create pending scholarship, then approve through finance workflow"
            )
        if self.table == "admission_applications" and record.get("status") in {
            "enrolled",
            "admitted",
        }:
            raise HTTPException(422, "Use enrollment workflow")
        if self.table == "admission_documents" and record.get("status") in {
            "verified",
            "waived",
        }:
            raise HTTPException(422, "Use document review endpoint")
        if self.table == "certificate_requests" and record.get("status") != "pending":
            raise HTTPException(422, "New certificate request must have pending status")
        if self.table == "certificates":
            raise HTTPException(
                409, "Certificate issuance requires a configured signing service"
            )
        if self.table == "hostel_permissions" and record.get("status") not in {
            "requested",
            "pending",
        }:
            raise HTTPException(422, "Use permission approval endpoint")
        if self.table == "hostel_allocations":
            from datetime import date

            if (
                not record.get("end_date")
                or record["end_date"] >= date.today().isoformat()
            ):
                for allocation in (
                    data["records"].get("hostel_allocations", {}).values()
                ):
                    if allocation["code"] == record["code"]:
                        continue
                    start = max(allocation["start_date"], record["start_date"])
                    end = min(
                        allocation.get("end_date") or "9999-12-31",
                        record.get("end_date") or "9999-12-31",
                    )
                    if start <= end and (
                        allocation["bed_code"] == record["bed_code"]
                        or allocation["student_code"] == record["student_code"]
                    ):
                        raise HTTPException(
                            409, "Student or bed already allocated during those dates"
                        )

    def update(self, data, code, body, actor):
        if self.table in MANAGED | IMMUTABLE:
            raise HTTPException(
                409, "Resource is immutable; use its workflow or a correction record"
            )
        old = self.repo.get(data, code)
        if (
            self.table == "inventory_items"
            and "quantity" in body
            and str(body["quantity"]) != str(old["quantity"])
        ):
            raise HTTPException(409, "Use stock movement to change quantity")
        if self.table == "exam_results" and old.get("published"):
            raise HTTPException(409, "Published results are locked")
        if self.table == "admission_applications" and old.get("status") == "enrolled":
            raise HTTPException(409, "Enrolled application is immutable")
        if self.table == "hostel_permissions" and old.get("status") not in {
            "pending",
            "requested",
        }:
            raise HTTPException(409, "Use the hostel workflow")
        patch = validate_record(self.table, body, True)
        if "code" in patch and patch["code"] != code:
            raise HTTPException(422, "Record code is immutable")
        record = {**old, **patch, "code": code}
        known = {field["name"] for field in CATALOG[self.table]["fields"]}
        # Persisted extension metadata (e.g. profile-photo URLs) is not an input field.
        # Validate the schema fields while retaining already stored extensions.
        record = {**record, **validate_record(self.table, {k: v for k, v in record.items() if k in known})}
        ensure_references(data, self.table, record)
        self.business_validation(data, record)
        self.repo.save(data, record)
        audit(data, actor, "edit", self.table, code)
        return record

    def delete(self, data, code, actor):
        if self.table in MANAGED | IMMUTABLE | {
            "students",
            "employees",
            "parents",
            "admission_applications",
            "hostel_permissions",
            "certificates",
        }:
            raise HTTPException(
                409, "Retained record; update status or use a workflow instead"
            )
        self.repo.get(data, code)
        if self.table == "programs" and code in data.get("documents", {}).get("course_curricula", {}):
            if any(a["program_code"] == code for a in data.get("documents", {}).get("assessments", {}).values()):
                raise HTTPException(409, "This course has assessments")
            # Course-owned plans should not prevent deleting an otherwise unused course.
            links = data["records"].get("curriculum_subjects", {})
            for key in [k for k, value in links.items() if value["program_code"] == code]:
                del links[key]
            data["documents"]["course_curricula"].pop(code, None)
        if hasattr(self.repo, "referenced_by"):  # screen modules check with their own SQL
            table = self.repo.referenced_by(data, code)
            if table:
                raise HTTPException(409, f"Record is referenced by {table}")
        else:
            for table, schema in CATALOG.items():
                for field in schema["fields"]:
                    if field["reference"] == self.table and any(
                        row.get(field["name"]) == code
                        for row in data["records"].get(table, {}).values()
                    ):
                        raise HTTPException(409, f"Record is referenced by {table}")
        self.repo.delete(data, code)
        audit(data, actor, "delete", self.table, code)


def staff_only(user):
    if user.get("workspace_scope") == "teaching":
        raise HTTPException(403, "Use assigned teaching screens")
    if user["person_type"] not in {"employee", "system"}:
        raise HTTPException(403, "Use the scoped /mobile endpoints for personal data")


def display_rows(data, table, records):
    """Expose retained import/custom details only after the endpoint's table permission check."""
    known = {f["name"] for f in CATALOG[table]["fields"]}
    forms = {f["code"] for f in data["forms"].values() if f["screen"] == table}
    latest = {}
    for submission in sorted(
        data["submissions"].values(), key=lambda r: r["submitted_at"]
    ):
        if submission["form_code"] in forms and submission.get("entity_code"):
            latest[submission["entity_code"]] = submission["values"]
    output = []
    for record in records:
        extras = {
            k: v
            for k, v in data.get("import_metadata", {})
            .get(table, {})
            .get(record["code"], {})
            .items()
            if k not in known
        }
        extras.update(
            {k: v for k, v in latest.get(record["code"], {}).items() if k not in known}
        )
        output.append({**record, **({"additional_details": extras} if extras else {})})
    return output
