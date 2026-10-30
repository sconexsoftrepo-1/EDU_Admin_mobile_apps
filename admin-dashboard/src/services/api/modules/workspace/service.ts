/**
 * Workspace endpoints. Record screens are generic: the screen contract gives each table's list
 * path (Resource.path), so one service lists, saves and deletes records of any table.
 */
import { apiRequest, type Query } from "../../client";
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

/** Compatibility while the Windows API rolls forward to atomic calendar/cohort saves. */
async function completeCourseBatch(table: string, saved: Row): Promise<Row> {
  if (table !== "academic_years" || !saved.program_code || saved.batch_code)
    return saved;
  const program = String(saved.program_code);
  const start = Number(String(saved.start_date).slice(0, 4));
  const end = Number(String(saved.end_date).slice(0, 4));
  const overview = await apiRequest<{ batches: Row[] }>(
    "master-data/enrollment/batches/overview",
    { query: { program_code: program } },
  );
  const matching = overview.batches.filter(
    (batch) =>
      Number(batch.entry_year) === start &&
      Number(batch.graduation_year) === end,
  );
  if (matching.length > 1)
    throw new Error(
      "Batch dates are saved. Multiple existing batches match this course and year range; resolve those records before enrolling students.",
    );
  const batch =
    matching[0] ||
    (
      await apiRequest<{ batch: Row }>(
        `master-data/courses/${encodeURIComponent(program)}/batches`,
        {
          method: "POST",
          body: {
            batch: {
              code: String(saved.code),
              name: String(saved.name),
              entry_year: start,
              graduation_year: end,
            },
            sections: [],
          },
        },
      )
    ).batch;
  return { ...saved, batch_code: batch.code };
}

export class WorkspaceService {
  /** Screens the signed-in user may open (role screen allocation applied). */
  screens() {
    return apiRequest<ScreensResponse>(WORKSPACE_ENDPOINTS.screens);
  }

  /** One screen with its tables, fields and permitted actions. */
  async screen(key: string) {
    const result = await apiRequest<Screen>(WORKSPACE_ENDPOINTS.screen(key));
    return {
      ...result,
      resources: result.resources
        .filter(
          (resource) => !["batches", "website_pages"].includes(resource.name),
        )
        .map((resource) =>
          resource.name === "academic_years"
            ? { ...resource, title: "Batches" }
            : resource,
        ),
    };
  }

  /** Options for a reference field (code + label), up to 1000. */
  lookup(table: string) {
    return apiRequest<LookupOption[]>(WORKSPACE_ENDPOINTS.lookup(table));
  }

  /** One page of a table, from the path in the screen contract. */
  list(
    resourcePath: string,
    offset = 0,
    limit: number = API_CONFIG.pageSize,
    filters: Query = {},
  ) {
    return apiRequest<Page<Row>>(resourcePath, {
      query: { ...filters, offset, limit },
    });
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
  async create(table: string, payload: RecordSavePayload) {
    const saved = await apiRequest<Row>(
      WORKSPACE_ENDPOINTS.createRecord(table),
      {
        method: "POST",
        body: payload,
      },
    );
    return completeCourseBatch(table, saved);
  }

  async update(table: string, code: string, payload: RecordSavePayload) {
    const saved = await apiRequest<Row>(
      WORKSPACE_ENDPOINTS.updateRecord(table, code),
      {
        method: "PATCH",
        body: payload,
      },
    );
    return completeCourseBatch(table, saved);
  }
}

export const workspaceService = new WorkspaceService();
