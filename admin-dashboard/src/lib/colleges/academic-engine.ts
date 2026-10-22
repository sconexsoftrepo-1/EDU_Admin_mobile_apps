import type { CollegeState } from "./store";
import type { OperationRecord } from "./operations";
import {
  cohortKey,
  sessionScope,
  sessionForStudent,
  publishedSession,
  timeMinutes,
} from "./academic-scope";
import { validateTimetableSession } from "./timetable";
export type WorkingSlot = {
  label: string;
  start: string;
  end: string;
  kind: "Teaching" | "Break" | "Lunch";
};
export type ScheduleConfiguration = {
  workingDays: string[];
  slots: WorkingSlot[];
  open: string;
  close: string;
};
export type AcademicRoom = {
  id: string;
  name: string;
  kind: "Classroom" | "Lab";
  capacity: number;
  equipment: string;
};
export type TimetableVersion = {
  id: string;
  name: string;
  status: string;
  date: string;
  scope: string;
  sequence: number;
  snapshot: string;
  [key: string]: string | number;
};
export function scheduleConfiguration(
  state: CollegeState,
): ScheduleConfiguration {
  const saved = state.operations?.records["schedule-configuration"]?.[0];
  if (saved) {
    try {
      return JSON.parse(String(saved.configuration));
    } catch {}
  }
  const engineering = state.slug === "skyline-institute";
  const hours = engineering
    ? [
        "09:20",
        "10:20",
        "11:10",
        "11:30",
        "12:20",
        "13:10",
        "14:00",
        "14:50",
        "15:00",
        "15:40",
        "16:20",
      ]
    : [
        "09:00",
        "10:00",
        "11:00",
        "11:30",
        "12:30",
        "13:30",
        "14:30",
        "15:30",
        "16:00",
      ];
  return {
    workingDays: [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ],
    open: "08:00",
    close: "18:00",
    slots: hours
      .slice(0, -1)
      .map((start, i) => ({
        start,
        end: hours[i + 1],
        label: (engineering ? [2, 7] : [2]).includes(i)
          ? "Morning / short break"
          : i === (engineering ? 5 : 4)
            ? "Lunch"
            : "Teaching period",
        kind: (engineering ? [2, 7] : [2]).includes(i)
          ? "Break"
          : i === (engineering ? 5 : 4)
            ? "Lunch"
            : "Teaching",
      })),
  };
}
export function academicRooms(state: CollegeState): AcademicRoom[] {
  const saved = state.operations?.records["academic-rooms"];
  if (saved?.length)
    return saved.map((r) => ({
      id: r.id,
      name: r.name,
      kind: r.kind === "Lab" ? "Lab" : "Classroom",
      capacity: Number(r.capacity),
      equipment: String(r.equipment || ""),
    }));
  const names = [
    ...new Set(
      (state.operations?.records.timetable || [])
        .filter((s) => !["Break", "Lunch", "Sports"].includes(String(s.kind)))
        .map((s) => String(s.room)),
    ),
  ];
  return names.map((name, i) => ({
    id: `${state.slug}-ROOM-${i}`,
    name,
    kind: name.toLowerCase().includes("lab") ? "Lab" : "Classroom",
    capacity: 64,
    equipment: name.toLowerCase().includes("lab")
      ? "Workstations, safety kit"
      : "Projector, display",
  }));
}
export function validateAcademicSession(
  state: CollegeState,
  data: Record<string, string>,
  records: OperationRecord[],
  id?: string,
) {
  validateTimetableSession(data, records, id);
  const config = scheduleConfiguration(state);
  if (!config.workingDays.includes(data.day))
    throw Error("This day is not a configured working day.");
  if (data.start < config.open || data.end > config.close)
    throw Error(`Institution hours are ${config.open}–${config.close}.`);
  if (["Break", "Lunch", "Holiday"].includes(data.kind)) return;
  const teacher = state.staff.find(
    (f) =>
      f.id === data.employeeId &&
      f.category === "Faculty" &&
      f.status === "Active",
  );
  if (!teacher)
    throw Error("Select an active faculty member in this institution.");
  const room = academicRooms(state).find((r) => r.name === data.room);
  if (!room) throw Error("Choose a configured classroom or laboratory.");
  if (data.kind === "Lab" && room.kind !== "Lab")
    throw Error("A laboratory session requires a laboratory resource.");
  const candidate = {
    id: "candidate",
    name: data.name,
    status: "Active",
    date: "",
    ...data,
  };
  const count = state.students.filter(
    (st) => st.status === "Active" && sessionForStudent(candidate, st),
  ).length;
  if (count > room.capacity)
    throw Error(
      `Room capacity ${room.capacity} is below the ${count} enrolled students.`,
    );
  const leaves = state.operations?.records["employee-leave"] || [];
  if (
    leaves.some(
      (l) =>
        l.employeeId === data.employeeId &&
        l.status === "Approved" &&
        data.date >= String(l.start) &&
        data.date <= String(l.end),
    )
  )
    throw Error("Faculty member is unavailable on approved leave.");
  if (
    records.some(
      (r) =>
        r.id !== id &&
        publishedSession(r) &&
        ["Break", "Lunch"].includes(String(r.kind)) &&
        cohortKey(sessionScope(r)) === cohortKey(sessionScope(candidate)) &&
        r.day === data.day &&
        String(r.start) < data.end &&
        String(r.end) > data.start,
    )
  )
    throw Error("This session overlaps a scheduled break or lunch.");
}
export function teachingLoad(state: CollegeState, id: string) {
  return (state.operations?.records.timetable || [])
    .filter(
      (p) =>
        p.employeeId === id &&
        publishedSession(p) &&
        !["Break", "Lunch"].includes(String(p.kind)),
    )
    .reduce(
      (n, p) =>
        n + (timeMinutes(String(p.end)) - timeMinutes(String(p.start))) / 60,
      0,
    );
}
