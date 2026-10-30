import { apiRequest } from "../client";
import type { Row } from "../consts";

export const admissionsApi = {
  createIntake(values: Row) {
    return apiRequest<Row>("admissions/admission-enquiries/intake", {
      method: "POST",
      body: { values },
    });
  },
  updateIntake(code: string, values: Row) {
    return apiRequest<Row>(
      `admissions/admission-enquiries/intake/${encodeURIComponent(code)}`,
      { method: "PATCH", body: { values } },
    );
  },
};
