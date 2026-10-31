import { apiRequest, type Query } from "../../client";
export type AttendanceStatus = "present" | "late" | "absent" | "excused";
export type AttendanceStats = {
  present: number;
  late: number;
  absent: number;
  excused: number;
  recorded: number;
  attended: number;
  percentage: number | null;
  leave_days: number;
  absent_days: number;
  recorded_days: number;
};
export type AttendanceOptions = {
  courses: {
    code: string;
    name: string;
    course_level: string;
    branch: string;
  }[];
  academic_years: {
    code: string;
    name: string;
    program_code: string;
    batch_code: string;
    section_codes?: string[];
  }[];
  sections: { code: string; name: string; batch_code: string }[];
  students: { code: string; name: string }[];
  can_mark: boolean;
  teacher: boolean;
  personal: boolean;
  periods: { value: number; label: string }[];
};
export type AttendanceRegister = {
  code: string;
  program_code: string;
  academic_year_code: string;
  section_code: string | null;
  session_date: string;
  period: number;
  subject: string;
  revision: number;
  marks: Record<string, AttendanceStatus>;
  legacy?: boolean;
};
export type AttendanceData = {
  leave_dates: Record<string, string[]>;
  date: string;
  students: { code: string; name: string; admission_number: string }[];
  registers: AttendanceRegister[];
  summaries: Record<string, AttendanceStats>;
  calendar: (AttendanceStats & { date: string })[];
  can_mark: boolean;
  calculation: string;
};
const base = "academics/attendance-workspace";
export const attendanceApi = {
  options: () => apiRequest<AttendanceOptions>(`${base}/options`),
  list: (query: Query) => apiRequest<AttendanceData>(base, { query }),
  save: (body: {
    program_code: string;
    academic_year_code: string;
    section_code: string | null;
    slot_code?: string;
    session_date: string;
    period: number;
    subject: string;
    revision: number;
    marks: { student_code: string; status: AttendanceStatus }[];
  }) =>
    apiRequest<AttendanceRegister>(`${base}/register`, { method: "PUT", body }),
};
