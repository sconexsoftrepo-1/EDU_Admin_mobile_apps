import { apiRequest, fileToBase64 } from "../../client";
import { apiUrl } from "../../config";

const root = "academics/syllabus-workspace";
export interface SyllabusFile {
  code: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
}
export interface SyllabusRecord {
  code: string;
  syllabus_name: string;
  description: string;
  course_level: string;
  program_code: string;
  course_name: string;
  specialization: string;
  academic_year_code: string;
  batch_name: string;
  created_at?: string;
  attachments: SyllabusFile[];
}
export interface SyllabusPayload {
  items: SyllabusRecord[];
  can_create: boolean;
  students: { code: string; name: string }[];
  role: string;
}
export interface SyllabusOptions {
  courses: { code: string; name: string; course_level: string; specialization: string }[];
  academic_years: { code: string; name: string; program_code: string }[];
  can_create: boolean;
}
export const syllabus = {
  list: (student?: string) => apiRequest<SyllabusPayload>(root, { query: { student_code: student } }),
  options: (level?: string, course?: string) =>
    apiRequest<SyllabusOptions>(`${root}/options`, {
      query: { course_level: level, program_code: course },
    }),
  create: (body: unknown) =>
    apiRequest<SyllabusRecord>(root, { method: "POST", body }),
  async upload(file: File): Promise<SyllabusFile> {
    if (!file.size || file.size > 10 * 1024 * 1024)
      throw new Error("Choose files up to 10 MB each.");
    const started = await apiRequest<{ code: string; chunk_size: number }>(
      "academics/assignment-workspace/files/start",
      {
        method: "POST",
        body: { filename: file.name, size_bytes: file.size, resource_upload: true },
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
      await apiRequest(
        `academics/assignment-workspace/files/${started.code}/chunk`,
        { method: "POST", body: { index, content_base64: await fileToBase64(part) } },
      );
    }
    return apiRequest<SyllabusFile>(
      `academics/assignment-workspace/files/${started.code}/finish`,
      { method: "POST" },
    );
  },
  bytes: async (file: SyllabusFile): Promise<Blob> => {
    const response = await fetch(
      apiUrl(`academics/assignment-workspace/files/${file.code}/view`),
      { cache: "no-store" },
    );
    if (!response.ok)
      throw new Error("The resource could not be opened. Please retry.");
    return response.blob();
  },
};
