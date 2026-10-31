import type { PDFContext, PDFReport, PDFSection } from "./report-types";
export function download(name: string, body: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
export function csv(name: string, rows: Record<string, unknown>[]) {
  const keys = Array.from(new Set(rows.flatMap(Object.keys)));
  const escape = (v: unknown) =>
    '"' +
    String(v ?? "")
      .replace(/^[=+@\t\r-]/, "'")
      .replaceAll('"', '""') +
    '"';
  download(
    name + ".csv",
    [keys, ...rows.map((r) => keys.map((k) => r[k]))]
      .map((r) => r.map(escape).join(","))
      .join("\r\n"),
    "text/csv;charset=utf-8",
  );
}
export type PDFMode = "view" | "download";
export async function professionalPdf(
  name: string,
  report: PDFReport,
  mode: PDFMode = "download",
) {
  const trigger =
    typeof document !== "undefined" &&
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
  const { createReport } = await import("./report-engine");
  const blob = await createReport(report);
  if (mode === "view")
    window.dispatchEvent(
      new CustomEvent("college:pdf-preview", {
        detail: { name, blob, trigger },
      }),
    );
  else download(name + ".pdf", blob, "application/pdf");
}
export function pdf(
  name: string,
  lines: string[],
  verification?: string,
  context?: PDFContext,
) {
  const sections: PDFSection[] = [];
  let current: PDFSection = {
    title: "Document details",
    fields: [],
    paragraphs: [],
  };
  for (const line of lines) {
    if (!line.trim()) continue;
    if (line === context?.college?.name) continue;
    if (
      line.length < 85 &&
      line === line.toUpperCase() &&
      /[A-Z]/.test(line) &&
      !line.includes(":")
    ) {
      if (current.fields?.length || current.paragraphs?.length)
        sections.push(current);
      current = { title: line, fields: [], paragraphs: [] };
      continue;
    }
    const split = line.indexOf(":");
    if (split > 0 && split < 45 && !line.includes(" | "))
      current.fields?.push([
        line.slice(0, split),
        line.slice(split + 1).trim(),
      ]);
    else current.paragraphs?.push(line);
  }
  if (current.fields?.length || current.paragraphs?.length)
    sections.push(current);
  return professionalPdf(name, {
    title:
      lines.find(
        (line) =>
          line.trim() &&
          line === line.toUpperCase() &&
          /[A-Z]/.test(line) &&
          !line.includes(":"),
      ) ||
      lines.find((line) => line !== context?.college?.name && line.trim()) ||
      name,
    context,
    sections,
    verification,
  });
}
