/** Roles, screen allocation, login accounts and audit (backend: access_control/role_management). */
import type { ApiClient, PermissionAction, Row } from "../../consts";
import type { WorkspaceScope } from "../auth/consts";

/** permissions: {table or screen: [actions]}. */
export type PermissionMap = Record<string, PermissionAction[] | string[]>;

export interface Role {
  code: string;
  name: string;
  scope: WorkspaceScope;
  system_admin: boolean;
  protected?: boolean;
  permissions: PermissionMap;
  /** Workspace screens allocated to the role; absent/null = every permitted screen. */
  screens?: string[] | null;
  /** Accounts holding the role (GET administration/roles). */
  assigned_accounts?: Row[];
  [key: string]: unknown;
}

/** POST administration/roles, PUT administration/roles/{code}. */
export interface RolePayload {
  name: string;
  scope: WorkspaceScope;
  permissions: PermissionMap;
  screens: string[] | null;
}

/** GET administration/screens: permission targets, actions and allocatable screens. */
export interface AdministrationScreensResponse {
  screens: string[];
  actions: PermissionAction[];
  workspace_screens: { key: string; title: string }[];
}

export type PersonType = "employee" | "student" | "parent";

export interface LoginAccount {
  code: string;
  login_id: string;
  active: boolean;
  person_type: PersonType | "system";
  person_code: string;
  role_codes: string[];
  clients: ApiClient[];
  [key: string]: unknown;
}

/** POST administration/accounts (password 12-128 characters). */
export interface CreateAccountPayload {
  login_id: string;
  password: string;
  person_type: PersonType;
  person_code: string;
  role_codes: string[];
  clients: ApiClient[];
}

/** PATCH administration/accounts/{code}. */
export interface UpdateAccountPayload {
  role_codes?: string[];
  clients?: ApiClient[];
  active?: boolean;
}

export interface ResetPasswordPayload {
  new_password: string;
}

export interface LinkEmployeePayload {
  employee_code: string;
}

export interface AuditEntry {
  code: string;
  actor: string | null;
  action: string;
  resource: string;
  entity_code: string;
  occurred_at: string;
  [key: string]: unknown;
}

/** Lookup table that lists the people of each person type. */
export const PERSON_LOOKUPS: Record<PersonType, string> = {
  employee: "employees",
  student: "students",
  parent: "parents",
};
