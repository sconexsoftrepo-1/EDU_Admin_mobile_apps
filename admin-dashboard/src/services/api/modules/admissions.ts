import { apiRequest } from "../client";
import type { Row } from "../consts";

export type AdmissionOpening = {
  program_code: string | null;
  course_name: string | null;
  course_level: string | null;
  intake_capacity: number | null;
  joined: number;
  cycle_name: string | null;
  academic_year: string | null;
  closes_on: string | null;
};
export type AdmissionCount = { name: string; count: number; percentage: number };
export type AdmissionSummary = {
  total: number;
  joined: number;
  conversion: number;
  in_progress: number;
  not_interested: number;
  statuses: AdmissionCount[];
  courses: AdmissionCount[];
  referrers: AdmissionCount[];
};
export type AdmissionScope = AdmissionSummary & {
  by_reference: (AdmissionSummary & {
    key: string;
    label: string;
    share: number;
  })[];
};
export type AdmissionRow = {
  code: string;
  name: string;
  course_name: string | null;
  reference_type: string;
  reference_label: string;
  reference_name: string | null;
  status: string;
  recorded_at: string | null;
};
export type AdmissionAnalytics = {
  can_view_all: boolean;
  all: AdmissionScope;
  mine: AdmissionScope;
  all_rows: AdmissionRow[];
  my_rows: AdmissionRow[];
};
export type AdmissionInsights = {
  available: AdmissionOpening[];
  analytics: AdmissionAnalytics | null;
};

export const admissionsApi = {
  insights() {
    return apiRequest<AdmissionInsights>("admissions/insights");
  },
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
