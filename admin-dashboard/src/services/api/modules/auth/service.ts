/** Authentication endpoints (backend: app/modules/access_control/authentication). */
import { apiRequest } from "../../client";
import { API_CONFIG } from "../../config";
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
  otpRequest: "auth/otp/request",
  otpVerify: "auth/otp/verify",
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

  /** Emails a 6-digit sign-in code to the login's address (staff only; the answer never says
   *  whether the login exists). */
  requestCode(login: string, roleCode?: string) {
    return apiRequest<{ sent: boolean; message: string }>(
      AUTH_ENDPOINTS.otpRequest,
      {
        method: "POST",
        body: {
          login,
          client: API_CONFIG.client,
          ...(roleCode ? { role_code: roleCode } : {}),
        },
      },
    );
  }

  /** Signs in with the emailed code; the proxy keeps the tokens in httpOnly cookies. */
  verifyCode(payload: { login: string; code: string; role_code?: string }) {
    return apiRequest<LoginResponse>(AUTH_ENDPOINTS.otpVerify, {
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
