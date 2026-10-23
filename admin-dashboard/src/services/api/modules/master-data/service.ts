/** Master data endpoints (backend: app/modules/master_data/onboarding). */
import { apiRequest } from "../../client";
import type { Row } from "../../consts";
import type {
  BatchOverview,
  CourseInsights,
  EnrollmentOptions,
  EnrollmentPayload,
  EnrollmentResult,
  MasterDataActionsResponse,
} from "./consts";

export const MASTER_DATA_ENDPOINTS = {
  actions: "master-data/actions",
  enrollment: "master-data/enrollment",
  enrollmentOptions: "master-data/enrollment/options",
  courseInsights: (programCode: string) =>
    `master-data/enrollment/courses/${encodeURIComponent(programCode)}/insights`,
  enrollmentReview: (studentCode: string) =>
    `master-data/enrollment/${encodeURIComponent(studentCode)}`,
  runAction: (key: string) => `master-data/actions/${encodeURIComponent(key)}`,
} as const;

export class MasterDataService {
  /** Data entry forms the user may fill (each posts {values} to its path). */
  actions() {
    return apiRequest<MasterDataActionsResponse>(MASTER_DATA_ENDPOINTS.actions);
  }

  /** Wizard options; pass a year and course for numbers and the fee breakdown. */
  enrollmentOptions(
    query: {
      academic_year_code?: string;
      program_code?: string;
    } = {},
  ) {
    return apiRequest<EnrollmentOptions>(
      MASTER_DATA_ENDPOINTS.enrollmentOptions,
      {
        query,
      },
    );
  }

  /** Enroll a student completely (student, parents, course, fees, admission profile). */
  enroll(payload: EnrollmentPayload) {
    return apiRequest<EnrollmentResult>(MASTER_DATA_ENDPOINTS.enrollment, {
      method: "POST",
      body: payload,
    });
  }

  /** A course with its year-wise batches and student counts. */
  courseInsights(programCode: string) {
    return apiRequest<CourseInsights>(
      MASTER_DATA_ENDPOINTS.courseInsights(programCode),
    );
  }

  batchOverview(programCode?: string) {
    return apiRequest<BatchOverview>(
      "master-data/enrollment/batches/overview",
      { query: { program_code: programCode || undefined } },
    );
  }

  updateBatch(
    batchCode: string,
    payload: {
      entry_year: number;
      graduation_year: number;
      sections: { code: string; name: string }[];
    },
  ) {
    return apiRequest<{ batch: Row; sections_updated: number }>(
      `master-data/enrollment/batches/${encodeURIComponent(batchCode)}`,
      { method: "PATCH", body: payload },
    );
  }

  enrollmentReview(studentCode: string) {
    return apiRequest<Row>(MASTER_DATA_ENDPOINTS.enrollmentReview(studentCode));
  }

  runAction(key: string, values: Row) {
    return apiRequest<Row>(MASTER_DATA_ENDPOINTS.runAction(key), {
      method: "POST",
      body: { values },
    });
  }
}

export const masterDataService = new MasterDataService();
