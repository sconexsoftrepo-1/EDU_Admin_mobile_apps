import { apiRequest } from "../client";
import type { AdmissionRow } from "./admissions";

export type DashboardMetric = {
  label: string;
  value: number | string | null;
  kind: "number" | "money" | "percent";
  hint: string | null;
  module: string | null;
  trend: number | null;
};
type Metrics = Record<string, DashboardMetric>;
/** A section that failed on the server: shown with a retry, never as zero. */
export type SectionError = { error: true };
export type DashboardSections = {
  finance?:
    | SectionError
    | {
        metrics: Metrics;
        monthly: { month: string; collected: number; outstanding: number }[];
      };
  admissions?:
    | SectionError
    | {
        metrics: Metrics;
        funnel: { name: string; count: number; percentage: number }[];
        recent: AdmissionRow[];
      };
  academics?:
    | SectionError
    | {
        metrics: Metrics;
        percentage: number | null;
        students: number;
        batches: number;
        backlog_students: number;
        all_clear: number;
        courses: { name: string; percentage: number }[];
        today_classes: {
          code: string;
          subject_name: string;
          start_time: string;
          end_time: string;
          state: string;
          period: number;
        }[];
      };
  activity?:
    | SectionError
    | {
        items: {
          code: string;
          title: string;
          starts_at: string;
          detail: string | null;
        }[];
      };
  students?: SectionError | { metrics: Metrics };
  attendance?: SectionError | { metrics: Metrics };
  people?: SectionError | { metrics: Metrics };
  counts?: SectionError | { metrics: Metrics };
  faculty?: SectionError | { metrics: Metrics };
};
export type DashboardOverviewData = {
  viewer: {
    name: string;
    login_id: string;
    roles: string[];
    campus: string | null;
  };
  academic_session: string;
  today: string;
  sections: DashboardSections;
};

export const dashboardApi = {
  overview() {
    return apiRequest<DashboardOverviewData>("dashboard/overview");
  },
};
