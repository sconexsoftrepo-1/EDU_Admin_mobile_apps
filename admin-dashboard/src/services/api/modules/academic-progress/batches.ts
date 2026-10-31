import { apiRequest } from "../../client";
export type BatchRow = {
  code: string;
  name: string;
  course_name: string;
  program_code: string;
  start_date: string;
  end_date: string;
  students: number;
  section_count: number;
  semester_count: number;
  current_semester: number | null;
};
export type SectionSpec = {
  code?: string;
  name: string;
  capacity: number | null;
};
export type SectionPlan = {
  semester_number: number;
  sections: SectionSpec[];
  order_by: "university_roll_number" | "admission_number";
  overrides: Record<string, number>;
  expected_revision?: string;
};
export type PlacementPreview = {
  revision: string;
  total_students: number;
  sections: (SectionSpec & { students: number })[];
  students: {
    student_code: string;
    name: string;
    admission_number: string;
    university_roll_number: string;
    roll_number: string;
    current_section_name: string;
    section_index: number;
    section_name: string;
  }[];
};
export const academicBatches = {
  list: () =>
    apiRequest<{
      items: BatchRow[];
      can_create: boolean;
      can_manage_sections: boolean;
    }>("academics/batch-workspace"),
  create: (body: {
    program_code: string;
    start_date: string;
    end_date: string;
  }) =>
    apiRequest<BatchRow>("academics/batch-workspace", { method: "POST", body }),
  sections: (code: string, semester: number) =>
    apiRequest<{
      sections: SectionSpec[];
      students: {
        student_code: string;
        name: string;
        admission_number: string;
        roll_number: string;
        section_name: string;
      }[];
    }>(`academics/batch-workspace/${encodeURIComponent(code)}/sections`, {
      query: { semester_number: semester },
    }),
  preview: (code: string, body: SectionPlan) =>
    apiRequest<PlacementPreview>(
      `academics/batch-workspace/${encodeURIComponent(code)}/sections/preview`,
      { method: "POST", body },
    ),
  apply: (code: string, body: SectionPlan) =>
    apiRequest<PlacementPreview>(
      `academics/batch-workspace/${encodeURIComponent(code)}/sections/apply`,
      { method: "POST", body },
    ),
};
