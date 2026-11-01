/** Laboratories and lab in-charges (backend: app/core/lab_workspace.py). */

export const LAB_TYPES = [
  "Physics",
  "Chemistry",
  "Biology",
  "Botany",
  "Zoology",
  "Computer",
  "Electronics",
  "Language",
  "Commerce",
  "Research",
  "Other",
] as const;
export type LabType = (typeof LAB_TYPES)[number];

/** Designation used for non-teaching staff who run a lab. */
export const LAB_INCHARGE_DESIGNATION = "Lab in-charge";

export interface LabInput {
  name: string;
  floor: string;
  room_number: string;
  lab_type: LabType;
  incharge_employee_code?: string | null;
  subject_codes: string[];
  campus_code?: string | null;
  capacity?: number | null;
  status?: "active" | "inactive";
}

export interface Lab extends LabInput {
  code: string;
  revision: number;
  incharge_name: string | null;
  subjects: { code: string; name: string }[];
  created_at?: string;
  updated_at?: string;
}

export interface LabRegister {
  items: Lab[];
  total: number;
  can_manage: boolean;
  lab_types: LabType[];
  incharges: {
    code: string;
    name: string;
    employee_id?: string | null;
    designation?: string | null;
  }[];
  subjects: { code: string; name: string; subject_type?: string }[];
  campuses: { code: string; name: string }[];
}
