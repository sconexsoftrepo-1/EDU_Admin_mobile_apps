/** Configurable form endpoints (backend: app/modules/access_control/forms). */
import { apiRequest } from "../../client";
import type { FormDefinition, FormPayload } from "./consts";

export const FORM_ENDPOINTS = {
  list: "forms",
  form: (code: string) => `forms/${encodeURIComponent(code)}`,
} as const;

export class FormService {
  list() {
    return apiRequest<FormDefinition[]>(FORM_ENDPOINTS.list);
  }

  get(code: string) {
    return apiRequest<FormDefinition>(FORM_ENDPOINTS.form(code));
  }

  create(payload: FormPayload) {
    return apiRequest<FormDefinition>(FORM_ENDPOINTS.list, {
      method: "POST",
      body: payload,
    });
  }

  /** Saving a published form creates a new revision. */
  update(code: string, payload: FormPayload) {
    return apiRequest<FormDefinition>(FORM_ENDPOINTS.form(code), {
      method: "PUT",
      body: payload,
    });
  }

  save(code: string | undefined, payload: FormPayload) {
    return code ? this.update(code, payload) : this.create(payload);
  }

  remove(code: string) {
    return apiRequest<void>(FORM_ENDPOINTS.form(code), { method: "DELETE" });
  }
}

export const formService = new FormService();
