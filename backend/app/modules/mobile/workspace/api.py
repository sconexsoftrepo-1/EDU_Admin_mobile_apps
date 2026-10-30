import copy

"""Mobile screens, scoped queries and write actions kept in one endpoint file."""

from datetime import date, datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, Request
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
        ("expenses", "Expenditures", "expenses"),
        ("employees", "Employees", "employees"),
        ("assignments", "Assignments and review", "assignments"),
        ("hostel", "Hostel allocations", "hostel_allocations"),
        ("calendar", "Calendar and events", "calendar_events"),
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
            for k, title, resource in SCREENS[effective_client(user)]
            if effective_client(user) != "admin-mobile"
            or resource == "profile"
            or has_permission(
                data,
                user,
                "audit"
                if resource == "audit"
                else "reports"
                if resource in {"summary", "reports"}
                else resource,
                "view",
            )
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
    definitions = {
        key: (title, resource)
        for key, title, resource in SCREENS.get(effective_client(user), [])
    }
    if screen not in definitions:
        raise HTTPException(404, "Screen not available")
    data = request.app.state.store.snapshot()
    context = active_context(data, user, student_code)
    title, table = definitions[screen]
    selected = context["student"]
    offerings = context["offerings"]
    teacher = effective_client(user) == "teacher-mobile"
    admin = effective_client(user) == "admin-mobile"
    summary = None
    items = []
    if admin:
        permission = (
            "audit"
            if table == "audit"
            else "reports"
            if table in {"summary", "reports"}
            else table
        )
        if table != "profile" and not has_permission(data, user, permission, "view"):
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
            for student in query_rows(data, "students"):
                ledger = calculate_ledger(data, student["code"])
                if Decimal(ledger["totals"]["outstanding"]) > 0:
                    items.append(
                        {
                            "student_code": student["code"],
                            "name": student["first_name"] + " " + student["last_name"],
                            **ledger["totals"],
                        }
                    )
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
        items = [r for r in query_rows(data, table) if r["code"] in offerings]
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
        items = [
            {
                **r,
                "receipts": [
                    clean(x)
                    for x in query_rows(data, "receipts")
                    if x["payment_code"] == r["code"]
                ],
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
        items = [
            r
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
    elif table == "employee_tax_documents":
        items = [
            r
            for r in query_rows(data, table)
            if r["employee_code"] == user["person_code"] and r.get("published_at")
        ]
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
        items = [
            r
            for r in query_rows(data, table)
            if r["campus_code"] in campus_codes
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
        items = [r for r in query_rows(data, table) if r["thread_code"] in threads]
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
        if table in CATALOG:
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
        return {"record": clean(record)}
