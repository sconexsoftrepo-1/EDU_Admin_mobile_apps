"""Screen actions and their transactional queries, without separate query files."""

from datetime import date
from decimal import Decimal, InvalidOperation

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import Field

from app.core.resources import staff_only
from app.core.security import StrictModel, current_user, has_permission
from app.core.storage import audit, new_code, now
from app.modules.finance.transactions.api import balance

router = APIRouter(prefix="/workflows", tags=["Screen business actions"])


def f(key, label, type="text", required=True, options=None):
    return {
        "key": key,
        "label": label,
        "type": type,
        "required": required,
        "options": options or [],
    }


SPECS = {
    "send-fee-reminder": (
        "notifications",
        "create",
        [
            f("charge_code", "Charge code"),
            f("parent_code", "Parent code"),
            f("cutoff_date", "Payment cut-off date", "date"),
        ],
    ),
    "seat-release": (
        "passenger_seats",
        "edit",
        [f("code", "Seat allocation code"), f("end_date", "End date", "date")],
    ),
    "purchase-pay": (
        "purchase_orders",
        "approve",
        [
            f("code", "Purchase order code"),
            f(
                "method",
                "Payment method",
                "select",
                True,
                ["cash", "bank_transfer", "cheque"],
            ),
            f("reference", "Payment reference"),
            f("paid_on", "Paid on", "date"),
        ],
    ),
    "expense-void": (
        "expenses",
        "approve",
        [f("code", "Unpaid expense code"), f("reason", "Reason", "textarea")],
    ),
    "certificate-reject": (
        "certificates",
        "approve",
        [f("code", "Certificate request code"), f("reason", "Reason", "textarea")],
    ),
    "fee-collect": (
        "payments",
        "create",
        [
            f("student_code", "Student code"),
            f("charge_code", "Fee charge"),
            f("amount", "Amount", "number"),
            f("method", "Method", "select", True, ["cash", "bank_transfer", "cheque"]),
            f("transaction_reference", "Unique collection reference"),
            f("paid_on", "Paid on", "date"),
        ],
    ),
    "document-review": (
        "admission_documents",
        "approve",
        [
            f("code", "Document code"),
            f("status", "Decision", "select", True, ["verified", "rejected", "waived"]),
            f("original_sighted", "Original document checked", "boolean", False),
            f("reason", "Review notes", "textarea"),
        ],
    ),
    "admission-enroll": (
        "admission_applications",
        "approve",
        [
            f("code", "Accepted application code"),
            f("section_code", "Section code"),
            f("roll_number", "Roll number"),
            f("student_details", "Student profile fields", "json"),
        ],
    ),
    "fee-discount": (
        "fee_adjustments",
        "approve",
        [
            f("charge_code", "Charge code"),
            f("amount", "Discount amount", "number"),
            f("reason", "Approval reason", "textarea"),
        ],
    ),
    "scholarship-approve": (
        "student_scholarships",
        "approve",
        [
            f("student_scholarship_code", "Award code"),
            f("charge_code", "Charge code"),
            f("amount", "Allocation amount", "number"),
        ],
    ),
    "hostel-approve": (
        "hostel_permissions",
        "approve",
        [
            f("code", "Permission code"),
            f("pickup_person_name", "Pickup person"),
            f(
                "pickup_relationship",
                "Relationship",
                "select",
                True,
                ["parent", "sibling", "guardian", "authorized_relative", "self"],
            ),
            f("pickup_contact", "Contact"),
        ],
    ),
    "hostel-depart": ("hostel_permissions", "edit", [f("code", "Permission code")]),
    "hostel-return": ("hostel_permissions", "edit", [f("code", "Permission code")]),
    "admission-transition": (
        "admission_applications",
        "approve",
        [
            f("code", "Application code"),
            f(
                "status",
                "Next status",
                "select",
                True,
                [
                    "submitted",
                    "documents_pending",
                    "reviewing",
                    "verified",
                    "offered",
                    "accepted",
                    "rejected",
                    "withdrawn",
                ],
            ),
            f("reason", "Reason", "textarea"),
        ],
    ),
    "student-relieve": (
        "students",
        "approve",
        [f("code", "Student code"), f("reason", "Relieving reason", "textarea")],
    ),
    "approve-leave": (
        "leave_requests",
        "approve",
        [
            f("code", "Leave request"),
            f("status", "Decision", "select", True, ["approved", "rejected"]),
        ],
    ),
    "approve-student-leave": (
        "student_leave_requests",
        "approve",
        [
            f("code", "Leave request"),
            f("status", "Decision", "select", True, ["approved", "rejected"]),
        ],
    ),
    "payroll-calculate": ("payroll_runs", "create", [f("code", "Payroll run code")]),
    "payroll-publish": ("payroll_runs", "approve", [f("code", "Payroll run code")]),
    "payroll-paid": ("payroll_runs", "approve", [f("code", "Payroll run code")]),
    "expense-pay": (
        "expenses",
        "approve",
        [
            f("code", "Expense code"),
            f("method", "Method", "select", True, ["cash", "bank_transfer", "cheque"]),
            f("reference", "Transaction reference"),
            f("paid_on", "Paid on", "date"),
        ],
    ),
    "refund": (
        "refunds",
        "create",
        [
            f("payment_code", "Original payment"),
            f("charge_code", "Charge code"),
            f("amount", "Refund amount", "number"),
            f("reason", "Reason", "textarea"),
            f("reference", "Refund reference"),
        ],
    ),
    "external-remit": (
        "external_remittances",
        "create",
        [
            f("party_code", "External party"),
            f("campus_code", "Campus code"),
            f("charge_code", "Charge code"),
            f("amount", "Amount", "number"),
            f("reference", "Transaction reference"),
        ],
    ),
    "purchase-approve": (
        "purchase_requests",
        "approve",
        [f("code", "Purchase request code")],
    ),
    "purchase-order": (
        "purchase_orders",
        "create",
        [f("request_code", "Approved request"), f("vendor_code", "Vendor code")],
    ),
    "purchase-receive": (
        "purchase_orders",
        "approve",
        [
            f("code", "Order code"),
            f("item_code", "Inventory item code"),
            f("quantity", "Quantity received", "number"),
        ],
    ),
    "stock-move": (
        "inventory_movements",
        "create",
        [
            f("item_code", "Inventory item"),
            f("movement_type", "Movement", "select", True, ["in", "out"]),
            f("quantity", "Quantity", "number"),
        ],
    ),
    "library-issue": (
        "library_loans",
        "create",
        [
            f("copy_code", "Book copy code"),
            f("student_code", "Student code"),
            f("due_on", "Due on", "date"),
        ],
    ),
    "library-return": (
        "library_loans",
        "edit",
        [f("code", "Loan code"), f("fine_amount", "Fine amount", "number")],
    ),
    "results-publish": (
        "exam_results",
        "approve",
        [f("paper_code", "Exam paper code")],
    ),
    "swap-approve": ("timetable_slots", "approve", [f("code", "Swap request code")]),
    "seat-assign": (
        "passenger_seats",
        "create",
        [
            f("seat_code", "Seat code"),
            f("route_code", "Route code"),
            f("student_code", "Student code", "text", False),
            f("employee_code", "Employee code", "text", False),
            f("start_date", "Start date", "date"),
        ],
    ),
    "invoice-settle": ("college_invoices", "approve", [f("code", "Invoice code")]),
}


def query_rows(data, table):
    return list(data["records"].get(table, {}).values())


def query_get(data, table, code):
    r = data["records"].get(table, {}).get(code)
    if not r:
        raise HTTPException(404, f"{table} record not found")
    return r


def query_save(data, table, record):
    data["records"].setdefault(table, {})[record["code"]] = record
    return record


def amount(value, positive=True):
    try:
        n = Decimal(str(value))
    except (InvalidOperation, ValueError):
        raise HTTPException(422, "Invalid amount")
    if not n.is_finite() or n < 0 or positive and n == 0 or n.as_tuple().exponent < -2:
        raise HTTPException(422, "Invalid amount or precision")
    return n


# These actions record the user in the audit log and do not write an employee FK.
USER_AUDITED_ACTIONS = {"certificate-reject", "payroll-publish", "send-fee-reminder"}


def workflow_fields(key, fields, user):
    if user.get("person_type") == "system" and key not in USER_AUDITED_ACTIONS:
        return [
            *fields,
            {
                **f("administrator_employee_code", "Administrator employee (links your account)"),
                "reference": "employees",
                "help": "Select your own employee record to link this administrator account and authorize the transaction.",
            },
        ]
    return fields


@router.get("")
def actions(request: Request, user=Depends(current_user)):
    staff_only(user)
    data = request.app.state.store.snapshot()
    return {
        "actions": [
            {
                "key": key,
                "label": key.replace("-", " ").capitalize(),
                "resource": table,
                "permission": permission,
                "fields": workflow_fields(key, fields, user),
            }
            for key, (table, permission, fields) in SPECS.items()
            if has_permission(data, user, table, permission)
        ]
    }


class WorkflowInput(StrictModel):
    values: dict = Field(default_factory=dict)


@router.post("/{action}")
def perform(
    action: str, body: WorkflowInput, request: Request, user=Depends(current_user)
):
    staff_only(user)
    if action not in SPECS:
        raise HTTPException(404, "Unknown action")
    table, permission, fields = SPECS[action]
    fields = workflow_fields(action, fields, user)
    v = dict(body.values)
    if set(v) - {f["key"] for f in fields}:
        raise HTTPException(422, "Unexpected action fields")
    for field in fields:
        if field["required"] and v.get(field["key"]) in (None, ""):
            raise HTTPException(422, field["label"] + " is required")
        if field["options"] and v.get(field["key"]) not in field["options"]:
            raise HTTPException(422, "Invalid " + field["label"])
        if field["type"] == "date":
            try:
                date.fromisoformat(v[field["key"]])
            except (ValueError, TypeError):
                raise HTTPException(422, "Invalid date")
    if action == "send-fee-reminder":
        from app.core.integrations_api import SmsInput, sms

        if not has_permission(
            request.app.state.store.snapshot(), user, table, permission
        ):
            raise HTTPException(403, "Action permission denied")
        return sms(request, SmsInput(**v), user)
    with request.app.state.store.transaction() as data:
        if not has_permission(data, user, table, permission):
            raise HTTPException(403, "Action permission denied")
        result = {}
        if user.get("person_type") == "system" and action not in USER_AUDITED_ACTIONS:
            from app.modules.access_control.role_management.api import link_bootstrap_employee

            employee_code = v.pop("administrator_employee_code")
            link_bootstrap_employee(data, user, employee_code)
            # Identity is read from the account on every request. Keep this session usable,
            # and revoke other sessions after the explicit employee-link choice.
            for session in data["sessions"].values():
                if session["user_code"] == user["code"] and session["code"] != user["session_code"]:
                    session["revoked"] = True
            actor = employee_code
            user = {**user, "person_type": "employee", "person_code": employee_code}
        else:
            actor = user.get("person_code")
        if action == "seat-release":
            allocation = query_get(data, "passenger_seats", v["code"])
            if allocation.get("end_date"):
                raise HTTPException(409, "Seat already released")
            if v["end_date"] < allocation["start_date"]:
                raise HTTPException(422, "Invalid release date")
            allocation["end_date"] = v["end_date"]
            query_get(data, "vehicle_seats", allocation["seat_code"])["status"] = (
                "available"
            )
            result = allocation
        elif action == "expense-void":
            result = query_get(data, "expenses", v["code"])
            if result.get("payment_status") != "unpaid":
                raise HTTPException(409, "Only unpaid expenses can be voided")
            result.update(payment_status="void", void_reason=v["reason"])
        elif action == "certificate-reject":
            result = query_get(data, "certificate_requests", v["code"])
            if result["status"] != "pending":
                raise HTTPException(409, "Request is not pending")
            result.update(status="rejected", rejection_reason=v["reason"])
        elif action == "purchase-pay":
            order = query_get(data, "purchase_orders", v["code"])
            if order["status"] != "received":
                raise HTTPException(409, "Order must be received and unpaid")
            req = query_get(data, "purchase_requests", order["request_code"])
            employee = query_get(data, "employees", req["employee_code"])
            expense = query_save(
                data,
                "expenses",
                {
                    "code": new_code("EXP"),
                    "campus_code": employee["campus_code"],
                    "vendor_code": order["vendor_code"],
                    "category": "equipment",
                    "description": "Purchase order " + order["code"],
                    "amount": order["amount"],
                    "currency": "INR",
                    "expense_date": v["paid_on"],
                    "approved_by_code": actor,
                    "payment_status": "paid",
                    "paid_on": v["paid_on"],
                },
            )
            query_save(
                data,
                "expense_payment_entries",
                {
                    "code": new_code("EP"),
                    "expense_code": expense["code"],
                    "method": v["method"],
                    "reference": v["reference"],
                    "paid_on": v["paid_on"],
                    "amount": order["amount"],
                },
            )
            order["status"] = "paid"
            result = order
        elif action == "fee-collect":
            from app.modules.finance.transactions.api import record_payment
            from app.workflows.schemas import PaymentInput

            try:
                payment = PaymentInput(
                    student_code=v["student_code"],
                    method=v["method"],
                    transaction_reference=v["transaction_reference"],
                    paid_on=v["paid_on"],
                    allocations={v["charge_code"]: v["amount"]},
                )
            except ValueError as e:
                raise HTTPException(422, str(e))
            result = record_payment(
                data,
                payment,
                "manual:" + v["student_code"] + ":" + v["transaction_reference"],
                user["code"],
            )
        elif action == "document-review":
            from app.modules.admissions.enrollment.api import review_admission_document
            from app.workflows.schemas import ReviewInput

            document = query_get(data, "admission_documents", v["code"])
            if v.get("original_sighted"):
                document.update(
                    original_sighted=True,
                    original_sighted_by_code=actor,
                    original_sighted_at=now(),
                )
            result = review_admission_document(
                data,
                v["code"],
                ReviewInput(status=v["status"], reason=v["reason"]),
                user,
            )
        elif action == "admission-enroll":
            from app.modules.admissions.enrollment.api import enroll_application
            from app.workflows.schemas import EnrollmentInput

            result = enroll_application(
                data,
                v["code"],
                EnrollmentInput(
                    section_code=v["section_code"],
                    roll_number=v["roll_number"],
                    student_details=v["student_details"],
                ),
                user,
            )
        elif action == "fee-discount":
            from app.modules.finance.transactions.api import record_adjustment
            from app.workflows.schemas import AdjustmentInput

            result = record_adjustment(
                data,
                AdjustmentInput(
                    charge_code=v["charge_code"],
                    adjustment_type="discount",
                    amount=amount(v["amount"]),
                    reason=v["reason"],
                ),
                user["code"],
            )
        elif action == "scholarship-approve":
            from app.modules.finance.transactions.api import approve_award
            from app.workflows.schemas import ScholarshipInput

            result = approve_award(
                data,
                ScholarshipInput(
                    student_scholarship_code=v["student_scholarship_code"],
                    allocations={v["charge_code"]: amount(v["amount"])},
                ),
                user["code"],
            )
        elif action in {"hostel-approve", "hostel-depart", "hostel-return"}:
            item = query_get(data, "hostel_permissions", v["code"])
            expected = {
                "hostel-approve": {"pending", "requested"},
                "hostel-depart": {"approved"},
                "hostel-return": {"departed"},
            }[action]
            if item["status"] not in expected:
                raise HTTPException(409, "Invalid hostel permission state")
            if action == "hostel-approve":
                item.update(
                    status="approved",
                    approved_at=now(),
                    approved_by_code=actor,
                    **{
                        k: v[k]
                        for k in [
                            "pickup_person_name",
                            "pickup_relationship",
                            "pickup_contact",
                        ]
                    },
                )
            elif action == "hostel-depart":
                item.update(status="departed", departed_at=now())
            else:
                item.update(status="returned", returned_at=now())
            result = item
        elif action == "admission-transition":
            record = query_get(data, table, v["code"])
            old = record["status"]
            target = v["status"]
            transitions = {
                "draft": ["submitted", "withdrawn"],
                "submitted": [
                    "documents_pending",
                    "reviewing",
                    "rejected",
                    "withdrawn",
                ],
                "documents_pending": ["reviewing", "rejected", "withdrawn"],
                "reviewing": ["verified", "documents_pending", "rejected", "withdrawn"],
                "verified": ["offered", "rejected", "withdrawn"],
                "offered": ["accepted", "rejected", "withdrawn"],
                "accepted": ["withdrawn"],
            }
            if target not in transitions.get(old, []):
                raise HTTPException(409, "Invalid admission status transition")
            record["status"] = target
            query_save(
                data,
                "admission_status_history",
                {
                    "code": new_code("ASH"),
                    "application_code": record["code"],
                    "old_status": old,
                    "new_status": target,
                    "actor_user_code": user["code"],
                    "reason": v["reason"],
                    "occurred_at": now(),
                },
            )
            result = record
        elif action == "student-relieve":
            record = query_get(data, "students", v["code"])
            if record["status"] == "relieved":
                raise HTTPException(409, "Already relieved")
            if any(
                balance(data, c)["outstanding"] > 0
                for c in query_rows(data, "student_fee_charges")
                if c["student_code"] == record["code"]
            ):
                raise HTTPException(409, "Outstanding fees must be settled")
            old = record["status"]
            record.update(
                status="relieved",
                relieved_on=date.today().isoformat(),
                relieving_reason=v["reason"],
            )
            for enrollment in query_rows(data, "student_enrollments"):
                if (
                    enrollment["student_code"] == record["code"]
                    and enrollment["status"] == "active"
                ):
                    enrollment["status"] = "completed"
            query_save(
                data,
                "student_status_history",
                {
                    "code": new_code("SSH"),
                    "student_code": record["code"],
                    "old_status": old,
                    "new_status": "relieved",
                    "actor_user_code": user["code"],
                    "reason": v["reason"],
                    "occurred_at": now(),
                },
            )
            result = record
        elif action in {"approve-leave", "approve-student-leave"}:
            record = query_get(data, table, v["code"])
            if record["status"] != "pending":
                raise HTTPException(409, "Request already processed")
            if record.get("employee_code") == actor:
                raise HTTPException(403, "Cannot approve your own leave")
            if v["status"] == "approved" and table == "leave_requests":
                kind = query_get(data, "leave_types", record["leave_type_code"])
                days = (
                    date.fromisoformat(record["end_date"])
                    - date.fromisoformat(record["start_date"])
                ).days + 1
                used = sum(
                    (
                        date.fromisoformat(r["end_date"])
                        - date.fromisoformat(r["start_date"])
                    ).days
                    + 1
                    for r in query_rows(data, table)
                    if r["employee_code"] == record["employee_code"]
                    and r["leave_type_code"] == record["leave_type_code"]
                    and r["status"] == "approved"
                    and r["start_date"][:4] == record["start_date"][:4]
                )
                if used + days > int(kind["annual_days"]):
                    raise HTTPException(409, "Annual leave allowance exceeded")
            record.update(status=v["status"], approved_by_code=actor)
            result = record
        elif action == "payroll-calculate":
            run = query_get(data, "payroll_runs", v["code"])
            if run["status"] not in {"draft", "pending"}:
                raise HTTPException(409, "Payroll is already calculated")
            if any(
                p["payroll_run_code"] == run["code"]
                for p in query_rows(data, "payslips")
            ):
                raise HTTPException(409, "Payslips already calculated")
            for employee in query_rows(data, "employees"):
                if (
                    employee["campus_code"] != run["campus_code"]
                    or employee["status"] != "active"
                ):
                    continue
                components = [
                    c
                    for c in query_rows(data, "employee_salary_components")
                    if c["employee_code"] == employee["code"]
                    and c["effective_from"] <= run["period_end"]
                    and (
                        not c.get("effective_to")
                        or c["effective_to"] >= run["period_start"]
                    )
                ]
                if not components:
                    raise HTTPException(
                        409, "Salary components missing for " + employee["code"]
                    )
                adjustments = [
                    c
                    for c in query_rows(data, "payroll_adjustments")
                    if c["employee_code"] == employee["code"]
                    and c["payroll_run_code"] == run["code"]
                    and c["status"] == "approved"
                ]
                gross = sum(
                    (
                        amount(c["amount"], False)
                        for c in components + adjustments
                        if c["component_type"] in {"earning", "earnings", "allowance"}
                    ),
                    Decimal("0"),
                )
                deductions = sum(
                    (
                        amount(c["amount"], False)
                        for c in components + adjustments
                        if c["component_type"] in {"deduction", "deductions"}
                    ),
                    Decimal("0"),
                )
                if deductions > gross:
                    raise HTTPException(409, "Deductions exceed earnings")
                slip = query_save(
                    data,
                    "payslips",
                    {
                        "code": new_code("SLIP"),
                        "payroll_run_code": run["code"],
                        "employee_code": employee["code"],
                        "gross_amount": str(gross),
                        "deduction_amount": str(deductions),
                        "net_amount": str(gross - deductions),
                    },
                )
                for component in components + adjustments:
                    query_save(
                        data,
                        "payslip_lines",
                        {
                            "code": new_code("LINE"),
                            "payslip_code": slip["code"],
                            "component": component["component"],
                            "component_type": component["component_type"],
                            "amount": str(component["amount"]),
                        },
                    )
            run["status"] = "calculated"
            result = run
        elif action in {"payroll-publish", "payroll-paid"}:
            run = query_get(data, "payroll_runs", v["code"])
            expected = "calculated" if action == "payroll-publish" else "published"
            if run["status"] != expected:
                raise HTTPException(409, "Unexpected payroll state")
            run["status"] = "published" if action == "payroll-publish" else "paid"
            result = run
        elif action == "expense-pay":
            expense = query_get(data, "expenses", v["code"])
            if expense.get("payment_status") in {"paid", "void"}:
                raise HTTPException(409, "Expense cannot be paid again")
            expense.update(payment_status="paid", paid_on=v["paid_on"])
            result = query_save(
                data,
                "expense_payment_entries",
                {
                    "code": new_code("EXP-PAY"),
                    "expense_code": expense["code"],
                    "method": v["method"],
                    "reference": v["reference"],
                    "paid_on": v["paid_on"],
                    "amount": expense["amount"],
                },
            )
        elif action == "refund":
            payment = query_get(data, "payments", v["payment_code"])
            charge = query_get(data, "student_fee_charges", v["charge_code"])
            n = amount(v["amount"])
            allocated = sum(
                (
                    amount(a["amount"])
                    for a in query_rows(data, "payment_allocations")
                    if a["payment_code"] == payment["code"]
                    and a["charge_code"] == charge["code"]
                ),
                Decimal("0"),
            )
            already = sum(
                (
                    amount(a["amount"])
                    for a in query_rows(data, "refund_allocations")
                    if a["charge_code"] == charge["code"]
                    and query_get(data, "refunds", a["refund_code"])["payment_code"]
                    == payment["code"]
                ),
                Decimal("0"),
            )
            if n > allocated - already:
                raise HTTPException(409, "Refund exceeds unrefunded allocation")
            if any(
                r["reference"] == v["reference"] for r in query_rows(data, "refunds")
            ):
                raise HTTPException(409, "Duplicate refund reference")
            result = query_save(
                data,
                "refunds",
                {
                    "code": new_code("REF"),
                    "payment_code": payment["code"],
                    "amount": str(n),
                    "reason": v["reason"],
                    "refunded_on": date.today().isoformat(),
                    "reference": v["reference"],
                },
            )
            query_save(
                data,
                "refund_allocations",
                {
                    "code": new_code("RA"),
                    "refund_code": result["code"],
                    "charge_code": charge["code"],
                    "amount": str(n),
                },
            )
        elif action == "external-remit":
            party = query_get(data, "external_parties", v["party_code"])
            query_get(data, "campuses", v["campus_code"])
            charge = query_get(data, "student_fee_charges", v["charge_code"])
            head = query_get(
                data,
                "fee_heads",
                query_get(data, "fee_structures", charge["fee_structure_code"])[
                    "fee_head_code"
                ],
            )
            n = amount(v["amount"])
            if (
                head["collection_ownership"] != "external"
                or head["external_party_code"] != party["code"]
            ):
                raise HTTPException(422, "Wrong external party")
            paid = balance(data, charge)["paid"]
            remitted = sum(
                (
                    amount(r["amount"])
                    for r in query_rows(data, "remittance_allocations")
                    if r["charge_code"] == charge["code"]
                ),
                Decimal("0"),
            )
            if n > paid - remitted:
                raise HTTPException(409, "Remittance exceeds collected funds")
            if any(
                r["transaction_reference"] == v["reference"]
                for r in query_rows(data, "external_remittances")
            ):
                raise HTTPException(409, "Duplicate remittance reference")
            result = query_save(
                data,
                "external_remittances",
                {
                    "code": new_code("REM"),
                    "party_code": party["code"],
                    "campus_code": v["campus_code"],
                    "amount": str(n),
                    "currency": "INR",
                    "paid_on": date.today().isoformat(),
                    "transaction_reference": v["reference"],
                    "status": "paid",
                    "approved_by_employee_code": actor,
                },
            )
            query_save(
                data,
                "remittance_allocations",
                {
                    "code": new_code("RMA"),
                    "remittance_code": result["code"],
                    "charge_code": charge["code"],
                    "amount": str(n),
                },
            )
        elif action == "purchase-approve":
            result = query_get(data, "purchase_requests", v["code"])
            if result["status"] != "pending":
                raise HTTPException(409, "Request is not pending")
            result["status"] = "approved"
        elif action == "purchase-order":
            req = query_get(data, "purchase_requests", v["request_code"])
            query_get(data, "vendors", v["vendor_code"])
            if req["status"] != "approved" or any(
                o["request_code"] == req["code"]
                for o in query_rows(data, "purchase_orders")
            ):
                raise HTTPException(409, "Request is not approved or already ordered")
            result = query_save(
                data,
                "purchase_orders",
                {
                    "code": new_code("PO"),
                    "request_code": req["code"],
                    "vendor_code": v["vendor_code"],
                    "amount": req["amount"],
                    "ordered_on": date.today().isoformat(),
                    "status": "ordered",
                },
            )
        elif action in {"purchase-receive", "stock-move"}:
            item = query_get(data, "inventory_items", v["item_code"])
            n = amount(v["quantity"])
            movement = v.get("movement_type", "in")
            if action == "purchase-receive":
                order = query_get(data, "purchase_orders", v["code"])
                if order["status"] != "ordered":
                    raise HTTPException(409, "Order already received")
                order["status"] = "received"
            current = amount(item["quantity"], False)
            if movement == "out" and current < n:
                raise HTTPException(409, "Insufficient stock")
            item["quantity"] = str(current + n if movement == "in" else current - n)
            result = query_save(
                data,
                "inventory_movements",
                {
                    "code": new_code("MOV"),
                    "item_code": item["code"],
                    "movement_type": "received" if movement == "in" else "issued",
                    "quantity": str(n),
                    "movement_date": date.today().isoformat(),
                    "employee_code": actor,
                },
            )
        elif action == "library-issue":
            copy = query_get(data, "library_copies", v["copy_code"])
            query_get(data, "students", v["student_code"])
            if copy["status"] != "available":
                raise HTTPException(409, "Book copy unavailable")
            if v["due_on"] < date.today().isoformat():
                raise HTTPException(422, "Due date is in the past")
            copy["status"] = "issued"
            result = query_save(
                data,
                "library_loans",
                {
                    "code": new_code("LOAN"),
                    "copy_code": copy["code"],
                    "student_code": v["student_code"],
                    "employee_code": None,
                    "issued_on": date.today().isoformat(),
                    "due_on": v["due_on"],
                    "returned_on": None,
                    "fine_amount": "0",
                },
            )
        elif action == "library-return":
            result = query_get(data, "library_loans", v["code"])
            if result.get("returned_on"):
                raise HTTPException(409, "Book already returned")
            result.update(
                returned_on=date.today().isoformat(),
                fine_amount=str(amount(v["fine_amount"], False)),
            )
            query_get(data, "library_copies", result["copy_code"])["status"] = (
                "available"
            )
        elif action == "results-publish":
            query_get(data, "exam_papers", v["paper_code"])
            count = 0
            for record in query_rows(data, "exam_results"):
                if record["paper_code"] == v["paper_code"]:
                    record["published"] = True
                    count += 1
            if count == 0:
                raise HTTPException(409, "No results entered")
            result = {"published": count}
        elif action == "swap-approve":
            swap = query_get(data, "timetable_swap_requests", v["code"])
            if swap["status"] != "pending":
                raise HTTPException(409, "Swap already processed")
            a = query_get(data, "timetable_slots", swap["slot_code"])
            b = query_get(data, "timetable_slots", swap["target_slot_code"])
            # Preserve times/rooms and swap offerings only after collision checks.
            for proposed, other in [(a, b), (b, a)]:
                offering = query_get(data, "subject_offerings", other["offering_code"])
                for s in query_rows(data, "timetable_slots"):
                    if (
                        s["code"] in {a["code"], b["code"]}
                        or s["weekday"] != proposed["weekday"]
                    ):
                        continue
                    o = query_get(data, "subject_offerings", s["offering_code"])
                    if max(s["start_time"], proposed["start_time"]) < min(
                        s["end_time"], proposed["end_time"]
                    ) and (
                        o["teacher_code"] == offering["teacher_code"]
                        or o["section_code"] == offering["section_code"]
                        or s["room_code"] == proposed["room_code"]
                    ):
                        raise HTTPException(409, "Swap causes a timetable collision")
            a["offering_code"], b["offering_code"] = (
                b["offering_code"],
                a["offering_code"],
            )
            swap["status"] = "approved"
            result = swap
        elif action == "seat-assign":
            seat = query_get(data, "vehicle_seats", v["seat_code"])
            query_get(data, "transport_routes", v["route_code"])
            if bool(v.get("student_code")) == bool(v.get("employee_code")):
                raise HTTPException(422, "Choose exactly one passenger")
            route = query_get(data, "transport_routes", v["route_code"])
            if route["vehicle_code"] != seat["vehicle_code"]:
                raise HTTPException(422, "Seat vehicle does not match the route")
            if any(
                r["route_code"] == v["route_code"]
                and not r.get("end_date")
                and (
                    (
                        v.get("student_code")
                        and r.get("student_code") == v["student_code"]
                    )
                    or (
                        v.get("employee_code")
                        and r.get("employee_code") == v["employee_code"]
                    )
                )
                for r in query_rows(data, "passenger_seats")
            ):
                raise HTTPException(409, "Passenger already has a seat on this route")
            if seat["status"] != "available" or any(
                s["seat_code"] == seat["code"] and not s.get("end_date")
                for s in query_rows(data, "passenger_seats")
            ):
                raise HTTPException(409, "Seat unavailable")
            query_get(
                data,
                "students" if v.get("student_code") else "employees",
                v.get("student_code") or v["employee_code"],
            )
            result = query_save(
                data,
                "passenger_seats",
                {"code": new_code("SEAT"), **v, "end_date": None},
            )
            seat["status"] = "reserved"
        elif action == "invoice-settle":
            result = query_get(data, "college_invoices", v["code"])
            if result["status"] == "paid":
                raise HTTPException(409, "Invoice already settled")
            result["status"] = "paid"
        audit(
            data,
            user["code"],
            action,
            table,
            result.get("code", v.get("code", "batch")),
        )
        return {"result": result}
