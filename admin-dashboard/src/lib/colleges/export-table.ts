/**
 * Excel and PDF exports of an on-screen table, with a "Grand total" row for currency columns.
 * Excel: grey bold header, bordered cells, normal sheet gridlines, auto column widths,
 * amounts as real numbers.
 */
import { download, professionalPdf } from "./download";

/** Columns that hold money (by their header), e.g. "Amount", "Net pay / month", "Fee (INR)". */
export function isCurrencyColumn(label: string) {
  return (
    /(amount|fee|fees|balance|paid|outstanding|salary|net pay|gross|price|cost|total|scholarship|concession|\bpay\b|inr|₹)/i.test(
      label,
    ) &&
    !/(date|code|name|mode|method|type|status|year|number|\bid\b|count|structure|category|running|rate)/i.test(
      label,
    )
  );
}

/** "₹45,000.50" / "45000.5" / "INR 1,200" → number; NaN when the text is not an amount. */
export function parseAmount(value: string) {
  const text = value.replace(/₹|INR|Rs\.?|,|\s/gi, "");
  return text && /^-?\d+(\.\d+)?$/.test(text) ? Number(text) : NaN;
}

const money = (n: number) =>
  n.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/** Indexes of currency columns that actually contain amounts. */
function currencyColumns(columns: string[], rows: string[][]) {
  return columns
    .map((label, i) => i)
    .filter(
      (i) =>
        isCurrencyColumn(columns[i]) &&
        rows.some((r) => !Number.isNaN(parseAmount(r[i] ?? ""))),
    );
}

/** "Grand total" row (first cell) with the sum of each currency column, or null if none. */
export function totalsRow(columns: string[], rows: string[][]) {
  const money_ = currencyColumns(columns, rows);
  if (!money_.length || !rows.length) return null;
  return columns.map((_, i) => {
    if (money_.includes(i)) {
      const sum = rows.reduce((s, r) => {
        const n = parseAmount(r[i] ?? "");
        return Number.isNaN(n) ? s : s + n;
      }, 0);
      const rupee = rows.some((r) => (r[i] ?? "").includes("₹"));
      return `${rupee ? "₹" : ""}${money(sum)}`;
    }
    return i === 0 ? "Grand total" : "";
  });
}

const xml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

/** Excel workbook (.xls, SpreadsheetML) of the table, with styling and a totals row. */
export function excelTable(
  name: string,
  sheet: string,
  columns: string[],
  rows: string[][],
) {
  const amounts = currencyColumns(columns, rows);
  const total = totalsRow(columns, rows);
  // Width in points from the longest text in each column (header, values, total).
  const widths = columns.map((label, i) => {
    const longest = Math.max(
      label.length,
      ...rows.map((r) => (r[i] ?? "").split("\n")[0].length),
      total ? total[i].length : 0,
    );
    return Math.min(320, Math.max(60, Math.round(longest * 7 + 16)));
  });
  const cell = (value: string, i: number, kind: "cell" | "total") => {
    const n = amounts.includes(i) ? parseAmount(value) : NaN;
    return Number.isNaN(n)
      ? `<Cell ss:StyleID="${kind}"><Data ss:Type="String">${xml(value)}</Data></Cell>`
      : `<Cell ss:StyleID="${kind}Num"><Data ss:Type="Number">${n}</Data></Cell>`;
  };
  const border = `<Borders>${["Bottom", "Left", "Right", "Top"]
    .map(
      (p) =>
        `<Border ss:Position="${p}" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BFBFBF"/>`,
    )
    .join("")}</Borders>`;
  download(
    `${name}.xls`,
    `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles>
    <Style ss:ID="Default" ss:Name="Normal"><Alignment ss:Vertical="Center"/><Font ss:FontName="Calibri" ss:Size="11" ss:Color="#000000"/></Style>
    <Style ss:ID="head"><Alignment ss:Vertical="Center" ss:WrapText="1"/>${border}<Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#000000"/><Interior ss:Color="#D9D9D9" ss:Pattern="Solid"/></Style>
    <Style ss:ID="cell"><Alignment ss:Vertical="Top" ss:WrapText="1"/>${border}</Style>
    <Style ss:ID="cellNum"><Alignment ss:Horizontal="Right" ss:Vertical="Top"/>${border}<NumberFormat ss:Format="#,##0.00"/></Style>
    <Style ss:ID="total"><Alignment ss:Vertical="Center"/>${border}<Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#000000"/><Interior ss:Color="#F2F2F2" ss:Pattern="Solid"/></Style>
    <Style ss:ID="totalNum"><Alignment ss:Horizontal="Right" ss:Vertical="Center"/>${border}<Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#000000"/><Interior ss:Color="#F2F2F2" ss:Pattern="Solid"/><NumberFormat ss:Format="#,##0.00"/></Style>
  </Styles>
  <Worksheet ss:Name="${xml(sheet.replace(/[\\/?*[\]:]/g, " ").slice(0, 31) || "Sheet1")}">
    <Table>
      ${widths.map((w) => `<Column ss:Width="${w}"/>`).join("")}
      <Row ss:Height="20">${columns.map((c) => `<Cell ss:StyleID="head"><Data ss:Type="String">${xml(c)}</Data></Cell>`).join("")}</Row>
      ${rows.map((r) => `<Row>${columns.map((_, i) => cell(r[i] ?? "", i, "cell")).join("")}</Row>`).join("\n      ")}
      ${total ? `<Row>${total.map((v, i) => cell(v, i, "total")).join("")}</Row>` : ""}
    </Table>
    <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
      <FreezePanes/><FrozenNoSplit/><SplitHorizontal>1</SplitHorizontal><TopRowBottomPane>1</TopRowBottomPane><ActivePane>2</ActivePane>
    </WorksheetOptions>
  </Worksheet>
</Workbook>`,
    "application/vnd.ms-excel",
  );
}

/** Landscape PDF of the table (Pragathi logo header), with the same "Grand total" row. */
export function pdfTable(
  name: string,
  title: string,
  subtitle: string,
  columns: string[],
  rows: string[][],
) {
  const total = totalsRow(columns, rows);
  return professionalPdf(name, {
    title,
    landscape: true,
    sections: [
      {
        title: subtitle,
        columns,
        rows: total ? [...rows, total] : rows,
      },
    ],
  });
}

/** Table header from a field key: "emergency_contact_name" → "Emergency Contact Name". */
export const headerLabel = (key: string) =>
  key
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
