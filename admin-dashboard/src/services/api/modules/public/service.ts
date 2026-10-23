/** Public website endpoints (backend: app/modules/admissions/public_intake). */
import { apiRequest } from "../../client";
import type {
  ApplicationPayload,
  ContactPayload,
  IntakeKind,
  IntakeReceipt,
  PublicOptions,
} from "./consts";

export const PUBLIC_ENDPOINTS = {
  options: "public/options",
  applications: "public/applications",
  contact: "public/contact",
} as const;

export class PublicService {
  /** Programs and admission sources for the application form. */
  options() {
    return apiRequest<PublicOptions>(PUBLIC_ENDPOINTS.options);
  }

  apply(payload: ApplicationPayload) {
    return apiRequest<IntakeReceipt>(PUBLIC_ENDPOINTS.applications, {
      method: "POST",
      body: payload,
    });
  }

  contact(payload: ContactPayload) {
    return apiRequest<IntakeReceipt>(PUBLIC_ENDPOINTS.contact, {
      method: "POST",
      body: payload,
    });
  }

  /** Submit either intake form by kind. */
  submit(kind: IntakeKind, payload: ApplicationPayload | ContactPayload) {
    return apiRequest<IntakeReceipt>(PUBLIC_ENDPOINTS[kind], {
      method: "POST",
      body: payload,
    });
  }
}

export const publicService = new PublicService();
