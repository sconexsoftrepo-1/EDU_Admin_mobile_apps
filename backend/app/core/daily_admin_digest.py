"""Previous-day finance and admissions digest for active administrators."""
from datetime import datetime, time, timedelta
import base64
from decimal import Decimal
from html import escape
from pathlib import Path
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
    enquiries = [r for r in records.get("admission_enquiries", {}).values() if str(r.get("recorded_at", ""))[:10] == day]
    admission_counts = {}
    for kind, rows in (("Application", applications), ("Enquiry", enquiries)):
        for row in rows:
            program = programs.get(row.get("program_code"), {})
            year_code = row.get("academic_year_code")
            key = (kind, program.get("name") or "Unassigned course",
                   program.get("branch") or program.get("branch_code") or "Unassigned branch",
                   years.get(year_code, {}).get("name") or year_code or "Unassigned year")
            admission_counts[key] = admission_counts.get(key, 0) + 1
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
            "applications": len(applications), "admissions_breakdown": admission_counts,
            "enquiries": len(enquiries), "change_requests": len(changes), "deposits": deposited,
            "deposit_count": len(deposits), "opening": opening, "cash_received": received,
            "cash_paid": paid, "closing": closing, "tomorrow_opening": closing}


def render_email(report, settings):
    from datetime import date as _date
    from app.core.email_layout import logo_url
    rupee = lambda n: f"₹{n:,.2f}"
    report_date = _date.fromisoformat(report["day"])
    date_heading = report_date.strftime("%A, %d %B %Y")
    logo = "cid:pragathi-emblem"
    navy, gold, pale, ink, muted = "#17356b", "#b87924", "#f4f7fb", "#202b3c", "#65748b"
    def table(headers, rows):
        if not rows: rows = [["—" for _ in headers]]
        th = "".join(f"<th style='padding:10px 12px;text-align:left;background:{navy};color:#fff;font-size:12px'>{escape(str(h))}</th>" for h in headers)
        trs = "".join("<tr>"+"".join(f"<td style='padding:10px 12px;border-bottom:1px solid #e3e8ef;color:{ink};font-size:13px'>{escape(str(v))}</td>" for v in row)+"</tr>" for row in rows)
        return f"<table role='presentation' width='100%' cellpadding='0' cellspacing='0' style='border-collapse:collapse;margin:8px 0 20px;background:#fff'><thead><tr>{th}</tr></thead><tbody>{trs}</tbody></table>"
    def bars(title, values, money=True):
        items = sorted(values.items(), key=lambda x: x[1], reverse=True)[:8]
        if not items: return f"<p style='color:{muted}'>No activity</p>"
        maximum = max(float(v) for _,v in items) or 1
        parts = []
        for label, value in items:
            width = max(2, int(float(value)/maximum*100))
            shown = rupee(value) if money else str(value)
            parts.append(f"<tr><td style='padding:5px 8px 5px 0;width:28%;font-size:12px;color:{ink}'>{escape(str(label))}</td><td style='padding:5px 0;width:52%'><div style='height:14px;width:{width}%;background:{gold};border-radius:3px'></div></td><td style='padding:5px 0 5px 8px;width:20%;font-size:12px;color:{ink}'>{shown}</td></tr>")
        return f"<h3 style='color:{navy};margin:16px 0 6px'>{escape(title)}</h3><table role='presentation' width='100%' cellpadding='0' cellspacing='0'>{''.join(parts)}</table>"
    def section(title, content):
        return f"<h2 style='margin:26px 0 10px;padding-bottom:8px;border-bottom:2px solid {gold};font-size:18px;color:{navy}'>{escape(title)}</h2>{content}"
    admissions_rows = [[kind, course, branch, year, count] for (kind,course,branch,year),count in sorted(report["admissions_breakdown"].items())]
    cash_rows = [["Opening balance",rupee(report["opening"])],["Cash received",rupee(report["cash_received"])],["Cash paid",rupee(report["cash_paid"])],["Accepted clerk deposits",rupee(report["deposits"])],["Closing balance",rupee(report["closing"])],["Tomorrow opening balance",rupee(report["tomorrow_opening"])]]
    html = f"""<div style='margin:0 auto;max-width:760px;background:#fff;border:1px solid #e1e6ee;font-family:Arial,sans-serif;color:{ink}'>
<div style='background:{navy};padding:24px;text-align:center'>{f"<img src='{escape(logo)}' alt='Pragathi logo' width='92' style='display:block;margin:0 auto 12px;background:#fff;border-radius:50%;padding:6px'>" if logo else ''}<div style='font-size:21px;font-weight:bold;color:#fff'>Pragathi Educational Institutions</div><div style='margin-top:8px;color:#f4d79e;font-size:16px'>Daily Analytics Report</div><div style='margin-top:5px;color:#fff;font-size:13px'>{escape(date_heading)}</div></div>
<div style='padding:20px;background:{pale}'><table role='presentation' width='100%' cellpadding='0' cellspacing='8'><tr><td style='background:#fff;padding:14px;border-left:4px solid {gold}'><div style='color:{muted};font-size:12px'>Payments received</div><b style='font-size:21px;color:{navy}'>{rupee(report['payment_total'])}</b></td><td style='background:#fff;padding:14px;border-left:4px solid {gold}'><div style='color:{muted};font-size:12px'>Students paid</div><b style='font-size:21px;color:{navy}'>{report['students']}</b></td><td style='background:#fff;padding:14px;border-left:4px solid {gold}'><div style='color:{muted};font-size:12px'>Admissions</div><b style='font-size:21px;color:{navy}'>{report['applications']+report['enquiries']}</b></td></tr></table>
{section('Payments',table(['Metric','Value'],[['Payment count',report['payments']],['Distinct students',report['students']],['Total received',rupee(report['payment_total'])]]))}
{bars('Received by transaction mode',report['by_mode'])}{bars('Received by course',report['by_course'])}{bars('Received by branch',report['by_branch'])}{bars('Received by academic year',report['by_year'])}
{section('Admissions received',table(['Type','Course','Branch','Academic year','Count'],admissions_rows))}
{section('Daily operations',table(['Item','Count / amount'],[['Change requests raised',report['change_requests']],['Clerk deposits accepted',f"{report['deposit_count']} · {rupee(report['deposits'])}"]]))}
{section('Cash position',table(['Balance item','Amount'],cash_rows))}<p style='margin:24px 0 0;color:{muted};font-size:11px'>Automated report for {escape(date_heading)}. Figures use records available at the time this report was generated.</p></div></div>"""
    text = f"Daily college analytics — {date_heading}. Payments {rupee(report['payment_total'])}; {report['students']} students; admissions {report['applications']} applications and {report['enquiries']} enquiries; change requests {report['change_requests']}; clerk deposits {rupee(report['deposits'])}; cash closing {rupee(report['closing'])}; tomorrow opening {rupee(report['tomorrow_opening'])}."
    logo_file = Path(__file__).resolve().parents[2] / "assets" / "pragathi-emblem.png"
    attachments = []
    if logo_file.is_file():
        attachments.append({"name": "pragathi-emblem.png", "contentId": "pragathi-emblem",
                            "contentType": "image/png", "contentInBase64": base64.b64encode(logo_file.read_bytes()).decode("ascii")})
    return f"Daily college analytics · {date_heading}", text, html, attachments


def deliver(store, settings, day):
    with store.transaction() as data:
        marker = data.setdefault("documents", {}).setdefault("daily_admin_digest", {})
        if marker.get("sent_for") == day:
            return False
        report = build(data, day)
        admins = [a.get("email") for code, a in data.get("accounts", {}).items()
                  if a.get("active") and a.get("email") and any(data.get("roles", {}).get(r, {}).get("system_admin") for r in a.get("role_codes", []))]
        marker["sent_for"] = day
    subject, text, html, attachments = render_email(report, settings)
    for email in admins:
        send_email(settings, email, subject, text, html, attachments=attachments)
    return bool(admins)


def previous_day(now=None):
    return ((now or datetime.now(TZ)).astimezone(TZ).date() - timedelta(days=1)).isoformat()


def seconds_until_next_run(now=None):
    now = (now or datetime.now(TZ)).astimezone(TZ)
    next_run = datetime.combine(now.date() + timedelta(days=1), time(0, 5), TZ)
    return max(1, (next_run-now).total_seconds())
