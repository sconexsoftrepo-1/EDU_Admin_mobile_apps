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
        year_label = " · ".join((program.get("name") or "Unassigned course",
                                  program.get("branch") or program.get("branch_code") or "Unassigned branch",
                                  years.get(year_code, {}).get("name") or year_code or "Unassigned year"))
        for agg, name in ((by_course, program.get("name") or "Unassigned course"),
                          (by_branch, program.get("branch") or program.get("branch_code") or "Unassigned branch"),
                          (by_year, year_label)):
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
    navy, gold, pale, ink, muted = "#0B4E8A", "#C99700", "#F4F8FF", "#243247", "#66758A"
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
            share = (float(value) / sum(float(v) for _, v in items) * 100) if money and sum(float(v) for _, v in items) else 0
            parts.append(f"<tr><td style='padding:5px 8px 5px 0;width:28%;font-size:12px;color:{ink}'>{escape(str(label))}</td><td style='padding:5px 0;width:52%'><table role='presentation' width='100%' cellpadding='0' cellspacing='0'><tr><td style='height:13px;width:{width}%;background:{navy}'>&nbsp;</td><td style='height:13px;background:#E7EEF7'>&nbsp;</td></tr></table></td><td style='padding:5px 0 5px 8px;width:20%;font-size:12px;color:{ink}'>{shown}{f' ({share:.0f}%)' if money else ''}</td></tr>")
        return f"<h3 style='color:{navy};margin:16px 0 6px'>{escape(title)}</h3><table role='presentation' width='100%' cellpadding='0' cellspacing='0'>{''.join(parts)}</table>"
    def section(title, content):
        return f"<h2 style='margin:26px 0 10px;padding-bottom:8px;border-bottom:2px solid {gold};font-size:18px;color:{navy}'>{escape(title)}</h2>{content}"
    admissions_rows = [[kind, course, branch, year, count] for (kind,course,branch,year),count in sorted(report["admissions_breakdown"].items())]
    cash_rows = [["Opening balance",rupee(report["opening"])],["Cash received",rupee(report["cash_received"])],["Cash paid",rupee(report["cash_paid"])],["Accepted clerk deposits",rupee(report["deposits"])],["Closing balance",rupee(report["closing"])],["Tomorrow opening balance",rupee(report["tomorrow_opening"])]]
    admissions_total = report['applications'] + report['enquiries']
    total_admissions = report['applications'] + report['enquiries']
    insights = []
    if report['by_mode']:
        mode, value = max(report['by_mode'].items(), key=lambda item: item[1])
        share = float(value) / float(report['payment_total']) * 100 if report['payment_total'] else 0
        insights.append(f"{mode} led collections at {share:.0f}% ({rupee(value)}).")
    if report['by_course']:
        course, value = max(report['by_course'].items(), key=lambda item: item[1])
        insights.append(f"{course} recorded the highest course collections ({rupee(value)}).")
    insights.append(f"Admissions received: {report['applications']} applications and {report['enquiries']} enquiries ({total_admissions} total records).")
    insights.append(f"Cash closed at {rupee(report['closing'])}; tomorrow's opening balance is {rupee(report['tomorrow_opening'])}.")
    insight_html = "<table role='presentation' width='100%' cellpadding='0' cellspacing='0' style='background:#FFF8E8;padding:14px'>" + "".join(f"<tr><td style='padding:5px 8px;color:{gold};font-size:16px'>&bull;</td><td style='padding:5px 0;color:{ink};font-size:13px'>{escape(item)}</td></tr>" for item in insights) + "</table>"
    html = f"""<div style='margin:0 auto;max-width:760px;background:#fff;border:1px solid #e1e6ee;font-family:Arial,Helvetica,sans-serif;color:{ink}'>
<div style='background:#fff;padding:20px;text-align:center;border-bottom:4px solid {gold}'>{f"<img src='{escape(logo)}' alt='Pragathi Educational Institutions logo' width='90' height='90' style='display:block;margin:0 auto 10px'>" if logo else ''}<div style='font-size:24px;font-weight:bold;color:#102A54'>Pragathi Educational Institutions</div><div style='margin-top:7px;color:{navy};font-size:19px;font-weight:bold'>Daily Analytics Report</div><div style='margin-top:6px;color:{muted};font-size:13px'>{escape(date_heading)}</div></div>
<div style='padding:18px;background:{pale}'><h2 style='margin:0 0 10px;color:{navy};font-size:16px'>Executive Summary</h2><table role='presentation' width='100%' cellpadding='4' cellspacing='4'><tr><td width='25%' style='background:#fff;padding:12px;border:1px solid #d9e5f3;text-align:center'><div style='color:{muted};font-size:12px'>Payments Received</div><b style='font-size:20px;color:{navy}'>{rupee(report['payment_total'])}</b></td><td width='25%' style='background:#fff;padding:12px;border:1px solid #d9e5f3;text-align:center'><div style='color:{muted};font-size:12px'>Students Paid</div><b style='font-size:20px;color:{navy}'>{report['students']}</b></td><td width='25%' style='background:#fff;padding:12px;border:1px solid #d9e5f3;text-align:center'><div style='color:{muted};font-size:12px'>Admissions</div><b style='font-size:20px;color:{navy}'>{admissions_total}</b></td><td width='25%' style='background:#fff;padding:12px;border:1px solid #d9e5f3;text-align:center'><div style='color:{muted};font-size:12px'>Transactions</div><b style='font-size:20px;color:{navy}'>{report['payments']}</b></td></tr></table>
{section('Payments Summary',table(['Metric','Value'],[['Payment count',report['payments']],['Distinct students',report['students']],['Total received',rupee(report['payment_total'])]]))}
{bars('Received by transaction mode',report['by_mode'])}{bars('Received by course',report['by_course'])}{bars('Received by branch',report['by_branch'])}{bars('Received by academic year',report['by_year'])}
{section('Admissions Analysis',f"<table role='presentation' width='100%' cellpadding='4' cellspacing='4'><tr><td width='33%' style='background:#F4F8FF;padding:10px;text-align:center'><b>Applications<br>{report['applications']}</b></td><td width='33%' style='background:#F4F8FF;padding:10px;text-align:center'><b>Enquiries<br>{report['enquiries']}</b></td><td width='34%' style='background:#FFF4D6;padding:10px;text-align:center'><b>Total records<br>{admissions_total}</b></td></tr></table>" + table(['Type','Course','Branch','Academic year','Count'],admissions_rows))}
{section('Daily operations',table(['Item','Count / amount'],[['Change requests raised',report['change_requests']],['Clerk deposits accepted',f"{report['deposit_count']} · {rupee(report['deposits'])}"]]))}
{section('Cash Reconciliation',table(['Balance item','Amount'],cash_rows))}
{section('Key Insights — Daily Observations',insight_html)}<p style='margin:24px 0 0;padding:12px;background:#F4F8FF;color:{muted};font-size:11px'>Automated Daily Analytics Report · {escape(date_heading)} · Figures reflect records available when this report was generated.</p></div></div>"""
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
