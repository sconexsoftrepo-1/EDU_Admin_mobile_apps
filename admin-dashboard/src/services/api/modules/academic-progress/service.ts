import { apiRequest } from "../../client";
export interface SemesterTerm {
  code: string;
  semester_number: number;
  name: string;
  start_date: string;
  end_date: string;
  estimated?: boolean;
}
export interface SemesterSummary {
  semester_number: number;
  students: number;
  all_clear: number;
  backlog_students: number;
  pending_students: number;
  graded_subject_results: number;
  percentage: number | null;
  earned_marks: string;
  max_marks: string;
  start_date?: string;
  end_date?: string;
  estimated?: boolean;
}
export interface FinalResult {
  code: string;
  student_code: string;
  subject_code: string;
  semester_number: number;
  marks: string | null;
  max_marks: string;
  pass_marks: string;
  absent: boolean;
  attempt: number;
  published: boolean;
}
export interface Backlog {
  subject_code: string;
  subject_name: string;
  marks: string | null;
  max_marks: string;
  pass_marks: string;
  absent: boolean;
  attempt: number;
}
export interface AcademicStudent {
  code: string;
  name: string;
  semester_number: number;
  status: string;
  pending_subjects: number;
  backlogs: Backlog[];
}
export interface AcademicBatch {
  placements?: {student_code: string; student_name: string; admission_number?: string; roll_number: string; section_code: string; section_name: string; semester_number: number | null; status: string}[];
  code: string;
  name: string;
  program_code: string;
  course_name: string;
  calendar_revision: number;
  timeline: {
    current: number | null;
    state: string;
    semesters: SemesterTerm[];
  };
  semesters: SemesterSummary[];
  students: AcademicStudent[];
  results: FinalResult[];
  result_groups: {
    subject_code: string;
    semester_number: number;
    attempt: number;
    revision: number;
  }[];
  subjects: {
    subject_code: string;
    name: string;
    subject_type: string;
    semester_number: number;
    eligible_student_codes?: string[];
    credits?: string;
    faculty?: {
      teacher_code: string;
      teacher_name: string;
      section_code: string;
      section_name: string;
    }[];
  }[];
  sections: { code: string; name: string }[];
}
export interface ScheduledClass {
  code: string;
  offering_code: string;
  program_code: string;
  academic_year_code: string;
  section_code: string;
  semester_number: number;
  subject_code: string;
  subject_name: string;
  teacher_name: string;
  teacher_code: string;
  start_time: string;
  end_time: string;
  period: number;
  state: string;
  session_date: string;
  can_take_attendance: boolean;
}
export interface SemesterFee {
  code: string;
  student_code: string;
  academic_year_code: string;
  semester_number: number | null;
  fee_head: string;
  amount: string;
  paid: string;
  outstanding: string;
  due_date: string | null;
  reminder_state: string;
}
export interface AcademicProgress {
  can_manage_batches?: boolean;
  generated_at: string;
  personal: boolean;
  teacher: boolean;
  can_grade: boolean;
  can_manage_calendar: boolean;
  college_percentage: number | null;
  courses: {
    code: string;
    name: string;
    course_level: string;
    branch?: string;
  }[];
  academic_years: { code: string; name: string; program_code: string }[];
  children: { code: string; name: string }[];
  batches: AcademicBatch[];
  today_classes: ScheduledClass[];
  fees: SemesterFee[];
  payments: {
    code: string;
    student_code: string;
    amount: string;
    paid_on: string;
    method: string;
    status: string;
  }[];
  course_comparison: {
    code: string;
    name: string;
    percentage: number | null;
  }[];
  totals: {
    students: number;
    batches: number;
    backlog_students: number;
    all_clear_semester_results: number;
  };
}
const path = "academics/semester-workspace";
export const academicProgress = {
  get: (program?: string, year?: string, student?: string) =>
    apiRequest<AcademicProgress>(path, {
      query: {
        program_code: program,
        academic_year_code: year,
        student_code: student,
      },
    }),
  results: (body: unknown) =>
    apiRequest<{ revision: number; saved: number }>(path + "/results", {
      method: "PUT",
      body,
    }),
  calendar: (body: unknown) =>
    apiRequest(path + "/calendar", { method: "PUT", body }),
};
