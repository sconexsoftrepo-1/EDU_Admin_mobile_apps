/** Client Excel workbook imports (backend: imports/excel). */

/** POST imports/excel/validate. */
export interface ImportValidatePayload {
  filename: string;
  content_base64: string;
}

export interface ImportJob {
  code: string;
  uploaded_by_code: string;
  filename: string;
  file_sha256: string;
  status: "validated" | "failed" | "committed" | string;
  total_rows: number;
  successful_rows: number;
  failed_rows: number;
  contract_version: string;
  errors: unknown[];
  [key: string]: unknown;
}

export interface ImportCommitResult {
  code: string;
  status: "committed";
  imported: number;
}

/** One workbook of the import contract (GET imports/excel/contract). */
export interface ImportContractFile {
  file: string;
  [key: string]: unknown;
}

export interface ImportContract {
  files: ImportContractFile[];
  [key: string]: unknown;
}

export const IMPORT_FILE_ACCEPT =
  ".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
