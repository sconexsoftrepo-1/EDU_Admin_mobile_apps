import type { College } from "@/data/colleges";
import type { CollegeState } from "./store";
import type { OperationRecord } from "./operations";
import { preciseMoney as money } from "./operations";
import type { PDFReport } from "./report-types";
export function payslipReport(
  college: College,
  state: CollegeState,
  r: OperationRecord,
  preparedBy = "Demo",
): PDFReport {
  return {
    title: "Employee payslip",
    context: {
      college,
      institution: state.institution,
      reference: r.id,
      preparedBy,
    },
    sections: [
      {
        title: "Employee and pay period",
        fields: [
          ["Employee", `${r.name} (${r.employeeId})`],
          ["Department", String(r.department)],
          [
            "Pay period / status",
            `${r.period} · ${r.status} · ${r.paidAt || "Not paid"}`,
          ],
        ],
      },
      {
        title: "Earnings and deductions",
        columns: ["Component", "Amount (INR)"],
        rows: [
          ["Basic salary", money(Number(r.basic))],
          ["Allowances", money(Number(r.allowances))],
          ["Approved bonuses / reimbursements", money(Number(r.bonus))],
          ["Gross pay", money(Number(r.gross))],
          ["Configured deductions + unpaid leave", money(Number(r.deductions))],
          ["Net pay", money(Number(r.net))],
        ],
      },
      {
        title: "Payroll notes",
        paragraphs: [
          `Approved unpaid leave: ${r.unpaidDays} days. Amounts use configured demo salary rules.`,
          "Fictional payroll demonstration. No banking transaction was executed; configured deductions are not statutory payroll advice.",
        ],
      },
    ],
  };
}
