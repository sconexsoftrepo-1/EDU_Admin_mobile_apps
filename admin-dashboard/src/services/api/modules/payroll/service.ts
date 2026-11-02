/** Salary structure and monthly payslips (backend: app/core/payroll_workspace.py). */
import { apiRequest } from "../../client";

export interface SalaryLine {
  component: string;
  amount: string;
}

export interface SalaryStructure {
  employee_code: string;
  earnings: SalaryLine[];
  deductions: SalaryLine[];
  gross_monthly: string;
  deductions_monthly: string;
  net_monthly: string;
  in_hand_monthly: string;
  ctc_annual: string;
  salary_basis: string;
  effective_from?: string | null;
}

export interface Payslip {
  code: string;
  period: string;
  period_start?: string | null;
  period_end?: string | null;
  run_status?: string | null;
  earnings: SalaryLine[];
  deductions: SalaryLine[];
  gross_amount: string;
  deduction_amount: string;
  net_amount: string;
  net_in_words: string;
  paid_on?: string | null;
  receipt_number?: string | null;
  transaction_reference?: string | null;
  payment_mode?: string | null;
}

export interface SalaryEmployee {
  code: string;
  name: string;
  designation?: string | null;
  department?: string | null;
  employee_type?: string | null;
  join_date?: string | null;
  status?: string | null;
  pan?: string;
  bank?: string;
  net_monthly: string;
  payslips?: number;
  staff_kind?: string;
}

export interface PayrollRun {
  code: string;
  period: string;
  period_start?: string | null;
  campus: string;
  status: string;
  payslips: number;
  net_total: string;
}

export interface RunResult {
  period: string;
  runs: {
    code: string;
    campus: string;
    status: string;
    payslips: number;
    skipped: { code: string; name: string; reason: string }[];
  }[];
}

export interface TaxDocument {
  code: string;
  employee_code: string;
  financial_year: string;
  document_type: string;
  revision: number;
  published_at?: string | null;
  original_filename?: string | null;
  generated?: boolean;
}

export interface LeaveBalance {
  code: string;
  name: string;
  allowed: number;
  taken: number;
  pending: number;
  remaining: number;
}

export interface AttendanceCounts {
  present: number;
  absent: number;
  leave: number;
  half_day: number;
  holiday: number;
  working_days: number;
  percent: number | null;
}

export interface StaffSummary {
  code: string;
  name: string;
  designation?: string | null;
  department?: string | null;
  staff_kind: string;
  net_monthly: string;
  gross_monthly: string;
  attendance: AttendanceCounts;
  leave: LeaveBalance[];
  bonus_ytd: string;
}

export interface LeaveRequest {
  code: string;
  employee_code: string;
  employee_name?: string;
  leave_type_code: string;
  leave_type_name?: string | null;
  start_date: string;
  end_date: string;
  days: number;
  reason: string;
  status: string;
  approved_by_name?: string | null;
  decision_note?: string | null;
}

export interface Adjustment {
  code: string;
  component: string;
  category: string;
  amount: string;
  status: string;
  period: string;
  period_start?: string | null;
}

export interface AttendanceDay {
  date: string;
  weekday: string;
  status: string | null;
  check_in?: string | null;
  check_out?: string | null;
}

export interface StaffDetail extends StaffSummary {
  employee: SalaryEmployee;
  structure: SalaryStructure;
  payslips: Payslip[];
  leave_history: LeaveRequest[];
  attendance_month: AttendanceCounts & {
    month: string;
    label: string;
    days: AttendanceDay[];
  };
  adjustments: Adjustment[];
  tax_documents: TaxDocument[];
}

export interface StaffListing {
  month: string;
  label: string;
  year: number;
  items: StaffSummary[];
  pending_leave: LeaveRequest[];
  can_decide: boolean;
  can_adjust: boolean;
}

export const payrollService = {
  /** Employees whose salary the signed-in person may see (only themselves for staff). */
  employees: () =>
    apiRequest<{
      items: SalaryEmployee[];
      can_manage: boolean;
      runs?: PayrollRun[];
      can_run?: boolean;
      can_publish_tax?: boolean;
    }>("hr/salary-workspace"),
  /** Create, calculate and publish a month's payroll (month = YYYY-MM). */
  run: (month: string) =>
    apiRequest<RunResult>("hr/salary-workspace/runs", {
      method: "POST",
      body: { month, publish: true },
    }),
  /** Form 16 and other tax documents of one employee. */
  taxDocuments: (code: string) =>
    apiRequest<TaxDocument[]>(
      `hr/salary-workspace/${encodeURIComponent(code)}/tax-documents`,
    ),
  /** Every employee's attendance, leave balances and bonuses for a month. */
  staff: (month?: string) =>
    apiRequest<StaffListing>("hr/staff-workspace", { query: { month } }),
  /** One employee in full (structure, payslips, leave history, attendance, bonuses, Form 16). */
  staffDetail: (code: string, month?: string) =>
    apiRequest<StaffDetail>(`hr/staff-workspace/${encodeURIComponent(code)}`, {
      query: { month },
    }),
  decideLeave: (code: string, status: "approved" | "rejected", note = "") =>
    apiRequest(
      `hr/staff-workspace/leave/${encodeURIComponent(code)}/decision`,
      { method: "POST", body: { status, note } },
    ),
  addAdjustment: (body: {
    employee_code: string;
    month: string;
    category: "Bonus" | "Incentive" | "Reimbursement";
    title: string;
    amount: string;
  }) =>
    apiRequest<Adjustment>("hr/staff-workspace/adjustments", {
      method: "POST",
      body,
    }),
  /** Mark a published payroll as paid (creates salary receipts). */
  markPaid: (run: string) =>
    apiRequest(`hr/salary-workspace/runs/${encodeURIComponent(run)}/paid`, {
      method: "POST",
      body: {},
    }),
  /** Generate Form 16 (Part B) from the year's published payslips (financial_year = YYYY-YYYY). */
  generateForm16: (code: string, financialYear: string) =>
    apiRequest<TaxDocument>(
      `hr/salary-workspace/${encodeURIComponent(code)}/form16`,
      { method: "POST", body: { financial_year: financialYear } },
    ),
  /** One employee's salary structure and monthly payslips. */
  employee: (code: string) =>
    apiRequest<{
      employee: SalaryEmployee;
      structure: SalaryStructure;
      payslips: Payslip[];
    }>(`hr/salary-workspace/${encodeURIComponent(code)}`),
};
