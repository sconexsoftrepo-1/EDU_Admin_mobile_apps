/**
 * Shared API types and constants used by every module service and by the components.
 * Module-specific payloads live in modules/<module>/consts.ts.
 */

/** A database record as the backend returns it (values are JSON: decimals and dates as strings). */
export type Row = Record<string, unknown>;

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/** Standard list response: {items, total, offset, limit}. */
export interface Page<T = Row> {
  items: T[];
  total: number;
  offset: number;
  limit: number;
}

/** Error body of every failed request: {"detail": "message"} (422 may carry a list). */
export interface ApiErrorBody {
  detail?: string | unknown;
}

/** A form field described by the backend (screen contracts, workflows, master data actions). */
export interface Field {
  name?: string;
  key?: string;
  label?: string;
  type: string;
  required?: boolean;
  /** Table whose codes the field holds; options come from workspace lookups. */
  reference?: string | null;
  choices?: string[];
  options?: string[];
  section?: string;
  help?: string;
}

/** {values} body accepted by workflows, master data actions and mobile actions. */
export interface ValuesPayload {
  values: Row;
}

/** Lookup option for reference fields. */
export interface LookupOption {
  value: string;
  label: string;
}

/** Permission actions a role can be granted on a table. */
export const PERMISSION_ACTIONS = [
  "view",
  "create",
  "edit",
  "delete",
  "approve",
  "export",
] as const;
export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];

/** Clients an account may be allowed to sign in from. */
export const API_CLIENTS = [
  "admin-web",
  "admin-mobile",
  "teacher-mobile",
  "parent-mobile",
  "student-mobile",
] as const;
export type ApiClient = (typeof API_CLIENTS)[number];

/** HTTP status codes the dashboard reacts to. */
export const HTTP_STATUS = {
  noContent: 204,
  unauthorized: 401,
  forbidden: 403,
  notFound: 404,
  conflict: 409,
  unprocessable: 422,
  tooManyRequests: 429,
} as const;
