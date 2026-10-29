/** Workspace screens, generic record screens and form-bound saves (backend: administration/workspace). */
import type { Field, Row } from "../../consts";

/** A table shown on a screen, with its list path and the actions the user may take. */
export interface Resource {
  name: string;
  title: string;
  /** Backend list path, e.g. "/api/v1/academics/students". */
  path: string;
  fields: Field[];
  actions: string[];
}

/** GET workspace/screens/{key}. */
export interface Screen {
  key: string;
  title: string;
  resources: Resource[];
  storage?: string;
}

/** Entry of GET workspace/screens (resources are table names here). */
export interface ScreenSummary {
  key: string;
  title: string;
  resources: string[];
}

export interface ScreensResponse {
  screens: ScreenSummary[];
}

/** Published custom form bound to a table (configurable forms). */
export interface BoundForm {
  code: string;
  name: string;
  screen: string;
  revision: number;
  published: boolean;
  fields: {
    key: string;
    label: string;
    type: string;
    required: boolean;
    options: string[];
  }[];
}

/** GET workspace/resources/{table}/form: the form and previously submitted values. */
export interface ResourceFormResponse {
  form: BoundForm | null;
  values: Row;
  defaults?: Row;
  resource?: Resource;
}

/** POST/PATCH workspace/resources/{table}[/{code}]. */
export interface RecordSavePayload {
  values: Row;
  form_code?: string;
  form_revision?: number;
}
