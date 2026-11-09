import { apiRequest } from "../client";
import { apiUrl } from "../config";

export type PaymentStudent = {
  code: string;
  name: string;
  roll_number: string | null;
  reference_number: string | null;
  admission_number: string | null;
  course_level: string | null;
  course_level_label: string | null;
  program_code: string | null;
  course_name: string | null;
  branch: string | null;
  academic_year_code: string | null;
  academic_year: string | null;
};
export type PaymentOptions = {
  methods: { key: string; label: string }[];
  levels: { key: string; label: string }[];
  programs: { code: string; name: string; branch: string | null; level: string | null }[];
  academic_years: { code: string; name: string; program_code: string | null }[];
  fee_heads: { code: string; name: string; category: string; outstanding: string }[];
  student: PaymentStudent | null;
};
export type PaymentRow = {
  code: string;
  paid_on: string;
  amount: string;
  method: string;
  method_label: string;
  transaction_reference: string | null;
  status: string;
  purpose: string;
  student_code: string;
  student_name: string;
  admission_number: string | null;
  receipt_code: string | null;
  receipt_number: string | null;
  roll_or_reference?: string | null;
  transaction_date?: string | null;
  course_level?: string | null;
  course_branch?: string | null;
  academic_year?: string | null;
  note?: string | null;
  semester?: number | null;
  /** Stored course level (intermediate, degree, ...) of a manual payment. */
  course_level_code?: string | null;
  recorded_at?: string | null;
  edited_at?: string | null;
};
/** PATCH finance/fee-payments/{code}: correction to a manual payment. */
export type PaymentEdit = {
  payer: {
    name: string;
    roll_or_reference: string | null;
    admission_number: string | null;
    course_level: string;
    course_branch: string;
    academic_year: string;
  };
  semester: number;
  amount: string;
  method: string;
  transaction_reference: string | null;
  transaction_date: string | null;
  paid_on: string;
  note: string | null;
};
type Slice = { amount: string; payments: number; payers: number };
export type LateFee = {
  key: string;
  charge_code: string;
  semester_number: number | null;
  label: string;
  missed_due_date: string;
  amount: string;
  applied_on: string | null;
  status: "unpaid" | "paid" | "cancelled";
  outstanding: string;
  semester_outstanding: string;
  cancelled_on?: string | null;
  cancelled_by?: string | null;
};
export type LateFeeStudent = {
  student_code: string;
  name: string;
  admission_number: string | null;
  course: string | null;
  course_level: string | null;
  branch: string | null;
  academic_year: string | null;
  current_semester: number | null;
  paid: string;
  pending: string;
  late_fees_applied: number;
  late_fees_cancelled: number;
  late_fee_total: string;
  late_fee_pending: string;
  status: "cleared" | "uncleared" | "no_late_fee";
  late_fees: LateFee[];
};
export type LateFeeOverview = {
  summary: { students: number; cleared: number; uncleared: number; late_fee_total: string; late_fee_pending: string; cancelled: number };
  items: LateFeeStudent[];
  can_cancel: boolean;
};
export type FeeAnalytics = {
  summary: Slice & { average: string; first_day: string | null; last_day: string | null };
  daily: ({ date: string } & Slice & { by_method: Record<string, string> })[];
  by_semester: ({ semester: number | null; label: string } & Slice)[];
  by_method: ({ method: string; label: string } & Slice)[];
  by_head: ({ name: string } & Slice)[];
  by_level: ({ label: string } & Slice)[];
  by_source: ({ source: string; label: string } & Slice)[];
};
export type CashDeposit = {
  code: string;
  amount: string;
  deposited_on: string;
  bank_reference: string | null;
  status: "awaiting_proof" | "awaiting_review" | "accepted" | "rejected";
  has_proof: boolean;
  proof_name?: string;
  proof_mime?: string;
  review_note?: string | null;
  /** When the clerk recorded the deposit, uploaded the slip and the admin reviewed it. */
  recorded_at?: string | null;
  proof_uploaded_at?: string | null;
  reviewed_at?: string | null;
  reviewed_by_name?: string | null;
};
/** Cash the clerk handed back to the admin instead of depositing it. */
export type CashReturn = {
  amount: string;
  returned_on: string;
  note: string | null;
  recorded_at: string;
  recorded_by_name?: string | null;
};
export type CashTransfer = {
  code: string;
  clerk_account: string;
  clerk_name: string;
  amount: string;
  note: string | null;
  status: "assigned" | "collected" | "deposited" | "awaiting_review" | "settled" | "cancelled";
  assigned_by_name: string;
  assigned_at: string;
  collected_at: string | null;
  deposits: CashDeposit[];
  returns?: CashReturn[];
  accepted_amount: string;
  pending_amount: string;
  returned_amount: string;
  with_clerk: string;
  can_deposit: string;
};
export type CashLedgerRow = {
  date: string;
  opening: string;
  received: string;
  paid: string;
  deposited: string;
  closing: string;
  with_clerks: string;
  with_admin: string;
};
export type CashOverview = {
  today: string;
  can_manage: boolean;
  cash_in_hand: string;
  with_clerks: string;
  with_admin: string;
  awaiting_collection: string;
  ledger: CashLedgerRow[];
  transfers: CashTransfer[];
  clerks: { account_code: string; name: string }[];
};

const q = (values: Record<string, string | undefined>) =>
  Object.fromEntries(Object.entries(values).filter(([, v]) => v)) as Record<string, string>;
const transfer = (code: string) => `finance/cash/transfers/${encodeURIComponent(code)}`;

export const feePaymentsApi = {
  students(query: Record<string, string | undefined>) {
    return apiRequest<{ items: PaymentStudent[]; total: number }>("finance/fee-payments/students", { query: q(query) });
  },
  options(studentCode?: string) {
    return apiRequest<PaymentOptions>("finance/fee-payments/options", { query: q({ student_code: studentCode }) });
  },
  record(body: Record<string, unknown>) {
    return apiRequest<{ payment: Record<string, unknown>; receipt: { code: string; receipt_number: string }; advance: string }>(
      "finance/fee-payments",
      { method: "POST", body },
    );
  },
  history(query: Record<string, string | undefined>) {
    return apiRequest<{ items: PaymentRow[]; total: number; totals_by_method: Record<string, string> }>(
      "finance/fee-payments",
      { query: q(query) },
    );
  },
  /** Admin: saved at once. Other roles: 202 with pending_approval until the admin decides. */
  edit(code: string, body: PaymentEdit) {
    return apiRequest<{ pending_approval?: boolean; edit_request_code?: string; unchanged?: boolean }>(
      `finance/fee-payments/${encodeURIComponent(code)}`,
      { method: "PATCH", body },
    );
  },
  analytics(query: Record<string, string | undefined>) {
    return apiRequest<FeeAnalytics>("finance/fee-payments/analytics", { query: q(query) });
  },
  lateFees() {
    return apiRequest<LateFeeOverview>("finance/late-fees");
  },
  cancelLateFee(key: string) {
    return apiRequest<{ cancelled: string }>(`finance/late-fees/${encodeURIComponent(key)}/cancel`, { method: "POST" });
  },
  applyLateFees() {
    return apiRequest<{ notifications: number }>("finance/late-fees/run", { method: "POST" });
  },
  collectedStudents() {
    return apiRequest<{ items: Record<string, unknown>[]; total: number }>("finance/fee-payments/collected-students");
  },
  cash() {
    return apiRequest<CashOverview>("finance/cash/overview");
  },
  assign(body: { clerk_account: string; amount: string; note?: string }) {
    return apiRequest<CashTransfer>("finance/cash/transfers", { method: "POST", body });
  },
  cancel(code: string) {
    return apiRequest<CashTransfer>(`${transfer(code)}/cancel`, { method: "POST", body: {} });
  },
  review(code: string, deposit: string, decision: "accept" | "reject", note?: string) {
    return apiRequest<CashTransfer>(`${transfer(code)}/deposits/${encodeURIComponent(deposit)}/review`, {
      method: "POST",
      body: { decision, note: note || null },
    });
  },
  returned(code: string, amount: string, returnedOn: string) {
    return apiRequest<CashTransfer>(`${transfer(code)}/returns`, {
      method: "POST",
      body: { amount, returned_on: returnedOn },
    });
  },
  /** The bank slip as an object URL for an <img>; revoke it when done. */
  async proofUrl(code: string, deposit: string) {
    const response = await fetch(apiUrl(`${transfer(code)}/deposits/${encodeURIComponent(deposit)}/proof`), {
      cache: "no-store",
    });
    if (!response.ok) throw new Error("The bank slip could not be loaded");
    return URL.createObjectURL(await response.blob());
  },
};
