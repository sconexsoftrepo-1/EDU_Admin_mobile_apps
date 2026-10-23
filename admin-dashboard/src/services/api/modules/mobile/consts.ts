/** Personal portal for teachers, students and parents (backend: mobile/workspace). */
import type { Field, Row } from "../../consts";

export interface PersonalScreen {
  key: string;
  title: string;
  resource?: string;
}

export interface PersonalScreensResponse {
  screens: PersonalScreen[];
}

/** An action offered on a personal screen (leave request, attendance, ...). */
export interface PersonalAction {
  key: string;
  label: string;
  fields: Field[];
  form_revision?: number;
}

/** GET mobile/workspace/{screen}. */
export interface PersonalScreenData {
  title: string;
  items: Row[];
  summary: Row | null;
  actions: PersonalAction[];
  /** Children of a parent account; the selected one is passed as student_code. */
  students: { code: string; name: string }[];
  selected_student_code?: string;
  /** Download kind for the items (payslip, receipt, ...). */
  downloads?: string;
}

/** Action results may redirect to a payment page or require signing in again. */
export interface PersonalActionResult {
  checkout_url?: string;
  reauthenticate?: boolean;
  [key: string]: unknown;
}

/** POST mobile/workspace/{screen}/actions/{action}. */
export interface PersonalActionPayload {
  values: Row;
  form_revision?: number;
  student_code?: string | null;
}
