import type { Row } from "@/services/api";
import type { RecordRow } from "./store";
import type { TaxMode } from "./fees";

export type FeeScheduleScope = {
  academicYear: string;
  studyYear: number;
  installment: number;
  frequency: string;
  currency: string;
  sourceIds: string[];
};

/** Fee rows are saved per head; present one complete schedule per course and period. */
export function programFeeSchedules(
  records: Row[],
  programs: Row[],
  heads: Row[],
  years: Row[],
): RecordRow[] {
  const names = (rows: Row[]) =>
    new Map(
      rows.map((row) => [String(row.code), String(row.name || row.code)]),
    );
  const programNames = names(programs),
    headNames = names(heads),
    yearNames = names(years);
  const groups = new Map<string, RecordRow>();
  for (const record of records) {
    const program = String(record.program_code || "");
    const academicYear = String(record.academic_year_code || "");
    const studyYear = Number(record.semester_number || 1);
    const installment = Number(record.installment_number || 1);
    const frequency = String(record.billing_frequency || "annual");
    const currency = String(record.currency || "INR");
    const taxMode: TaxMode = ["no-tax", "intra-state", "inter-state"].includes(
      String(record.taxMode),
    )
      ? (record.taxMode as TaxMode)
      : "not-configured";
    const key = JSON.stringify([
      program,
      academicYear,
      studyYear,
      installment,
      frequency,
      currency,
      taxMode,
    ]);
    let schedule = groups.get(key);
    if (!schedule) {
      schedule = {
        id: String(record.code),
        name: programNames.get(program) || program || "Unassigned course",
        program,
        date: String(record.due_date || ""),
        status: String(record.status || "Active"),
        amount: 0,
        components: [],
        taxMode,
        feeSchedule: {
          academicYear: yearNames.get(academicYear) || academicYear,
          studyYear,
          installment,
          frequency,
          currency,
          sourceIds: [],
        },
      };
      groups.set(key, schedule);
    }
    const amount = Math.round(Number(record.amount || 0) * 100);
    schedule.components!.push({
      id: String(record.code),
      name:
        headNames.get(String(record.fee_head_code)) ||
        String(record.fee_head_code || "Fee"),
      amount,
      gstRate: Number(record.gstRate || record.gst_rate || 0),
    });
    schedule.amount = (schedule.amount || 0) + amount;
    schedule.feeSchedule!.sourceIds.push(String(record.code));
    if (
      String(record.status || "Active").toLowerCase() !==
      schedule.status.toLowerCase()
    )
      schedule.status = "Mixed";
  }
  return [...groups.values()].sort(
    (a, b) =>
      a.name.localeCompare(b.name) ||
      a.feeSchedule!.academicYear.localeCompare(b.feeSchedule!.academicYear) ||
      a.feeSchedule!.studyYear - b.feeSchedule!.studyYear ||
      a.feeSchedule!.installment - b.feeSchedule!.installment,
  );
}
