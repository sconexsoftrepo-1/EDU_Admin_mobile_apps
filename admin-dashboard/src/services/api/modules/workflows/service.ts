/** Screen business action endpoints (backend: app/modules/operations/workflows). */
import { apiRequest } from "../../client";
import type { Row } from "../../consts";
import type {
  WorkflowAction,
  WorkflowActionsResponse,
  WorkflowResult,
} from "./consts";

export const WORKFLOW_ENDPOINTS = {
  list: "workflows",
  run: (key: string) => `workflows/${encodeURIComponent(key)}`,
} as const;

export class WorkflowService {
  list() {
    return apiRequest<WorkflowActionsResponse>(WORKFLOW_ENDPOINTS.list);
  }

  /** Run an action with its form values; actions that carry their own path post there. */
  run(action: Pick<WorkflowAction, "key" | "path">, values: Row) {
    return apiRequest<WorkflowResult>(
      action.path || WORKFLOW_ENDPOINTS.run(action.key),
      { method: "POST", body: { values } },
    );
  }
}

export const workflowService = new WorkflowService();
