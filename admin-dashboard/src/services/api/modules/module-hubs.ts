import { apiRequest } from "../client";
import type { DashboardMetric } from "./dashboard";
export type HubActivity = {
  code: string;
  title: string;
  type: string;
  date: string;
  status: string;
  module: string;
  amount: string | null;
  method?: string | null;
};
export type ModuleHubData = {
  key: string;
  today: string;
  metrics: DashboardMetric[];
  charts: {
    title: string;
    kind: "number" | "money" | "percent";
    items: { label: string; value: number }[];
  }[];
  cashbook: {
    opening: number;
    receipts: number;
    payments: number;
    closing: number;
  } | null;
  warnings?: string[];
  recent: HubActivity[];
  pending: HubActivity[];
  pending_count: number;
  years: { code: string; name: string }[];
  destinations: string[];
};
export const loadModuleHub = (
  key: string,
  filters: { academic_year: string; start: string; end: string },
  signal: AbortSignal,
) =>
  apiRequest<ModuleHubData>(`dashboard/modules/${encodeURIComponent(key)}`, {
    query: filters,
    signal,
  });
