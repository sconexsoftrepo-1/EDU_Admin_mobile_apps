/**
 * Compact A4 admission form for the enrollment review: four-column label/value rows, small
 * section bands and a signature strip, so a typical enrollment fits on one sheet.
 */
import { jsPDF } from "jspdf";
import autoTable, { type CellInput, type RowInput } from "jspdf-autotable";
import { download } from "./download";

export type FormSection = {
  title: string;
  fields?: [string, string][];
  columns?: string[];
  rows?: string[][];
};
export type EnrollmentForm = {
  college: string;
  title: string;
  photo?: string;
  numbers: [string, string][];
  sections: FormSection[];
  signatures: string[];
};

const ACCENT: [number, number, number] = [165, 104, 36];
const BAND: [number, number, number] = [246, 230, 206];
const INK: [number, number, number] = [36, 29, 24];
const MUTED: [number, number, number] = [118, 105, 94];
const LINE: [number, number, number] = [226, 214, 198];
const clean = (value: string) =>
  String(value ?? "")
    .replaceAll("₹", "Rs. ")
    .replace(/[–—]/g, "-")
    .replaceAll("·", "|")
    .replaceAll("•", "*")
    .replace(/[^\x20-\x7e\n]/g, " ")
    .trim() || "-";
/** Values longer than this get a full row instead of half of one. */
const LONG = 46;

async function logo() {
  try {
    const img = new Image();
    img.src = "/assets/pragathilogo.jpg";
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = 200;
    canvas.height = 200;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, 200, 200);
    const scale = Math.min(200 / img.naturalWidth, 200 / img.naturalHeight);
    const w = img.naturalWidth * scale;
    const h = img.naturalHeight * scale;
    ctx.drawImage(img, (200 - w) / 2, (200 - h) / 2, w, h);
    return canvas.toDataURL("image/png");
  } catch {
    return undefined;
  }
}

const imageType = (data: string) =>
  data.startsWith("data:image/png") ? "PNG" : data.startsWith("data:image/webp") ? "WEBP" : "JPEG";

export async function enrollmentPdf(name: string, form: EnrollmentForm) {
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const margin = 11;
  const usable = width - margin * 2;
  const label = { textColor: MUTED, fontSize: 7, cellWidth: 34 } as const;
  let y = 0;

  // Header: logo, college and form title on the left, photo on the right.
  const crest = await logo();
  if (crest) doc.addImage(crest, "PNG", margin, 8, 13, 13);
  doc.setFont("helvetica", "bold").setFontSize(13).setTextColor(...INK);
  doc.text(clean(form.college), margin + 16, 13.5);
  doc.setFontSize(9).setTextColor(...ACCENT);
  doc.text(clean(form.title), margin + 16, 19);
  const photoW = 24;
  const photoH = 29;
  const photoX = width - margin - photoW;
  doc.setDrawColor(...LINE).setLineWidth(0.3).rect(photoX, 8, photoW, photoH);
  if (form.photo) {
    const info = doc.getImageProperties(form.photo);
    const scale = Math.min(photoW / info.width, photoH / info.height);
    const w = info.width * scale;
    const h = info.height * scale;
    doc.addImage(form.photo, imageType(form.photo), photoX + (photoW - w) / 2, 8 + (photoH - h) / 2, w, h);
  } else {
    doc.setFont("helvetica", "normal").setFontSize(7).setTextColor(...MUTED);
    doc.text("Affix photo", photoX + photoW / 2, 8 + photoH / 2, { align: "center" });
  }

  // Admission numbers beside the photo.
  const numberRows: RowInput[] = [];
  for (let i = 0; i < form.numbers.length; i += 2) {
    const pair = form.numbers.slice(i, i + 2);
    numberRows.push(
      pair.flatMap(([k, v]) => [
        { content: clean(k), styles: { ...label } },
        { content: clean(v), styles: { fontStyle: "bold" as const } },
      ]),
    );
  }
  autoTable(doc, {
    startY: 23,
    body: numberRows,
    margin: { left: margin, right: margin + photoW + 3 },
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 1.3, textColor: INK, lineColor: LINE, lineWidth: 0.15 },
  });
  y = Math.max(8 + photoH, lastY(doc)) + 3;

  const band = (title: string, span: number): RowInput => [
    {
      content: clean(title).toUpperCase(),
      colSpan: span,
      styles: { fillColor: BAND, textColor: INK, fontStyle: "bold", fontSize: 7.5, cellPadding: { top: 1.1, bottom: 1.1, left: 1.6, right: 1.6 } },
    },
  ];

  for (const section of form.sections) {
    let head: RowInput[];
    let body: RowInput[];
    let columnStyles = {};
    if (section.fields) {
      head = [band(section.title, 4)];
      body = [];
      // Two pairs per row; long values (addresses, names of institutions) take the whole row.
      let pending: CellInput[] = [];
      const flush = () => {
        if (pending.length) body.push([...pending, ...(pending.length === 2 ? [{ content: "", colSpan: 2 }] : [])]);
        pending = [];
      };
      for (const [k, v] of section.fields) {
        const value = clean(v);
        if (value.length > LONG) {
          flush();
          body.push([{ content: clean(k), styles: { ...label } }, { content: value, colSpan: 3 }]);
          continue;
        }
        pending.push({ content: clean(k), styles: { ...label } }, { content: value });
        if (pending.length === 4) flush();
      }
      flush();
    } else {
      const columns = section.columns || [];
      head = [
        band(section.title, columns.length),
        columns.map((c) => ({ content: clean(c), styles: { fillColor: [251, 248, 243] as [number, number, number], textColor: MUTED, fontSize: 7, fontStyle: "bold" as const } })),
      ];
      body = (section.rows || []).map((row) => {
        const total = /^(Gross fee|Net payable)$/.test(row[0]);
        return row.map((cell) => ({
          content: clean(cell),
          styles: total ? { fontStyle: "bold" as const, fillColor: [246, 230, 206] as [number, number, number] } : {},
        }));
      });
      if (/fee breakdown/i.test(section.title)) columnStyles = { [columns.length - 1]: { halign: "right" } };
    }
    autoTable(doc, {
      startY: y,
      head,
      body,
      margin: { top: 14, left: margin, right: margin, bottom: 14 },
      tableWidth: usable,
      theme: "grid",
      styles: { font: "helvetica", fontSize: 8, cellPadding: 1.3, textColor: INK, lineColor: LINE, lineWidth: 0.15, overflow: "linebreak", valign: "middle" },
      headStyles: { fillColor: BAND, textColor: INK },
      columnStyles,
      rowPageBreak: "avoid",
      showHead: "firstPage",
    });
    y = lastY(doc) + 2.2;
  }

  // Signatures, kept together at the end.
  if (y + 20 > height - 14) {
    doc.addPage();
    y = 16;
  }
  y += 11;
  const slot = usable / form.signatures.length;
  doc.setDrawColor(...MUTED).setLineWidth(0.2);
  doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(...MUTED);
  form.signatures.forEach((who, i) => {
    const x = margin + i * slot;
    doc.line(x + 3, y, x + slot - 3, y);
    doc.text(clean(who), x + slot / 2, y + 4, { align: "center" });
  });

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    doc.setFillColor(...ACCENT).rect(0, 0, width, 3, "F");
    doc.setFont("helvetica", "normal").setFontSize(6.5).setTextColor(...MUTED);
    doc.text(`Generated ${new Date().toLocaleString("en-IN")}`, margin, height - 7);
    doc.text(`Page ${page} of ${pages}`, width - margin, height - 7, { align: "right" });
  }
  const blob = doc.output("blob");
  download(`${name}.pdf`, blob, "application/pdf");
  return blob;
}

function lastY(doc: jsPDF) {
  return (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 0;
}
