import type { RecordRow } from "./store";
export type FeeComponent = {
  id: string;
  name: string;
  amount: number;
  gstRate: number;
};
export type TaxMode =
  "not-configured" | "no-tax" | "intra-state" | "inter-state";
export type InstitutionDetails = {
  address?: string;
  email?: string;
  phone?: string;
  website?: string;
  gstin?: string;
  registration?: string;
  state?: string;
};
export function feeComponents(row: RecordRow): FeeComponent[] {
  if (row.components?.length) return row.components.map((c) => ({ ...c }));
  const heads: [string, number][] = [
    ["Tuition", 60],
    ["Admission", 5],
    ["Library", 3],
    ["Laboratory", 8],
    ["Examination", 6],
    ["University", 5],
    ["Student services", 3],
    ["Hostel", 6],
    ["Transport", 4],
  ];
  let assigned = 0;
  return heads.map(([name, percent], i) => {
    const amount =
      i === heads.length - 1
        ? (row.amount || 0) - assigned
        : Math.floor(((row.amount || 0) * percent) / 100);
    assigned += amount;
    return { id: `fee-${i + 1}`, name, amount, gstRate: 0 };
  });
}
export function feeTotals(components: FeeComponent[], mode: TaxMode) {
  const lines = components.map((c) => {
    const tax = ["intra-state", "inter-state"].includes(mode)
      ? Math.round((c.amount * Math.round(c.gstRate * 100)) / 10000)
      : 0;
    const cgst = mode === "intra-state" ? Math.floor(tax / 2) : 0;
    return {
      ...c,
      tax,
      cgst,
      sgst: mode === "intra-state" ? tax - cgst : 0,
      igst: mode === "inter-state" ? tax : 0,
      total: c.amount + tax,
    };
  });
  return {
    lines,
    base: lines.reduce((n, c) => n + c.amount, 0),
    gst: lines.reduce((n, c) => n + c.tax, 0),
    cgst: lines.reduce((n, c) => n + c.cgst, 0),
    sgst: lines.reduce((n, c) => n + c.sgst, 0),
    igst: lines.reduce((n, c) => n + c.igst, 0),
    total: lines.reduce((n, c) => n + c.total, 0),
  };
}
export const taxLabel = (mode: TaxMode) =>
  ({
    "not-configured": "GST not configured",
    "no-tax": "No GST applied (configured)",
    "intra-state": "CGST + SGST (configured)",
    "inter-state": "IGST (configured)",
  })[mode];
