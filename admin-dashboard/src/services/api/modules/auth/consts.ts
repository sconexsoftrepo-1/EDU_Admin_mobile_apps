/** Sign-in, session and password payloads (backend module: Authentication). */
import type { ApiClient } from "../../consts";

export type WorkspaceScope = "college" | "teaching" | "self";

/** Signed-in account (GET auth/me -> account). */
export interface Account {
  code: string;
  login_id: string;
  active: boolean;
  person_type: "employee" | "student" | "parent" | "system" | string;
  person_code: string;
  role_codes: string[];
  clients: ApiClient[];
  workspace_scope?: WorkspaceScope;
  session_code?: string;
  client?: ApiClient;
  [key: string]: unknown;
}

/** A role of the signed-in account (GET auth/me -> roles). */
export interface AccountRole {
  system_admin?: boolean;
  screens?: string[] | null;
  code: string;
  name: string;
  scope: WorkspaceScope;
  permissions: Record<string, string[]>;
}

export interface MeResponse {
  account: Account;
  roles: AccountRole[];
}

/** Role offered on the sign-in page (GET auth/roles). */
export interface SignInRole {
  code: string;
  name: string;
  scope: WorkspaceScope;
}

export interface SignInRolesResponse {
  roles: SignInRole[];
}

/** POST auth/login. `client` is added by the proxy (admin-web). */
export interface LoginPayload {
  login_id: string;
  password: string;
  /** Role chosen on the sign-in page; the account must hold it (403 otherwise). */
  role_code?: string;
}

/** The proxy keeps the tokens in cookies and returns the account with its roles. */
export interface LoginResponse {
  account: Account;
  /** Roles with permissions and screen allocation, to build the navigation at once. */
  roles?: AccountRole[];
}

/** POST auth/change-password (new password 12-128 characters). */
export interface ChangePasswordPayload {
  current_password: string;
  new_password: string;
}

export const PASSWORD_MIN_LENGTH = 12;
