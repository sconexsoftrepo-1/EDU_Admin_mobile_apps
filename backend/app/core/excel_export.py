"""Any on-screen table as a branded Excel workbook (.xlsx).

    POST /print/table.xlsx   same body as POST /print/table (title, subtitle, columns, rows, filename)

Sheet 1 (the report): college emblem, college name and campus, report title and details, then the
table with a styled header, alternating row shading, real numbers with Indian money format, filters
on every column, frozen header and a grand total. Sheet 2 (Summary): record count, money totals and
breakdowns of the columns that group records (status, type, department ...).
"""
import io
import re
from datetime import datetime
from decimal import Decimal, InvalidOperation

from fastapi import APIRouter, Depends, Request
from fastapi.responses import Response
from openpyxl import Workbook
from openpyxl.drawing.image import Image as XlImage
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

from .pdf_kit import LOGO, college
from .print_pdfs import TableInput, staff
from .security import current_user

router = APIRouter(prefix="/print", tags=["Printable documents"])

BRAND = "1D4ED8"      # dashboard blue
BRAND_SOFT = "DBEAFE"
ZEBRA = "F8FAFC"
INK = "171B23"
MUTED = "4B5563"
LINE = Side(style="thin", color="E2E8F0")
BOX = Border(left=LINE, right=LINE, top=LINE, bottom=LINE)
MONEY_FORMAT = '[$₹-4009] #,##,##0.00'
MONEY_WORDS = ("amount", "fee", "fees", "salary", "pay", "paid", "balance", "due", "total", "inr", "₹", "net",
               "gross", "cost", "price", "deposit", "collected", "outstanding", "discount", "scholarship")


def number(value):
    """A number from a table cell ('₹ 1,20,000.00', '45', '-12.5'), else None."""
    text = str(value or "").replace("₹", "").replace("INR", "").replace("Rs.", "").replace(",", "").strip()
    if not text or not re.fullmatch(r"-?\d+(\.\d+)?", text):
        return None
    try:
        return Decimal(text)
    except InvalidOperation:
        return None


def column_kinds(columns, rows):
    """'money', 'number' or 'text' for each column."""
    kinds = []
    for i, label in enumerate(columns):
        values = [r[i] for r in rows if i < len(r) and str(r[i] or "").strip() not in ("", "—", "-")]
        if values and all(number(v) is not None for v in values):
            money = any(w in label.lower() for w in MONEY_WORDS) or any("₹" in str(v) for v in values)
            kinds.append("money" if money else "number")
        else:
            kinds.append("text")
    return kinds


def grouping_columns(columns, rows, kinds):
    """Text columns that group records: few distinct values, repeated (status, type, department ...)."""
    out = []
    for i, label in enumerate(columns):
        if kinds[i] != "text" or not rows:
            continue
        values = [str(r[i] or "").strip() for r in rows if i < len(r)]
        distinct = {v for v in values if v}
        if 1 < len(distinct) <= 12 and len(distinct) < max(2, len(values)) * 0.8:
            out.append(i)
    return out[:4]


_SMALL_LOGO = None


def small_logo():
    """The emblem at 160 px: sharp at the 72 px it is shown, without a 1 MB image in every file."""
    global _SMALL_LOGO
    if _SMALL_LOGO is None:
        from PIL import Image as PilImage
        out = io.BytesIO()
        PilImage.open(LOGO).convert("RGBA").resize((160, 160), PilImage.LANCZOS).save(out, "PNG", optimize=True)
        _SMALL_LOGO = out.getvalue()
    return io.BytesIO(_SMALL_LOGO)


def table_xlsx(data, body, user_name=""):
    cols = body.columns
    rows = [[("" if c is None else str(c)) for c in r][:len(cols)] + [""] * max(0, len(cols) - len(r)) for r in body.rows]
    total = None
    if rows and str(rows[-1][0]).strip().lower() in {"total", "grand total"}:
        total, rows = rows[-1], rows[:-1]
    kinds = column_kinds(cols, rows)
    name, campus = college(data)
    width = max(len(cols), 4)
    last = get_column_letter(width)

    wb = Workbook()
    ws = wb.active
    ws.title = re.sub(r"[\\/?*\[\]:]", " ", body.title)[:31] or "Report"
    ws.sheet_view.showGridLines = False

    # -- header band: emblem, college, report title and details
    for r in range(1, 6):
        for c in range(1, width + 1):
            ws.cell(r, c).fill = PatternFill("solid", fgColor=BRAND_SOFT)
    ws.row_dimensions[1].height = 26
    ws.row_dimensions[2].height = 18
    ws.row_dimensions[3].height = 22
    ws.row_dimensions[4].height = 16
    ws.row_dimensions[5].height = 8
    start = 2 if LOGO.exists() else 1
    if LOGO.exists():
        logo = XlImage(small_logo())
        logo.width = logo.height = 72
        ws.add_image(logo, "A1")
        ws.column_dimensions["A"].width = 12
    title_col = get_column_letter(start)
    for row, text, font in ((1, name, Font(name="Calibri", size=16, bold=True, color=BRAND)),
                            (2, campus, Font(name="Calibri", size=10, color=MUTED)),
                            (3, body.title, Font(name="Calibri", size=13, bold=True, color=INK)),
                            (4, " · ".join(p for p in (body.subtitle,
                                                         f"{len(rows)} record{'s' if len(rows) != 1 else ''}",
                                                         f"Generated {datetime.now().strftime('%d %b %Y, %I:%M %p')}",
                                                         f"by {user_name}" if user_name else "") if p),
                             Font(name="Calibri", size=9, italic=True, color=MUTED))):
        ws.merge_cells(f"{title_col}{row}:{last}{row}")
        cell = ws[f"{title_col}{row}"]
        cell.value, cell.font = text, font
        cell.alignment = Alignment(vertical="center")

    # -- the table
    top = 7
    for c, label in enumerate(cols, 1):
        cell = ws.cell(top, c, label)
        cell.font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
        cell.fill = PatternFill("solid", fgColor=BRAND)
        cell.alignment = Alignment(vertical="center", wrap_text=True,
                                   horizontal="right" if kinds[c - 1] != "text" else "left")
        cell.border = BOX
    ws.row_dimensions[top].height = 24
    for r, values in enumerate(rows, top + 1):
        shade = PatternFill("solid", fgColor=ZEBRA) if (r - top) % 2 == 0 else None
        for c, value in enumerate(values, 1):
            kind = kinds[c - 1]
            n = number(value) if kind != "text" else None
            cell = ws.cell(r, c, float(n) if n is not None else value)
            if n is not None:
                cell.number_format = MONEY_FORMAT if kind == "money" else "#,##0.##"
                cell.alignment = Alignment(horizontal="right", vertical="top")
            else:
                cell.alignment = Alignment(vertical="top", wrap_text=True)
            cell.border = BOX
            cell.font = Font(name="Calibri", size=10, color=INK)
            if shade:
                cell.fill = shade
    end = top + len(rows)
    if rows:
        ws.auto_filter.ref = f"A{top}:{last if len(cols) >= width else get_column_letter(len(cols))}{end}"
    # Grand total: money columns summed by Excel itself, so edits stay correct.
    money_cols = [i for i, k in enumerate(kinds) if k == "money"]
    if rows and (money_cols or total):
        t = end + 1
        for c in range(1, len(cols) + 1):
            cell = ws.cell(t, c)
            cell.fill = PatternFill("solid", fgColor=BRAND_SOFT)
            cell.border = Border(left=LINE, right=LINE, top=Side(style="medium", color=BRAND), bottom=LINE)
            cell.font = Font(name="Calibri", size=10, bold=True, color=INK)
        ws.cell(t, 1, "Grand total")
        for i in money_cols:
            letter = get_column_letter(i + 1)
            cell = ws.cell(t, i + 1, f"=SUBTOTAL(9,{letter}{top + 1}:{letter}{end})")
            cell.number_format = MONEY_FORMAT
            cell.alignment = Alignment(horizontal="right")
    if not rows:
        ws.cell(top + 1, 1, "No records").font = Font(italic=True, color=MUTED)

    # -- column widths, frozen header, printing
    for c, label in enumerate(cols, 1):
        longest = max([len(str(label))] + [len(str(r[c - 1]).split("\n")[0]) for r in rows[:500]])
        ws.column_dimensions[get_column_letter(c)].width = max(12 if c == 1 and LOGO.exists() else 8,
                                                               min(48, longest * 1.1 + 3))
    ws.freeze_panes = ws.cell(top + 1, 1)
    ws.print_title_rows = f"{top}:{top}"
    ws.page_setup.orientation = "landscape"
    ws.page_setup.fitToWidth, ws.page_setup.fitToHeight = 1, 0
    ws.sheet_properties.pageSetUpPr.fitToPage = True
    ws.oddFooter.left.text = f"{name} · {body.title}"
    ws.oddFooter.right.text = "Page &P of &N"
    wb.properties.title, wb.properties.creator = body.title, name

    # -- Summary sheet
    sm = wb.create_sheet("Summary")
    sm.sheet_view.showGridLines = False
    sm.column_dimensions["A"].width = 34
    sm.column_dimensions["B"].width = 16
    sm.column_dimensions["C"].width = 12
    sm["A1"], sm["A2"] = f"{body.title} — summary", name
    sm["A1"].font = Font(size=14, bold=True, color=BRAND)
    sm["A2"].font = Font(size=10, color=MUTED)
    row = 4

    def heading(text):
        nonlocal row
        for c, v in enumerate((text, "", ""), 1):
            cell = sm.cell(row, c, v)
            cell.font = Font(bold=True, color="FFFFFF")
            cell.fill = PatternFill("solid", fgColor=BRAND)
        row += 1

    def line(label, value, share=None, money=False):
        nonlocal row
        sm.cell(row, 1, label).border = BOX
        cell = sm.cell(row, 2, value)
        cell.border = BOX
        cell.alignment = Alignment(horizontal="right")
        if money:
            cell.number_format = MONEY_FORMAT
        pct = sm.cell(row, 3, share if share is not None else "")
        pct.border = BOX
        if share is not None:
            pct.number_format = "0.0%"
        row += 1

    heading("Overview")
    line("Records", len(rows))
    for i in money_cols:
        line(f"Total {cols[i]}", float(sum((number(r[i]) or 0) for r in rows)), money=True)
    for i in grouping_columns(cols, rows, kinds):
        row += 1
        heading(f"By {cols[i]}")
        counts = {}
        for r in rows:
            key = str(r[i] or "").strip() or "Not set"
            counts[key] = counts.get(key, 0) + 1
        for key, count in sorted(counts.items(), key=lambda kv: (-kv[1], kv[0])):
            line(key, count, count / len(rows))
    out = io.BytesIO()
    wb.save(out)
    return out.getvalue()


@router.post("/table.xlsx")
def table_excel(body: TableInput, request: Request, user=Depends(current_user)):
    data = request.app.state.store.snapshot()
    staff(data, user)
    account = data["accounts"].get(user["code"], {})
    safe = "".join(ch if ch.isalnum() or ch in "-_" else "-" for ch in body.filename)[:60] or "report"
    return Response(table_xlsx(data, body, account.get("login_id", "")),
                    media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    headers={"Content-Disposition": f'attachment; filename="{safe}.xlsx"', "Cache-Control": "no-store"})
