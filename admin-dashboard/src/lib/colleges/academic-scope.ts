import type { Student } from "./store";
import type { OperationRecord } from "./operations";
export type AcademicScope = {
  program: string;
  academicYear: string;
  studyYear: string;
  branch: string;
  specialization: string;
  semester: string;
  section: string;
  batch: string;
};
export const normalizeAcademicValue = (v: unknown) =>
  String(v || "")
    .trim()
    .toLowerCase()
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/\s*-\s*/g, "-");
export function studentScope(student: Student): AcademicScope {
  const p = student.profile;
  return {
    program: student.program,
    academicYear: p?.academicYear || "2026-2027",
    studyYear: p?.studyYear || "1",
    branch: p?.branch || student.program,
    specialization: p?.specialization || "General",
    semester: p?.semester || "1",
    section: p?.section || "A",
    batch: p?.batch || "Main",
  };
}
export function sessionScope(session: OperationRecord): AcademicScope {
  return {
    program: String(session.program || ""),
    academicYear: String(session.academicYear || "2026-2027"),
    studyYear: String(session.studyYear || "1"),
    branch: String(session.branch || session.program || ""),
    specialization: String(session.specialization || "General"),
    semester: String(session.semester || "1"),
    section: String(session.section || "A"),
    batch: String(session.batch || "Main"),
  };
}
export function sameCohort(a: AcademicScope, b: AcademicScope) {
  return (Object.keys(a) as (keyof AcademicScope)[]).every(
    (k) => normalizeAcademicValue(a[k]) === normalizeAcademicValue(b[k]),
  );
}
export function sessionForStudent(session: OperationRecord, student: Student) {
  return sameCohort(sessionScope(session), studentScope(student));
}
export function cohortKey(scope: AcademicScope) {
  return JSON.stringify(Object.values(scope).map(normalizeAcademicValue));
}
export function publishedSession(session: OperationRecord) {
  return !["Draft", "Archived", "Cancelled", "Inactive"].includes(
    session.status,
  );
}
export const timetableDays = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
export const timeMinutes = (value: string) =>
  Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));
export const clockTime = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
