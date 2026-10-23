import type { Row } from "../../consts";
/** Master data entry forms: student/parent enrollment, staff onboarding, courses (backend: master_data/onboarding). */
import type { WorkflowAction } from "../workflows/consts";

/** Master data forms use the same shape as workflow actions, always with a `path`. */
export type MasterDataAction = WorkflowAction & { path: string };

export interface MasterDataActionsResponse {
  actions: MasterDataAction[];
}

/** Screens that offer document and certificate uploads. */
export const UPLOAD_SCREENS = ["documents", "student-enrollment"] as const;

// ---- Student enrollment wizard (POST master-data/enrollment) ---------------------------------

export type CourseLevel = "intermediate" | "degree";
export type FeeCategory = "academic" | "hostel" | "transport" | "other";

export interface WizardCourse {
  code: string;
  name: string;
  branch?: string | null;
  qualification?: string;
  duration_semesters?: number;
  /** Course family, e.g. "Commerce, Finance and Management". */
  category?: string | null;
  duration_label?: string | null;
  semesters_label?: string | null;
  subjects?: string | null;
  career_opportunities?: string | null;
  /** Semester names: Intermediate 1-1, 1-2, 2-1, 2-2; degrees Semester 1, 2, ... */
  semester_labels?: string[];
  batches: {
    code: string;
    name: string;
    entry_year: number;
    sections: { code: string; name: string; semester_code: string }[];
  }[];
}

/** One fee of the first year: academic/other always, hostel or transport when chosen. */
export interface FeeLine {
  fee_structure_code: string;
  fee_head_code: string;
  name: string;
  category: FeeCategory;
  installment_number: number;
  amount: string;
  due_date: string;
  currency: string;
  charge_code?: string;
}

/** GET master-data/enrollment/options. Numbers and fees appear once a year/course is chosen. */
export interface EnrollmentOptions {
  courses: Record<CourseLevel, WizardCourse[]>;
  academic_years: {
    code: string;
    name: string;
    start_date: string;
    end_date: string;
  }[];
  campuses: { code: string; name: string }[];
  documents: { key: string; label: string }[];
  identity_documents: { key: string; label: string }[];
  admission_number?: string;
  registration_number?: string;
  fees?: FeeLine[];
  fees_available?: FeeLine[];
}

export interface EnrollmentStudent {
  first_name: string;
  middle_name?: string;
  last_name: string;
  date_of_birth: string;
  gender: "female" | "male" | "other" | "prefer_not_to_say";
  email?: string;
  phone: string;
  aadhaar_number: string;
  blood_group?: string;
  nationality?: string;
  address: string;
  city: string;
  state: string;
  postal_code: string;
  country?: string;
  campus_code?: string;
}

export interface LastQualification {
  level: "ssc" | "intermediate";
  institution: string;
  board?: string;
  group?: string;
  grade?: string;
  first_year_score?: string;
  second_year_score?: string;
  passed_year?: number;
}

/** The student's guardian; the guardian's mobile number is the primary contact. */
export interface EnrollmentGuardian {
  relationship: "father" | "mother" | "guardian" | "other";
  first_name: string;
  last_name: string;
  phone: string;
  alternate_phone?: string;
}

export interface EnrollmentPayload {
  student: EnrollmentStudent;
  last_qualification: LastQualification;
  guardian: EnrollmentGuardian;
  documents: Record<string, boolean>;
  referral?: { name: string; relation: string; mobile: string } | null;
  achievements: {
    title: string;
    level?: string;
    year?: number;
    description?: string;
  }[];
  certifications: { name: string; issuer?: string; year?: number }[];
  course: {
    course_level: CourseLevel;
    program_code: string;
    academic_year_code: string;
    batch_code?: string;
    section_code?: string;
  };
  hostel_required: boolean;
  transport_required: boolean;
  scholarship?: { amount: string; name?: string } | null;
  special_consideration?: { amount: string; reason?: string } | null;
}

export interface AdmissionProfile {
  code: string;
  student_code: string;
  program_code: string;
  academic_year_code: string;
  batch_code?: string | null;
  section_code?: string | null;
  course_level: CourseLevel;
  registration_number: string;
  document_checklist: Record<
    string,
    {
      label: string;
      submitted: boolean;
      uploaded: boolean;
      document_code?: string;
    }
  >;
  gross_fee: string;
  net_fee: string;
  scholarship_amount: string;
  special_consideration_amount: string;
  fee_summary: (Partial<FeeLine> & {
    category: FeeCategory | "concession";
    label?: string;
    status?: "applied" | "pending_approval";
    reason?: string;
    amount: string;
  })[];
  [key: string]: unknown;
}

export interface EnrollmentResult {
  student: Row;
  parents: { parent: Row; relationship: Row }[];
  enrollment: Row | null;
  profile: AdmissionProfile;
  charges: Row[];
  program: Row;
  batch: Row;
}

/** Counts of a group of students (a batch, or the whole course). */
export interface StudentCounts {
  students: number;
  active: number;
  by_current_year: Record<string, number>;
  by_gender: Record<string, number>;
  hostel: number;
  transport: number;
  gross_fee: string;
  net_fee: string;
}

/** GET master-data/enrollment/courses/{code}/insights. */
export interface CourseInsights {
  program: Row;
  /** Years of study of the course. */
  years: number;
  /** Semester names: Intermediate 1-1, 1-2, 2-1, 2-2; degrees Semester 1, 2, ... */
  semester_labels: string[];
  batches: (StudentCounts & {
    code: string;
    name: string;
    entry_year: number;
    graduation_year: number;
    sections: {
      code: string;
      name: string;
      capacity?: number | null;
      students: number;
    }[];
  })[];
  totals: StudentCounts & { batches: number; intake_capacity?: number | null };
}

/** Documents the enrollment checklist offers (same keys as the backend's DOCUMENTS). */
export const ENROLLMENT_DOCUMENTS: { key: string; label: string }[] = [
  { key: "transfer_certificate", label: "TC (transfer certificate)" },
  { key: "study_conduct_certificate", label: "Study & conduct certificate" },
  { key: "certificate_copy", label: "Certificate copy" },
  { key: "original_certificate", label: "Original certificate" },
];

export interface BatchOverview {
  batches: (Pick<
    CourseInsights["batches"][number],
    "code" | "name" | "entry_year" | "graduation_year" | "students" | "sections"
  > & { program_code: string; course_name: string })[];
  totals: { batches: number; students: number };
}
