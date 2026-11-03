"""Branded A4 documents: Pragathi College logo header, sections, field grids, tables and totals.

Used for payslips, salary structures, salary payment receipts, Form 16, fee receipts and report
exports so every PDF the college hands out looks the same.

    doc = Document(data, "PAYSLIP", "October 2026")
    doc.section("Employee details")
    doc.fields([("Name", "Rohan Varma"), ("Employee ID", "D26-EMP01")])
    doc.table(["Earnings", "Amount"], [["Basic pay", "36,000.00"]], widths=[3, 1], align="LR")
    raw = doc.finish()
"""
import io
from decimal import Decimal, InvalidOperation
from pathlib import Path

from reportlab.lib.colors import HexColor, white
from reportlab.lib.pagesizes import A4, landscape as rotate
from reportlab.lib.utils import ImageReader, simpleSplit
from reportlab.pdfgen.canvas import Canvas

LOGO = Path(__file__).resolve().parents[2] / "assets" / "pragathi-logo.jpg"
INK, MUTED, LINE, BAND, ACCENT, SOFT, GOLD = (HexColor(x) for x in (
    "#251e18", "#6b6158", "#e4d9c8", "#f7f1e7", "#7a4a1c", "#f3e6d3", "#c99445"))


def amount(value) -> Decimal:
    try:
        return Decimal(str(value or 0)).quantize(Decimal("0.01"))
    except (InvalidOperation, ValueError):
        return Decimal("0.00")


def inr(value) -> str:
    """Indian grouping: 1,23,456.00"""
    number = amount(value)
    sign = "-" if number < 0 else ""
    whole, _, fraction = f"{abs(number):.2f}".partition(".")
    if len(whole) > 3:
        head, tail = whole[:-3], whole[-3:]
        groups = []
        while len(head) > 2:
            groups.insert(0, head[-2:])
            head = head[:-2]
        if head:
            groups.insert(0, head)
        whole = ",".join(groups + [tail])
    return f"{sign}{whole}.{fraction}"


def college(data, campus_code=None):
    """(college name, campus line) from the institution and campus records."""
    records = data["records"]
    campus = records.get("campuses", {}).get(campus_code or "", {}) or next(iter(records.get("campuses", {}).values()), {})
    institution = records.get("institutions", {}).get(campus.get("institution_code"), {}) or next(
        iter(records.get("institutions", {}).values()), {})
    parts = [campus.get("name"), *(str(x) for x in (campus.get("address") or institution.get("address"), campus.get("city") or institution.get("city"),
                                                     campus.get("state") or institution.get("state")) if x and not isinstance(x, dict))]
    return institution.get("name") or "Pragathi College", " · ".join(p for p in parts if p)


def wrap(text, face, size, width):
    """Lines that fit `width`; words longer than the column (codes, emails) are broken too."""
    from reportlab.pdfbase.pdfmetrics import stringWidth
    out = []
    for line in simpleSplit(text, face, size, width) or [""]:
        while stringWidth(line, face, size) > width and len(line) > 1:
            cut = len(line)
            while cut > 1 and stringWidth(line[:cut], face, size) > width:
                cut -= 1
            out.append(line[:cut])
            line = line[cut:]
        out.append(line)
    return out


class _Numbered(Canvas):
    """Canvas that writes "Page x of y" on every page once the total is known."""

    def __init__(self, *args, footer="", **kwargs):
        super().__init__(*args, **kwargs)
        self._pages, self._footer = [], footer

    def showPage(self):
        self._pages.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        total = len(self._pages)
        for state in self._pages:
            self.__dict__.update(state)
            width, _ = self._pagesize
            self.setFont("Helvetica", 7.5)
            self.setFillColor(MUTED)
            self.drawString(36, 22, self._footer[:120])
            self.drawRightString(width - 36, 22, f"Page {self._pageNumber} of {total}")
            super().showPage()
        super().save()


class Document:
    def __init__(self, data, title, subtitle="", *, wide=False, campus_code=None, footer=None, reference=""):
        self.size = rotate(A4) if wide else A4
        self.width, self.height = self.size
        self.left, self.right = 36, self.width - 36
        self.college, self.campus = college(data, campus_code)
        self.title, self.subtitle, self.reference = title, subtitle, reference
        self.out = io.BytesIO()
        note = footer or "Computer-generated document. No signature is required."
        self.c = _Numbered(self.out, pagesize=self.size, footer=f"{self.college} · {note}")
        self.c.setTitle(f"{title} {subtitle}".strip())
        self.c.setAuthor(self.college)
        self.header(full=True)

    # -- layout ---------------------------------------------------------------------------
    def header(self, full=False):
        c, h = self.c, (96 if full else 58)
        c.setFillColor(BAND)
        c.rect(0, self.height - h, self.width, h, stroke=0, fill=1)
        c.setFillColor(ACCENT)
        c.rect(0, self.height - h, self.width, 3, stroke=0, fill=1)
        size = 64 if full else 38
        top = self.height - (h - size) / 2
        if LOGO.exists():
            c.setFillColor(white)
            c.roundRect(self.left - 4, top - size - 4, size + 8, size + 8, 8, stroke=0, fill=1)
            c.drawImage(ImageReader(str(LOGO)), self.left, top - size, width=size, height=size, preserveAspectRatio=True, mask="auto")
        x = self.left + size + 16
        title_font = 13 if full else 10
        room = self.right - x - c.stringWidth(self.title[:48], "Helvetica-Bold", title_font) - 18
        size_name = 19 if full else 13
        while size_name > 10 and c.stringWidth(self.college[:60], "Times-Bold", size_name) > room:
            size_name -= 0.5
        c.setFillColor(INK)
        c.setFont("Times-Bold", size_name)
        c.drawString(x, top - (24 if full else 16), self.college[:60])
        if full and self.campus:
            c.setFont("Helvetica", 8.5)
            c.setFillColor(MUTED)
            c.drawString(x, top - 40, self.campus[:95])
        c.setFillColor(ACCENT)
        c.setFont("Helvetica-Bold", 13 if full else 10)
        c.drawRightString(self.right, top - (22 if full else 16), self.title[:48])
        if self.subtitle:
            c.setFont("Helvetica", 9 if full else 8)
            c.setFillColor(INK)
            c.drawRightString(self.right, top - (38 if full else 28), self.subtitle[:70])
        if full and self.reference:
            c.setFont("Helvetica", 8)
            c.setFillColor(MUTED)
            c.drawRightString(self.right, top - 52, self.reference[:70])
        self.y = self.height - h - 24

    def ensure(self, space):
        if self.y - space < 48:
            self.c.showPage()
            self.header(full=False)

    def section(self, title):
        self.ensure(40)
        self.c.setFillColor(ACCENT)
        self.c.setFont("Helvetica-Bold", 10.5)
        self.c.drawString(self.left, self.y, title.upper())
        self.c.setStrokeColor(LINE)
        self.c.setLineWidth(0.8)
        self.c.line(self.left, self.y - 6, self.right, self.y - 6)
        self.y -= 22

    def fields(self, pairs, columns=2):
        """Label / value grid."""
        col = (self.right - self.left) / columns
        for i in range(0, len(pairs), columns):
            self.ensure(18)
            for j, (label, value) in enumerate(pairs[i:i + columns]):
                x = self.left + j * col
                self.c.setFont("Helvetica", 8)
                self.c.setFillColor(MUTED)
                self.c.drawString(x, self.y, str(label))
                self.c.setFont("Helvetica-Bold", 9.5)
                self.c.setFillColor(INK)
                text = str(value if value not in (None, "") else "—")
                limit = int((col - 100) / 5.2)
                self.c.drawString(x + 96, self.y, text if len(text) <= limit else text[:limit - 1] + "…")
            self.y -= 16
        self.y -= 6

    def table(self, header, rows, widths=None, align=None, totals=None, font=8.6):
        """Rows wrap within their columns; the header repeats on new pages.
        align: one letter per column, L or R."""
        n = len(header)
        widths = widths or [1] * n
        align = (align or "L" * n).ljust(n, "L")
        unit = (self.right - self.left) / sum(widths)
        cols = [w * unit for w in widths]

        def draw_header():
            self.ensure(40)
            self.c.setFillColor(SOFT)
            self.c.rect(self.left, self.y - 7, self.right - self.left, 20, stroke=0, fill=1)
            self.c.setFillColor(INK)
            self.c.setFont("Helvetica-Bold", font)
            x = self.left
            for i, label in enumerate(header):
                self._cell(str(label), x, cols[i], align[i], self.y, "Helvetica-Bold", font)
                x += cols[i]
            self.y -= 20

        def draw_row(values, bold=False, shade=False):
            face = "Helvetica-Bold" if bold else "Helvetica"
            lines = [wrap(str(v if v is not None else ""), face, font, cols[i] - 10) for i, v in enumerate(values)]
            height = max(len(x) for x in lines) * (font + 3) + 6
            if self.y - height < 48:
                self.c.showPage()
                self.header(full=False)
                draw_header()
            if shade or bold:
                self.c.setFillColor(SOFT if bold else BAND)
                self.c.rect(self.left, self.y - height + font + 1, self.right - self.left, height, stroke=0, fill=1)
            self.c.setFillColor(INK)
            x = self.left
            for i, chunk in enumerate(lines):
                for k, text in enumerate(chunk):
                    self._cell(text, x, cols[i], align[i], self.y - k * (font + 3), face, font)
                x += cols[i]
            self.y -= height
            self.c.setStrokeColor(LINE)
            self.c.setLineWidth(0.4)
            self.c.line(self.left, self.y + font - 1, self.right, self.y + font - 1)

        draw_header()
        for i, row in enumerate(rows):
            draw_row(row, shade=i % 2 == 1)
        if not rows:
            draw_row(["No records for this selection."] + [""] * (n - 1))
        if totals:
            draw_row(totals, bold=True)
        self.y -= 10

    def _cell(self, text, x, width, side, y, face, size):
        self.c.setFont(face, size)
        if side == "R":
            self.c.drawRightString(x + width - 5, y, text)
        else:
            self.c.drawString(x + 5, y, text)

    def statement(self, left_title, left, right_title, right, left_total, right_total):
        """Two-column earnings | deductions table with totals."""
        rows = []
        for i in range(max(len(left), len(right), 1)):
            a = left[i] if i < len(left) else ("", "")
            b = right[i] if i < len(right) else ("", "")
            rows.append([a[0], inr(a[1]) if a[0] else "", b[0], inr(b[1]) if b[0] else ""])
        self.table([left_title, "Amount (INR)", right_title, "Amount (INR)"], rows, widths=[2.2, 1.2, 2.2, 1.2], align="LRLR",
                   totals=[f"Total {left_title.lower()}", inr(left_total), f"Total {right_title.lower()}", inr(right_total)])

    def highlight(self, label, value, words="", stamp=None, stamp_color=None):
        self.ensure(70)
        box_y = self.y
        self.c.setFillColor(SOFT)
        self.c.roundRect(self.left, self.y - 34, self.right - self.left, 50, 8, stroke=0, fill=1)
        self.c.setFillColor(ACCENT)
        self.c.setFont("Helvetica-Bold", 12)
        self.c.drawString(self.left + 14, self.y - 2, label)
        self.c.setFont("Helvetica-Bold", 16)
        self.c.drawRightString(self.right - 14, self.y - 4, value)
        if words:
            self.c.setFont("Helvetica", 8.5)
            self.c.setFillColor(INK)
            self.c.drawString(self.left + 14, self.y - 22, words[:120])
        if stamp:
            self.stamp(stamp, stamp_color, x=(self.left + self.right) / 2 + 40, y=box_y - 6)
        self.y -= 62

    def note(self, text, size=8.5):
        for line in simpleSplit(text, "Helvetica", size, self.right - self.left):
            self.ensure(14)
            self.c.setFont("Helvetica", size)
            self.c.setFillColor(MUTED)
            self.c.drawString(self.left, self.y, line)
            self.y -= size + 4
        self.y -= 4

    def signature(self, left="Employee", right="Authorised signatory"):
        self.ensure(60)
        self.y -= 26
        self.c.setStrokeColor(LINE)
        self.c.line(self.left, self.y, self.left + 160, self.y)
        self.c.line(self.right - 160, self.y, self.right, self.y)
        self.c.setFont("Helvetica", 8)
        self.c.setFillColor(MUTED)
        self.c.drawString(self.left, self.y - 12, left)
        self.c.drawRightString(self.right, self.y - 12, right)
        self.y -= 24

    # -- richer blocks ---------------------------------------------------------------------
    def tiles(self, items):
        """A row of figure tiles: [(label, value, note), ...] (2–4 tiles)."""
        n = max(1, len(items))
        gap = 10
        width = (self.right - self.left - gap * (n - 1)) / n
        self.ensure(70)
        top = self.y + 8
        for i, item in enumerate(items):
            label, value, note = (list(item) + [""])[:3]
            x = self.left + i * (width + gap)
            highlight = i == n - 1
            self.c.setFillColor(ACCENT if highlight else BAND)
            self.c.setStrokeColor(ACCENT if highlight else LINE)
            self.c.roundRect(x, top - 56, width, 56, 8, stroke=1, fill=1)
            self.c.setFillColor(white if highlight else MUTED)
            self.c.setFont("Helvetica", 7.8)
            self.c.drawString(x + 10, top - 15, str(label).upper()[:34])
            self.c.setFillColor(white if highlight else INK)
            room = width - 20
            text, size = str(value), 13.5
            while size > 8.5 and self.c.stringWidth(text, "Helvetica-Bold", size) > room:
                size -= 0.5
            while len(text) > 3 and self.c.stringWidth(text, "Helvetica-Bold", size) > room:
                text = text[:-2] + "…"
            self.c.setFont("Helvetica-Bold", size)
            self.c.drawString(x + 10, top - 34, text)
            if note:
                note = str(note)
                while len(note) > 3 and self.c.stringWidth(note, "Helvetica", 7.5) > room:
                    note = note[:-2] + "…"
                self.c.setFont("Helvetica", 7.5)
                self.c.setFillColor(SOFT if highlight else MUTED)
                self.c.drawString(x + 10, top - 47, note)
        self.y = top - 74

    def panels(self, blocks):
        """Side-by-side boxed cards: [(title, [(label, value), ...]), ...]."""
        n = len(blocks)
        gap = 12
        width = (self.right - self.left - gap * (n - 1)) / n
        rows = max(len(b[1]) for b in blocks)
        height = 30 + rows * 15
        self.ensure(height + 10)
        top = self.y + 8
        for i, (title, pairs) in enumerate(blocks):
            x = self.left + i * (width + gap)
            self.c.setFillColor(white)
            self.c.setStrokeColor(LINE)
            self.c.roundRect(x, top - height, width, height, 8, stroke=1, fill=1)
            self.c.setFillColor(SOFT)
            self.c.roundRect(x, top - 22, width, 22, 8, stroke=0, fill=1)
            self.c.rect(x, top - 22, width, 10, stroke=0, fill=1)
            self.c.setFillColor(ACCENT)
            self.c.setFont("Helvetica-Bold", 8.5)
            self.c.drawString(x + 10, top - 15, str(title).upper())
            y = top - 38
            for label, value in pairs:
                self.c.setFont("Helvetica", 7.8)
                self.c.setFillColor(MUTED)
                self.c.drawString(x + 10, y, str(label))
                self.c.setFont("Helvetica-Bold", 8.6)
                self.c.setFillColor(INK)
                text = str(value if value not in (None, "") else "—")
                room = width * 0.58 - 12
                while text and self.c.stringWidth(text, "Helvetica-Bold", 8.6) > room:
                    text = text[:-2] + "…" if len(text) > 2 else ""
                self.c.drawRightString(x + width - 10, y, text)
                y -= 15
        self.y = top - height - 24

    def stamp(self, text, color=None, x=None, y=None):
        """Rotated outlined stamp (e.g. PAID); by default top-right of the page body."""
        tone = color or HexColor("#2f7d4f")
        self.c.saveState()
        self.c.translate(x if x is not None else self.right - 70, y if y is not None else self.height - 150)
        self.c.rotate(10)
        self.c.setStrokeColor(tone)
        self.c.setFillColor(tone)
        self.c.setLineWidth(2)
        width = self.c.stringWidth(text, "Helvetica-Bold", 18) + 24
        self.c.roundRect(-width / 2, -14, width, 32, 6, stroke=1, fill=0)
        self.c.setFont("Helvetica-Bold", 18)
        self.c.drawCentredString(0, -4, text)
        self.c.restoreState()

    def para(self, text, size=10, bold=False, color=None, gap=6):
        """Body text that wraps to the page width (letters, terms)."""
        face = "Helvetica-Bold" if bold else "Helvetica"
        for line in simpleSplit(str(text), face, size, self.right - self.left) or [""]:
            self.ensure(size + 6)
            self.c.setFont(face, size)
            self.c.setFillColor(color or INK)
            self.c.drawString(self.left, self.y, line)
            self.y -= size + 4
        self.y -= gap

    def bullets(self, items, size=9.5, numbered=False):
        for i, item in enumerate(items, 1):
            lines = simpleSplit(str(item), "Helvetica", size, self.right - self.left - 18) or [""]
            self.ensure(len(lines) * (size + 4) + 4)
            self.c.setFillColor(ACCENT)
            self.c.setFont("Helvetica-Bold", size)
            self.c.drawString(self.left + 2, self.y, f"{i}." if numbered else "•")
            self.c.setFillColor(INK)
            self.c.setFont("Helvetica", size)
            for k, line in enumerate(lines):
                self.c.drawString(self.left + 18, self.y, line)
                self.y -= size + 4
            self.y -= 2
        self.y -= 6

    def page_break(self, title=None, subtitle=None):
        self.c.showPage()
        if title:
            self.title = title
        if subtitle is not None:
            self.subtitle = subtitle
        self.header(full=True)

    def finish(self):
        self.c.showPage()
        self.c.save()
        return self.out.getvalue()
