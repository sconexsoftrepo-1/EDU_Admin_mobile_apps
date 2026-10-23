/** Finance endpoints used by the dashboard (backend: finance). */
import { apiDownload, apiRequest } from "../../client";
import { LEDGER_EXPORT_FILENAME, type FinanceSummary } from "./consts";

export const FINANCE_ENDPOINTS = {
  summary: "finance/summary",
  ledgerExport: "finance/ledger-export.csv",
} as const;

export class FinanceService {
  summary() {
    return apiRequest<FinanceSummary>(FINANCE_ENDPOINTS.summary);
  }

  /** Student ledger as CSV. */
  downloadLedger(filename: string = LEDGER_EXPORT_FILENAME) {
    return apiDownload(FINANCE_ENDPOINTS.ledgerExport, filename);
  }
}

export const financeService = new FinanceService();
