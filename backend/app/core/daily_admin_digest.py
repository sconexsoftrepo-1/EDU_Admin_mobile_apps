"""Previous-day finance and admissions digest for active administrators."""
from datetime import datetime, time, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

from app.core.email_delivery import send_email
from app.modules.reports.downloads.api import cash_entries

TZ = ZoneInfo("Asia/Kolkata")


def build(data, day):
    records = data["records"]
    programs = records.get("programs", {})
    structures = records.get("fee_structures", {})
    students = records.get("students", {})
    years = records.get("academic_years", {})
    enrollments = records.get("student_enrollments", {})
    student_program = {e.get("student_code"): e.get("program_code") for e in enrollments.values() if e.get("status") == "active"}
    payments = [p for p in records.get("payments", {}).values() if str(p.get("paid_on", ""))[:10] == day]
    by_mode, by_course, by_branch, by_year = {}, {}, {}, {}
    total = Decimal("0")
    student_codes = set()
    for p in payments:
        amount = Decimal(str(p.get("amount") or 0)); total += amount
        student = p.get("student_code"); student_codes.add(student) if student else None
        enrollment = next((e for e in enrollments.values() if e.get("student_code") == student and e.get("status") == "active"), {})
        allocations = [a for a in records.get("payment_allocations", {}).values() if a.get("payment_code") == p.get("code")]
        charge = records.get("student_fee_charges", {}).get(allocations[0].get("charge_code"), {}) if allocations else {}
        structure = structures.get(charge.get("fee_structure_code"), {})
        program_code = structure.get("program_code") or enrollment.get("program_code") or student_program.get(student)
        year_code = structure.get("academic_year_code") or enrollment.get("academic_year_code")
        program = programs.get(program_code, {})
        mode = str(p.get("method") or "unspecified"); by_mode[mode] = by_mode.get(mode, Decimal("0")) + amount
        for agg, name in ((by_course, program.get("name") or "Unassigned course"),
                          (by_branch, program.get("branch") or program.get("branch_code") or "Unassigned branch"),
                          (by_year, years.get(year_code, {}).get("name") or year_code or "Unassigned year")):
            agg[name] = agg.get(name, Decimal("0")) + amount
    applications = [r for r in records.get("admission_applications", {}).values() if str(r.get("applied_on", ""))[:10] == day]
    admissions_by_course = {}
    for r in applications:
        name = programs.get(r.get("program_code"), {}).get("name") or "Unassigned course"
        admissions_by_course[name] = admissions_by_course.get(name, 0) + 1
    enquiries = [r for r in records.get("admission_enquiries", {}).values() if str(r.get("recorded_at", ""))[:10] == day]
    changes = [r for r in records.get("edit_requests", {}).values() if str(r.get("requested_at", ""))[:10] == day]
    entries = cash_entries(data)
    cash = [e for e in entries if str(e.get("date", ""))[:10] <= day]
    opening = sum((Decimal(str(e.get("receipt") or 0))-Decimal(str(e.get("payment") or 0)) for e in cash if str(e["date"])[:10] < day), Decimal("0"))
    received = sum((Decimal(str(e.get("receipt") or 0)) for e in cash if str(e["date"])[:10] == day), Decimal("0"))
    paid = sum((Decimal(str(e.get("payment") or 0)) for e in cash if str(e["date"])[:10] == day), Decimal("0"))
    deposits = []
    for transfer in data.get("documents", {}).get("cash_transfers", {}).values():
        for dep in transfer.get("deposits", []):
            if dep.get("status") == "accepted" and str(dep.get("deposited_on", ""))[:10] == day:
                deposits.append(dep)
    deposited = sum((Decimal(str(d.get("amount") or 0)) for d in deposits), Decimal("0"))
    closing = opening + received - paid - deposited
    return {"day": day, "payment_total": total, "students": len(student_codes), "payments": len(payments),
            "by_mode": by_mode, "by_course": by_course, "by_branch": by_branch, "by_year": by_year,
            "applications": len(applications), "admissions_by_course": admissions_by_course,
            "enquiries": len(enquiries), "change_requests": len(changes), "deposits": deposited,
            "deposit_count": len(deposits), "opening": opening, "cash_received": received,
            "cash_paid": paid, "closing": closing, "tomorrow_opening": closing}


def deliver(store, settings, day):
    with store.transaction() as data:
        marker = data.setdefault("documents", {}).setdefault("daily_admin_digest", {})
        if marker.get("sent_for") == day:
            return False
        report = build(data, day)
        admins = [a.get("email") for code, a in data.get("accounts", {}).items()
                  if a.get("active") and a.get("email") and any(data.get("roles", {}).get(r, {}).get("system_admin") for r in a.get("role_codes", []))]
        marker["sent_for"] = day
    def rows(title, values):
        if not values: return f"<p><b>{title}:</b> No activity</p>"
        return "<p><b>"+title+"</b></p><ul>"+"".join(f"<li>{k}: ₹{v:,.2f}</li>" for k,v in sorted(values.items()))+"</ul>"
    rupee = lambda n: f"₹{n:,.2f}"
    from datetime import date as _date
    report_date = _date.fromisoformat(day)
    date_heading = report_date.strftime("%A, %d %B %Y")
    from app.core.email_layout import logo_url
    logo = logo_url(settings)
    subject = f"Daily college analytics · {date_heading}"
    html = ((f"<div style='text-align:center'><img src='{logo}' alt='Pragathi logo' width='140'></div>" if logo else "")
            + f"<h1>Pragathi Educational Institutions</h1><h2>Daily Analytics Report</h2><h3>Report date: {date_heading}</h3><p>Payments received: {rupee(report['payment_total'])} across {report['payments']} payments from {report['students']} students.</p>"
            + rows("Payment mode", report["by_mode"]) + rows("Course", report["by_course"])
            + rows("Branch", report["by_branch"]) + rows("Academic year", report["by_year"])
            + f"<p>Admissions: {report['applications']} applications and {report['enquiries']} enquiries.</p>"
            + rows("Admissions by course", report["admissions_by_course"])
            + f"<p>Change requests raised: {report['change_requests']}<br>Clerk deposits accepted: {report['deposit_count']} totaling {rupee(report['deposits'])}.</p>"
            + f"<p>Cash opening: {rupee(report['opening'])}<br>Cash received: {rupee(report['cash_received'])}<br>Cash paid: {rupee(report['cash_paid'])}<br>Closing balance: {rupee(report['closing'])}<br>Tomorrow opening balance: {rupee(report['tomorrow_opening'])}</p>")
    text = f"Daily college analytics — {day}\nPayments {rupee(report['payment_total'])}; {report['students']} students; {report['payments']} payments. Admissions {report['applications']} applications, {report['enquiries']} enquiries. Change requests {report['change_requests']}. Clerk deposits {rupee(report['deposits'])}. Cash opening {rupee(report['opening'])}, closing {rupee(report['closing'])}; tomorrow opening {rupee(report['tomorrow_opening'])}."
    for email in admins:
        send_email(settings, email, subject, text, html)
    return bool(admins)


def previous_day(now=None):
    return ((now or datetime.now(TZ)).astimezone(TZ).date() - timedelta(days=1)).isoformat()


def seconds_until_next_run(now=None):
    now = (now or datetime.now(TZ)).astimezone(TZ)
    next_run = datetime.combine(now.date() + timedelta(days=1), time(0, 5), TZ)
    return max(1, (next_run-now).total_seconds())
