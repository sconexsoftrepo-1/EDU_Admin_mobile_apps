import {
  sameCohort,
  sessionScope,
  normalizeAcademicValue,
  publishedSession,
} from "./academic-scope";
import type { OperationRecord } from "./operations";
/** One conflict policy for admin edits and draft publication. */
export function validateTimetableSession(
  data: Record<string, string>,
  records: OperationRecord[],
  id?: string,
) {
  if (
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(data.start) ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(data.end) ||
    data.end <= data.start
  )
    throw Error("Period end must follow start (HH:MM).");
  if (data.start < "08:00" || data.end > "18:00")
    throw Error("Sessions must be within campus hours, 08:00–18:00.");
  const pause = ["Break", "Lunch", "Holiday"].includes(data.kind);
  if (!pause && !data.employeeId)
    throw Error("Allocate a teacher before publishing this session.");
  if (data.kind === "Lab") {
    const mins = (v: string) => Number(v.slice(0, 2)) * 60 + Number(v.slice(3));
    if (mins(data.end) - mins(data.start) < 60)
      throw Error("Laboratory sessions must be at least 60 minutes.");
  }
  if (
    records.some(
      (x) =>
        x.id !== id &&
        publishedSession(x) &&
        x.day === data.day &&
        normalizeAcademicValue(sessionScope(x).academicYear) ===
          normalizeAcademicValue(
            sessionScope({
              id: "candidate",
              name: "",
              status: "Active",
              date: "",
              ...data,
            }).academicYear,
          ) &&
        String(x.start) < data.end &&
        String(x.end) > data.start &&
        ((!!data.employeeId && x.employeeId === data.employeeId) ||
          (!!data.room &&
            x.room === data.room &&
            !["Break", "Lunch", "Sports", "Library", "Counselling"].includes(
              data.kind,
            ) &&
            !["Break", "Lunch", "Sports", "Library", "Counselling"].includes(
              String(x.kind),
            )) ||
          sameCohort(
            sessionScope(x),
            sessionScope({
              id: "candidate",
              name: data.name || "Session",
              status: "Active",
              date: "",
              ...data,
            }),
          )),
    )
  )
    throw Error("Teacher, class or room conflict in this period.");
}
