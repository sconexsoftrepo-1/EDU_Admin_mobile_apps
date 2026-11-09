"""Read-only, bounded summaries for module landing pages; existing workflows stay untouched."""
import json
import logging
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query, Request

from . import academic_progress as academics
from . import assignment_workspace as aw
from .dashboard_overview import amount, metric
from .security import current_user, has_permission
from app.modules.administration.workspace.api import SCREENS, screens as visible_screens

router = APIRouter(prefix="/dashboard/modules", tags=["Module dashboards"])
HUBS = json.loads((Path(__file__).parents[1] / "contracts/module_hubs.json").read_text())
DEFINITIONS = {s["key"]: s for s in SCREENS}
log = logging.getLogger(__name__)
PENDING = {"pending", "requested", "submitted", "in_review", "awaiting_approval", "documents_pending", "reviewing", "queued"}
DATES = ("paid_on", "expense_date", "issued_on", "applied_on", "recorded_at", "enrolled_on", "admission_date", "ordered_on", "occurred_at", "attendance_date", "sent_at", "completed_at", "requested_at", "start_date", "period_start", "date", "starts_at", "created_at")
PRIORITY = {
    "finance": ["payments", "refunds", "external_remittances", "student_fee_charges"],
    "admissions": ["admission_enquiries", "admission_applications", "enquiry_followups"],
    "academics": ["programs", "departments", "academic_years", "semesters", "teachers", "exam_results"],
    "students": ["students", "student_enrollments", "student_leave_requests", "student_attendance"],
    "hr": ["employees", "teachers", "leave_requests", "payroll_runs", "payslips"],
    "procurement": ["expenses", "purchase_requests", "purchase_orders", "vendors", "inventory_items", "asset_register"],
    "certificates": ["certificates", "certificate_requests", "certificate_signatures", "certificate_download_events"],
    "hostel": ["hostel_rooms", "hostel_beds", "hostel_allocations", "hostel_permissions"],
    "transport": ["vehicles", "transport_routes", "transport_allocations", "vehicle_trips"],
    "communication": ["announcements", "notifications", "notification_campaigns", "notification_delivery_attempts"],
    "reports": ["report_export_jobs", "report_download_events"],
    "administration": ["institutions", "campuses", "import_jobs", "documents"],
    "library": ["library_books", "library_copies", "library_loans"],
    "placements": ["placement_companies", "placement_drives", "placement_applications"],
}
LABELS = {"academic_years": "Batches", "programs": "Courses", "teachers": "Faculty", "student_leave_requests": "Student leave requests", "hostel_permissions": "Hostel leave requests"}


def label(table):
    return LABELS.get(table, table.replace("_", " ").capitalize())


def recorded(row):
    return next((str(row[k])[:10] for k in DATES if row.get(k)), "")


def year_of(row, data):
    if row.get("academic_year_code"):
        return row["academic_year_code"]
    if row.get("section_code"):
        return data["records"].get("sections", {}).get(row["section_code"], {}).get("academic_year_code")
    if row.get("fee_structure_code"):
        return data["records"].get("fee_structures", {}).get(row["fee_structure_code"], {}).get("academic_year_code")
    return None


def matches_year(row, table, year, data, memberships):
    if not year:
        return True
    records = data["records"]
    linked = year_of(row, data)
    if linked:
        return linked == year
    if table == "students":
        return row["code"] in memberships["students"]
    if table == "student_enrollments":
        return row.get("section_code") in memberships["sections"]
    if table == "payments":
        return row["code"] in memberships["payments"]
    if row.get("student_code"):
        return row["student_code"] in memberships["students"]
    if table == "academic_years":
        return row["code"] == year
    if table == "programs":
        return row["code"] == records.get("academic_years", {}).get(year, {}).get("program_code")
    # Configuration and other records without a year relationship remain current snapshots.
    return True


def finance_summary(data, allowed, year, start, end, today):
    from app.modules.finance.transactions.api import balance
    from .analytics_workspace import cashbook_section, collection_rows

    metrics, charts = [], []
    if "student_fee_charges" in allowed:
        charges = [r for r in aw.rows(data, "student_fee_charges") if not year or year_of(r, data) == year]
        if any(data["records"].get("fee_structures", {}).get(c.get("fee_structure_code"), {}).get("currency", "INR") != "INR" for c in charges):
            raise HTTPException(409, "Mixed/foreign currency ledger is not supported yet")
        # Index once, then reuse the authoritative charge calculation without rescanning each table.
        indexes = {}
        for table in ("fee_adjustments", "charge_scholarship_allocations", "payment_allocations", "refund_allocations"):
            grouped = defaultdict(dict)
            for r in aw.rows(data, table):
                grouped[r.get("charge_code")][r["code"]] = r
            indexes[table] = grouped
        totals = Counter()
        overdue = 0
        for charge in charges:
            narrow = {"records": {table: index.get(charge["code"], {}) for table, index in indexes.items()}}
            values = balance(narrow, charge)
            for key, value in values.items():
                totals[key] += value
            due = str(charge.get("due_date") or "")[:10]
            if due and due < today and values["outstanding"] > 0:
                overdue += values["outstanding"]
        for key, title in [("gross", "Gross fees"), ("outstanding", "Outstanding fees"), ("discount", "Discounts"), ("scholarship", "Scholarships")]:
            metrics.append(metric(title, str(totals[key]), "money", "Current ledger · selected academic year", "fees"))
        metrics.append(metric("Overdue fees", str(overdue), "money", "Unpaid charges with a past due date", "fees"))
    if "student_fee_charges" in allowed:
        charts.append({"title": "Outstanding fees", "kind": "money", "items": [{"label": "Overdue", "value": float(overdue)}, {"label": "Not overdue", "value": float(max(0, totals["outstanding"] - overdue))}]})
    if "payments" in allowed:
        collections = collection_rows(data)
        if year:
            # Refunds must follow the charge's academic year through refund allocations.
            collections = [r for r in collections if r["purpose"] != "Refunds"]
            refunds = data["records"].get("refunds", {})
            for allocation in aw.rows(data, "refund_allocations"):
                charge = data["records"].get("student_fee_charges", {}).get(allocation.get("charge_code"), {})
                refund = refunds.get(allocation.get("refund_code"), {})
                if year_of(charge, data) == year and refund:
                    collections.append({"date": str(refund.get("refunded_on") or "")[:10], "amount": -float(amount(allocation.get("amount"))), "year": year, "purpose": "Refunds", "method": data["records"].get("payments", {}).get(refund.get("payment_code"), {}).get("method")})
        rows = [r for r in collections if (not year or r["year"] == year) and (not start or r["date"] >= start) and (not end or r["date"] <= end)]
        metrics.insert(1, metric("Total collected", str(sum((amount(r["amount"]) for r in rows), amount(0))), "money", "Settled collections less refunds · selected period", "payments"))
        for title, field in [("Monthly collection trend", "date"), ("Collection by purpose", "purpose"), ("Collection by payment method", "method")]:
            groups = Counter()
            for r in rows:
                groups[(r[field][:7] if field == "date" else r[field]) or "Unspecified"] += r["amount"]
            entries = sorted(groups.items())[-12:] if field == "date" else groups.most_common(10)
            charts.append({"title": title, "kind": "money", "items": [{"label": k.replace("_", " ").capitalize() if field == "method" else k, "value": v} for k, v in entries]})
    if "expenses" in allowed:
        rows = [r for r in aw.rows(data, "expenses") if (not start or recorded(r) >= start) and (not end or recorded(r) <= end)]
        metrics.append(metric("Recorded expenses", str(sum((amount(r.get("amount")) for r in rows), amount(0))), "money", "Selected period · expenses have no academic year", "expenses"))
    # A partial cashbook would misrepresent cash in hand. Require all its source permissions.
    cash = cashbook_section(data, date.fromisoformat(today)) if {"payments", "refunds", "expense_payment_entries"} <= allowed else None
    return metrics, charts, cash



def activity_title(data, user, table, row):
    if row.get("title") or row.get("name"):
        return str(row.get("title") or row.get("name"))
    direct = " ".join(str(row.get(k) or "").strip() for k in ("first_name", "middle_name", "last_name")).strip()
    if direct:
        return direct
    records = data["records"]
    for field, target in (("student_code", "students"), ("employee_code", "employees"), ("vendor_code", "vendors")):
        if row.get(field) and has_permission(data, user, target, "view"):
            person = records.get(target, {}).get(row[field], {})
            name = person.get("name") or " ".join(aw.name(person).split())
            if name:
                return name
    return str(row.get("certificate_number") or row.get("description") or row.get("code") or label(table))

@router.get("/{key}")
def summary(key: str, request: Request, academic_year: str | None = Query(None, max_length=100),
            start: date | None = None, end: date | None = None, user=Depends(current_user)):
    hub = next((h for h in HUBS if h["key"] == key), None)
    if not hub:
        raise HTTPException(404, "Unknown module")
    if start and end and start > end:
        raise HTTPException(422, "From date must be on or before To date")
    visible = {s["key"]: s for s in visible_screens(request, user)["screens"]}
    destinations = [visible[s] for s in hub["screens"] if s in visible]
    if not destinations:
        raise HTTPException(403, "Module access denied")
    data = getattr(request.state, "auth_data", None) or request.app.state.store.snapshot()
    allowed = {t for s in destinations for t in s["resources"] if has_permission(data, user, t, "view")}
    # Keep the existing college-store and role scoping. Self/teaching users cannot read these tables.
    if aw.teaching(user) or user.get("workspace_scope") == "self":
        raise HTTPException(403, "This summary is for authorized college staff")
    if academic_year and academic_year not in data["records"].get("academic_years", {}):
        raise HTTPException(422, "Unknown academic year")
    start_s, end_s = start.isoformat() if start else "", end.isoformat() if end else ""
    today = academics.local_now().date().isoformat()
    memberships = {"students": set(), "payments": set(), "sections": set()}
    if academic_year:
        # Sections have no year of their own: the batch roster says which belong to this year.
        selected_year = data["records"]["academic_years"][academic_year]
        _, year_sections, _ = aw.roster(data, academic_year, selected_year.get("program_code"))
        memberships["sections"] = year_sections
        memberships["students"] = {e.get("student_code") for e in aw.rows(data, "student_enrollments") if e.get("section_code") in year_sections}
        memberships["payments"] = {a.get("payment_code") for a in aw.rows(data, "payment_allocations") if year_of(data["records"].get("student_fee_charges", {}).get(a.get("charge_code"), {}), data) == academic_year}
    rows_by_table = {}
    needed = set(PRIORITY.get(key, [])) | ({"employee_attendance"} if key == "hr" else set())
    for table in allowed & needed:
        rows_by_table[table] = [r for r in aw.rows(data, table)
            if matches_year(r, table, academic_year, data, memberships)
            and (not start_s or recorded(r) >= start_s) and (not end_s or "" < recorded(r) <= end_s)]
    if "students" in rows_by_table:
        rows_by_table["students"] = [r for r in rows_by_table["students"] if r.get("code") != "FEE-PAYERS"]
    tables = [t for t in PRIORITY.get(key, []) if t in allowed]
    metrics = [metric(label(t), len(rows_by_table[t]), module=next((s["key"] for s in destinations if t in s["resources"]), None)) for t in tables[:6]]
    charts, activity, pending_rows, warnings = [], [], [], []
    for table in tables:
        rows = rows_by_table[table]
        route = next(s["key"] for s in destinations if table in s["resources"])
        for row in rows:
            status = str(row.get("status") or "").lower()
            item = {"code": str(row.get("code", "")), "title": activity_title(data, user, table, row),
                    "type": label(table), "date": recorded(row), "status": status or "Recorded", "module": route,
                    "amount": str(row["amount"]) if row.get("amount") is not None else None,
                    "method": row.get("method")}
            if item["date"]:
                activity.append(item)
            if status in PENDING:
                pending_rows.append(item)
        field = next((f for f in ("reference_type", "program_code", "category", "status") if any(r.get(f) for r in rows)), None)
        if field and len(charts) < 2:
            counts = Counter(str(r.get(field) or "Unspecified") for r in rows)
            def group_label(value):
                return data["records"].get("programs", {}).get(value, {}).get("name", value.replace("_", " ")) if field == "program_code" else value.replace("_", " ")
            charts.append({"title": f"{label(table)} by {field.replace('_code', '').replace('_', ' ')}", "kind": "number",
                           "items": [{"label": group_label(k), "value": v} for k, v in counts.most_common(10)]})
    def add_metric(table, title, value, kind="number", hint=None):
        if table in allowed:
            route = next(s["key"] for s in destinations if table in s["resources"])
            metrics.append(metric(title, value, kind, hint, route))
    if key == "admissions" and "admission_enquiries" in allowed:
        from .admission_insights import enquiry_row, label as reference_label
        from .analytics_workspace import REFERENCE_ORDER
        rows = [enquiry_row(data, r) for r in rows_by_table["admission_enquiries"]]
        joined = sum(r["status"] == "joined" for r in rows)
        add_metric("admission_enquiries", "Admissions confirmed", joined)
        add_metric("admission_enquiries", "Conversion rate", round(joined * 100 / len(rows), 1) if rows else None, "percent")
        due = sum(bool(r.get("next_follow_up_at")) and str(r["next_follow_up_at"])[:10] <= today and enquiry_row(data, r)["status"] in {"new", "contacted", "counselling", "applied"} for r in rows_by_table["admission_enquiries"])
        add_metric("admission_enquiries", "Follow-ups due", due)
        references = Counter(r["reference_type"] for r in rows)
        charts = [c for c in charts if not c["title"].startswith("Admission enquiries by")]
        charts.insert(0, {"title": "Enquiries by reference type", "kind": "number", "items": [{"label": reference_label(k), "value": references[k]} for k in REFERENCE_ORDER + sorted(set(references) - set(REFERENCE_ORDER))]})
        if due:
            pending_rows += [{"code": r["code"], "title": r["code"], "type": "Follow-up due", "date": str(r["next_follow_up_at"])[:10], "status": "pending", "module": "admissions", "amount": None} for r in rows_by_table["admission_enquiries"] if r.get("next_follow_up_at") and str(r["next_follow_up_at"])[:10] <= today and enquiry_row(data, r)["status"] in {"new", "contacted", "counselling", "applied"}]
    if key == "academics":
        metrics = [m for m in metrics if m["label"] != label("exam_results")]
        add_metric("exam_results", "Published results", sum(bool(r.get("published")) for r in rows_by_table.get("exam_results", [])))
    if key == "academics" and "exam_results" in allowed and academics.can_view(data, user):
        try:
            progress = academics.dashboard_summary(request, user, academic_year)
            charts.append({"title": "Course performance · published results", "kind": "percent", "items": [{"label": c["name"], "value": c["percentage"]} for c in progress["course_comparison"] if c["percentage"] is not None]})
            semesters = defaultdict(lambda: [amount(0), amount(0)])
            for batch in progress["batches"]:
                for term in batch["semesters"]:
                    values = semesters[term["semester_number"]]
                    values[0] += amount(term["earned_marks"])
                    values[1] += amount(term["max_marks"])
            charts.append({"title": "Semester-wise results · published results", "kind": "percent", "items": [{"label": f"Semester {n}", "value": round(float(earned / maximum * 100), 2)} for n, (earned, maximum) in sorted(semesters.items()) if maximum]})
        except Exception:
            log.exception("Module academic performance could not be calculated")
            warnings.append("Academic performance could not be loaded. Other module figures remain available; refresh to retry.")
    if key == "students":
        metrics = [m for m in metrics if m["label"] not in {label("student_leave_requests"), label("student_attendance"), label("student_enrollments")} ]
        if "student_attendance" in allowed:
            from .dashboard_overview import attendance_section
            metrics.extend(attendance_section(data, date.fromisoformat(today), {r["code"] for r in rows_by_table.get("students", [])} if "students" in allowed else memberships["students"] if academic_year else None, academic_year, start_s, end_s)["metrics"].values())
        add_metric("student_enrollments", "Active enrollments", sum(r.get("status") == "active" for r in rows_by_table.get("student_enrollments", [])))
        add_metric("student_leave_requests", "Pending leave requests", sum(r.get("status") in PENDING for r in rows_by_table.get("student_leave_requests", [])))
    if key == "students" and {"students", "student_enrollments"} <= allowed and has_permission(data, user, "programs", "view"):
        programs = defaultdict(set)
        visible_students = {r["code"] for r in rows_by_table.get("students", [])}
        for enrollment in rows_by_table.get("student_enrollments", []):
            if enrollment.get("student_code") not in visible_students or enrollment.get("status") != "active":
                continue
            section = data["records"].get("sections", {}).get(enrollment.get("section_code"), {})
            batch = data["records"].get("batches", {}).get(section.get("batch_code"), {})
            program = data["records"].get("programs", {}).get(batch.get("program_code"), {})
            programs[program.get("name") or "Unassigned program"].add(enrollment["student_code"])
        charts.insert(0, {"title": "Students by program · active enrollments", "kind": "number", "items": [{"label": name, "value": len(students)} for name, students in sorted(programs.items())]})
    if key == "hr":
        metrics = [m for m in metrics if m["label"] not in {label("leave_requests"), label("payslips")} ]
        if "employee_attendance" in allowed:
            marked = [r for r in rows_by_table["employee_attendance"] if str(r.get("attendance_date") or "")[:10] == today]
            present = sum(r.get("status") in {"present", "late", "half_day"} for r in marked)
            add_metric("employee_attendance", "Attendance today", round(present * 100 / len(marked), 1) if marked else None, "percent", "Present out of marked employee attendance")
        add_metric("payslips", "Payroll net amount", str(sum((amount(r.get("net_amount")) for r in rows_by_table.get("payslips", [])), amount(0))), "money", "Payslips in the selected period")
        add_metric("leave_requests", "Pending leave requests", sum(r.get("status") in PENDING for r in rows_by_table.get("leave_requests", [])))
    if key == "procurement":
        metrics = [m for m in metrics if m["label"] != label("expenses")]
        add_metric("expenses", "Total expenses", str(sum((amount(r.get("amount")) for r in rows_by_table.get("expenses", [])), amount(0))), "money")
        add_metric("purchase_requests", "Pending purchase requests", sum(r.get("status") in PENDING for r in rows_by_table.get("purchase_requests", [])))
    if key == "certificates":
        add_metric("certificate_requests", "Pending requests", sum(r.get("status") == "pending" for r in rows_by_table.get("certificate_requests", [])))
        add_metric("certificate_requests", "Rejected requests", sum(r.get("status") == "rejected" for r in rows_by_table.get("certificate_requests", [])))
    if key == "hostel" and {"hostel_beds", "hostel_allocations"} <= allowed:
        metrics = [m for m in metrics if m["label"] != label("hostel_allocations")]
        beds = {r["code"]: r for r in rows_by_table["hostel_beds"]}
        allocations = [r for r in rows_by_table["hostel_allocations"] if str(r.get("start_date") or "")[:10] <= today and (not r.get("end_date") or str(r["end_date"])[:10] >= today)]
        occupied = {r.get("bed_code") for r in allocations} & beds.keys()
        add_metric("hostel_beds", "Available beds", len(beds) - len(occupied))
        add_metric("hostel_beds", "Bed occupancy", round(len(occupied) * 100 / len(beds), 1) if beds else None, "percent")
        add_metric("hostel_allocations", "Hostel students", len({r.get("student_code") for r in allocations}))
        counts = [{"label": "Occupied beds", "value": len(occupied)}, {"label": "Available beds", "value": len(beds) - len(occupied)}]
        charts.insert(0, {"title": "Hostel occupancy", "kind": "number", "items": counts})
    if key == "communication":
        add_metric("notifications", "Pending notifications", sum(r.get("status") == "queued" for r in rows_by_table.get("notifications", [])))
        channels = Counter(r.get("channel") or "Unspecified" for r in rows_by_table.get("notifications", []) if r.get("status") == "sent")
        if "notifications" in allowed:
            charts.insert(0, {"title": "Sent notifications by channel", "kind": "number", "items": [{"label": k, "value": v} for k, v in channels.items()]})
    cash = None
    if key == "finance":
        metrics, charts, cash = finance_summary(data, allowed, academic_year, start_s, end_s, today)
        if "student_fee_charges" in allowed:
            # Reuse the same indexed financial balances returned above for totals; detailed dues
            # remain in the existing register rather than returning an unbounded student list.
            overdue_metric = next((m for m in metrics if m["label"] == "Overdue fees"), None)
            if overdue_metric and amount(overdue_metric["value"]) > 0:
                pending_rows.insert(0, {"code": "overdue-fees", "title": "Review overdue fees", "type": "Fee follow-up", "date": today, "status": "overdue", "module": "fees" if "fees" in visible else next(s["key"] for s in destinations if "student_fee_charges" in s["resources"]), "amount": overdue_metric["value"]})
        # Only dated payment transactions are returned, never entire transaction tables.
        if "payments" in allowed:
            year_payments = {r.get("payment_code") for r in aw.rows(data, "payment_allocations") if year_of(data["records"].get("student_fee_charges", {}).get(r.get("charge_code"), {}), data) == academic_year} if academic_year else None
            activity = [{"code": r["code"], "title": activity_title(data, user, "payments", r), "type": "Payment", "date": str(r.get("paid_on") or "")[:10],
                         "status": r.get("status") or "Recorded", "amount": str(r.get("amount") or 0), "method": r.get("method"), "module": "payments"}
                        for r in aw.rows(data, "payments") if (year_payments is None or r["code"] in year_payments) and (not start_s or str(r.get("paid_on") or "")[:10] >= start_s) and (not end_s or str(r.get("paid_on") or "")[:10] <= end_s)]
    dated = Counter(i["date"][:7] for i in activity if i["date"])
    if key != "finance" and dated:
        charts.append({"title": "Recorded activity by month", "kind": "number", "items": [{"label": k, "value": v} for k, v in sorted(dated.items())[-12:]]})
    return {"key": key, "today": today, "warnings": warnings, "metrics": metrics, "charts": charts, "cashbook": cash,
            "recent": sorted(activity, key=lambda i: (i["date"], i["code"]), reverse=True)[:8],
            "pending": sorted(pending_rows, key=lambda i: (i["date"], i["code"]), reverse=True)[:8],
            "pending_count": len(pending_rows),
            "years": [{"code": y["code"], "name": y.get("name") or y["code"]} for y in aw.rows(data, "academic_years")] if has_permission(data, user, "academic_years", "view") or (key == "finance" and {"payments", "student_fee_charges"} & allowed) else [],
            "destinations": [s["key"] for s in destinations]}
