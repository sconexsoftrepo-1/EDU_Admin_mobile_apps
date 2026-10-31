import { apiRequest, fileToBase64 } from "../../client";
import { assignmentPath, type AssignmentFile } from "../assignments/service";
export interface CurriculumItem {
  code?: string;
  credits?: string;
  subject_code: string;
  name: string;
  subject_type: string;
  semester_number: number;
}
export interface Curriculum {
  revision: number;
  status: string;
  items: CurriculumItem[];
}
export interface AssessmentMark {
  marks: string | null;
  absent: boolean;
  feedback: string;
}
export interface Assessment {
  code: string;
  title: string;
  description: string;
  guidance: string;
  scheduled_at: string;
  max_marks: string;
  status: string;
  bucket: string;
  revision: number;
  course_level: string;
  program_code: string;
  academic_year_code: string;
  section_code?: string;
  teacher_code: string;
  subject_code: string;
  semester_number: number;
  subject_name: string;
  course_name: string;
  batch_name: string;
  can_manage: boolean;
  can_grade: boolean;
  attachments: AssignmentFile[];
  marks: Record<string, AssessmentMark>;
  students?: { code: string; name: string; mark: AssessmentMark | null }[];
  counts: { assigned: number; graded: number };
}
export interface AssessmentOptions {
  current_semester?: number | null;
  courses: {
    code: string;
    name: string;
    course_level: string;
    branch?: string;
  }[];
  academic_years: { code: string; name: string; program_code: string }[];
  sections: { code: string; name: string }[];
  students: { code: string; name: string }[];
  subjects: CurriculumItem[];
  teachers: { code: string; name: string }[];
  can_create: boolean;
}
interface Performance {
  graded: number;
  percentage: number | null;
}
export interface AssessmentList {
  items: Assessment[];
  can_create: boolean;
  students: { code: string; name: string }[];
  performance: Performance;
  student_performance?: (Performance & { code: string; name: string })[];
  subject_performance?: (Performance & { code: string; name: string })[];
  subjects?: CurriculumItem[];
  batch_performance: (Performance & { code: string; name: string })[];
}
const path = "academics/assessment-workspace";
export const assessments = {
  list: (student?: string) =>
    apiRequest<AssessmentList>(path, { query: { student_code: student } }),
  options: (program?: string, year?: string, section?: string) =>
    apiRequest<AssessmentOptions>(path + "/options", {
      query: {
        program_code: program,
        academic_year_code: year,
        section_code: section,
      },
    }),
  detail: (code: string, student?: string) =>
    apiRequest<Assessment>(path + "/" + code, {
      query: { student_code: student },
    }),
  save: (body: unknown, code?: string) =>
    apiRequest<Assessment>(path + (code ? "/" + code : ""), {
      method: code ? "PUT" : "POST",
      body,
    }),
  grade: (code: string, revision: number, students: unknown[]) =>
    apiRequest<Assessment>(path + "/" + code + "/marks", {
      method: "PUT",
      body: { revision, students },
    }),
  async upload(file: File): Promise<AssignmentFile> {
    if (!file.size || file.size > 10 * 1024 * 1024)
      throw new Error("Choose a PDF or image up to 10 MB.");
    const upload = await apiRequest<{ code: string; chunk_size: number }>(
      assignmentPath + "/files/start",
      {
        method: "POST",
        body: {
          filename: file.name,
          size_bytes: file.size,
          assessment_upload: true,
        },
      },
    );
    for (
      let offset = 0, index = 0;
      offset < file.size;
      offset += upload.chunk_size, index++
    )
      await apiRequest(`${assignmentPath}/files/${upload.code}/chunk`, {
        method: "POST",
        body: {
          index,
          content_base64: await fileToBase64(
            new File(
              [file.slice(offset, offset + upload.chunk_size)],
              file.name,
            ),
          ),
        },
      });
    return apiRequest<AssignmentFile>(
      `${assignmentPath}/files/${upload.code}/finish`,
      { method: "POST" },
    );
  },
};
export const courseCurricula = {
  get: (code: string) =>
    apiRequest<Curriculum>("academics/course-curricula/" + code),
  save: (code: string, body: unknown) =>
    apiRequest<Curriculum>("academics/course-curricula/" + code, {
      method: "PUT",
      body,
    }),
};

export interface CourseWorkspace extends Curriculum {
  can_edit: boolean;
  can_assign: boolean;
  allocation_revision: number;
  academic_years: { code: string; name: string }[];
  sections: {
    code: string;
    name: string;
    academic_year_code: string;
    semester_number?: number | null;
  }[];
  teachers: { code: string; name: string }[];
  offerings: {
    code: string;
    subject_code: string;
    section_code: string;
    teacher_code: string;
  }[];
}
export const courseWorkspace = {
  get: (code: string) =>
    apiRequest<CourseWorkspace>(`academics/course-curricula/${code}/workspace`),
  edit: (code: string, link: string, body: unknown) =>
    apiRequest<CourseWorkspace>(
      `academics/course-curricula/${code}/subjects/${link}`,
      { method: "PATCH", body },
    ),
  add: (code: string, body: unknown) =>
    apiRequest<CourseWorkspace>(`academics/course-curricula/${code}/subjects`, {
      method: "POST",
      body,
    }),
  assign: (code: string, body: unknown) =>
    apiRequest<CourseWorkspace>(`academics/course-curricula/${code}/faculty`, {
      method: "PUT",
      body,
    }),
};
