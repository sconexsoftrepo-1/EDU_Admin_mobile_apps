/** Lab register endpoints (backend: app/core/lab_workspace.py). */
import { apiRequest } from "../../client";
import type { Lab, LabInput, LabRegister } from "./consts";

export const LAB_ENDPOINTS = {
  list: "academics/labs",
  detail: (code: string) => `academics/labs/${encodeURIComponent(code)}`,
} as const;

export class LabService {
  /** Registered labs plus the in-charges, lab subjects and campuses for the form. */
  list() {
    return apiRequest<LabRegister>(LAB_ENDPOINTS.list);
  }

  register(body: LabInput) {
    return apiRequest<Lab>(LAB_ENDPOINTS.list, { method: "POST", body });
  }

  update(code: string, body: LabInput & { revision: number }) {
    return apiRequest<Lab>(LAB_ENDPOINTS.detail(code), { method: "PUT", body });
  }
}

export const labService = new LabService();
