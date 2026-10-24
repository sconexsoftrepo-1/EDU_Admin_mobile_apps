/** Staff onboarding: teaching staff, non-teaching staff and daily labour (backend: master_data/staff). */
import type { Row } from "../../consts";

export type StaffKind = "teaching" | "non_teaching" | "labour";
export type QualificationLevel =
  | "graduation"
  | "post_graduation"
  | "doctorate"
  | "diploma"
  | "school"
  | "other";

export const QUALIFICATION_LEVELS: {
  value: QualificationLevel;
  label: string;
}[] = [
  { value: "graduation", label: "Graduation" },
  { value: "post_graduation", label: "Post graduation" },
  { value: "doctorate", label: "Doctorate (PhD)" },
  { value: "diploma", label: "Diploma" },
  { value: "school", label: "School" },
  { value: "other", label: "Other" },
];

/** Screen key -> staff kind. */
export const STAFF_SCREENS: Record<string, StaffKind> = {
  "teaching-staff": "teaching",
  "non-teaching-staff": "non_teaching",
  "daily-labour": "labour",
};

export const STAFF_KIND_LABEL: Record<StaffKind, string> = {
  teaching: "teaching staff",
  non_teaching: "non-teaching staff",
  labour: "daily labour",
};

export interface StaffOptions {
  /** Next employee ID, e.g. EMP-PRA-005 (assigned when saved). */
  employee_id: string;
  departments: string[];
  campuses: { code: string; name: string }[];
}

export interface SalaryComponentInput {
  component: string;
  component_type: "earning" | "deduction";
  amount: string;
}

/** POST master-data/staff-onboarding. */
export interface StaffOnboardingPayload {
  kind: StaffKind;
  personal: {
    first_name: string;
    last_name: string;
    gender?: string;
    date_of_birth?: string;
    email?: string;
    phone?: string;
    address?: string;
    city?: string;
    state?: string;
    postal_code?: string;
  };
  job: {
    designation: string;
    department?: string;
    join_date: string;
    employment_type?: "permanent" | "contract" | "part_time" | "daily_wage";
  };
  qualification?: { level: QualificationLevel; specialization?: string } | null;
  certificates: string[];
  aadhaar_number: string;
  pan_number?: string | null;
  previous_experience: {
    organization: string;
    role?: string;
    from_date?: string;
    to_date?: string;
    details?: string;
  }[];
  employment_history: {
    organization: string;
    designation?: string;
    from_date?: string;
    to_date?: string;
    reason_for_leaving?: string;
  }[];
  achievements: { title: string; year?: number; details?: string }[];
  bank: {
    account_holder: string;
    account_number: string;
    bank_name: string;
    ifsc: string;
    branch?: string;
  };
  salary: {
    basis?: "monthly" | "yearly" | "daily";
    amount?: string;
    components: SalaryComponentInput[];
    ctc_annual?: string;
    in_hand_monthly?: string;
  };
}

export interface StaffOnboardingResult {
  employee: Row;
  role: Row | null;
  profile: Row & {
    document_checklist: Record<string, { label: string; uploaded: boolean }>;
  };
  salary_components: Row[];
}

/** A row of the staff tables (numbers masked). */
export interface StaffRow {
  employee_id: string;
  name: string;
  designation: string;
  department?: string | null;
  qualification?: string | null;
  specialization?: string | null;
  phone?: string | null;
  email?: string | null;
  join_date: string;
  employment_type: string;
  status: string;
  salary_basis?: string | null;
  salary_amount?: string | null;
  gross_monthly?: string | null;
  net_monthly?: string | null;
  in_hand_monthly?: string | null;
  ctc_annual?: string | null;
  aadhaar?: string | null;
  pan?: string | null;
  bank?: string | null;
  documents_uploaded: number;
  documents_expected: number;
}
