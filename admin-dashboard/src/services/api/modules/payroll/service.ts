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
}

export const payrollService = {
  /** Employees whose salary the signed-in person may see (only themselves for staff). */
  employees: () =>
    apiRequest<{ items: SalaryEmployee[]; can_manage: boolean }>(
      "hr/salary-workspace",
    ),
  /** One employee's salary structure and monthly payslips. */
  employee: (code: string) =>
    apiRequest<{
      employee: SalaryEmployee;
      structure: SalaryStructure;
      payslips: Payslip[];
    }>(`hr/salary-workspace/${encodeURIComponent(code)}`),
};
