import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import QRCode from "qrcode";
import type { PDFReport } from "./report-types";
const clean = (value: string) =>
  String(value ?? "")
    .replaceAll("₹", "INR ")
    .replace(/[–—]/g, "-")
    .replaceAll("→", " > ")
    .replaceAll("·", " | ")
    .replaceAll("’", "'")
    .replace(/[^\x20-\x7e\n]/g, " ");
export async function createReport(report: PDFReport): Promise<Blob> {
  const doc = new jsPDF({
    orientation: report.landscape ? "landscape" : "portrait",
    unit: "mm",
    format: "a4",
    compress: true,
  });
  const width = doc.internal.pageSize.getWidth(),
    height = doc.internal.pageSize.getHeight(),
    margin = 16,
    usable = width - margin * 2;
  const context = report.context || {},
    skyline = context.college?.slug === "skyline-institute";
  const accent: [number, number, number] = skyline
    ? [23, 85, 171]
    : [151, 101, 40];
  const ink: [number, number, number] = [28, 38, 52],
    muted: [number, number, number] = [95, 107, 122];
  let crest: string | undefined;
  if (context.college && typeof document !== "undefined")
    try {
      const img = new Image();
      img.src = `/assets/colleges-institutions/${context.college.slug}/crest.svg`;
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = 160;
      canvas.height = 190;
      canvas.getContext("2d")!.drawImage(img, 0, 0, 160, 190);
      crest = canvas.toDataURL("image/png");
    } catch {
      /* The vector book below is the local fallback. */
    }
  let y = 88;
  doc.setProperties({
    title: clean(report.title),
    author: context.college?.name || "KC Web Universe",
    subject: "Fictional campus demonstration report",
    creator: "KC Web Universe ERP",
  });
  const newSpace = (size: number) => {
    if (y + size > height - 22) {
      doc.addPage();
      y = 32;
    }
  };
  const heading = (text: string) => {
    newSpace(18);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...accent);
    doc.text(clean(text), margin, y);
    y += 5;
  };
  const table = (
    head: string[] | undefined,
    body: string[][],
    widths?: Record<number, { cellWidth: number }>,
  ) => {
    autoTable(doc, {
      startY: y,
      head: head ? [head.map(clean)] : undefined,
      body: body.map((r) => r.map(clean)),
      margin: { top: 32, right: margin, bottom: 23, left: margin },
      tableWidth: usable,
      theme: "grid",
      styles: {
        font: "helvetica",
        fontSize: report.landscape ? 7.3 : 8,
        cellPadding: report.landscape ? 1.7 : 2.7,
        textColor: ink,
        lineColor: [222, 227, 234],
        lineWidth: 0.15,
        overflow: "linebreak",
        valign: "top",
      },
      headStyles: {
        fillColor: accent,
        textColor: [255, 255, 255],
        fontStyle: "bold",
      },
      alternateRowStyles: { fillColor: [247, 249, 252] },
      columnStyles:
        widths ||
        Object.fromEntries(
          (head || []).map((label, i) => [
            i,
            /INR|CGST|SGST|IGST|GST rate/i.test(label)
              ? { halign: "right" as const }
              : {},
          ]),
        ),
      didParseCell: (data) => {
        if (
          data.section === "body" &&
          /^(Grand total|Total received|Total transaction|Annual total|Outstanding balance)/i.test(
            String(body[data.row.index]?.[0] || ""),
          )
        ) {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fillColor = [237, 242, 248];
        }
      },
      rowPageBreak: "avoid",
      showHead: "everyPage",
      didDrawPage: (data) => {
        y = data.cursor?.y || 88;
      },
    });
    y =
      (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable
        ?.finalY || y;
    y += 9;
  };
  if (context.institution) {
    heading("Institution details");
    table(
      undefined,
      Object.entries(context.institution)
        .filter(([, value]) => value)
        .map(([key, value]) => [
          key === "gstin"
            ? "GSTIN"
            : key
                .replace(/([A-Z])/g, " $1")
                .replace(/^./, (letter) => letter.toUpperCase()),
          String(value),
        ]),
      { 0: { cellWidth: 43 } },
    );
  }
  if (context.reference || context.preparedBy || context.filters) {
    heading("Document information");
    table(
      undefined,
      [
        ["Reference", context.reference || "Not assigned"],
        ["Prepared by", context.preparedBy || "Campus demo workspace"],
        ["Selection / filters", context.filters || "Current records"],
      ],
      { 0: { cellWidth: 43 } },
    );
  }
  for (const section of report.sections) {
    heading(section.title);
    if (section.image) {
      newSpace(45);
      const imageInfo = doc.getImageProperties(section.image);
      const scale = Math.min(27 / imageInfo.width, 33 / imageInfo.height);
      doc.addImage(
        section.image,
        section.image.startsWith("data:image/webp")
          ? "WEBP"
          : section.image.startsWith("data:image/png")
            ? "PNG"
            : "JPEG",
        margin,
        y,
        imageInfo.width * scale,
        imageInfo.height * scale,
      );
      y += 39;
    }
    if (section.fields?.length)
      table(undefined, section.fields, {
        0: { cellWidth: Math.min(55, usable * 0.3) },
      });
    if (section.columns) {
      const all = section.columns;
      if (!section.rows?.length)
        table(all, [
          all.map((_, i) => (i === 0 ? "No records in this selection." : "")),
        ]);
      else if (all.length > 12) {
        for (let i = 1; i < all.length; i += 6) {
          const indexes = [
            0,
            ...Array.from(
              { length: Math.min(6, all.length - i) },
              (_, j) => i + j,
            ),
          ];
          table(
            indexes.map((n) => all[n]),
            section.rows.map((r) => indexes.map((n) => r[n] || "")),
          );
        }
      } else table(all, section.rows || []);
    }
    for (const text of section.paragraphs || []) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(...muted);
      const lines: string[] = doc.splitTextToSize(clean(text), usable);
      for (const line of lines) {
        newSpace(5);
        doc.text(line, margin, y);
        y += 4.5;
      }
      y += 4;
    }
  }
  if (report.verification) {
    newSpace(42);
    heading("Document verification");
    const qr = await QRCode.toDataURL(report.verification, {
      errorCorrectionLevel: "M",
      margin: 4,
      width: 220,
    });
    doc.addImage(qr, "PNG", margin, y, 30, 30);
    doc.setFontSize(8);
    doc.setTextColor(...muted);
    doc.text(
      doc.splitTextToSize(clean(report.verification), usable - 40),
      margin + 38,
      y + 8,
    );
    doc.text("Browser-local demo verification only.", margin + 38, y + 23);
    y += 38;
  }
  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page);
    doc.setFillColor(...accent);
    doc.rect(0, 0, width, 5, "F");
    if (page === 1) {
      doc.setDrawColor(...accent);
      doc.setLineWidth(0.6);
      if (crest) doc.addImage(crest, "PNG", margin, 13, 16, 19);
      else {
        doc.roundedRect(margin, 13, 16, 19, 2, 2, "S");
        doc.line(margin + 3, 18, margin + 8, 20);
        doc.line(margin + 8, 20, margin + 13, 18);
        doc.line(margin + 8, 20, margin + 8, 28);
        doc.line(margin + 3, 18, margin + 3, 26);
        doc.line(margin + 3, 26, margin + 8, 28);
        doc.line(margin + 13, 18, margin + 13, 26);
        doc.line(margin + 13, 26, margin + 8, 28);
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(...ink);
      doc.text(
        doc.splitTextToSize(
          clean(context.college?.name || "Campus management"),
          usable - 25,
        ),
        margin + 23,
        19,
      );
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...muted);
      const inst = context.institution;
      doc.text(
        doc
          .splitTextToSize(
            clean(
              `Address: ${inst?.address || "Not provided (demonstration institution)"}`,
            ),
            usable,
          )
          .slice(0, 2),
        margin,
        40,
      );
      doc.text(
        doc.splitTextToSize(
          clean(
            `Contact: ${inst?.phone || "Not provided"} | ${inst?.email || "Not provided"}`,
          ),
          usable,
        )[0],
        margin,
        51,
      );
      doc.text(
        doc.splitTextToSize(
          clean(
            `GSTIN: ${inst?.gstin || "Not configured"} | Registration: ${inst?.registration || "Not provided"} | State: ${inst?.state || "Not provided"}`,
          ),
          usable,
        )[0],
        margin,
        57,
      );
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(...accent);
      doc.text(doc.splitTextToSize(clean(report.title), usable), margin, 69);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(...muted);
      doc.text(
        `Generated: ${new Date().toISOString().replace("T", " ").slice(0, 19)} UTC`,
        margin,
        79,
      );
      doc.text("FICTIONAL DEMONSTRATION", width - margin, 79, {
        align: "right",
      });
    } else {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(...ink);
      doc.text(clean(context.college?.name || "Campus management"), margin, 14);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...muted);
      doc.text(clean(report.title), margin, 21);
      doc.setFontSize(7);
      doc.text(
        clean(context.reference || "Demonstration report"),
        width - margin,
        21,
        { align: "right" },
      );
      doc.setDrawColor(220, 226, 233);
      doc.setLineWidth(0.2);
      doc.line(margin, 26, width - margin, 26);
    }
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...muted);
    doc.setDrawColor(220, 226, 233);
    doc.setLineWidth(0.2);
    doc.line(margin, height - 17, width - margin, height - 17);
    doc.setFontSize(7);
    doc.text(
      "Demo records only. Not a tax invoice, statutory certificate, or proof of payment.",
      margin,
      height - 12,
    );
    doc.text(`Page ${page} of ${pageCount}`, width - margin, height - 8, {
      align: "right",
    });
    doc.text(
      "KC Web Universe | Amounts in INR unless specified",
      margin,
      height - 8,
    );
  }
  return doc.output("blob");
}
