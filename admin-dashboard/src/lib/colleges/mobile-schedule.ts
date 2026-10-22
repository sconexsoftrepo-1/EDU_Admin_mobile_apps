import { publishedSession } from "./academic-scope";
import type { OperationRecord } from "./operations";
export type ScheduleEvent = {
  id: string;
  name: string;
  date: string;
  start: string;
  end: string;
  kind: string;
  room: string;
  description: string;
  status: string;
  scopeLabel?: string;
};
export function localDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function scheduleForDate(
  date: string,
  periods: OperationRecord[],
  events: OperationRecord[],
): ScheduleEvent[] {
  const day = new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
  });
  const holiday = events.some(
    (e) =>
      e.date === date &&
      e.kind === "Holiday" &&
      !["Draft", "Cancelled"].includes(e.status),
  );
  const scheduled = (holiday ? [] : periods)
    .filter((p) => p.day === day && publishedSession(p))
    .map((p) => ({
      id: p.id,
      name: p.name,
      date,
      start: String(p.start),
      end: String(p.end),
      kind: String(p.kind || "Class"),
      room: String(p.room || ""),
      description: String(p.description || ""),
      status: p.status,
      scopeLabel: `${p.program} · Year ${p.studyYear || "1"} · Section ${p.section || "A"}`,
    }));
  const dated = events
    .filter(
      (e) =>
        e.date === date &&
        !["Draft", "Cancelled", "Archived"].includes(e.status),
    )
    .map((e) => ({
      id: e.id,
      name: e.name,
      date,
      start: String(e.start || ""),
      end: String(e.end || ""),
      kind: String(
        e.kind || (e.due ? "Assignment" : e.maxMarks ? "Assessment" : "Event"),
      ),
      room: String(e.room || ""),
      description: String(e.description || e.subject || ""),
      status: e.status,
    }));
  return [...scheduled, ...dated].sort((a, b) =>
    (a.start || "23:59").localeCompare(b.start || "23:59"),
  );
}
