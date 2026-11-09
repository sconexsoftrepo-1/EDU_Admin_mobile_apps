import { apiRequest } from "../client";

export type EnquiryRow = {
  key: string;
  visible: boolean;
  mine: boolean;
  code: string | null;
  name: string | null;
  phone: string | null;
  reference_name: string | null;
  assigned_to: string | null;
  course_level: string | null;
  program_code: string | null;
  course_name: string | null;
  academic_year_code: string | null;
  academic_year: string | null;
  reference_type: string;
  reference_label: string;
  status: string;
  stage: "enquiry" | "application" | "joined";
  has_application: boolean;
  next_follow_up_at: string | null;
  followups_done: number;
  recorded_at: string | null;
  /** Staff member credited with the enquiry (admin / teacher / staff / employee reference). */
  credited_to?: string | null;
  credited_key?: string | null;
};
export type ApplicationRow = {
  key: string;
  visible: boolean;
  code: string | null;
  name: string | null;
  phone: string | null;
  course_level: string | null;
  program_code: string | null;
  course_name: string | null;
  academic_year_code: string | null;
  academic_year: string | null;
  reference_type: string;
  reference_label: string;
  status: string;
  applied_on: string | null;
  enquiry_code: string | null;
};
export type AdmissionAnalyticsData = {
  can_view_all: boolean;
  today: string;
  enquiries: EnquiryRow[];
  applications: ApplicationRow[];
  options: {
    references: { key: string; label: string }[];
    courses: { code: string; name: string; level: string | null }[];
    years: { code: string; name: string; program_code: string | null }[];
  };
};
export type CollectionRow = {
  date: string;
  method: string | null;
  amount: number;
  purpose: string;
  year: string | null;
  department: string | null;
};
export type DueRow = {
  student_code: string;
  student: string;
  course: string | null;
  department: string | null;
  year: string | null;
  purpose: string | null;
  due_date: string;
  amount: number;
  days_overdue: number;
};
export type CampusAnalyticsData = {
  today: string;
  collections: CollectionRow[] | null;
  dues: DueRow[] | null;
  cashbook: {
    opening: number;
    receipts: number;
    payments: number;
    closing: number;
    recent: {
      date: string;
      description: string;
      reference: string;
      receipt: number;
      payment: number;
    }[];
  } | null;
  expenses:
    | {
        date: string;
        amount: number;
        category: string;
        description: string | null;
        status: string | null;
      }[]
    | null;
  operations: Record<
    string,
    {
      label: string;
      value: number | string;
      module: string | null;
      hint: string | null;
    }
  >;
  activity:
    | {
        code: string;
        title: string;
        starts_at: string;
        detail: string | null;
      }[]
    | null;
  options: {
    departments: { code: string; name: string }[];
    years: { code: string; name: string }[];
  };
};

/** GET dashboard/reports-analytics: rows for the Reports & analytics dashboard (filtered in the browser). */
export type ReportsAnalyticsData = {
  today: string;
  levels: { key: string; label: string }[];
  programs: { code: string; name: string; level: string | null; branch: string | null; department: string | null }[];
  years: { code: string; name: string; program_code: string | null }[];
  students: { code: string; name: string; status: string; level: string | null; program_code: string | null; year_code: string | null }[];
  charges: {
    student_code: string;
    student: string;
    level: string | null;
    program_code: string | null;
    year_code: string | null;
    semester: number | null;
    head: string | null;
    late_fee: boolean;
    billed: number;
    concession: number;
    paid: number;
    outstanding: number;
    due_date: string;
    days_overdue: number;
  }[];
  payments: {
    date: string;
    amount: number;
    method: string;
    source: "manual" | "linked";
    level: string | null;
    program_code: string | null;
    year_code: string | null;
    branch_label: string | null;
    semester: number | null;
    head: string | null;
    student_code: string | null;
    student?: string | null;
    receipt_number?: string | null;
    reference?: string | null;
  }[];
  enquiries: { level: string | null; program_code: string | null; year_code: string | null; status: string; stage: string; reference: string; recorded_at: string | null }[];
  cashbook: { date: string; opening: string; received: string; paid: string; deposited: string; closing: string; with_admin: string; with_clerks: string }[];
  late_fees: {
    summary: { students: number; cleared: number; uncleared: number; late_fee_total: string; late_fee_pending: string; cancelled: number };
    items: { student_code: string; status: string; late_fees: { amount: string; status: string; semester: number | null }[] }[];
  };
};

export const analyticsApi = {
  reports() {
    return apiRequest<ReportsAnalyticsData>("dashboard/reports-analytics");
  },
  admissions() {
    return apiRequest<AdmissionAnalyticsData>("dashboard/admission-analytics");
  },
  campus() {
    return apiRequest<CampusAnalyticsData>("dashboard/campus-analytics");
  },
};
