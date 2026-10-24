/** Excel import endpoints (backend: imports/excel). */
import { apiRequest } from "../../client";
import type {
  ImportCommitResult,
  ImportContract,
  ImportJob,
  ImportValidatePayload,
} from "./consts";

export const IMPORT_ENDPOINTS = {
  contract: "imports/excel/contract",
  validate: "imports/excel/validate",
  commit: (code: string) => `imports/excel/${encodeURIComponent(code)}/commit`,
} as const;

export class ImportService {
  /** Workbooks the user may import, with their sheets and columns. */
  contract() {
    return apiRequest<ImportContract>(IMPORT_ENDPOINTS.contract);
  }

  /** Upload and validate a workbook; nothing is imported yet. */
  validate(payload: ImportValidatePayload) {
    return apiRequest<ImportJob>(IMPORT_ENDPOINTS.validate, {
      method: "POST",
      body: payload,
    });
  }

  /** Import a validated workbook. */
  commit(code: string) {
    return apiRequest<ImportCommitResult>(IMPORT_ENDPOINTS.commit(code), {
      method: "POST",
    });
  }
}

export const importService = new ImportService();
