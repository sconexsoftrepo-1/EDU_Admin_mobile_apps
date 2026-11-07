import { apiRequest } from "../client";

export type EditRequestChange = {
  field: string;
  label: string;
  from: string;
  to: string;
};
export type EditRequest = {
  code: string;
  status: "pending" | "applying" | "accepted" | "rejected";
  target_title: string;
  target_label: string;
  changes: EditRequestChange[];
  requester_name: string | null;
  requester_role: string | null;
  requested_at: string;
  decided_at: string | null;
  decision_note: string | null;
  last_error: string | null;
  stale_fields?: string[];
};

export const editRequestsApi = {
  list(status?: string) {
    return apiRequest<{ items: EditRequest[]; can_decide: boolean }>(
      "edit-requests",
      { query: status ? { status } : undefined },
    );
  },
  pendingCount() {
    return apiRequest<{ count: number; can_decide: boolean }>(
      "edit-requests/pending-count",
    );
  },
  accept(code: string, applyOverNewerData = false) {
    return apiRequest<EditRequest>(
      `edit-requests/${encodeURIComponent(code)}/accept`,
      { method: "POST", body: { apply_over_newer_data: applyOverNewerData } },
    );
  },
  reject(code: string, note?: string) {
    return apiRequest<EditRequest>(
      `edit-requests/${encodeURIComponent(code)}/reject`,
      { method: "POST", body: { note: note || null } },
    );
  },
};
