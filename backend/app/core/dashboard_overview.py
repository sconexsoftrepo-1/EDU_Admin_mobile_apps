"""Home dashboard figures in one request, built from the existing calculations.

A section appears only when the signed-in person may read its source. A section that fails comes
back as {"error": true}, so the page can offer a retry instead of showing a false zero.
"""
import logging
from datetime import date, datetime, timedelta
from decimal import Decimal, InvalidOperation

from fastapi import APIRouter, Depends, HTTPException, Request

from . import academic_progress as academics
from . import admission_insights as admissions
from . import assignment_workspace as aw
from . import attendance_workspace as attendance
from . import calendar_workspace as calendar
from .security import current_user, has_permission

router = APIRouter(prefix="/dashboard", tags=["Home dashboard"])
log = logging.getLogger(__name__)
ZERO = Decimal("0")
OPEN_REQUEST = {"pending", "requested", "submitted", "in_review", "reviewing", "approved"}


def amount(value):
    try:
        return Decimal(str(value if value not in (None, "") else 0))
    except InvalidOperation:
        return ZERO


def metric(label, value, kind="number", hint=None, module=None, trend=None):
    return {"label": label, "value": value, "kind": kind, "hint": hint, "module": module, "trend": trend}


def academic_session(day):
    """Indian academic session (April to March), written 2026-27."""
    start = day.year if day.month >= 4 else day.year - 1
    return f"{start}-{str(start + 1)[2:]}"


def pending(rows):
    return sum(str(r.get("status") or "").lower() in {"pending", "requested", "submitted"} for r in rows)


def finance_section(data, today):
    from app.modules.finance.transactions.api import build_ledger_index, calculate_ledger

    months = {}

    def add(month, key, value):
        row = months.setdefault(month, {"month": month, "collected": ZERO, "outstanding": ZERO})
        row[key] += value

    index = build_ledger_index(data)
    outstanding = ZERO
    for student in aw.rows(data, "students"):
        ledger = calculate_ledger(data, student["code"], index=index)
        outstanding += amount(ledger["totals"]["outstanding"])
        for charge in ledger["charges"]:
            remaining = amount(charge.get("outstanding"))
            if remaining > 0 and charge.get("due_date"):
                add(str(charge["due_date"])[:7], "outstanding", remaining)
    day = today.isoformat()
    collected = today_total = ZERO
    for payment in aw.rows(data, "payments"):
        if payment.get("status") != "settled":
            continue
        value, paid_on = amount(payment.get("amount")), str(payment.get("paid_on") or "")[:10]
        collected += value
        today_total += value if paid_on == day else ZERO
        if paid_on:
            add(paid_on[:7], "collected", value)
    for refund in aw.rows(data, "refunds"):
        value, refunded_on = amount(refund.get("amount")), str(refund.get("refunded_on") or "")[:10]
        collected -= value
        if refunded_on:
            add(refunded_on[:7], "collected", -value)
    this_month = today.strftime("%Y-%m")
    last_month = (today.replace(day=1) - timedelta(days=1)).strftime("%Y-%m")
    current = months.get(this_month, {}).get("collected", ZERO)
    previous = months.get(last_month, {}).get("collected", ZERO)
    # A trend needs a real earlier figure; without one the card simply shows none.
    trend = round(float((current - previous) * 100 / previous), 1) if previous > 0 else None
    return {
        "metrics": {
            "fee_collection": metric("Fee collection", str(collected), "money", "Settled, less refunds", "payments"),
            "outstanding_fees": metric("Outstanding fees", str(outstanding), "money", "Across student ledgers", "fees"),
            "today_collection": metric("Today's collection", str(today_total), "money", "Settled today", "payments"),
            "month_collection": metric("This month", str(current), "money", "Compared with last month" if trend is not None else "Collected this month", "payments", trend),
        },
        "monthly": [{"month": m["month"], "collected": float(m["collected"]), "outstanding": float(m["outstanding"])}
                    for m in sorted(months.values(), key=lambda m: m["month"])],
    }


def admissions_section(data):
    enquiries = aw.rows(data, admissions.TABLE)
    rows = [admissions.enquiry_row(data, e) for e in enquiries]
    total = len(rows)
    reached = lambda *statuses: sum(r["status"] in statuses for r in rows)
    joined = reached("joined")
    # Each stage counts everyone who got at least that far in the enquiry workflow.
    stages = [("Enquiries", total), ("Contacted", reached("contacted", "counselling", "applied", "joined")),
              ("Counselling", reached("counselling", "applied", "joined")), ("Applied", reached("applied", "joined")),
              ("Joined", joined)]
    recent = sorted(rows, key=lambda r: (str(r["recorded_at"] or ""), str(r["code"])), reverse=True)[:6]
    conversion = admissions.percent(joined, total)
    return {
        "metrics": {
            "enquiries": metric("Admission enquiries", total, hint=f"{joined} joined", module="admissions"),
            "applied": metric("Applications", stages[3][1], hint="Applied or joined", module="admissions"),
            "joined": metric("Admissions confirmed", joined, hint="Joined as students", module="admissions"),
            "in_progress": metric("In progress", sum(r["status"] in admissions.ACTIVE for r in rows), hint="Awaiting a decision", module="admissions"),
            "conversion": metric("Conversion rate", conversion, "percent", "Joined out of all enquiries", "admissions"),
        },
        "funnel": [{"name": name, "count": count, "percentage": admissions.percent(count, total)} for name, count in stages],
        "recent": recent,
    }


def students_section(data):
    students = [s for s in aw.rows(data, "students") if s.get("code") != "FEE-PAYERS"]
    enrolled = {e.get("student_code") for e in aw.rows(data, "student_enrollments") if e.get("status") == "active"}
    return {"metrics": {
        "students": metric("Total students", len(students), hint=f"{len(enrolled)} actively enrolled", module="students"),
        "enrolled": metric("Active enrollments", len(enrolled), hint="Students in a section", module="student-enrollment"),
    }}


def attendance_section(data, today, student_codes=None, academic_year=None, start=None, end=None):
    students = student_codes if student_codes is not None else {s["code"] for s in aw.rows(data, "students")}
    registers = attendance.all_registers(data)
    if academic_year:
        registers = [r for r in registers if r.get("academic_year_code") == academic_year]
    if start or end:
        result = attendance.summarize(registers, students, {}, start or today.isoformat(), end or today.isoformat())
        hint = "Selected period"
    else:
        day = attendance.summarize(registers, students, {}, today.isoformat(), today.isoformat())
        week = attendance.summarize(registers, students, {}, (today - timedelta(days=6)).isoformat(), today.isoformat())
        result = day if day["recorded"] else week
        hint = "Marked today" if day["recorded"] else "Last 7 days"
    recorded = result["recorded"]
    return {"metrics": {"attendance": metric("Student attendance", result["percentage"], "percent", hint if recorded else "No attendance marked for this selection", "attendance")}}


def academics_section(request, data, user):
    progress = academics.dashboard_summary(request, user, include_classes=True)
    totals = progress["totals"]
    return {
        "percentage": progress.get("college_percentage"),
        "students": totals.get("students", 0), "batches": totals.get("batches", 0),
        "backlog_students": totals.get("backlog_students", 0),
        "all_clear": totals.get("all_clear_semester_results", 0),
        "courses": [{"name": c["name"], "percentage": c["percentage"]} for c in progress.get("course_comparison", [])
                    if c.get("percentage") is not None][:5],
        "today_classes": [{key: c.get(key) for key in ("code", "subject_name", "start_time", "end_time", "state", "period")}
                          for c in progress.get("today_classes", [])][:6],
        "metrics": {"batches": metric("Active batches", totals.get("batches", 0), hint="With a current semester", module="academics"),
                    "backlogs": metric("Students with backlogs", totals.get("backlog_students", 0), hint="From published results", module="academics")},
    }


def activity_section(request, data, user, today):
    day = today.isoformat()
    events = calendar.listing(request, None, user)["items"]
    return {"items": [{"code": e.get("code"), "title": e.get("title"), "starts_at": e.get("starts_at"),
                       "detail": e.get("place") or e.get("short_description") or str(e.get("event_type") or "").capitalize()}
                      for e in events if str(e.get("starts_at") or "")[:10] >= day][:4]}


def people_section(data):
    employees = [e for e in aw.rows(data, "employees") if str(e.get("status") or "active").lower() == "active"]
    teaching = sum("non" not in str(e.get("employee_type") or "").lower() and "teach" in str(e.get("employee_type") or "").lower()
                   or e.get("code") in {t.get("employee_code") for t in aw.rows(data, "teachers")} for e in employees)
    return {"metrics": {
        "employees": metric("Total employees", len(employees), hint="Active staff", module="employees"),
        "faculty": metric("Faculty", teaching, hint="Teaching staff", module="teaching-staff"),
        "non_teaching": metric("Non-teaching staff", len(employees) - teaching, hint="Support and administration", module="non-teaching-staff"),
    }}


def counts_section(data, user):
    metrics = {}
    allowed = lambda table: has_permission(data, user, table, "view")
    if allowed("departments"):
        metrics["departments"] = metric("Departments", len(aw.rows(data, "departments")), hint="Across the college", module="academics")
    if allowed("programs"):
        metrics["courses"] = metric("Courses", len(aw.rows(data, "programs")), hint="Configured programs", module="course-setup")
    if allowed("leave_requests"):
        metrics["staff_leave"] = metric("Pending staff leave", pending(aw.rows(data, "leave_requests")), hint="Waiting for approval", module="employee-leave")
    if allowed("student_leave_requests"):
        metrics["student_leave"] = metric("Pending student leave", pending(aw.rows(data, "student_leave_requests")), hint="Waiting for approval", module="student-leave")
    if allowed("certificate_requests"):
        metrics["certificates"] = metric("Pending certificates", sum(str(r.get("status") or "").lower() in OPEN_REQUEST for r in aw.rows(data, "certificate_requests")), hint="Requests to issue", module="certificates")
    if allowed("expenses"):
        total = sum((amount(e.get("amount")) for e in aw.rows(data, "expenses")), ZERO)
        metrics["expenses"] = metric("Recorded expenses", str(total), "money", "All recorded expenses", "expenses")
    if allowed("payroll_runs"):
        runs = aw.rows(data, "payroll_runs")
        metrics["payroll_pending"] = metric("Payroll runs not closed", sum(str(r.get("status") or "").lower() not in {"paid", "closed", "completed", "finalized"} for r in runs), hint=f"{len(runs)} runs in total", module="payroll")
    if allowed("hostel_allocations") and allowed("hostel_beds"):
        beds = len(aw.rows(data, "hostel_beds"))
        used = sum(not a.get("end_date") for a in aw.rows(data, "hostel_allocations"))
        metrics["hostel"] = metric("Hostel beds in use", used, hint=f"Out of {beds} beds", module="hostels")
    return {"metrics": metrics}


def faculty_section(data, user):
    teachers = aw.teacher_codes(data, user)
    offerings = [o for o in aw.rows(data, "subject_offerings") if o.get("teacher_code") in teachers]
    return {"metrics": {
        "assigned_classes": metric("Assigned classes", len(offerings), hint="Subjects you teach", module="assignments"),
        "sections": metric("Sections", len({o.get("section_code") for o in offerings}), hint="You teach in", module="attendance"),
    }}


def viewer_of(data, user):
    records = data["records"]
    roles = [data["roles"][code] for code in data["accounts"].get(user["code"], {}).get("role_codes", []) if code in data["roles"]]
    person = records.get("employees", {}).get(user.get("person_code"), {})
    campus = next(iter(records.get("campuses", {}).values()), {})
    # Accounts without an employee record (the system login) are greeted by their role.
    name = (user.get("display_name") or " ".join(aw.name(person).split())
            or (roles[0].get("name") if roles else None) or user.get("login_id"))
    return {"name": name, "login_id": user.get("login_id"), "roles": [r.get("name") for r in roles], "campus": campus.get("name")}


@router.get("/overview")
def overview(request: Request, user=Depends(current_user)):
    if user.get("person_type") not in {"employee", "system"}:
        raise HTTPException(403, "The dashboard is for college staff")
    data = getattr(request.state, "auth_data", None) or request.app.state.store.snapshot()
    today = academics.local_now().date()
    teaching = aw.teaching(user)
    allowed = lambda table: not teaching and has_permission(data, user, table, "view")
    plan = {
        "finance": (allowed("payments"), lambda: finance_section(data, today)),
        "admissions": (allowed(admissions.TABLE), lambda: admissions_section(data)),
        "students": (allowed("students"), lambda: students_section(data)),
        "attendance": (allowed("student_attendance"), lambda: attendance_section(data, today)),
        "academics": (teaching or academics.can_view(data, user), lambda: academics_section(request, data, user)),
        "activity": (teaching or calendar.staff_can_view(data, user), lambda: activity_section(request, data, user, today)),
        "people": (allowed("employees"), lambda: people_section(data)),
        "counts": (not teaching, lambda: counts_section(data, user)),
        "faculty": (teaching, lambda: faculty_section(data, user)),
    }
    sections = {}
    for name, (permitted, build) in plan.items():
        if not permitted:
            continue
        try:
            sections[name] = build()
        except HTTPException as denied:
            if denied.status_code not in {401, 403}:
                sections[name] = {"error": True}
        except Exception:
            log.exception("Dashboard section %s failed", name)
            sections[name] = {"error": True}
    return {"viewer": viewer_of(data, user), "academic_session": academic_session(today), "today": today.isoformat(),
            "sections": sections}
