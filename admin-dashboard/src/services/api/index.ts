/**
 * EduNexa API services — import from "@/services/api".
 *
 *   import { api, type Row } from "@/services/api";
 *   const { screens } = await api.workspace.screens();
 *
 * config.ts   base URLs and API settings (the main configuration file)
 * client.ts   apiRequest / apiDownload / ApiError
 * consts.ts   shared types and constants
 * modules/<module>/service.ts   endpoints of that backend module
 * modules/<module>/consts.ts    payloads, responses and constants of that module
 */
import { administrationService } from "./modules/administration/service";
import { authService } from "./modules/auth/service";
import { documentService } from "./modules/documents/service";
import { financeService } from "./modules/finance/service";
import { formService } from "./modules/forms/service";
import { importService } from "./modules/imports/service";
import { masterDataService } from "./modules/master-data/service";
import { mobileWorkspaceService } from "./modules/mobile/service";
import { publicService } from "./modules/public/service";
import { reportService } from "./modules/reports/service";
import { workflowService } from "./modules/workflows/service";
import { workspaceService } from "./modules/workspace/service";

export const api = {
  auth: authService,
  workspace: workspaceService,
  workflows: workflowService,
  masterData: masterDataService,
  administration: administrationService,
  forms: formService,
  finance: financeService,
  reports: reportService,
  documents: documentService,
  imports: importService,
  mobile: mobileWorkspaceService,
  public: publicService,
} as const;

export { API_CONFIG, apiUrl, backendApiUrl, stripPrefix } from "./config";
export { SCREEN_CATALOG } from "./modules/workspace/catalog";
export {
  ApiError,
  apiDownload,
  apiRequest,
  buildQuery,
  errorText,
  fileToBase64,
} from "./client";
export * from "./consts";
export * from "./modules/administration/consts";
export * from "./modules/auth/consts";
export * from "./modules/documents/consts";
export * from "./modules/finance/consts";
export * from "./modules/forms/consts";
export * from "./modules/imports/consts";
export * from "./modules/master-data/consts";
export * from "./modules/mobile/consts";
export * from "./modules/public/consts";
export * from "./modules/reports/consts";
export * from "./modules/workflows/consts";
export * from "./modules/workspace/consts";
