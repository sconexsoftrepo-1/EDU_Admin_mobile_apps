/** Authentication endpoints (backend: app/modules/access_control/authentication). */
import { apiRequest } from "../../client";
import type {
  ChangePasswordPayload,
  LoginPayload,
  LoginResponse,
  MeResponse,
  SignInRolesResponse,
} from "./consts";

export const AUTH_ENDPOINTS = {
  login: "auth/login",
  logout: "auth/logout",
  logoutAll: "auth/logout-all",
  me: "auth/me",
  roles: "auth/roles",
  changePassword: "auth/change-password",
} as const;

export class AuthService {
  /** Roles listed on the sign-in page (public). */
  signInRoles() {
    return apiRequest<SignInRolesResponse>(AUTH_ENDPOINTS.roles);
  }

  login(payload: LoginPayload) {
    return apiRequest<LoginResponse>(AUTH_ENDPOINTS.login, {
      method: "POST",
      body: payload,
    });
  }

  me() {
    return apiRequest<MeResponse>(AUTH_ENDPOINTS.me);
  }

  logout() {
    return apiRequest<void>(AUTH_ENDPOINTS.logout, { method: "POST" });
  }

  /** Ends every session of the account. */
  logoutAll() {
    return apiRequest<void>(AUTH_ENDPOINTS.logoutAll, { method: "POST" });
  }

  changePassword(payload: ChangePasswordPayload) {
    return apiRequest<void>(AUTH_ENDPOINTS.changePassword, {
      method: "POST",
      body: payload,
    });
  }
}

export const authService = new AuthService();
