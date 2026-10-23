/** Configurable forms: extra fields bound to a table or a mobile action (backend: access_control/forms). */

export const FORM_FIELD_TYPES = [
  "text",
  "email",
  "phone",
  "integer",
  "decimal",
  "date",
  "boolean",
  "select",
  "textarea",
] as const;
export type FormFieldType = (typeof FORM_FIELD_TYPES)[number];

export interface FormFieldDefinition {
  key: string;
  label: string;
  type: string;
  required: boolean;
  options: string[];
  section: string;
  help: string;
}

export interface FormDefinition {
  code: string;
  name: string;
  /** Table name, or "mobile.<action>" for a mobile action form. */
  screen: string;
  fields: FormFieldDefinition[];
  published: boolean;
  revision: number;
  updated_at?: string;
  [key: string]: unknown;
}

/** POST forms, PUT forms/{code}. */
export interface FormPayload {
  name: string;
  screen: string;
  published: boolean;
  fields: Partial<FormFieldDefinition>[];
}
