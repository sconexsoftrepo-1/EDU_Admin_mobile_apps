import { apiRequest, fileToBase64 } from "../../client";
import { apiUrl } from "../../config";
export const assignmentPath = "academics/assignment-workspace";
export interface AssignmentFile {
  code: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
}
export interface Submission {
  code: string;
  student_code: string;
  submitted_at?: string;
  completed?: boolean;
  marks?: string | null;
  feedback?: string;
  reviewed_at?: string;
  late?: boolean;
  revision?: number;
  attachments: AssignmentFile[];
}
export interface Assignment {
  code: string;
  title: string;
  description: string;
  due_at: string;
  max_marks: string;
  teacher_code: string;
  teacher_name: string;
  program_code: string;
  academic_year_code: string;
  section_code?: string;
  course_name: string;
  batch_name: string;
  created_by: string;
  revision: number;
  allow_late: boolean;
  legacy?: boolean;
  can_review: boolean;
  can_grade: boolean;
  can_submit: boolean;
  bucket: string;
  attachments: AssignmentFile[];
  counts?: {
    assigned: number;
    submitted: number;
    pending: number;
    reviewed: number;
  };
  my_submission?: Submission | null;
  my_submissions?: Record<string, Submission | null>;
  students?: {
    code: string;
    name: string;
    admission_number?: string;
    submission: Submission | null;
  }[];
}
export interface AssignmentList {
  items: Assignment[];
  can_create: boolean;
  can_review: boolean;
  account_code: string;
  role: string;
  students: { code: string; name: string }[];
}
export interface AssignmentOptions {
  courses: { code: string; name: string; course_level: string }[];
  academic_years: { code: string; name: string; program_code: string }[];
  teachers: { code: string; name: string }[];
  teacher_locked: boolean;
  sections: { code: string; name: string }[];
  students: { code: string; name: string; admission_number?: string }[];
  can_create: boolean;
}
export const assignments = {
  list: (student?: string) =>
    apiRequest<AssignmentList>(assignmentPath, {
      query: { student_code: student },
    }),
  options: (
    program?: string,
    year?: string,
    section?: string,
    signal?: AbortSignal,
  ) =>
    apiRequest<AssignmentOptions>(`${assignmentPath}/options`, {
      query: {
        program_code: program,
        academic_year_code: year,
        section_code: section,
      },
      signal,
    }),
  detail: (code: string, student?: string) =>
    apiRequest<Assignment>(`${assignmentPath}/${code}`, {
      query: { student_code: student },
    }),
  create: (body: unknown) =>
    apiRequest<Assignment>(assignmentPath, { method: "POST", body }),
  review: (code: string, students: unknown[]) =>
    apiRequest<Assignment>(`${assignmentPath}/${code}/review`, {
      method: "POST",
      body: { students },
    }),
  submit: (code: string, files: string[], revision: number) =>
    apiRequest<Submission>(`${assignmentPath}/${code}/submit`, {
      method: "POST",
      body: { attachments: files, revision },
    }),
  async upload(file: File, code?: string): Promise<AssignmentFile> {
    if (!file.size || file.size > 10 * 1024 * 1024)
      throw new Error("Choose files up to 10 MB each.");
    const started = await apiRequest<{ code: string; chunk_size: number }>(
      `${assignmentPath}/files/start`,
      {
        method: "POST",
        body: {
          filename: file.name,
          size_bytes: file.size,
          assignment_code: code,
        },
      },
    );
    for (
      let offset = 0, index = 0;
      offset < file.size;
      offset += started.chunk_size, index++
    ) {
      const part = new File(
        [file.slice(offset, offset + started.chunk_size)],
        file.name,
      );
      await apiRequest(`${assignmentPath}/files/${started.code}/chunk`, {
        method: "POST",
        body: { index, content_base64: await fileToBase64(part) },
      });
    }
    return apiRequest<AssignmentFile>(
      `${assignmentPath}/files/${started.code}/finish`,
      { method: "POST" },
    );
  },
  async bytes(file: AssignmentFile): Promise<Blob> {
    const response = await fetch(
      apiUrl(`${assignmentPath}/files/${file.code}/view`),
      { cache: "no-store" },
    );
    if (!response.ok)
      throw new Error("The attachment could not be opened. Please retry.");
    return response.blob();
  },
};
