import { type College, type Role } from "@/data/colleges";
import {
  type CollegeState,
  type RecordRow,
  type Student,
  paid,
  balance,
} from "./store";
import { semesterAmounts } from "./program-fee-schedules";
import { feeComponents, feeTotals, taxLabel } from "./fees";
import type { PDFContext, PDFReport, PDFSection } from "./report-types";
import { totalsRow } from "./export-table";
export const inr = (n: number) =>
  `INR ${(n / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const reportContext = (
  c: College,
  s: CollegeState,
  role?: Role | null,
  filters?: string,
): PDFContext => ({
  college: c,
  institution: s.institution,
  preparedBy: role || "Campus demo workspace",
  filters,
});
const studentFields = (st: Student): [string, string][] => [
  ["Student name", st.name],
  ["Student / roll ID", st.id],
  ["Program / department", `${st.program} / ${st.department}`],
  ["Academic year", st.year],
  ["Guardian", st.guardian],
  ["Email", st.email],
  ["Enrollment status", st.status],
  ...Object.entries(st.profile || {})
    .filter(([key, value]) => key !== "photo" && value)
    .map(([key, value]): [string, string] => [
      key.replace(/([A-Z])/g, " $1"),
      String(value),
    ]),
];
const paymentColumns = [
  "Receipt / transaction",
  "Date",
  "Fee category",
  "Method",
  "Reference",
  "Status",
  "Amount (INR)",
];
const paymentRows = (rows: RecordRow[]) =>
  rows.map((p) => [
    p.id,
    p.date,
    p.category || "Not recorded",
    p.method || "Not recorded",
    p.reference || "Not recorded",
    p.status,
    inr(p.amount || 0),
  ]);
export function structureSections(row: RecordRow): PDFSection[] {
  const totals = feeTotals(feeComponents(row), row.taxMode || "not-configured");
  return [
    {
      title: row.name,
      fields: [
        ["Structure reference", row.id],
        ["Status", row.status],
        ["GST treatment", taxLabel(row.taxMode || "not-configured")],
        [
          "Allocation basis",
          row.components?.length
            ? "Saved component schedule"
            : "Illustrative allocation of the existing total; review before adoption",
        ],
      ],
    },
    {
      title: "Itemized fee schedule",
      columns: [
        "Fee head",
        "Base (INR)",
        "GST rate",
        "CGST",
        "SGST",
        "IGST",
        "Total (INR)",
      ],
      rows: totals.lines.map((l) => [
        l.name,
        inr(l.amount),
        ["intra-state", "inter-state"].includes(row.taxMode || "")
          ? `${l.gstRate}%`
          : "Not applied",
        inr(l.cgst),
        inr(l.sgst),
        inr(l.igst),
        inr(l.total),
      ]),
    },
    {
      title: "Fee totals",
      fields: [
        ["Base fee", inr(totals.base)],
        ["CGST", inr(totals.cgst)],
        ["SGST", inr(totals.sgst)],
        ["IGST", inr(totals.igst)],
        ["Total GST", inr(totals.gst)],
        [
          row.feeSchedule?.basis === "full_course"
            ? "Full course total"
            : "Grand total / annual fee",
          inr(totals.total),
        ],
      ],
    },
    ...(row.feeSchedule?.basis === "full_course"
      ? [
          {
            title: "Semester payment schedule",
            columns: ["Year", "Semester", "Payable (INR)", "Due date"],
            rows: semesterAmounts(
              totals.lines.map((line) => line.total),
              row.feeSchedule.termCount,
            ).map((amount, i) => [
              String(Math.floor(i / 2) + 1),
              String(i + 1),
              inr(amount),
              row.feeSchedule!.termDueDates[i] || "Not scheduled",
            ]),
          },
        ]
      : []),
    {
      title: "Terms & scope",
      paragraphs: [
        row.terms ||
          (row.feeSchedule?.basis === "full_course"
            ? "Full course fee divided across semesters. Existing student charges are preserved."
            : "Annual program schedule. Existing student assignments are not changed by editing this structure."),
        row.note || "No additional notes.",
        row.taxMode === "not-configured" || !row.taxMode
          ? "Tax treatment has not been configured. Zero displayed tax is not a statement of tax exemption."
          : "Tax values follow the configured demo rates; review applicability before real use.",
        "Hostel, transport and other heads in an illustrative allocation are not evidence that a student has opted into those services.",
      ],
    },
  ];
}
export function structureReport(
  c: College,
  s: CollegeState,
  row: RecordRow,
  role?: Role | null,
): PDFReport {
  return {
    title: "Program fee structure & tax breakdown",
    context: { ...reportContext(c, s, role), reference: row.id },
    sections: structureSections(row),
  };
}
export function receiptReport(
  c: College,
  s: CollegeState,
  row: RecordRow,
  role?: Role | null,
): PDFReport {
  const st = s.students.find((st) => st.id === row.studentId);
  const report: PDFReport = {
    title: "Payment receipt & student account summary",
    context: { ...reportContext(c, s, role), reference: row.id },
    sections: [
      ...(st
        ? [
            {
              title: "Student details",
              fields: studentFields(st),
              image: st.profile?.photo,
            },
          ]
        : [
            {
              title: "Student details",
              fields: [
                ["Student ID", row.studentId || "Not recorded"],
                ["Name", row.name],
              ] as [string, string][],
            },
          ]),
      {
        title: "Payment details",
        fields: [
          ["Amount received", inr(row.amount || 0)],
          [
            "Student name / roll ID",
            `${st?.name || row.name} / ${row.studentId || "Not recorded"}`,
          ],
          ["Receipt number", row.id],
          ["Payment date", row.date],
          ["Payment method", row.method || "Not recorded"],
          ["Transaction reference", row.reference || "Not recorded"],
          ["Payment status", row.status],
          ["Received for", row.category || "Not recorded"],
          ["Paid by", row.paidBy || "Not recorded"],
          ["Payment remarks", row.note || "No remarks recorded"],
        ],
      },
      {
        title: "Transaction breakdown",
        columns: ["Particulars", "Recorded amount (INR)"],
        rows: row.paymentTax
          ? [
              [row.category || "Payment received", inr(row.paymentTax.base)],
              ["GST treatment", taxLabel(row.paymentTax.mode)],
              ["GST rate (included)", `${row.paymentTax.rate}%`],
              ["CGST", inr(row.paymentTax.cgst)],
              ["SGST", inr(row.paymentTax.sgst)],
              ["IGST", inr(row.paymentTax.igst)],
              ["Total received, including recorded GST", inr(row.amount || 0)],
            ]
          : [
              [row.category || "Payment received", inr(row.amount || 0)],
              ["CGST / SGST / IGST", "Not recorded on original transaction"],
              [
                "GST rate / taxable value",
                "Not recorded on original transaction",
              ],
              ["Total transaction amount", inr(row.amount || 0)],
            ],
      },
      ...(st
        ? [
            {
              title: "Current student ledger (at export)",
              fields: [
                ["Assigned fee", inr(st.fee)],
                ["Approved scholarships / adjustments", inr(st.scholarship)],
                ["Net assigned fee", inr(Math.max(0, st.fee - st.scholarship))],
                ["Completed payments to date", inr(paid(s, st.id))],
                ["Outstanding balance", inr(balance(s, st))],
              ] as [string, string][],
            },
          ]
        : []),
      {
        title: "Receipt notes",
        paragraphs: [
          "No real funds were transferred. This is a simulated receipt, not a tax invoice.",
          "GST appears only when recorded with the transaction. Missing tax or per-head allocations are not reconstructed from the current fee structure. Current balances may include payments after this receipt.",
        ],
      },
    ],
  };
  const order = ["Payment details", "Transaction breakdown"];
  report.sections.sort(
    (a, b) =>
      (order.includes(a.title) ? order.indexOf(a.title) : 2) -
      (order.includes(b.title) ? order.indexOf(b.title) : 2),
  );
  return report;
}
export function ledgerReport(
  c: College,
  s: CollegeState,
  st: Student,
  role?: Role | null,
): PDFReport {
  const structure = s.structures.find((r) => r.name === st.program),
    transactions = s.payments.filter((p) => p.studentId === st.id);
  const report: PDFReport = {
    title: "Detailed student fee statement",
    context: { ...reportContext(c, s, role), reference: st.id },
    sections: [
      {
        title: "Student details",
        fields: studentFields(st),
        image: st.profile?.photo,
      },
      {
        title: "Account reconciliation",
        fields: [
          ["Assigned academic fee", inr(st.fee)],
          ["Approved scholarship / discount", inr(st.scholarship)],
          ["Net assigned fee", inr(Math.max(0, st.fee - st.scholarship))],
          ["Completed payments", inr(paid(s, st.id))],
          ["Outstanding balance", inr(balance(s, st))],
        ],
      },
      {
        title: "Payment history",
        columns: paymentColumns,
        rows: paymentRows(transactions),
      },
      ...(structure
        ? [
            {
              title: "Current program schedule reference",
              paragraphs: [
                "The following is the current program schedule, not a historical allocation of the student’s assigned fee or individual payments. Differences do not change the assigned ledger balance.",
              ],
            },
            ...structureSections(structure),
          ]
        : []),
      {
        title: "Statement notes",
        paragraphs: [
          "Balances use completed payments only. Failed and pending attempts remain listed for traceability. GST and payment allocation are shown only where recorded; current fee schedules do not retrospectively amend past receipts.",
        ],
      },
    ],
  };
  const account = report.sections.findIndex(
    (section) => section.title === "Account reconciliation",
  );
  if (account > 0)
    report.sections.unshift(...report.sections.splice(account, 1));
  return report;
}
export function tableReport(
  c: College,
  s: CollegeState,
  title: string,
  rows: { id: string; [key: string]: unknown }[],
  columns: { key: string; label: string }[],
  role: Role | null,
  filters: string,
): PDFReport {
  if (title === "Program fee structures")
    return {
      title: "Program fee structures - detailed schedule",
      context: reportContext(c, s, role, filters),
      sections: rows.flatMap((r) =>
        structureSections(r as unknown as RecordRow),
      ),
    };
  const moneyKeys = new Set([
    "amount",
    "fee",
    "scholarship",
    "paid",
    "outstanding",
    "running",
    "base",
    "gst",
    "total",
  ]);
  const sections: PDFSection[] = [
    {
      title: "Report scope",
      fields: [
        ["Record count", String(rows.length)],
        ["Selection", filters],
        ["Currency", "INR; monetary values rounded to two decimal places"],
      ],
    },
    {
      title,
      columns: columns.map((col) =>
        moneyKeys.has(col.key) ? `${col.label} (INR)` : col.label,
      ),
      rows: rows.map((row) =>
        columns.map((col) => {
          const value = row[col.key];
          if (
            moneyKeys.has(col.key) &&
            value !== undefined &&
            Number.isFinite(Number(value))
          )
            return inr(Number(value));
          if (col.key === "studentId") {
            const st = s.students.find((st) => st.id === value);
            return st
              ? `${st.name}\n${st.id}\n${st.program}`
              : String(value || "Not recorded");
          }
          return (
            typeof value === "object"
              ? JSON.stringify(value)
              : String(value ?? "Not recorded")
          ).replace(
            /data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+/g,
            "[Uploaded student image]",
          );
        }),
      ),
    },
  ];
  // "Grand total" row under the table for its currency columns.
  const main = sections[1];
  const grand = totalsRow(main.columns || [], main.rows || []);
  if (grand) main.rows = [...(main.rows || []), grand];
  const taxRows = rows
    .filter((r) => r.paymentTax && typeof r.paymentTax === "object")
    .map((r) => r as unknown as RecordRow);
  if (taxRows.length)
    sections.push({
      title: "Recorded GST on exported transactions",
      columns: [
        "Receipt reference",
        "Taxable base (INR)",
        "GST rate",
        "CGST (INR)",
        "SGST (INR)",
        "IGST (INR)",
        "Total received (INR)",
      ],
      rows: taxRows.map((row) => [
        row.id,
        inr(row.paymentTax!.base),
        `${row.paymentTax!.rate}%`,
        inr(row.paymentTax!.cgst),
        inr(row.paymentTax!.sgst),
        inr(row.paymentTax!.igst),
        inr(row.amount || 0),
      ]),
    });
  const totals = columns.filter(
    (col) =>
      moneyKeys.has(col.key) &&
      col.key !== "running" &&
      rows.some((r) => typeof r[col.key] === "number"),
  );
  if (totals.length)
    sections.push({
      title: "Totals for exported records",
      fields: totals.map((col) => [
        col.label,
        inr(
          rows.reduce(
            (sum, r) =>
              sum + (typeof r[col.key] === "number" ? Number(r[col.key]) : 0),
            0,
          ),
        ),
      ]),
    });
  if (title === "Cashbook entries") {
    const incoming = rows
        .filter((r) => r.direction === "In")
        .reduce((n, r) => n + Number(r.amount || 0), 0),
      outgoing = rows
        .filter((r) => r.direction === "Out")
        .reduce((n, r) => n + Number(r.amount || 0), 0);
    sections.push({
      title: "Cash movement in exported records",
      fields: [
        ["Inflows", inr(incoming)],
        ["Outflows", inr(outgoing)],
        ["Net movement", inr(incoming - outgoing)],
      ],
      paragraphs: [
        "Running balances are cumulative values and are not summed. The net movement reflects the exported selection only.",
      ],
    });
  }
  if (title === "Student fee ledgers") {
    const ids = new Set(rows.map((r) => r.id));
    sections.push({
      title: "Linked payment transactions",
      columns: ["Student / roll ID", ...paymentColumns],
      rows: s.payments
        .filter((p) => ids.has(p.studentId || ""))
        .map((p) => [p.studentId || "", ...paymentRows([p])[0]]),
    });
  }
  sections.push({
    title: "Report notes",
    paragraphs: [
      "This export reflects the selected records and visible columns at export time. Student balances use lifetime completed payments; collection reports follow the selected date range.",
      "Where a source record does not store GST, tax references, addresses, payment references, or other details, those fields are not invented. Configure institution details in Settings and GST treatment in the program fee structure editor.",
    ],
  });
  return {
    title,
    context: reportContext(c, s, role, filters),
    sections,
    landscape: columns.length > 6,
  };
}
export function financialRecordReport(
  c: College,
  s: CollegeState,
  row: RecordRow,
  type: string,
  role?: Role | null,
): PDFReport {
  return {
    title: `${type} - detailed record`,
    context: { ...reportContext(c, s, role), reference: row.id },
    sections: [
      {
        title: "Document details",
        fields: Object.entries(row).map(([key, value]) => [
          key.replace(/([A-Z])/g, " $1"),
          key === "amount"
            ? inr(Number(value))
            : String(value ?? "Not recorded"),
        ]),
      },
      {
        title: "Tax & payment disclosure",
        fields: [
          ["Recorded total", inr(row.amount || 0)],
          [
            "GST / taxable base / GST rate",
            "Not recorded on this original record",
          ],
          [
            "Method / reference",
            `${row.method || "Not recorded"} / ${row.reference || "Not recorded"}`,
          ],
        ],
        paragraphs: [
          "This is an internal demo record, not a statutory tax invoice. The recorded amount has not been increased by an inferred tax charge.",
        ],
      },
    ],
  };
}

export function certificateReport(
  c: College,
  s: CollegeState,
  row: RecordRow,
  st: Student,
  verification: string,
  role?: Role | null,
): PDFReport {
  return {
    title: row.name,
    context: { ...reportContext(c, s, role), reference: row.id },
    verification,
    sections: [
      {
        title: "Certificate statement",
        paragraphs: [
          `This demonstration document records ${row.name.toLowerCase()} for the fictional student identified below. It does not certify any real-world qualification.`,
        ],
      },
      {
        title: "Student details",
        fields: studentFields(st),
        image: st.profile?.photo,
      },
      {
        title: "Issuance record",
        fields: [
          ["Certificate reference", row.id],
          ["Status", row.status],
          ["Issue date", row.approvedAt?.slice(0, 10) || row.date],
          ["Document version", String(row.version || 1)],
          ["Purpose / review remarks", row.note || "Not recorded"],
          ["Authorized by", row.actor || "Demo Certificate Officer"],
        ],
      },
      {
        title: "Authorization & verification",
        paragraphs: [
          "DEMO AUTHORIZATION MARK. This is not a cryptographic digital signature.",
          "The QR code resolves records stored in this browser only. It does not establish authenticity across devices.",
        ],
      },
    ],
  };
}
export function admissionReport(
  c: College,
  s: CollegeState,
  row: RecordRow,
  role?: Role | null,
): PDFReport {
  return {
    title: "Admission application acknowledgement",
    context: { ...reportContext(c, s, role), reference: row.id },
    sections: [
      {
        title: "Applicant details",
        image: row.profile?.photo,
        fields: [
          ["Applicant name", row.name],
          ["Email", row.email || "Not recorded"],
          ["Guardian", row.guardian || "Not recorded"],
          ...Object.entries(row.profile || {})
            .filter(([key, value]) => key !== "photo" && value)
            .map(([key, value]): [string, string] => [
              key.replace(/([A-Z])/g, " $1"),
              String(value),
            ]),
        ],
      },
      {
        title: "Application record",
        fields: [
          ["Application ID", row.id],
          ["Program", row.program || "Not recorded"],
          ["Admission source", row.source || "Not recorded"],
          ["Submission date", row.date],
          ["Status", row.status],
          ["Documents / review notes", row.note || "Not recorded"],
        ],
      },
      {
        title: "Next steps",
        paragraphs: [
          "This acknowledgement is not an offer of admission. Follow the application review, document verification, approval and enrollment stages in the campus workspace. No real admission has been granted.",
        ],
      },
    ],
  };
}
