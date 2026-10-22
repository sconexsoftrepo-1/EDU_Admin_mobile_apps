import type { CollegeState } from "./store";
import type { OperationRecord } from "./operations";
import { referenceTimetable } from "./reference-timetable";
const subjects = [
  "Applied mathematics",
  "Computing foundations",
  "Practical laboratory",
  "Communication",
];
/** Upgrade only exact, untouched historical generator output; never custom sessions. */
export function upgradeLegacyTimetable(
  state: CollegeState,
): Record<string, OperationRecord[]> {
  const records = state.operations!.records;
  if (
    records["timetable-upgrades"]?.some((r) => r.id === "full-day-reference-v1")
  )
    return records;
  const all = records.timetable || [];
  const prefix = state.slug.startsWith("edu") ? "21" : "22";
  const core = all.filter((r) =>
    new RegExp(`^${prefix}-PERIOD\\d+$`).test(r.id),
  );
  if (
    ![30, 180].includes(core.length) ||
    all.some((r) => !new RegExp(`^${prefix}-(PERIOD|BREAK)\\d+$`).test(r.id))
  )
    return records;
  const auditEdited = state.audit.some((a) => {
    if (!["ops.record.save", "ops.record.status"].includes(a.name))
      return false;
    try {
      return JSON.parse(a.note || "{}").collection === "timetable";
    } catch {
      return true;
    }
  });
  if (auditEdited) return records;
  const teachers = state.staff.filter((t) => t.category === "Faculty");
  const ordered = [...core].sort(
    (a, b) => Number(a.id.match(/\d+$/)![0]) - Number(b.id.match(/\d+$/)![0]),
  );
  const allowed = new Set([
    "id",
    "name",
    "status",
    "date",
    "program",
    "employeeId",
    "day",
    "start",
    "end",
    "room",
    "kind",
  ]);
  const structure = ordered.every(
    (r, i) =>
      r.id === `${prefix}-PERIOD${i + 1}` &&
      r.name === subjects[i % 4] &&
      r.status === "Active" &&
      r.program === state.students[i % 6]?.program &&
      r.employeeId === teachers[i % Math.max(1, teachers.length)]?.id &&
      r.day ===
        ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"][i % 5] &&
      r.room === `Room ${100 + i}` &&
      Object.keys(r).every((k) => allowed.has(k)),
  );
  if (!structure) return records;
  const divisor = core.length === 30 ? 6 : 30;
  const originalHours = ordered.every(
    (r, i) =>
      r.start === `${9 + Math.floor(i / divisor)}:00`.padStart(5, "0") &&
      r.end === `${10 + Math.floor(i / divisor)}:00`.padStart(5, "0"),
  );
  const newerHours =
    core.length === 180 &&
    ordered.every(
      (r, i) =>
        r.start ===
          ["09:00", "10:00", "11:30", "13:30", "14:30", "15:30"][
            Math.floor(i / 30)
          ] &&
        r.end ===
          ["10:00", "11:00", "12:30", "14:30", "15:30", "16:00"][
            Math.floor(i / 30)
          ],
    );
  if (!originalHours && !newerHours) return records;
  if (
    all.some(
      (r) =>
        r.id.includes("-BREAK") &&
        !["Morning break", "Lunch break"].includes(r.name),
    )
  )
    return records;
  return {
    ...records,
    "timetable-legacy-backup": [
      ...(records["timetable-legacy-backup"] || []),
      ...all,
    ],
    timetable: referenceTimetable(state),
    "timetable-upgrades": [
      ...(records["timetable-upgrades"] || []),
      {
        id: "full-day-reference-v1",
        name: "Full-day reference timetable upgrade",
        status: "Completed",
        date: "2026-10-19",
        previousSessions: all.length,
        description:
          "Original generated sessions retained in timetable-legacy-backup. Other records unchanged.",
      },
    ],
  };
}
