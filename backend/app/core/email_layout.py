"""The college's branded email layout (HTML and plain text), shared by every email the system sends.

HTML is table-based with inline styles so it renders the same in Gmail, Outlook and phone mail apps.
The emblem is loaded from the dashboard (EDUNEXA_PUBLIC_PORTAL_URL + /assets/pragathi-emblem-email.png);
on a local address it is left out and the college name stands alone.
"""

from html import escape

COLLEGE = "Pragathi Educational Institutions"
PLACE = "Kothavalasa"
MOTTO = "Knowledge is Power"
SENDER_NOTE = "This is an automated message. Please do not reply to this email."

NAVY = "#1b2f73"
GOLD = "#d4a21c"
INK = "#1f2937"
MUTED = "#6b7280"
LINE = "#e5e7eb"
SOFT = "#f4f6fb"


def logo_url(settings):
    base = (getattr(settings, "public_portal_url", "") or "").rstrip("/")
    if not base.startswith("https://"):
        return None
    return f"{base}/assets/pragathi-emblem-email.png"


# ----------------------------------------------------------------------------- HTML building blocks

def p(text_html):
    return f"<p style='margin:0 0 14px;font-size:15px;line-height:1.6;color:{INK}'>{text_html}</p>"


def heading(text):
    return (f"<h2 style='margin:22px 0 10px;font-size:16px;line-height:1.4;color:{NAVY};"
            f"font-weight:700'>{escape(text)}</h2>")


def details(rows):
    """A boxed list of label / value pairs (values may hold trusted HTML only via (label, value, True))."""
    cells = ""
    for row in rows:
        label, value = row[0], row[1]
        shown = value if len(row) > 2 and row[2] else escape(str(value))
        cells += (f"<tr><td style='padding:9px 14px;font-size:13px;color:{MUTED};width:38%;"
                  f"border-bottom:1px solid {LINE}'>{escape(label)}</td>"
                  f"<td style='padding:9px 14px;font-size:15px;color:{INK};font-weight:600;"
                  f"border-bottom:1px solid {LINE}'>{shown}</td></tr>")
    return (f"<table role='presentation' width='100%' cellpadding='0' cellspacing='0' "
            f"style='margin:4px 0 18px;border:1px solid {LINE};border-radius:8px;border-collapse:separate;"
            f"overflow:hidden;background:{SOFT}'>{cells}</table>")


def code_box(code):
    return (f"<table role='presentation' cellpadding='0' cellspacing='0' style='margin:6px 0 18px'><tr>"
            f"<td style='padding:14px 26px;background:{SOFT};border:1px dashed {NAVY};border-radius:8px;"
            f"font-family:Consolas,Menlo,monospace;font-size:30px;font-weight:700;letter-spacing:8px;"
            f"color:{NAVY}'>{escape(code)}</td></tr></table>")


def bullets(items):
    """items: (title, description) pairs."""
    rows = "".join(
        f"<tr><td valign='top' style='padding:0 10px 10px 0;color:{GOLD};font-size:16px;line-height:1.5'>&#9679;</td>"
        f"<td style='padding:0 0 10px;font-size:14px;line-height:1.55;color:{INK}'>"
        f"<b style='color:{NAVY}'>{escape(t)}</b> &ndash; {escape(d)}</td></tr>" for t, d in items)
    return f"<table role='presentation' cellpadding='0' cellspacing='0' style='margin:0 0 8px'>{rows}</table>"


def steps(items):
    rows = "".join(
        f"<tr><td valign='top' style='padding:0 12px 10px 0'><div style='width:24px;height:24px;border-radius:12px;"
        f"background:{NAVY};color:#fff;font-size:12px;font-weight:700;line-height:24px;text-align:center'>{i}</div></td>"
        f"<td style='padding:2px 0 10px;font-size:14px;line-height:1.55;color:{INK}'>{escape(s)}</td></tr>"
        for i, s in enumerate(items, 1))
    return f"<table role='presentation' cellpadding='0' cellspacing='0' style='margin:0 0 8px'>{rows}</table>"


def button(label, url):
    return (f"<table role='presentation' cellpadding='0' cellspacing='0' style='margin:6px 0 20px'><tr>"
            f"<td style='border-radius:6px;background:{NAVY}'><a href='{escape(url)}' "
            f"style='display:inline-block;padding:12px 24px;font-size:14px;font-weight:700;color:#ffffff;"
            f"text-decoration:none;border-radius:6px'>{escape(label)}</a></td></tr></table>")


def notice(text):
    return (f"<table role='presentation' width='100%' cellpadding='0' cellspacing='0' style='margin:4px 0 16px'><tr>"
            f"<td style='padding:12px 14px;background:#fff8e6;border-left:4px solid {GOLD};border-radius:4px;"
            f"font-size:13px;line-height:1.55;color:#5b4a14'>{escape(text)}</td></tr></table>")


def page(settings, title, preheader, body_html):
    """The full email: emblem header, title band, white card, footer."""
    logo = logo_url(settings)
    emblem = (f"<img src='{escape(logo)}' width='72' height='72' alt='{COLLEGE} emblem' "
              f"style='display:block;margin:0 auto 10px;border:0;width:72px;height:72px'>" if logo else "")
    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><title>{escape(title)}</title></head>
<body style="margin:0;padding:0;background:#eef1f7;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">{escape(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef1f7"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid {LINE}">
<tr><td align="center" style="background:{NAVY};padding:26px 24px 18px">
{emblem}<div style="font-size:20px;font-weight:700;color:#ffffff;letter-spacing:.3px">{COLLEGE}</div>
<div style="font-size:12px;color:#c9d3f2;letter-spacing:2px;text-transform:uppercase;margin-top:4px">{PLACE}</div>
</td></tr>
<tr><td style="height:4px;background:{GOLD};line-height:4px;font-size:0">&nbsp;</td></tr>
<tr><td style="padding:28px 32px 10px">
<h1 style="margin:0 0 18px;font-size:21px;line-height:1.35;color:{NAVY};font-weight:700">{escape(title)}</h1>
{body_html}
<p style="margin:22px 0 4px;font-size:15px;line-height:1.6;color:{INK}">Warm regards,</p>
<p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:{INK}"><b>Administration Office</b><br>{COLLEGE}, {PLACE}</p>
</td></tr>
<tr><td style="padding:18px 32px 24px;background:{SOFT};border-top:1px solid {LINE}">
<p style="margin:0 0 6px;font-size:12px;line-height:1.6;color:{MUTED};text-align:center"><i>&ldquo;{MOTTO}&rdquo;</i></p>
<p style="margin:0;font-size:11px;line-height:1.6;color:{MUTED};text-align:center">{SENDER_NOTE} For help, please contact the college office.<br>
&copy; {COLLEGE}, {PLACE}</p>
</td></tr>
</table></td></tr></table></body></html>"""


def text_page(title, body):
    """Plain-text version with the same structure."""
    rule = "=" * 60
    return (f"{COLLEGE.upper()}, {PLACE.upper()}\n{rule}\n\n{title}\n\n{body.strip()}\n\n"
            f"Warm regards,\nAdministration Office\n{COLLEGE}, {PLACE}\n\n{rule}\n"
            f"{SENDER_NOTE} For help, please contact the college office.\n")
