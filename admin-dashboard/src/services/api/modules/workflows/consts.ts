/** Screen business actions: payments, approvals, stock movements, ... (backend: operations/workflows). */
import type { Field, Row } from "../../consts";

/** A business action offered on a screen. `path` overrides the default workflows/{key}. */
export interface WorkflowAction {
  key: string;
  label: string;
  /** Table the action belongs to; it is shown on screens that use this table. */
  resource: string;
  permission?: string;
  fields: Field[];
  path?: string;
}

export interface WorkflowActionsResponse {
  actions: WorkflowAction[];
}

/** Result of an action: the records it created or changed. */
export type WorkflowResult = Row;
