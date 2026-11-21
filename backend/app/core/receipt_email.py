"""Fee receipt emails to the student email entered on the payment form.

Sent when a payment is recorded, when it is changed and when it is deleted (for changes and
deletions that wait for the admin, when the admin approves them). Nothing is sent when no student
email was entered.

The email is a branded HTML receipt (navy and gold, 800px wide on desktop, stacked on phones) with
the official receipt PDF attached. The emblem and icons are embedded as inline images (content-ID),
so they show without any hosted file. Table layout with inline styles for Gmail, Outlook and phone
mail apps; it stays readable with images blocked.
"""
import base64
import re
from decimal import Decimal, InvalidOperation
from html import escape
from pathlib import Path

from .pdf_kit import inr

ASSETS = Path(__file__).resolve().parents[2] / "assets" / "email" / "fee-receipt"
INSTITUTION = "Pragathi Educational Institutions"
PLACE = "Kothavalasa"

NAVY = "#102A54"
HEADER = "#123675"
GOLD = "#D4A017"
GOLD_SOFT = "#FFF4D6"
BLUE_SOFT = "#EEF5FF"
INK = "#172B4D"
MUTED = "#66758A"
GREEN = "#168A4A"
GREEN_SOFT = "#E5F7ED"
LINE = "#E2E8F0"
# Double-quoted family names: style attributes in this template are single-quoted.
FONT = '"Segoe UI", Roboto, Helvetica, Arial, sans-serif'

METHODS = {"cash": "Cash", "upi": "UPI", "bank_transfer": "Bank transfer", "cheque": "Cheque", "card": "Card"}
# event -> (heading, intro, badge title, badge note, badge icon, badge colour, badge background)
EVENTS = {
    "recorded": ("Fee Receipt", "Thank you! We have received your fee payment. Your receipt details are given below.",
                 "Payment Successful", "Receipt for Fee Payment", "check-circle", GREEN, GREEN_SOFT),
    "updated": ("Updated Fee Receipt", "The details of your fee payment were corrected by the college. The updated "
                "receipt is given below; please use it in place of the earlier one.",
                "Receipt Updated", "Corrected by the college", "refresh", "#1D4ED8", "#E8F0FE"),
    "deleted": ("Fee Payment Cancelled", "This fee payment has been cancelled by the college and is no longer counted "
                "towards your fees. The cancelled receipt is given below for your records.",
                "Payment Cancelled", "Not counted towards fees", "x-circle", "#B42318", "#FDECEC"),
}
ICONS = ("graduation-cap", "check-circle", "refresh", "x-circle", "coins", "calendar", "credit-card",
         "receipt", "wallet", "information")


def _words(value):
    try:
        from .payroll_workspace import words
        return words(value)
    except Exception:
        return ""


def _money(value):
    try:
        return Decimal(str(value or 0))
    except InvalidOperation:
        return Decimal(0)


def _date(value):
    """'21 Nov 2026' from an ISO date; the text as given otherwise."""
    text = str(value or "")[:10]
    m = re.fullmatch(r"(\d{4})-(\d{2})-(\d{2})", text)
    if not m:
        return text
    months = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split()
    return f"{int(m[3])} {months[int(m[2]) - 1]} {m[1]}"


def _components(data, payment):
    """[(fee head, amount)] from the payment's allocations (kept on the payment once deleted)."""
    records = data["records"]
    charges = records.get("student_fee_charges", {})
    structures = records.get("fee_structures", {})
    heads = records.get("fee_heads", {})
    allocations = [a for a in records.get("payment_allocations", {}).values() if a.get("payment_code") == payment.get("code")]
    allocations = allocations or payment.get("deleted_allocations") or []
    rows = {}
    for a in allocations:
        structure = structures.get(charges.get(a.get("charge_code"), {}).get("fee_structure_code"), {})
        name = heads.get(structure.get("fee_head_code"), {}).get("name") or payment.get("fee_head_name") or "Fee"
        rows[name] = rows.get(name, Decimal(0)) + _money(a.get("amount"))
    total = _money(payment.get("amount"))
    allocated = sum(rows.values(), Decimal(0))
    if not rows:
        return [(payment.get("fee_head_name") or "Fee payment", total)]
    if total > allocated:  # the rest of the payment is held as an advance on the student's account
        rows["Advance (held on account)"] = total - allocated
    return list(rows.items())


def _img(cid, width, alt, style=""):
    return (f"<img src='cid:{cid}' width='{width}' height='{width}' alt='{escape(alt)}' "
            f"style='display:block;border:0;outline:none;width:{width}px;height:{width}px;{style}'>")


def _section_title(icon, text):
    return (f"<table role='presentation' cellpadding='0' cellspacing='0' style='margin:0 0 10px'><tr>"
            f"<td style='background:{HEADER};border-radius:0 18px 18px 0;padding:8px 18px 8px 12px'>"
            f"<table role='presentation' cellpadding='0' cellspacing='0'><tr>"
            f"<td style='padding-right:8px'>{_img(icon, 20, '')}</td>"
            f"<td style='font:700 15px/1.2 {FONT};color:#FFFFFF'>{escape(text)}</td></tr></table></td></tr></table>")


def _details_table(rows, status_html):
    body = ""
    for i, (label, value) in enumerate(rows):
        shade = "#FFFFFF" if i % 2 == 0 else "#F7FAFF"
        body += (f"<tr><td style='padding:7px 12px;background:{shade};border-bottom:1px solid {LINE};"
                 f"font:13px/1.4 {FONT};color:{MUTED};width:44%;vertical-align:top'>{escape(label)}</td>"
                 f"<td style='padding:7px 12px;background:{shade};border-bottom:1px solid {LINE};"
                 f"font:600 13px/1.4 {FONT};color:{INK};vertical-align:top;word-break:break-word'>{escape(str(value))}</td></tr>")
    body += (f"<tr><td style='padding:8px 12px;font:13px/1.4 {FONT};color:{MUTED}'>Status</td>"
             f"<td style='padding:8px 12px'>{status_html}</td></tr>")
    return (f"<table role='presentation' width='100%' cellpadding='0' cellspacing='0' "
            f"style='border:1px solid {LINE};border-radius:10px;border-collapse:separate;overflow:hidden'>{body}</table>")


def _columns(cells, gap=16):
    """Side-by-side blocks that wrap onto their own rows on narrow screens, even in mail apps that
    ignore media queries (inline-block divs with a max-width; Outlook desktop gets a table)."""
    mso_open = "<!--[if mso]><table role='presentation' width='100%' cellpadding='0' cellspacing='0'><tr><![endif]-->"
    mso_close = "<!--[if mso]></tr></table><![endif]-->"
    parts = []
    for i, (width, html) in enumerate(cells):
        pad = f"padding:0 {gap // 2 if i < len(cells) - 1 else 0}px 0 {gap // 2 if i else 0}px"
        parts.append(f"<!--[if mso]><td width='{width}' valign='top'><![endif]-->"
                     f"<div class='col' style='display:inline-block;vertical-align:top;width:100%;max-width:{width}px;"
                     f"box-sizing:border-box;{pad};font-size:14px;text-align:left'>{html}</div>"
                     f"<!--[if mso]></td><![endif]-->")
    return f"<div style='font-size:0;text-align:left'>{mso_open}{''.join(parts)}{mso_close}</div>"


def render_receipt(event, ctx):
    """(html, text) of the receipt email from the receipt context."""
    heading, intro, badge, badge_note, badge_icon, badge_ink, badge_bg = EVENTS[event]
    cancelled = event == "deleted"
    amount = f"₹ {inr(ctx['amount'])}"
    status_word, status_ink, status_bg = ("Cancelled", "#B42318", "#FDECEC") if cancelled else ("Paid", GREEN, GREEN_SOFT)
    status_html = (f"<span style='display:inline-block;padding:3px 12px;border-radius:999px;background:{status_bg};"
                   f"color:{status_ink};font:700 12px/1.4 {FONT}'>{'✕' if cancelled else '✓'} {status_word}</span>")

    # Emblem and name side by side at every width (a header never wraps); vertically centred.
    header = (
        f"<tr><td style='background:{HEADER};padding:20px 24px 16px' class='px hdr'>"
        f"<table role='presentation' width='100%' cellpadding='0' cellspacing='0'><tr>"
        f"<td width='76' class='logo' style='width:76px;vertical-align:middle;padding-right:14px'>"
        f"{_img('emblem', 76, INSTITUTION + ' emblem')}</td>"
        f"<td style='vertical-align:middle;border-left:2px solid #3E5C99;padding-left:14px' class='name'>"
        f"<div style='font:800 22px/1.15 {FONT};color:#FFFFFF;letter-spacing:.3px' class='title'>"
        f"PRAGATHI<br>EDUCATIONAL INSTITUTIONS</div>"
        f"<div style='font:600 13px/1.4 {FONT};color:#FFFFFF;letter-spacing:3px;margin-top:6px' class='place'>"
        f"<span style='color:{GOLD}'>&#8212;&#8212;</span> KOTHAVALASA "
        f"<span style='color:{GOLD}'>&#8212;&#8212;</span></div>"
        f"</td></tr></table></td></tr>"
        f"<tr><td style='height:6px;line-height:6px;font-size:0;background:{GOLD}'>&nbsp;</td></tr>")

    intro_row = (
        f"<tr><td style='padding:22px 24px 6px' class='px'>"
        + _columns([
            (480, f"<table role='presentation' cellpadding='0' cellspacing='0'><tr>"
                  f"<td style='vertical-align:top;padding-right:12px'>{_img('graduation-cap', 52, '')}</td>"
                  f"<td style='vertical-align:top'>"
                  f"<div style='font:800 26px/1.2 {FONT};color:{NAVY}' class='h1'>{escape(heading)}</div>"
                  f"<div style='font:700 15px/1.5 {FONT};color:{INK};margin-top:2px'>Dear {escape(ctx['name'] or 'Student')},</div>"
                  f"</td></tr></table>"
                  f"<div style='font:14px/1.6 {FONT};color:{INK};margin:8px 0 10px'>{escape(intro)}</div>"),
            (264, f"<table role='presentation' cellpadding='0' cellspacing='0' style='background:{badge_bg};"
                  f"border:1px solid {badge_ink}33;border-radius:12px;margin:2px 0 10px'><tr>"
                  f"<td style='padding:10px 10px 10px 12px'>{_img(badge_icon, 28, '')}</td>"
                  f"<td style='padding:10px 14px 10px 0'><div style='font:700 15px/1.3 {FONT};color:{badge_ink}'>{escape(badge)}</div>"
                  f"<div style='font:12px/1.4 {FONT};color:{MUTED}'>{escape(badge_note)}</div></td></tr></table>"),
        ])
        + "</td></tr>")

    words = _words(ctx["amount"])
    date_mode = (
        f"<table role='presentation' width='100%' cellpadding='0' cellspacing='0'><tr>"
        f"<td width='50%' style='vertical-align:top;padding:4px 8px 4px 0'>"
        f"<table role='presentation' cellpadding='0' cellspacing='0'><tr><td style='padding-right:8px;vertical-align:top'>{_img('calendar', 24, '')}</td>"
        f"<td><div style='font:12px/1.3 {FONT};color:{MUTED}'>Payment Date</div>"
        f"<div style='font:700 15px/1.4 {FONT};color:{INK}'>{escape(ctx['paid_on'])}</div></td></tr></table></td>"
        f"<td width='50%' style='vertical-align:top;padding:4px 0 4px 8px'>"
        f"<table role='presentation' cellpadding='0' cellspacing='0'><tr><td style='padding-right:8px;vertical-align:top'>{_img('credit-card', 24, '')}</td>"
        f"<td><div style='font:12px/1.3 {FONT};color:{MUTED}'>Payment Mode</div>"
        f"<div style='font:700 15px/1.4 {FONT};color:{INK}'>{escape(ctx['method'])}</div></td></tr></table></td>"
        f"</tr></table>")
    amount_block = (
        f"<table role='presentation' cellpadding='0' cellspacing='0'><tr>"
        f"<td style='padding-right:12px;vertical-align:middle'>{_img('coins', 46, '')}</td>"
        f"<td style='vertical-align:middle'>"
        f"<div style='font:700 12px/1.3 {FONT};color:{MUTED};letter-spacing:1px;text-transform:uppercase'>"
        f"{'Amount cancelled' if cancelled else 'Amount received'}</div>"
        f"<div class='amount' style='font:800 30px/1.15 {FONT};color:{NAVY};{'text-decoration:line-through;' if cancelled else ''}'>"
        f"{escape(amount)}</div>"
        + (f"<div style='font:13px/1.4 {FONT};color:{INK}'>({escape(words)})</div>" if words else "")
        + "</td></tr></table>")
    summary = (
        f"<tr><td style='padding:10px 24px' class='px'>"
        f"<table role='presentation' width='100%' cellpadding='0' cellspacing='0' style='background:{GOLD_SOFT};"
        f"border:1px solid #F1D98A;border-radius:14px'><tr><td style='padding:14px 16px'>"
        + _columns([(390, f"<div style='padding:4px 0'>{amount_block}</div>"),
                    (310, f"<div style='padding:6px 0 4px 16px;border-left:2px solid {GOLD}' class='split'>{date_mode}</div>")], gap=20)
        + "</td></tr></table></td></tr>")

    comp_rows = "".join(
        f"<tr><td style='padding:8px 12px;border-bottom:1px solid {LINE};font:13px/1.4 {FONT};color:{INK}'>{escape(name)}</td>"
        f"<td align='right' style='padding:8px 12px;border-bottom:1px solid {LINE};font:13px/1.4 {FONT};color:{INK};"
        f"white-space:nowrap'>{escape(inr(value))}</td></tr>" for name, value in ctx["components"])
    components = (
        _section_title("wallet", "Fee Components")
        + f"<table role='presentation' width='100%' cellpadding='0' cellspacing='0' style='border:1px solid {LINE};"
          f"border-radius:10px;border-collapse:separate;overflow:hidden;background:#FFFFFF'>"
          f"<tr><td style='padding:8px 12px;background:{BLUE_SOFT};font:700 13px/1.4 {FONT};color:{NAVY}'>Particulars</td>"
          f"<td align='right' style='padding:8px 12px;background:{BLUE_SOFT};font:700 13px/1.4 {FONT};color:{NAVY}'>Amount (&#8377;)</td></tr>"
        + comp_rows
        + f"<tr><td style='padding:10px 12px;background:{GOLD_SOFT};font:800 15px/1.4 {FONT};color:{NAVY}'>"
          f"{'Total cancelled' if cancelled else 'Total received'}</td>"
          f"<td align='right' style='padding:10px 12px;background:{GOLD_SOFT};font:800 15px/1.4 {FONT};color:{NAVY};white-space:nowrap'>"
          f"{escape(amount)}</td></tr></table>")
    notes = [*(["Reason given by the college: " + ctx["reason"]] if ctx.get("reason") else []),
             "This is a system-generated receipt; the official receipt PDF is attached.",
             "Please keep this receipt for your records.",
             "For any query about this payment, contact the accounts office with the receipt number."]
    note_box = (
        f"<table role='presentation' width='100%' cellpadding='0' cellspacing='0' style='margin-top:14px;background:{BLUE_SOFT};"
        f"border:1px solid #D6E4FB;border-radius:12px'><tr><td style='padding:14px 16px'>"
        f"<table role='presentation' cellpadding='0' cellspacing='0'><tr><td style='padding-right:8px'>{_img('information', 22, '')}</td>"
        f"<td style='font:700 15px/1.3 {FONT};color:{NAVY}'>Note</td></tr></table>"
        + "".join(f"<div style='font:13px/1.5 {FONT};color:{INK};margin:6px 0 0 6px'>&#8226;&nbsp; {escape(n)}</div>" for n in notes)
        + "</td></tr></table>")

    two_columns = (
        f"<tr><td style='padding:14px 24px 6px' class='px'>"
        + _columns([(392, _section_title("receipt", "Receipt Details") + _details_table(ctx["rows"], status_html)
                     + "<div style='height:16px;line-height:16px;font-size:0'>&nbsp;</div>"),
                    (352, components + note_box)], gap=20)
        + "</td></tr>")

    closing = (
        f"<tr><td style='padding:18px 28px 22px' class='px'>"
        f"<div style='font:14px/1.5 {FONT};color:{INK}'>Warm regards,</div>"
        f"<div style='font:800 16px/1.5 {FONT};color:{NAVY}'>Administration Office</div>"
        f"<div style='font:13px/1.5 {FONT};color:{MUTED}'>{INSTITUTION}, {PLACE}</div></td></tr>")
    footer = (
        f"<tr><td style='height:5px;line-height:5px;font-size:0;background:{GOLD}'>&nbsp;</td></tr>"
        f"<tr><td style='background:{NAVY};padding:16px 28px;text-align:center' class='px'>"
        f"<div style='font:12px/1.6 {FONT};color:#D7E0F2'>This is an automated fee payment receipt. Please do not reply to this "
        f"email. For assistance, contact the accounts office.</div>"
        f"<div style='font:700 12px/1.6 {FONT};color:#FFFFFF;margin-top:4px'>&copy; {INSTITUTION}, {PLACE}</div></td></tr>")

    html = f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">
<title>{escape(heading)} {escape(ctx['number'])}</title>
<style>
@media only screen and (max-width:620px) {{
  .wrap {{ border-radius:0 !important; }}
  .px {{ padding-left:14px !important; padding-right:14px !important; }}
  .col {{ max-width:100% !important; padding-left:0 !important; padding-right:0 !important; }}
  .title {{ font-size:17px !important; letter-spacing:0 !important; }}
  .place {{ font-size:11px !important; letter-spacing:2px !important; }}
  .logo {{ width:60px !important; padding-right:10px !important; }}
  .logo img {{ width:60px !important; height:60px !important; }}
  .name {{ padding-left:10px !important; }}
  .hdr {{ padding-top:14px !important; padding-bottom:12px !important; }}
  .h1 {{ font-size:22px !important; }}
  .amount {{ font-size:26px !important; }}
  .split {{ border-left:0 !important; padding-left:0 !important; border-top:1px solid #F1D98A !important;
            margin-top:8px !important; padding-top:10px !important; }}
}}
</style></head>
<body style="margin:0;padding:0;background:#EEF2F8">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">{escape(heading)} {escape(ctx['number'])} &#183; {escape(amount)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EEF2F8"><tr><td align="center" style="padding:20px 10px">
<!--[if mso]><table role="presentation" width="800" cellpadding="0" cellspacing="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="wrap" style="max-width:800px;background:#FFFFFF;border-radius:16px;overflow:hidden;border:1px solid {LINE}">
{header}{intro_row}{summary}{two_columns}{closing}{footer}
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table></body></html>"""

    lines = [f"{INSTITUTION.upper()}, {PLACE.upper()}", "=" * 60, "", heading, "",
             f"Dear {ctx['name'] or 'Student'},", "", intro, "",
             f"{'Amount cancelled' if cancelled else 'Amount received'}: {amount}" + (f" ({words})" if words else ""),
             f"Payment date: {ctx['paid_on']}", f"Payment mode: {ctx['method']}", "", "Receipt details:",
             *[f"  {label}: {value}" for label, value in ctx["rows"]], f"  Status: {status_word}", "", "Fee components:",
             *[f"  {name}: Rs. {inr(value)}" for name, value in ctx["components"]],
             f"  {'Total cancelled' if cancelled else 'Total received'}: {amount}", "",
             *[f"- {n}" for n in notes], "", "Warm regards,", "Administration Office", f"{INSTITUTION}, {PLACE}", "",
             "This is an automated fee payment receipt. Please do not reply to this email."]
    return html, "\n".join(lines)


def _inline_images(html):
    """Embed only the images this email shows: Gmail lists unused embedded images as attachments."""
    out = []
    for cid, path in [("emblem", ASSETS / "emblem.png"), *((name, ASSETS / "icons" / f"{name}.png") for name in ICONS)]:
        if f"cid:{cid}'" in html and path.exists():
            out.append({"name": f"{cid}.png", "contentType": "image/png", "contentId": cid,
                        "contentInBase64": base64.b64encode(path.read_bytes()).decode()})
    return out


def receipt_message(data, settings, payment_code, event):
    """(to, subject, text, html, attachments) for a payment's receipt email, or None without an email."""
    from .finance_pdfs import fee_receipt_pdf
    from .student_leave_workspace import student_context

    records = data["records"]
    payment = records.get("payments", {}).get(payment_code)
    if not payment:
        return None
    to = str(payment.get("student_email") or "").strip()
    if not to:
        return None
    receipt = next((r for r in records.get("receipts", {}).values() if r.get("payment_code") == payment_code), {})
    number = receipt.get("receipt_number") or receipt.get("code") or payment_code
    payer = payment.get("payer") or {}
    student = records.get("students", {}).get(payment.get("student_code"), {})
    if payer:
        name, course, level, year = payer.get("name"), payer.get("course_branch"), payer.get("course_level_label"), payer.get("academic_year")
        admission, roll, student_id = payer.get("admission_number"), payer.get("roll_or_reference"), None
    else:
        place = student_context(data, payment.get("student_code")) or {}
        name = place.get("student_name") or " ".join(filter(None, [student.get("first_name"), student.get("last_name")]))
        course, level, year = place.get("course_name"), place.get("section_name"), place.get("academic_year_name")
        admission, roll, student_id = student.get("admission_number"), None, None
    semester = "Year end" if payment.get("year_end") else (f"Semester {payment['semester']}" if payment.get("semester") else None)
    method = METHODS.get(payment.get("method"), str(payment.get("method") or "").replace("_", " ").title())
    rows = [("Receipt No.", number),
            *([("Transaction No.", payment["transaction_reference"])] if payment.get("transaction_reference") else []),
            ("Student Name", name or "—"),
            *([("Student ID", student_id)] if student_id else []),
            *([("Admission No.", admission)] if admission else []),
            *([("Roll / Reference No.", roll)] if roll else []),
            *([("Course / Branch", course)] if course else []),
            *([("Course Level", level)] if level else []),
            *([("Academic Year", year)] if year else []),
            *([("Semester", semester)] if semester else []),
            ("Fee For", payment.get("fee_head_name") or "Fee payment"),
            *([("Transaction Date", _date(payment["transaction_date"]))] if payment.get("transaction_date") else [])]
    ctx = {"name": name, "number": number, "amount": payment.get("amount"), "paid_on": _date(payment.get("paid_on")),
           "method": method, "rows": rows, "components": _components(data, payment),
           "reason": payment.get("delete_reason") if event == "deleted" else None}
    html, text = render_receipt(event, ctx)
    attachments = _inline_images(html)
    if receipt:
        attachments.append({"name": f"Fee-receipt-{number}.pdf", "contentType": "application/pdf",
                            "contentInBase64": base64.b64encode(fee_receipt_pdf(data, receipt, payment)).decode()})
    money = f"₹{inr(payment.get('amount'))}"
    subject = {"recorded": f"Fee Receipt {number} — {money} | Pragathi",
               "updated": f"Updated Fee Receipt {number} | Pragathi",
               "deleted": f"Fee Payment Cancelled · Receipt {number} | Pragathi"}[event]
    return to, subject, text, html, attachments


def send_receipt(settings, message):
    """Background task: send a prepared receipt email (never raises)."""
    if not message:
        return False
    from .email_delivery import send_email
    to, subject, text, html, attachments = message
    return send_email(settings, to, subject, text, html, attachments=attachments)
