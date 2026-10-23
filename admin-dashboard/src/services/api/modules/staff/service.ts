/** Staff onboarding endpoints (backend: app/modules/master_data/staff). */
import { apiRequest } from "../../client";
import type {
  StaffKind,
  StaffOnboardingPayload,
  StaffOnboardingResult,
  StaffOptions,
  StaffRow,
} from "./consts";
import type { Row } from "../../consts";

export const STAFF_ENDPOINTS = {
  onboarding: "master-data/staff-onboarding",
  options: "master-data/staff-onboarding/options",
  detail: (code: string) =>
    `master-data/staff-onboarding/${encodeURIComponent(code)}`,
} as const;

export class StaffService {
  /** Next employee ID and the departments/campuses for the form. */
  options() {
    return apiRequest<StaffOptions>(STAFF_ENDPOINTS.options);
  }

  /** Onboard a teaching, non-teaching or daily-labour employee. */
  onboard(payload: StaffOnboardingPayload) {
    return apiRequest<StaffOnboardingResult>(STAFF_ENDPOINTS.onboarding, {
      method: "POST",
      body: payload,
    });
  }

  list(kind: StaffKind) {
    return apiRequest<{ items: StaffRow[]; total: number }>(
      STAFF_ENDPOINTS.onboarding,
      {
        query: { kind },
      },
    );
  }

  detail(code: string) {
    return apiRequest<{
      employee: Row;
      profile: Row | null;
      salary_components: Row[];
    }>(STAFF_ENDPOINTS.detail(code));
  }
}

export const staffService = new StaffService();
