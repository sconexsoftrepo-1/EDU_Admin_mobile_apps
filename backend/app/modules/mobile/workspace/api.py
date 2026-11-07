import copy

"""Mobile screens, scoped queries and write actions kept in one endpoint file."""

from datetime import date, datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request
from pydantic import Field

from app.core.resources import CATALOG, ensure_references, validate_record
from app.core.security import StrictModel, current_user, has_permission
from app.core.storage import audit, new_code, now
from app.modules.finance.transactions.api import calculate_ledger, calculate_summary

router = APIRouter(prefix="/mobile/workspace", tags=["Mobile screen workflows"])
# Shared role descriptors are consumed by the two combined Flutter applications.
SCREENS = {
    "admin-mobile": [
        ("overview", "Overview", "summary"),
        ("dues", "Outstanding fees", "student_fee_charges"),
        ("reports", "Finance reports", "reports"),
        ("activity", "Activity and audit", "audit"),
        ("students", "Students", "students"),
        ("admissions", "Admissions", "admission_applications"),
        ("collections", "Collections and receipts", "payments"),
        ("cash", "Cash and clerk deposits", "cash"),
        ("cash-analytics", "Collection analytics", "fee_analytics"),
        ("change-requests", "Change requests", "edit_requests"),
        ("expenses", "Expenditures", "expenses"),
        ("employees", "Employees", "employees"),
        ("assessments", "Assessments and marks", "exams"),
        ("academics", "Academic progress", "exam_results"),
        ("assignments", "Assignments and review", "assignments"),
        ("hostel", "Hostel allocations", "hostel_allocations"),
        ("calendar", "Calendar and events", "calendar_events"),
        ("certificates", "Certificate approvals", "certificates"),
        ("announcements", "Announcements", "announcements"),
        ("notifications", "Notifications", "notifications"),
        ("profile", "My profile", "profile"),
    ],
    "parent-mobile": [
        ("children", "My children", "students"),
        ("profile", "My profile", "profile"),
        ("fees", "Fees and balances", "fees"),
        ("payments", "Payments and receipts", "payments"),
        ("attendance", "Attendance", "student_attendance"),
        ("leave", "Student leave", "student_leave_requests"),
        ("results", "Exam results", "exam_results"),
        ("timetable", "Timetable", "timetable_slots"),
        ("assessments", "Assessments and marks", "exams"),
        ("assignments", "Assignments and performance", "assignments"),
        ("syllabus", "Syllabus and resources", "learning_resources"),
        ("certificates", "Certificates", "certificates"),
        ("hostel", "Hostel and pickup permissions", "hostel_permissions"),
        ("transport", "Bus and route", "transport_allocations"),
        ("calendar", "Calendar and events", "calendar_events"),
        ("announcements", "Announcements", "announcements"),
        ("messages", "Teacher messages", "messages"),
        ("notifications", "Notifications", "notifications"),
    ],
    "student-mobile": [
        ("profile", "My profile", "profile"),
        ("timetable", "Timetable", "timetable_slots"),
        ("attendance", "Attendance", "student_attendance"),
        ("assessments", "Assessments and marks", "exams"),
        ("assignments", "Assignments and submissions", "assignments"),
        ("syllabus", "Syllabus and resources", "learning_resources"),
        ("results", "Exam results", "exam_results"),
        ("fees", "Fees and balances", "fees"),
        ("payments", "Payments and receipts", "payments"),
        ("certificates", "Certificates", "certificates"),
        ("leave", "Leave requests", "student_leave_requests"),
        ("library", "Library loans", "library_loans"),
        ("hostel", "Hostel permissions", "hostel_permissions"),
        ("transport", "Bus and route", "transport_allocations"),
        ("calendar", "Calendar and events", "calendar_events"),
        ("announcements", "Announcements", "announcements"),
        ("messages", "Messages", "messages"),
        ("notifications", "Notifications", "notifications"),
    ],
    "teacher-mobile": [
        ("profile", "My profile", "profile"),
        ("classes", "Assigned classes", "subject_offerings"),
        ("timetable", "Timetable and period swap", "timetable_slots"),
        ("attendance", "Attendance entry", "student_attendance"),
        ("assessments", "Assessments and marks", "exams"),
        ("assignments", "Homework and assignments", "assignments"),
        ("submissions", "Submissions and grading", "assignment_submissions"),
        ("syllabus", "Syllabus progress and resources", "learning_resources"),
        ("results", "Exam marks", "exam_results"),
        ("leave", "Leave requests", "leave_requests"),
        ("payslips", "Salary and payslips", "payslips"),
        ("tax-documents", "Form 16 and tax documents", "employee_tax_documents"),
        ("calendar", "Calendar and events", "calendar_events"),
        ("announcements", "Announcements", "announcements"),
        ("messages", "Messages", "messages"),
        ("notifications", "Notifications", "notifications"),
    ],
}


# Cash clerks sign in to the staff app; they see the cash they must deposit, not teaching screens.
CASH_CLERK_SCREENS = [
    ("profile", "My profile", "profile"),
    ("cash", "Cash deposits", "cash"),
    ("leave", "Leave requests", "leave_requests"),
    ("payslips", "Salary and payslips", "payslips"),
    ("tax-documents", "Form 16 and tax documents", "employee_tax_documents"),
    ("calendar", "Calendar and events", "calendar_events"),
    ("announcements", "Announcements", "announcements"),
    ("notifications", "Notifications", "notifications"),
]


# Lab in-charges sign in to the staff app; they see their labs instead of teaching screens.
LAB_INCHARGE_SCREENS = [
    ("profile", "My profile", "profile"),
    ("labs", "My labs and sessions", "lab_sessions"),
    ("timetable", "Lab timetable", "lab_timetable"),
    ("leave", "Leave requests", "leave_requests"),
    ("payslips", "Salary and payslips", "payslips"),
    ("tax-documents", "Form 16 and tax documents", "employee_tax_documents"),
    ("calendar", "Calendar and events", "calendar_events"),
    ("announcements", "Announcements", "announcements"),
    ("notifications", "Notifications", "notifications"),
]


def admin_collections(data):
    """Payments for the admin app: student, course, receipt number and the fees they settled."""
    from app.core.finance_pdfs import METHODS
    from app.core.student_leave_workspace import student_context
    records = data["records"]
    receipts = {r.get("payment_code"): r for r in query_rows(data, "receipts")}
    heads = {}
    for a in query_rows(data, "payment_allocations"):
        charge = records.get("student_fee_charges", {}).get(a.get("charge_code"), {})
        structure = records.get("fee_structures", {}).get(charge.get("fee_structure_code"), {})
        name = records.get("fee_heads", {}).get(structure.get("fee_head_code"), {}).get("name")
        if name:
            heads.setdefault(a.get("payment_code"), []).append(name)
    items = []
    for p in query_rows(data, "payments"):
        student = records.get("students", {}).get(p.get("student_code"), {})
        place = student_context(data, p.get("student_code")) if student else {}
        receipt = receipts.get(p["code"], {})
        items.append({**{k: v for k, v in p.items() if k not in {"request", "idempotency_key"}},
                      "title": place.get("student_name") or p.get("student_code"), "student_name": place.get("student_name"),
                      "admission_number": student.get("admission_number"), "course_name": place.get("course_name"),
                      "receipt_number": receipt.get("receipt_number"),
                      "fee_heads": ", ".join(dict.fromkeys(heads.get(p["code"], []))),
                      "body": " · ".join(x for x in (student.get("admission_number"), place.get("course_name"),
                                                     receipt.get("receipt_number") and f"Receipt {receipt['receipt_number']}",
                                                     ", ".join(dict.fromkeys(heads.get(p["code"], []))),
                                                     METHODS.get(p.get("method"), p.get("method"))) if x)})
    return sorted(items, key=lambda r: str(r.get("paid_on") or ""), reverse=True)


def admin_can_view(data, user, resource):
    """Admin app screens. The college finance overview and reports are fee totals, so anyone who
    may view fee charges or payments sees them as well as holders of the reports permission."""
    if resource == "audit":
        return has_permission(data, user, "audit", "view")
    if resource == "cash":
        from app.core.cash_custody import can_manage
        return can_manage(data, user)
    if resource == "edit_requests":  # only the Super Admin decides change requests
        from app.core.edit_approvals import is_super_admin
        return is_super_admin(data, user)
    if resource == "fee_analytics":
        return has_permission(data, user, "payments", "view")
    if resource in {"summary", "reports"}:
        return any(has_permission(data, user, table, "view")
                   for table in ("reports", "student_fee_charges", "payments"))
    return has_permission(data, user, resource, "view")


def client_screens(data, user):
    from app.core.cash_custody import is_clerk
    from app.core.lab_workspace import is_lab_incharge
    client = effective_client(user)
    if client == "teacher-mobile" and is_clerk(data, user):
        return CASH_CLERK_SCREENS
    if client == "teacher-mobile" and is_lab_incharge(data, user):
        return LAB_INCHARGE_SCREENS
    return SCREENS.get(client, [])


def weekly_for(data, user, context, offerings):
    """Published weekly timetable entries for the signed-in person's section(s)."""
    from app.core.timetable_templates import weekly_timetable
    if user.get("person_type") in {"student", "parent"}:
        student = context.get("student")
        sections = {e["section_code"] for e in query_rows(data, "student_enrollments")
                    if e.get("student_code") == student and e.get("status") == "active"}
        return weekly_timetable(data, sections) if sections else []
    own = [o for o in query_rows(data, "subject_offerings") if o["code"] in offerings]
    if not own:
        return []
    subjects = {}
    for o in own:
        subjects.setdefault(o["section_code"], set()).add(o["subject_code"])
    return weekly_timetable(data, set(subjects), subjects_for=subjects)


def describe_offering(data, offering):
    """An assigned class with readable names: subject, section, course, batch and class size."""
    records = data["records"]
    subject = records.get("subjects", {}).get(offering.get("subject_code"), {})
    section = records.get("sections", {}).get(offering.get("section_code"), {})
    batch = records.get("batches", {}).get(section.get("batch_code"), {})
    program = records.get("programs", {}).get(batch.get("program_code"), {})
    semester = records.get("semesters", {}).get(section.get("semester_code"), {})
    from app.core.timetable_templates import year_for_batch
    year = year_for_batch(data, batch) or {}
    students = sum(1 for e in query_rows(data, "student_enrollments")
                   if e.get("section_code") == offering.get("section_code") and e.get("status") == "active")
    return {**offering, "subject_name": subject.get("name"), "subject_type": subject.get("subject_type"),
            "section_name": section.get("name"), "course_name": program.get("name"),
            "academic_year_name": year.get("name") or batch.get("name"),
            "semester_number": semester.get("semester_number"), "students": students}


def query_rows(data, table):
    return list(data["records"].get(table, {}).values())


def query_get(data, table, code):
    record = data["records"].get(table, {}).get(code)
    if not record:
        raise HTTPException(404, "Record not found")
    return record


def query_save(data, table, record):
    data["records"].setdefault(table, {})[record["code"]] = record
    return record


def effective_client(user):
    if user["client"] == "admin-web" and user.get("workspace_scope") in {
        "teaching",
        "self",
    }:
        return "teacher-mobile"
    if user["client"] == "admin-web" and user["person_type"] in {"student", "parent"}:
        return user["person_type"] + "-mobile"
    return user["client"]


def active_context(data, user, student_code=None):
    kind = user["person_type"]
    own = user["person_code"]
    client = effective_client(user)
    children = (
        {
            r["student_code"]
            for r in query_rows(data, "student_parents")
            if r["parent_code"] == own
        }
        if kind == "parent"
        else {own}
        if kind == "student"
        else set()
    )
    if student_code and student_code not in children:
        raise HTTPException(404, "Student not found")
    selected = student_code or next(iter(sorted(children)), None)
    if (
        client == "student-mobile"
        and kind != "student"
        or client == "parent-mobile"
        and kind != "parent"
        or client == "teacher-mobile"
        and kind != "employee"
    ):
        raise HTTPException(403, "Account type does not match the application")
    teachers = {
        r["code"] for r in query_rows(data, "teachers") if r["employee_code"] == own
    }
    offerings = {
        r["code"]
        for r in query_rows(data, "subject_offerings")
        if r["teacher_code"] in teachers
    }
    selected_enrollments = {
        r["code"]
        for r in query_rows(data, "student_enrollments")
        if r["student_code"] == selected and r["status"] == "active"
    }
    selected_sections = {
        r["section_code"]
        for r in query_rows(data, "student_enrollments")
        if r["code"] in selected_enrollments
    }
    if kind in {"student", "parent"}:
        offerings = {
            r["code"]
            for r in query_rows(data, "subject_offerings")
            if r["section_code"] in selected_sections
        }
    sections = {
        r["section_code"]
        for r in query_rows(data, "subject_offerings")
        if r["code"] in offerings
    }
    class_students = {
        r["student_code"]
        for r in query_rows(data, "student_enrollments")
        if r["section_code"] in sections and r["status"] == "active"
    }
    return {
        "student": selected,
        "children": children,
        "offerings": offerings,
        "class_students": class_students,
        "sections": sections,
    }


def clean(record):
    return {
        k: v
        for k, v in record.items()
        if k
        not in {
            "storage_key",
            "password_hash",
            "request",
            "refresh_hash",
            "verification_token",
        }
    }


def field(key, label, kind="text", required=True, options=None):
    return {
        "key": key,
        "label": label,
        "type": kind,
        "required": required,
        "options": options or [],
    }


def contact_detail(data, account, context):
    """Why a contact is listed: the subjects a teacher takes, or the student and class."""
    records = data["records"]
    section_names = {s["code"]: s.get("name", "") for s in query_rows(data, "sections")}
    student_sections = {}
    for e in query_rows(data, "student_enrollments"):
        if e.get("status") == "active" and e["section_code"] in context["sections"]:
            student_sections.setdefault(e["student_code"], set()).add(section_names.get(e["section_code"], ""))

    def student_label(code):
        s = records.get("students", {}).get(code, {})
        name = f"{s.get('first_name', '')} {s.get('last_name', '')}".strip() or code
        classes = ", ".join(sorted(n for n in student_sections.get(code, set()) if n))
        return f"{name} · {classes}" if classes else name

    if account["person_type"] == "employee":
        teacher_codes = {t["code"] for t in query_rows(data, "teachers") if t["employee_code"] == account["person_code"]}
        subjects = sorted({
            records.get("subjects", {}).get(o["subject_code"], {}).get("name", o["subject_code"])
            for o in query_rows(data, "subject_offerings")
            if o["teacher_code"] in teacher_codes and o["code"] in context["offerings"]
        })
        return "Teacher · " + ", ".join(subjects) if subjects else "Teacher"
    if account["person_type"] == "parent":
        kids = [r["student_code"] for r in query_rows(data, "student_parents")
                if r["parent_code"] == account["person_code"] and r["student_code"] in context["class_students"]]
        return "Parent of " + "; ".join(student_label(k) for k in kids) if kids else "Parent"
    return "Student · " + student_label(account["person_code"]).split(" · ", 1)[-1] if account["person_code"] in student_sections else "Student"


def account_name(data, account_code):
    """Display name of an account's person (falls back to the login ID)."""
    account = data["accounts"].get(account_code) or {}
    table = {"student": "students", "parent": "parents", "employee": "employees"}.get(account.get("person_type"))
    person = data["records"].get(table, {}).get(account.get("person_code"), {}) if table else {}
    return (f"{person.get('first_name', '')} {person.get('last_name', '')}").strip() or account.get("login_id") or account_code


def contacts(data, user, context):
    people = set()
    if effective_client(user) == "teacher-mobile":
        people |= {("student", code) for code in context["class_students"]}
        people |= {
            ("parent", r["parent_code"])
            for r in query_rows(data, "student_parents")
            if r["student_code"] in context["class_students"]
        }
    else:
        teachers = {
            r["teacher_code"]
            for r in query_rows(data, "subject_offerings")
            if r["code"] in context["offerings"]
        }
        people |= {
            ("employee", r["employee_code"])
            for r in query_rows(data, "teachers")
            if r["code"] in teachers
        }
    result = []
    for account in data["accounts"].values():
        if (
            not account["active"]
            or account["code"] == user["code"]
            or (account["person_type"], account["person_code"]) not in people
        ):
            continue
        table = {"student": "students", "parent": "parents", "employee": "employees"}[
            account["person_type"]
        ]
        person = data["records"].get(table, {}).get(account["person_code"], {})
        result.append(
            {
                "code": account["code"],
                "name": (
                    person.get("first_name", "") + " " + person.get("last_name", "")
                ).strip()
                or account["person_code"],
                "role": {"employee": "teacher"}.get(account["person_type"], account["person_type"]),
                "detail": contact_detail(data, account, context),
            }
        )
    return result


ACTION_FIELDS = {
    "send_alert": [field("recipient_user_code", "Recipient"), field("title", "Title"),
                   field("body", "Alert message", "textarea"), field("push", "Also send a push notification", "boolean", False)],
    "create_event": [
        field("campus_code", "Campus"), field("title", "Event title"),
        field("starts_at", "Starts", "datetime-local"), field("ends_at", "Ends", "datetime-local"),
        field("event_type", "Event type", "select", True, ["holiday", "academic", "cultural", "sports", "meeting"]),
    ],
    "publish_announcement": [
        field("campus_code", "Campus"), field("title", "Title"), field("body", "Announcement", "textarea"),
    ],
    "make_payment": [
        field("charge_code", "Fee charge code"),
        field("amount", "Amount to pay", "number"),
    ],
    "start_thread": [
        field("recipient_user_code", "Recipient"),
        field("subject", "Subject"),
        field("body", "Message", "textarea"),
    ],
    "change_password": [
        field("current_password", "Current password", "password"),
        field("new_password", "New password (12 or more characters)", "password"),
    ],
    "request_leave": [
        field("leave_type_code", "Leave type code"),
        field("start_date", "From", "date"),
        field("end_date", "To", "date"),
        field("reason", "Reason", "textarea"),
    ],
    "request_student_leave": [
        field("start_date", "From", "date"),
        field("end_date", "To", "date"),
        field("reason", "Reason", "textarea"),
    ],
    "request_certificate": [
        field("type_code", "Certificate type code"),
        field("roll_number", "Roll number"),
        field("reason", "Reason", "textarea"),
    ],
    "request_hostel_permission": [
        field("leave_at", "Departure", "datetime-local"),
        field("return_at", "Expected return", "datetime-local"),
        field("reason", "Reason", "textarea"),
        field("pickup_person_name", "Pickup person"),
        field(
            "pickup_relationship",
            "Relationship",
            "select",
            True,
            ["parent", "sibling", "guardian", "authorized_relative", "self"],
        ),
        field("pickup_contact", "Pickup contact"),
    ],
    "submit_assignment": [
        field("assignment_code", "Assignment code"),
        field("document_url", "Submission link"),
    ],
    "create_assignment": [
        field("offering_code", "Assigned subject offering"),
        field("title", "Title"),
        field("instructions", "Instructions", "textarea"),
        field("due_at", "Due at", "datetime-local"),
        field("max_marks", "Maximum marks", "number"),
    ],
    "record_attendance": [
        field("session_code", "Attendance session code"),
        field("student_code", "Student code"),
        field(
            "status",
            "Attendance",
            "select",
            True,
            ["present", "absent", "late", "excused"],
        ),
        field("remarks", "Remarks", "textarea", False),
    ],
    "create_session": [
        field("offering_code", "Assigned subject offering"),
        field("session_date", "Session date", "date"),
        field("start_time", "Start time", "time"),
        field("end_time", "End time", "time"),
    ],
    "grade_submission": [
        field("submission_code", "Submission code"),
        field("marks", "Marks", "number"),
        field("feedback", "Feedback", "textarea", False),
    ],
    "record_marks": [
        field("paper_code", "Exam paper code"),
        field("student_code", "Student code"),
        field("marks", "Marks", "number"),
        field("grade", "Grade"),
        field("is_absent", "Absent", "boolean", False),
    ],
    "publish_resource": [
        field("offering_code", "Subject offering"),
        field("title", "Topic / syllabus progress"),
        field("resource_url", "Resource link"),
        field(
            "resource_type",
            "Type",
            "select",
            True,
            ["document", "video", "link", "other"],
        ),
    ],
    "request_swap": [
        field("slot_code", "Your timetable slot"),
        field("target_slot_code", "Requested slot"),
        field("reason", "Reason", "textarea"),
    ],
    "send_message": [
        field("thread_code", "Message thread code"),
        field("body", "Message", "textarea"),
    ],
    "read_notification": [field("notification_code", "Notification code")],
}


# Provider/security actions have fixed contracts; custom data belongs to business forms.
FIXED_ACTIONS = {"make_payment", "change_password", "send_alert", "create_event", "publish_announcement", "read_notification"}
FORM_ACTIONS = set(ACTION_FIELDS) - FIXED_ACTIONS


def allowed_actions(screen, user):
    if screen == "profile":
        return ["change_password"]
    if effective_client(user) == "teacher-mobile":
        return {
            "leave": ["request_leave"],
            "assignments": ["create_assignment"],
            "submissions": ["grade_submission"],
            "attendance": ["create_session", "record_attendance"],
            "results": ["record_marks"],
            "syllabus": ["publish_resource"],
            "timetable": ["request_swap"],
            "messages": ["start_thread", "send_message"],
            "notifications": ["read_notification"],
        }.get(screen, [])
    if effective_client(user) in {"parent-mobile", "student-mobile"}:
        result = {
            "fees": ["make_payment"],
            "leave": ["request_student_leave"],
            "certificates": ["request_certificate"],
            "hostel": ["request_hostel_permission"],
            "messages": ["start_thread", "send_message"],
            "notifications": ["read_notification"],
        }.get(screen, [])
        if screen == "assignments" and effective_client(user) == "student-mobile":
            result = ["submit_assignment"]
        return result
    return {"notifications": ["read_notification", "send_alert"], "calendar": ["create_event"],
            "announcements": ["publish_announcement"]}.get(screen, [])


@router.get("/screens")
def screen_list(request: Request, user=Depends(current_user)):
    if effective_client(user) not in SCREENS:
        raise HTTPException(403, "Mobile session required")
    data = request.app.state.store.snapshot()
    return {
        "screens": [
            {"key": k, "title": title, "resource": resource}
            for k, title, resource in client_screens(data, user)
            if effective_client(user) != "admin-mobile"
            or resource == "profile"
            or admin_can_view(data, user, resource)
        ]
    }


@router.get("/{screen}")
def screen_data(
    screen: str,
    request: Request,
    student_code: str | None = None,
    from_date: date | None = None,
    to_date: date | None = None,
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    user=Depends(current_user),
):
    data = request.app.state.store.snapshot()
    definitions = {
        key: (title, resource)
        for key, title, resource in client_screens(data, user)
    }
    if screen not in definitions:
        raise HTTPException(404, "Screen not available")
    if definitions[screen][1] in {"fee_analytics", "edit_requests"}:
        # Drawn by the app from /finance/fee-payments/analytics and /edit-requests.
        return {"screen": screen, "title": definitions[screen][0], "items": [], "total": 0, "students": [],
                "actions": [], "lookups": {}, "summary": None}
    if definitions[screen][1] == "cash" and effective_client(user) == "admin-mobile":
        from app.core.cash_custody import overview as cash_overview
        result = cash_overview(request, user)
        review = sum(1 for t in result["transfers"] for d in t["deposits"] if d["status"] == "awaiting_review")
        return {"screen": screen, "title": definitions[screen][0], "items": [], "total": 0, "students": [],
                "actions": [], "lookups": {}, "summary": {"with_admin": result["with_admin"], "with_clerks": result["with_clerks"],
                                                          "to_review": review}}
    if definitions[screen][1] == "cash":
        # The staff app draws this screen itself from /finance/cash/overview; this is its summary.
        from app.core.cash_custody import overview as cash_overview
        result = cash_overview(request, user)
        mine = [t for t in result["transfers"] if t["clerk_account"] == user["code"]]
        return {"screen": screen, "title": definitions[screen][0], "items": mine, "total": len(mine), "students": [],
                "actions": [], "lookups": {}, "summary": {"in_hand": result["my_in_hand"],
                "to_collect": sum(1 for t in mine if t["status"] == "assigned"),
                "to_upload": sum(1 for t in mine for d in t["deposits"] if d["status"] in {"awaiting_proof", "rejected"})}}
    if definitions[screen][1] in {"lab_sessions", "lab_timetable"}:
        from app.core.academic_progress import local_now
        from app.core.lab_workspace import day_sessions, employee_labs, view, weekly_sessions
        labs = employee_labs(data, user["person_code"])
        if definitions[screen][1] == "lab_timetable":
            items = weekly_sessions(data, user["person_code"], labs)
            return {"screen": screen, "title": definitions[screen][0], "items": items, "total": len(items),
                    "students": [], "actions": [], "lookups": {}, "summary": None}
        day = from_date or local_now().date()
        items = day_sessions(data, user["person_code"], day)
        return {"screen": screen, "title": definitions[screen][0], "items": items, "total": len(items),
                "students": [], "actions": [], "lookups": {"labs": [view(data, lab) for lab in labs]},
                "summary": {"date": day.isoformat(), "labs": len(labs), "sessions": len(items),
                            "students": sum(i["counts"]["total"] for i in items),
                            "present": sum(i["counts"]["present"] + i["counts"]["late"] for i in items),
                            "absent": sum(i["counts"]["absent"] for i in items)}}
    if screen == "academics":
        from app.core.academic_progress import overview as academic_overview
        result=academic_overview(request,student_code=student_code,user=user)
        return {"screen":screen,"title":"Academic progress","items":[],"total":0,"students":result['children'],"actions":[],"lookups":{},"summary":result['totals']}
    if screen == "assessments":
        from app.core.assessment_workspace import listing as assessment_listing
        result = assessment_listing(request, student_code, user)
        return {"screen":screen,"title":"Assessments","items":result["items"][offset:offset+limit],"total":len(result["items"]),"students":result["students"],"actions":[],"lookups":{},"summary":result["performance"],"selected_student_code":student_code}
    context = active_context(data, user, student_code)
    title, table = definitions[screen]
    selected = context["student"]
    offerings = context["offerings"]
    teacher = effective_client(user) == "teacher-mobile"
    admin = effective_client(user) == "admin-mobile"
    summary = None
    items = []
    if admin:
        if table != "profile" and not admin_can_view(data, user, table):
            raise HTTPException(403, "Screen permission denied")
        if table in {"summary", "reports"}:
            summary = calculate_summary(data)
        elif table == "audit":
            items = data["audit"][::-1]
        elif table == "profile":
            items = [data["records"].get("employees", {}).get(user["person_code"], {})]
        elif table == "notifications":
            items = [r for r in query_rows(data, table) if r["user_code"] == user["code"]]
        elif screen == "dues":
            from app.core.student_leave_workspace import student_context
            for student in query_rows(data, "students"):
                ledger = calculate_ledger(data, student["code"])
                if Decimal(ledger["totals"]["outstanding"]) > 0:
                    place = student_context(data, student["code"])
                    items.append(
                        {
                            "student_code": student["code"],
                            "name": student["first_name"] + " " + student["last_name"],
                            "admission_number": student.get("admission_number"),
                            "course_name": place.get("course_name"),
                            "body": " · ".join(x for x in (student.get("admission_number"), place.get("course_name"),
                                                         place.get("academic_year_name"),
                                                         f"Paid ₹{ledger['totals']['paid']} of ₹{ledger['totals']['gross']}") if x),
                            **ledger["totals"],
                        }
                    )
            items.sort(key=lambda r: -Decimal(r["outstanding"]))
        elif screen == "collections":
            items = admin_collections(data)
        elif screen == "expenses":
            vendors = data["records"].get("vendors", {})
            items = sorted(({**r, "title": vendors.get(r.get("vendor_code"), {}).get("name") or r.get("description") or r.get("category"),
                             "body": " · ".join(str(x) for x in (r.get("category"), r.get("description"),
                                                                 str(r.get("payment_status") or "").title()) if x)}
                            for r in query_rows(data, "expenses")), key=lambda r: str(r.get("expense_date") or ""), reverse=True)
        else:
            items = query_rows(data, table)
    elif table == "profile":
        entity = {"employee": "employees", "student": "students", "parent": "parents"}[
            user["person_type"]
        ]
        item = data["records"].get(entity, {}).get(user["person_code"])
        items = [item] if item else []
    elif screen == "children":
        items = [
            r for r in query_rows(data, "students") if r["code"] in context["children"]
        ]
    elif table == "fees":
        if selected:
            summary = calculate_ledger(data, selected)
            items = summary.pop("charges")
    elif table == "subject_offerings":
        items = [describe_offering(data, r) for r in query_rows(data, table) if r["code"] in offerings]
    elif table == "timetable_slots" and (weekly := weekly_for(data, user, context, offerings)):
        # The published weekly timetable (repeats every week of the semester).
        items = weekly
    elif table in {
        "timetable_slots",
        "assignments",
        "learning_resources",
        "attendance_sessions",
    }:
        items = [r for r in query_rows(data, table) if r["offering_code"] in offerings]
    elif table == "student_attendance":
        sessions = {
            r["code"]
            for r in query_rows(data, "attendance_sessions")
            if r["offering_code"] in offerings
        }
        items = [
            r
            for r in query_rows(data, table)
            if r["session_code"] in sessions
            and (teacher or r["student_code"] == selected)
        ]
    elif table == "assignment_submissions":
        assignments = {
            r["code"]
            for r in query_rows(data, "assignments")
            if r["offering_code"] in offerings
        }
        items = [
            r
            for r in query_rows(data, table)
            if r["assignment_code"] in assignments
            and (teacher or r["student_code"] == selected)
        ]
    elif table == "exam_results":
        papers = {
            r["code"]
            for r in query_rows(data, "exam_papers")
            if r["offering_code"] in offerings
        }
        items = [
            r
            for r in query_rows(data, table)
            if r["paper_code"] in papers
            and (teacher or r["student_code"] == selected and r["published"])
        ]
    elif table in {
        "student_leave_requests",
        "hostel_permissions",
        "transport_allocations",
        "library_loans",
    }:
        items = [
            r for r in query_rows(data, table) if r.get("student_code") == selected
        ]
    elif table == "payments":
        # Each payment also lists the fees it settled, so the app can show what was paid for.
        charges = {c["code"]: c for c in query_rows(data, "student_fee_charges") if c.get("student_code") == selected}
        structures = {s["code"]: s for s in query_rows(data, "fee_structures")}
        heads = {h["code"]: h for h in query_rows(data, "fee_heads")}

        def head_name(charge_code):
            charge = charges.get(charge_code, {})
            structure = structures.get(charge.get("fee_structure_code"), {})
            return heads.get(structure.get("fee_head_code"), {}).get("name") or charge.get("description") or "Fee"

        allocations = {}
        for a in query_rows(data, "payment_allocations"):
            if a.get("charge_code") in charges:
                allocations.setdefault(a["payment_code"], []).append(
                    {"charge_code": a["charge_code"], "amount": a["amount"], "fee_head": head_name(a["charge_code"]),
                     "semester_number": charges[a["charge_code"]].get("semester_number")})
        items = [
            {
                **r,
                "receipts": [
                    clean(x)
                    for x in query_rows(data, "receipts")
                    if x["payment_code"] == r["code"]
                ],
                "allocations": allocations.get(r["code"], []),
            }
            for r in query_rows(data, table)
            if r["student_code"] == selected
        ]
    elif table == "certificates":
        requests = {
            r["code"]
            for r in query_rows(data, "certificate_requests")
            if r["student_code"] == selected
        }
        items = [r for r in query_rows(data, table) if r["request_code"] in requests]
        items += [
            {**r, "record_type": "request"}
            for r in query_rows(data, "certificate_requests")
            if r["student_code"] == selected
            and not any(c["request_code"] == r["code"] for c in items)
        ]
    elif table == "leave_requests":
        from app.core.hr_workspace import leave_balances
        from app.core.hr_workspace import month_attendance
        from datetime import date as _date
        summary = {"leave_balances": leave_balances(data, user["person_code"]),
                   "attendance": month_attendance(data, user["person_code"], _date.today().strftime("%Y-%m"))}
        types = {t["code"]: t for t in query_rows(data, "leave_types")}
        items = [
            {**r, "leave_type_name": types.get(r.get("leave_type_code"), {}).get("name")}
            for r in query_rows(data, table)
            if r["employee_code"] == user["person_code"]
        ]
    elif table == "payslips":
        published = {
            r["code"]
            for r in query_rows(data, "payroll_runs")
            if r["status"] in {"published", "paid"}
        }
        items = [
            {
                **r,
                "lines": [
                    x
                    for x in query_rows(data, "payslip_lines")
                    if x["payslip_code"] == r["code"]
                ],
            }
            for r in query_rows(data, table)
            if r["employee_code"] == user["person_code"]
            and r["payroll_run_code"] in published
        ]
        from app.core.payroll_workspace import payslip_view, salary_structure
        items = [{**payslip_view(data, r), "lines": r["lines"]} for r in items]
        items.sort(key=lambda r: str(r.get("period_start") or ""), reverse=True)
        from app.core.hr_workspace import adjustments, staff_kind
        employee = data["records"].get("employees", {}).get(user["person_code"], {})
        summary = {"structure": salary_structure(data, user["person_code"]),
                   "adjustments": adjustments(data, user["person_code"]),
                   "staff_kind": staff_kind(data, employee)}
    elif table == "employee_tax_documents":
        from app.core.payroll_workspace import form16_statement
        items = []
        for r in query_rows(data, table):
            if r["employee_code"] != user["person_code"] or not r.get("published_at") or r.get("deleted_at"):
                continue
            row = {k: v for k, v in r.items() if k != "storage_key"}
            try:  # Part B figures for the financial year, shown above the download
                st = form16_statement(data, r["employee_code"], r["financial_year"])
                row["statement"] = {"assessment_year": st["assessment_year"], "months": st["months"],
                                    "period_from": st["period_from"], "period_to": st["period_to"],
                                    "gross": str(st["gross"]), "tax": str(st["tax"]),
                                    "other_deductions": str(st["other_deductions"]), "net": str(st["net"]),
                                    "earnings": [{"component": k, "amount": str(v)} for k, v in sorted(st["earnings"].items())],
                                    "deductions": [{"component": k, "amount": str(v)} for k, v in sorted(st["deductions"].items())],
                                    "quarters": [{"quarter": k, "amount": str(v)} for k, v in st["quarters"].items()]}
            except Exception:
                pass
            items.append(row)
        items.sort(key=lambda r: (str(r.get("financial_year")), r.get("revision") or 0), reverse=True)
    elif table in {"calendar_events", "announcements"}:
        campus_codes = set()
        entity = {"employee": "employees", "student": "students", "parent": "parents"}[
            user["person_type"]
        ]
        person = data["records"].get(entity, {}).get(user["person_code"], {})
        if person.get("campus_code"):
            campus_codes.add(person["campus_code"])
        for child in context["children"]:
            s = data["records"].get("students", {}).get(child, {})
            if s.get("campus_code"):
                campus_codes.add(s["campus_code"])
        scoped_students = set()
        if user.get("person_type") == "student" and context.get("student"):
            scoped_students = {context["student"]}
        elif user.get("person_type") == "parent":
            scoped_students = set(context.get("children", []))
        from app.core.calendar_workspace import matches as event_matches
        items = [
            r
            for r in query_rows(data, table)
            if (r["campus_code"] in campus_codes
                or table == "calendar_events" and r.get("audience_type"))
            and (table != "calendar_events" or user.get("person_type") not in {"student", "parent"}
                 or event_matches(data, r, scoped_students))
            and (
                table != "announcements"
                or r.get("published_at")
                and r["published_at"] <= now()
            )
        ]
    elif table == "messages":
        threads = {
            r["thread_code"]
            for r in query_rows(data, "thread_members")
            if r["user_code"] == user["code"]
        }
        subjects = {t["code"]: t.get("subject", "") for t in query_rows(data, "message_threads") if t["code"] in threads}
        members = {}
        for m in query_rows(data, "thread_members"):
            if m["thread_code"] in threads:
                members.setdefault(m["thread_code"], []).append(m["user_code"])
        items = [
            {
                **r,
                "thread_subject": subjects.get(r["thread_code"], ""),
                "sender_name": account_name(data, r["sender_code"]),
                "mine": r["sender_code"] == user["code"],
                "with": [account_name(data, m) for m in members.get(r["thread_code"], []) if m != user["code"]],
            }
            for r in query_rows(data, table)
            if r["thread_code"] in threads
        ]
    elif table == "notifications":
        items = [r for r in query_rows(data, table) if r["user_code"] == user["code"]]
    if table == "assignments":
        from app.core.assignment_workspace import listing as assignment_listing
        items = assignment_listing(request, student_code, user)["items"]
    if table == "exam_results" and user.get("person_type") in {"student", "parent"}:
        from app.core.assignment_workspace import listing as assignment_listing
        assignment_grades = assignment_listing(request, student_code, user)["items"]
        for assignment in assignment_grades:
            submission = assignment.get("my_submission")
            if submission and submission.get("marks") is not None:
                items.append({"code": submission["code"], "title": assignment["title"], "assessment_type": "assignment",
                              "marks_obtained": submission["marks"], "marks": submission["marks"], "subject": assignment["title"], "max_marks": assignment["max_marks"],
                              "feedback": submission.get("feedback"), "reviewed_at": submission.get("reviewed_at")})
    if table == "exam_results" and user.get("person_type") in {"student", "parent"}:
        from app.core.assessment_workspace import listing as assessment_listing
        for assessment in assessment_listing(request, student_code, user)["items"]:
            for student, mark in assessment["marks"].items():
                if mark.get("marks") is not None or mark.get("absent"):
                    items.append({"code":assessment["code"]+"-"+student,"student_code":student,"title":assessment["title"],"assessment_type":"assessment","subject":assessment["subject_name"],"marks_obtained":mark.get("marks"),"marks":mark.get("marks"),"max_marks":assessment["max_marks"],"absent":mark.get("absent"),"feedback":mark.get("feedback"),"reviewed_at":mark.get("reviewed_at")})
    if table == "calendar_events":
        if from_date and to_date and (to_date < from_date or (to_date - from_date).days > 366):
            raise HTTPException(422, "Choose a calendar range of up to one year")
        items = [r for r in items
                 if (not from_date or datetime.fromisoformat(r["ends_at"]).date() >= from_date)
                 and (not to_date or datetime.fromisoformat(r["starts_at"]).date() <= to_date)]
        items.sort(key=lambda r: r["starts_at"])
    elif table in {"notifications", "announcements", "messages", "payments", "student_leave_requests", "leave_requests"}:
        items.sort(key=lambda r: str(r.get("sent_at") or r.get("published_at") or r.get("paid_on") or r.get("requested_at") or r.get("start_date") or ""), reverse=True)
    for index, item in enumerate(items):
        offering_code = item.get("offering_code")
        if table == "subject_offerings":
            offering_code = item["code"]
        if item.get("session_code"):
            session = data["records"].get("attendance_sessions", {}).get(item["session_code"], {})
            offering_code = session.get("offering_code")
            item = {**item, "session_date": session.get("session_date")}
        if item.get("paper_code"):
            paper = data["records"].get("exam_papers", {}).get(item["paper_code"], {})
            offering_code = paper.get("offering_code")
        offering = data["records"].get("subject_offerings", {}).get(offering_code) if offering_code else None
        if offering:
            subject = data["records"].get("subjects", {}).get(offering["subject_code"], {})
            item = {**item, "subject": subject.get("name", offering["subject_code"])}
        if item.get("student_code"):
            pupil = data["records"].get("students", {}).get(item["student_code"], {})
            item = {**item, "student_name": (pupil.get("first_name", "") + " " + pupil.get("last_name", "")).strip()}
        items[index] = item
    actions = [
        {
            "key": a,
            "label": a.replace("_", " ").capitalize(),
            "fields": copy.deepcopy(ACTION_FIELDS[a]),
        }
        for a in allowed_actions(screen, user)
        if a not in {"create_event", "publish_announcement", "send_alert"}
        or has_permission(data, user, {"create_event": "calendar_events", "publish_announcement": "announcements", "send_alert": "notifications"}[a], "create")
    ]
    def named(rows, name):
        return [{"code": r["code"], "name": name(r)} for r in rows]

    for action in actions:
        if action["key"] in FIXED_ACTIONS:
            continue
        form = next(
            (
                f
                for f in data["forms"].values()
                if f["screen"] == "mobile." + action["key"] and f["published"]
            ),
            None,
        )
        if form:
            base = {f["key"]: f for f in action["fields"]}
            for custom in form["fields"]:
                if custom["key"] in base:
                    original = base[custom["key"]]
                    original["label"] = custom["label"]
                    original["required"] = original["required"] or custom["required"]
                else:
                    action["fields"].append(custom)
            action["form_revision"] = form["revision"]
    # Every form receives only records the current identity can act on.
    needed = {f["key"] for action in actions for f in action["fields"]}
    assignments = [r for r in query_rows(data, "assignments") if r["offering_code"] in offerings] if needed & {"assignment_code", "submission_code"} else []
    assignment_codes = {r["code"] for r in assignments}
    submissions = [r for r in query_rows(data, "assignment_submissions")
                   if r["assignment_code"] in assignment_codes and (teacher or r["student_code"] == selected)] if "submission_code" in needed else []
    sessions = [r for r in query_rows(data, "attendance_sessions") if r["offering_code"] in offerings] if "session_code" in needed else []
    papers = [r for r in query_rows(data, "exam_papers") if r["offering_code"] in offerings] if "paper_code" in needed else []
    slots = [r for r in query_rows(data, "timetable_slots") if r["offering_code"] in offerings] if "slot_code" in needed else []
    own_threads = {r["thread_code"] for r in query_rows(data, "thread_members") if r["user_code"] == user["code"]} if "thread_code" in needed else set()
    return {
        "screen": screen,
        "title": title,
        "items": [clean(r) for r in items[offset : offset + limit]],
        "total": len(items),
        "summary": summary,
        "actions": actions,
        "students": [
            {"code": r["code"], "name": r["first_name"] + " " + r["last_name"]}
            for r in query_rows(data, "students")
            if r["code"] in context["children"]
        ],
        "lookups": {
            "contacts": named([a for a in data["accounts"].values() if a["active"]], lambda a: a["login_id"]) if admin and has_permission(data, user, "notifications", "create") else contacts(data, user, context),
            "offerings": [
                {**clean(r), "name": data["records"].get("subjects", {}).get(r["subject_code"], {}).get("name", r["subject_code"]) + " / " + r["section_code"]}
                for r in query_rows(data, "subject_offerings")
                if r["code"] in offerings
            ],
            "students": [
                {"code": r["code"], "name": r["first_name"] + " " + r["last_name"]}
                for r in query_rows(data, "students")
                if r["code"] in context["class_students"]
            ],
            "leave_types": query_rows(data, "leave_types") if "leave_type_code" in needed else [],
            "certificate_types": query_rows(data, "certificate_types") if "type_code" in needed else [],
            "campuses": named(query_rows(data, "campuses") if admin else [], lambda r: r.get("name", r["code"])),
            "charges": named(items if screen == "fees" else [], lambda r: r.get("description", r.get("fee_head", r["code"])) + " — " + str(r.get("outstanding", ""))),
            "assignments": named(assignments, lambda r: r["title"]),
            "submissions": named(submissions, lambda r: r["student_code"] + " / " + r["assignment_code"]),
            "sessions": named(sessions, lambda r: r.get("session_date", r["code"]) + " / " + r["offering_code"]),
            "papers": named(papers, lambda r: r.get("title", r.get("name", r["code"]))),
            "slots": named(slots, lambda r: r["offering_code"] + " / " + str(r.get("weekday", "")) + " / " + r.get("start_time", "")),
            "swap_slots": named([r for r in query_rows(data, "timetable_slots")
                                 if r["offering_code"] in {o["code"] for o in query_rows(data, "subject_offerings")
                                                         if o["section_code"] in context["sections"]}] if "target_slot_code" in needed else [],
                                lambda r: r["offering_code"] + " / " + str(r.get("weekday", "")) + " / " + r.get("start_time", "")),
            "threads": named([r for r in query_rows(data, "message_threads") if r["code"] in own_threads] if "thread_code" in needed else [], lambda r: r["subject"]),
        },
        "selected_student_code": selected,
        "downloads": {
            "payslips": "payslip",
            "tax-documents": "tax-document",
            "certificates": "certificate",
            "collections": "receipt",
            "payments": "receipt",
        }.get(screen),
    }


class ActionInput(StrictModel):
    form_revision: int | None = None
    values: dict = Field(default_factory=dict)
    student_code: str | None = None


@router.post("/{screen}/actions/{action}", status_code=201)
def mobile_action(
    screen: str,
    action: str,
    body: ActionInput,
    request: Request,
    background: BackgroundTasks,
    user=Depends(current_user),
):
    if action not in allowed_actions(screen, user):
        raise HTTPException(403, "Action not available")
    allowed = {f["key"] for f in ACTION_FIELDS[action]}
    bound = next(
        (
            f
            for f in request.app.state.store.snapshot()["forms"].values()
            if f["screen"] == "mobile." + action and f["published"]
        ),
        None,
    )
    if action in FIXED_ACTIONS:
        bound = None
    if (
        set(body.values)
        - allowed
        - ({f["key"] for f in bound["fields"]} if bound else set())
    ):
        raise HTTPException(422, "Unexpected input fields")
    for f in ACTION_FIELDS[action]:
        if f["options"] and body.values.get(f["key"]) not in f["options"]:
            raise HTTPException(422, "Invalid " + f["label"])
        if f["type"] == "number":
            try:
                number = Decimal(str(body.values.get(f["key"])))
            except Exception:
                raise HTTPException(422, "Invalid numeric value")
            if not number.is_finite():
                raise HTTPException(422, "Invalid numeric value")
        if f["required"] and body.values.get(f["key"]) in (None, ""):
            raise HTTPException(422, f"{f['label']} is required")
    if action == "send_alert":
        from app.core.push_api import AlertInput, send_alert
        if not has_permission(request.app.state.store.snapshot(), user, "notifications", "create"):
            raise HTTPException(403, "Create permission denied")
        try:
            alert = AlertInput(**body.values)
        except ValueError:
            raise HTTPException(422, "Invalid alert details")
        return send_alert(alert, request, user)
    if action == "make_payment":
        from app.core.integrations_api import OrderInput, order

        context = active_context(
            request.app.state.store.snapshot(), user, body.student_code
        )
        if not context["student"]:
            raise HTTPException(422, "Select a student")
        try:
            payment = OrderInput(
                student_code=context["student"],
                charge_code=body.values["charge_code"],
                amount=body.values["amount"],
            )
        except ValueError:
            raise HTTPException(422, "Invalid payment amount")
        return order(request, payment, user)
    with request.app.state.store.transaction() as data:
        if action in {"create_event", "publish_announcement"}:
            table = "calendar_events" if action == "create_event" else "announcements"
            if not has_permission(data, user, table, "create"):
                raise HTTPException(403, "Create permission denied")
            record = {k: value for k, value in body.values.items() if k in allowed}
            record["code"] = new_code("MOB")
            if action == "publish_announcement":
                record["published_at"] = now()
                record["author_code"] = user["person_code"]
            else:
                try:
                    if datetime.fromisoformat(record["ends_at"]) <= datetime.fromisoformat(record["starts_at"]):
                        raise ValueError()
                except (ValueError, TypeError):
                    raise HTTPException(422, "Event end must be after its start")
            record = validate_record(table, record)
            ensure_references(data, table, record)
            query_save(data, table, record)
            audit(data, user["code"], action, table, record["code"])
            return {"record": clean(record)}
        if action == "change_password":
            from app.core.security import check_password, hasher, revoke_user

            account = data["accounts"][user["code"]]
            if not check_password(
                str(body.values["current_password"]), account["password_hash"]
            ):
                raise HTTPException(401, "Current password incorrect")
            new_password = str(body.values["new_password"])
            if not 12 <= len(new_password) <= 128:
                raise HTTPException(422, "Password must be 12–128 characters")
            account["password_hash"] = hasher.hash(new_password)
            revoke_user(data, user["code"])
            audit(data, user["code"], "password_changed", "accounts", user["code"])
            return {"reauthenticate": True}
        context = active_context(data, user, body.student_code)
        form = next(
            (
                f
                for f in data["forms"].values()
                if f["screen"] == "mobile." + action and f["published"]
            ),
            None,
        )
        if form and body.form_revision != form["revision"]:
            raise HTTPException(409, "Form changed; reload before saving")
        v = {k: value for k, value in body.values.items() if k in allowed}
        selected = context["student"]
        table = ""
        record = {}
        key = new_code("MOB")

        def own_offering(code):
            if code not in context["offerings"]:
                raise HTTPException(403, "Not an assigned subject")

        if action == "request_leave":
            table = "leave_requests"
            record = {**v, "employee_code": user["person_code"], "status": "pending"}
        elif action == "request_student_leave":
            if not selected:
                raise HTTPException(422, "Select a student")
            table = "student_leave_requests"
            record = {**v, "student_code": selected, "status": "pending"}
        elif action == "request_certificate":
            if not any(
                r["student_code"] == selected
                and r["roll_number"] == v["roll_number"]
                and r["status"] == "active"
                for r in query_rows(data, "student_enrollments")
            ):
                raise HTTPException(
                    422, "Roll number does not match an active enrollment"
                )
            query_get(data, "certificate_types", v["type_code"])
            table = "certificate_requests"
            record = {k: x for k, x in v.items() if k != "roll_number"}
            record.update(
                student_code=selected,
                requested_on=date.today().isoformat(),
                status="pending",
            )
        elif action == "request_hostel_permission":
            if not any(
                r["student_code"] == selected
                and (not r.get("end_date") or r["end_date"] >= date.today().isoformat())
                for r in query_rows(data, "hostel_allocations")
            ):
                raise HTTPException(409, "No active hostel allocation")
            table = "hostel_permissions"
            record = {**v, "student_code": selected, "status": "pending"}
        elif action == "create_assignment":
            own_offering(v["offering_code"])
            table = "assignments"
            record = v.copy()
        elif action == "create_session":
            own_offering(v["offering_code"])
            table = "attendance_sessions"
            record = {
                **v,
                "recorded_by_code": query_get(
                    data, "subject_offerings", v["offering_code"]
                )["teacher_code"],
            }
        elif action == "record_attendance":
            session = query_get(data, "attendance_sessions", v["session_code"])
            own_offering(session["offering_code"])
            offering = query_get(data, "subject_offerings", session["offering_code"])
            if not any(
                e["student_code"] == v["student_code"]
                and e["section_code"] == offering["section_code"]
                and e["status"] == "active"
                for e in query_rows(data, "student_enrollments")
            ):
                raise HTTPException(403, "Student not in this class")
            existing = next(
                (
                    r
                    for r in query_rows(data, "student_attendance")
                    if r["student_code"] == v["student_code"]
                    and r["session_code"] == v["session_code"]
                ),
                None,
            )
            if existing:
                key = existing["code"]
            table = "student_attendance"
            record = v.copy()
        elif action == "submit_assignment":
            assignment = query_get(data, "assignments", v["assignment_code"])
            own_offering(assignment["offering_code"])
            if datetime.fromisoformat(
                assignment["due_at"].replace("Z", "+00:00")
            ).astimezone(timezone.utc) < datetime.now(timezone.utc):
                raise HTTPException(409, "Assignment deadline has passed")
            existing = next(
                (
                    r
                    for r in query_rows(data, "assignment_submissions")
                    if r["student_code"] == selected
                    and r["assignment_code"] == v["assignment_code"]
                ),
                None,
            )
            if existing:
                if existing.get("marks") is not None:
                    raise HTTPException(409, "Graded submission is locked")
                key = existing["code"]
            table = "assignment_submissions"
            record = {**v, "student_code": selected, "submitted_at": now()}
        elif action == "grade_submission":
            record = query_get(
                data, "assignment_submissions", v["submission_code"]
            ).copy()
            assignment = query_get(data, "assignments", record["assignment_code"])
            own_offering(assignment["offering_code"])
            marks = Decimal(str(v["marks"]))
            if (
                not marks.is_finite()
                or marks < 0
                or marks > Decimal(str(assignment["max_marks"]))
            ):
                raise HTTPException(422, "Marks outside permitted range")
            record.update(marks=str(marks), feedback=v.get("feedback"))
            key = record["code"]
            table = "assignment_submissions"
        elif action == "record_marks":
            paper = query_get(data, "exam_papers", v["paper_code"])
            own_offering(paper["offering_code"])
            offering = query_get(data, "subject_offerings", paper["offering_code"])
            if not any(
                e["student_code"] == v["student_code"]
                and e["section_code"] == offering["section_code"]
                and e["status"] == "active"
                for e in query_rows(data, "student_enrollments")
            ):
                raise HTTPException(403, "Student not in this paper class")
            marks = Decimal(str(v["marks"]))
            if not marks.is_finite() or not 0 <= marks <= Decimal(
                str(paper["max_marks"])
            ):
                raise HTTPException(422, "Marks outside permitted range")
            old = next(
                (
                    r
                    for r in query_rows(data, "exam_results")
                    if r["paper_code"] == v["paper_code"]
                    and r["student_code"] == v["student_code"]
                ),
                None,
            )
            if old:
                if old["published"]:
                    raise HTTPException(409, "Published result is locked")
                key = old["code"]
            table = "exam_results"
            record = {**v, "published": False}
        elif action == "publish_resource":
            own_offering(v["offering_code"])
            table = "learning_resources"
            record = v.copy()
        elif action == "request_swap":
            slot = query_get(data, "timetable_slots", v["slot_code"])
            own_offering(slot["offering_code"])
            query_get(data, "timetable_slots", v["target_slot_code"])
            table = "timetable_swap_requests"
            record = {
                **v,
                "requested_by_user_code": user["code"],
                "status": "pending",
                "requested_at": now(),
            }
        elif action == "start_thread":
            if v["recipient_user_code"] not in {
                r["code"] for r in contacts(data, user, context)
            }:
                raise HTTPException(
                    403, "Recipient is not connected to your classes or children"
                )
            thread = query_save(
                data,
                "message_threads",
                {
                    "code": new_code("THREAD"),
                    "subject": v["subject"],
                    "created_by_code": user["code"],
                },
            )
            for participant in {user["code"], v["recipient_user_code"]}:
                query_save(
                    data,
                    "thread_members",
                    {
                        "code": new_code("TM"),
                        "thread_code": thread["code"],
                        "user_code": participant,
                    },
                )
            table = "messages"
            record = {
                "thread_code": thread["code"],
                "sender_code": user["code"],
                "body": v["body"],
                "sent_at": now(),
            }
        elif action == "send_message":
            if not any(
                r["thread_code"] == v["thread_code"] and r["user_code"] == user["code"]
                for r in query_rows(data, "thread_members")
            ):
                raise HTTPException(403, "You are not a thread participant")
            table = "messages"
            record = {**v, "sender_code": user["code"], "sent_at": now()}
        elif action == "read_notification":
            record = query_get(data, "notifications", v["notification_code"]).copy()
            if record["user_code"] != user["code"]:
                raise HTTPException(404, "Notification not found")
            record["status"] = "read"
            key = record["code"]
            table = "notifications"
        record["code"] = key
        # Marking read only changes the status; notifications may carry extra links (fee reminders
        # keep charge / semester details), so they are not re-validated against the base schema.
        if table in CATALOG and action != "read_notification":
            record = validate_record(table, record)
            ensure_references(data, table, record)
        if form:
            from app.modules.access_control.forms.api import Service as FormService
            from app.modules.access_control.forms.schemas import SubmissionInput

            submitted = FormService().submit(
                data,
                form["code"],
                SubmissionInput(
                    revision=form["revision"],
                    values={
                        f["key"]: body.values.get(f["key"]) for f in form["fields"]
                    },
                ),
                user["code"],
            )
            submitted["entity_code"] = record["code"]
        query_save(data, table, record)
        audit(data, user["code"], action, table, key)
        notices = []
        if action in {"start_thread", "send_message"}:
            sender = account_name(data, user["code"])
            for member in query_rows(data, "thread_members"):
                if member["thread_code"] == record["thread_code"] and member["user_code"] != user["code"]:
                    code = new_code("MNOTICE")
                    data["records"].setdefault("notifications", {})[code] = {
                        "code": code, "user_code": member["user_code"], "title": f"New message from {sender}",
                        "body": str(record.get("body", ""))[:160], "channel": "in_app", "status": "sent",
                        "sent_at": now(), "screen": "messages", "thread_code": record["thread_code"],
                    }
                    notices.append(code)
        result = {"record": clean(record)}
    if notices:
        from app.core.certificate_workspace import push
        background.add_task(push, request, notices)
    return result
