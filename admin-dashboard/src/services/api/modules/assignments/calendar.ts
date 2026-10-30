import { apiRequest, fileToBase64 } from "../../client";
import { apiUrl } from "../../config";

const root = "academics/calendar-workspace";
const uploadRoot = "academics/assignment-workspace/files";
export interface CalendarImage {
  code: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
}
export interface CalendarEvent {
  code: string;
  title: string;
  place: string;
  starts_at: string;
  ends_at: string;
  event_type: string;
  short_description: string;
  description: string;
  audience_type: string;
  audience_code?: string;
  image_code?: string;
  image?: CalendarImage | null;
}
export interface CalendarData {
  items: CalendarEvent[];
  can_create: boolean;
  students: { code: string; name: string }[];
  role: string;
}
export interface CalendarOptions {
  departments: { code: string; name: string }[];
  courses: { code: string; name: string; department_code: string; course_level: string; specialization: string }[];
  event_types: string[];
  can_create: boolean;
}
export const calendar = {
  list: (student?: string) => apiRequest<CalendarData>(root, { query: { student_code: student } }),
  detail: (code: string) => apiRequest<CalendarEvent>(`${root}/${encodeURIComponent(code)}`),
  options: () => apiRequest<CalendarOptions>(`${root}/options`),
  create: (body: unknown) => apiRequest<CalendarEvent>(root, { method: "POST", body }),
  async upload(file: File): Promise<CalendarImage> {
    if (!file.size || file.size > 10 * 1024 * 1024) throw new Error("Choose an image up to 10 MB.");
    const started = await apiRequest<{ code: string; chunk_size: number }>(`${uploadRoot}/start`, {
      method: "POST", body: { filename: file.name, size_bytes: file.size, event_upload: true },
    });
    for (let offset = 0, index = 0; offset < file.size; offset += started.chunk_size, index++) {
      const part = new File([file.slice(offset, offset + started.chunk_size)], file.name);
      await apiRequest(`${uploadRoot}/${started.code}/chunk`, { method: "POST", body: { index, content_base64: await fileToBase64(part) } });
    }
    return apiRequest<CalendarImage>(`${uploadRoot}/${started.code}/finish`, { method: "POST" });
  },
  bytes: async (file: CalendarImage): Promise<Blob> => {
    const response = await fetch(apiUrl(`${uploadRoot}/${file.code}/view`), { cache: "no-store" });
    if (!response.ok) throw new Error("The event image could not be opened.");
    return response.blob();
  },
};
