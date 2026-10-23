/**
 * Workspace endpoints. Record screens are generic: the screen contract gives each table's list
 * path (Resource.path), so one service lists, saves and deletes records of any table.
 */
import { apiRequest } from "../../client";
import { API_CONFIG } from "../../config";
import type { LookupOption, Page, Row } from "../../consts";
import type {
  RecordSavePayload,
  ResourceFormResponse,
  Screen,
  ScreensResponse,
} from "./consts";

export const WORKSPACE_ENDPOINTS = {
  screens: "workspace/screens",
  screen: (key: string) => `workspace/screens/${encodeURIComponent(key)}`,
  lookup: (table: string) => `workspace/lookups/${encodeURIComponent(table)}`,
  resourceForm: (table: string) => `workspace/resources/${table}/form`,
  createRecord: (table: string) => `workspace/resources/${table}`,
  updateRecord: (table: string, code: string) =>
    `workspace/resources/${table}/${encodeURIComponent(code)}`,
  /** Generic table routes come from the screen contract (Resource.path). */
  record: (resourcePath: string, code: string) =>
    `${resourcePath}/${encodeURIComponent(code)}`,
} as const;

export class WorkspaceService {
  /** Screens the signed-in user may open (role screen allocation applied). */
  screens() {
    return apiRequest<ScreensResponse>(WORKSPACE_ENDPOINTS.screens);
  }

  /** One screen with its tables, fields and permitted actions. */
  screen(key: string) {
    return apiRequest<Screen>(WORKSPACE_ENDPOINTS.screen(key));
  }

  /** Options for a reference field (code + label), up to 1000. */
  lookup(table: string) {
    return apiRequest<LookupOption[]>(WORKSPACE_ENDPOINTS.lookup(table));
  }

  /** One page of a table, from the path in the screen contract. */
  list(resourcePath: string, offset = 0, limit: number = API_CONFIG.pageSize) {
    return apiRequest<Page<Row>>(resourcePath, { query: { offset, limit } });
  }

  /** Delete a record (the backend refuses records still referenced elsewhere). */
  remove(resourcePath: string, code: string) {
    return apiRequest<void>(WORKSPACE_ENDPOINTS.record(resourcePath, code), {
      method: "DELETE",
    });
  }

  /** The custom form bound to a table, with the values last submitted for `entityCode`. */
  resourceForm(table: string, entityCode?: string) {
    return apiRequest<ResourceFormResponse>(
      WORKSPACE_ENDPOINTS.resourceForm(table),
      { query: { entity_code: entityCode } },
    );
  }

  /** Create a record; custom form values are stored with it. */
  create(table: string, payload: RecordSavePayload) {
    return apiRequest<Row>(WORKSPACE_ENDPOINTS.createRecord(table), {
      method: "POST",
      body: payload,
    });
  }

  update(table: string, code: string, payload: RecordSavePayload) {
    return apiRequest<Row>(WORKSPACE_ENDPOINTS.updateRecord(table, code), {
      method: "PATCH",
      body: payload,
    });
  }
}

export const workspaceService = new WorkspaceService();
