/** Roles & access endpoints (backend: app/modules/access_control/role_management). */
import { apiRequest } from "../../client";
import type {
  AdministrationScreensResponse,
  AuditEntry,
  CreateAccountPayload,
  LinkEmployeePayload,
  LoginAccount,
  ResetPasswordPayload,
  Role,
  RolePayload,
  UpdateAccountPayload,
} from "./consts";

export const ADMINISTRATION_ENDPOINTS = {
  screens: "administration/screens",
  roles: "administration/roles",
  role: (code: string) => `administration/roles/${encodeURIComponent(code)}`,
  accounts: "administration/accounts",
  account: (code: string) =>
    `administration/accounts/${encodeURIComponent(code)}`,
  resetPassword: (code: string) =>
    `administration/accounts/${encodeURIComponent(code)}/reset-password`,
  audit: "administration/audit",
  linkEmployee: "administration/bootstrap/link-employee",
} as const;

export class AdministrationService {
  /** Permission targets, actions and the screens a role can be allocated. */
  screens() {
    return apiRequest<AdministrationScreensResponse>(
      ADMINISTRATION_ENDPOINTS.screens,
    );
  }

  roles() {
    return apiRequest<Role[]>(ADMINISTRATION_ENDPOINTS.roles);
  }

  createRole(payload: RolePayload) {
    return apiRequest<Role>(ADMINISTRATION_ENDPOINTS.roles, {
      method: "POST",
      body: payload,
    });
  }

  updateRole(code: string, payload: RolePayload) {
    return apiRequest<Role>(ADMINISTRATION_ENDPOINTS.role(code), {
      method: "PUT",
      body: payload,
    });
  }

  /** Create when `code` is empty, otherwise update. */
  saveRole(code: string | undefined, payload: RolePayload) {
    return code ? this.updateRole(code, payload) : this.createRole(payload);
  }

  deleteRole(code: string) {
    return apiRequest<void>(ADMINISTRATION_ENDPOINTS.role(code), {
      method: "DELETE",
    });
  }

  accounts() {
    return apiRequest<LoginAccount[]>(ADMINISTRATION_ENDPOINTS.accounts);
  }

  createAccount(payload: CreateAccountPayload) {
    return apiRequest<LoginAccount>(ADMINISTRATION_ENDPOINTS.accounts, {
      method: "POST",
      body: payload,
    });
  }

  updateAccount(code: string, payload: UpdateAccountPayload) {
    return apiRequest<LoginAccount>(ADMINISTRATION_ENDPOINTS.account(code), {
      method: "PATCH",
      body: payload,
    });
  }

  /** Disables the account and ends its sessions. */
  disableAccount(code: string) {
    return apiRequest<void>(ADMINISTRATION_ENDPOINTS.account(code), {
      method: "DELETE",
    });
  }

  resetPassword(code: string, payload: ResetPasswordPayload) {
    return apiRequest<void>(ADMINISTRATION_ENDPOINTS.resetPassword(code), {
      method: "POST",
      body: payload,
    });
  }

  /** Newest entries first. */
  audit(offset = 0, limit = 100) {
    return apiRequest<AuditEntry[]>(ADMINISTRATION_ENDPOINTS.audit, {
      query: { offset, limit },
    });
  }

  /** Link the bootstrap administrator to an employee record (needed for transactions). */
  linkEmployee(payload: LinkEmployeePayload) {
    return apiRequest<LoginAccount>(ADMINISTRATION_ENDPOINTS.linkEmployee, {
      method: "POST",
      body: payload,
    });
  }
}

export const administrationService = new AdministrationService();
