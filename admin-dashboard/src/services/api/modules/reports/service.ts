/** Report download endpoints (backend: app/modules/reports/downloads). */
import { apiDownload } from "../../client";
import { FINANCE_REPORT_FILENAME } from "./consts";

export const REPORT_ENDPOINTS = {
  financePdf: "reports/finance.pdf",
  report: (filename: string) => `reports/${encodeURIComponent(filename)}`,
} as const;

export class ReportService {
  downloadFinanceReport(filename: string = FINANCE_REPORT_FILENAME) {
    return apiDownload(REPORT_ENDPOINTS.financePdf, filename);
  }

  /** Any export the reports module offers, e.g. "attendance.csv". */
  download(reportFilename: string, saveAs = reportFilename) {
    return apiDownload(REPORT_ENDPOINTS.report(reportFilename), saveAs);
  }
}

export const reportService = new ReportService();
