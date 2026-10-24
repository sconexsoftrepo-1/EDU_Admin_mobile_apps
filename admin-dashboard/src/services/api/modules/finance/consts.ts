/** Finance overview (backend: finance). Amounts are decimal strings. */

export interface FinanceSummary {
  currency: string;
  gross: string;
  discount: string;
  scholarship: string;
  paid: string;
  outstanding: string;
  internal_collections: string;
  external_collections: string;
  external_remitted: string;
  recorded_expenses: string;
}

/** Screens that show the finance summary cards. */
export const FINANCE_SUMMARY_SCREENS: readonly string[] = [
  "dashboard",
  "reports",
  "cashbook",
  "fees",
  "campus-analytics",
  "expense-dashboard",
];

export const LEDGER_EXPORT_FILENAME = "student-ledger.csv";
