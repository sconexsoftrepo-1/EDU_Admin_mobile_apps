import { courseOfferings } from "@/data/colleges/subjects";
import type { CollegeState } from "./store";
import type { OperationRecord } from "./operations";
import { studentScope, cohortKey, timetableDays } from "./academic-scope";
/** Fictional teaching data using the reference's period/break structure. */
export function referenceTimetable(state: CollegeState): OperationRecord[] {
  const cohorts = Array.from(
    new Map(
      state.students.map((st) => {
        const scope = studentScope(st);
        return [cohortKey(scope), scope];
      }),
    ).values(),
  );
  const faculty = state.staff.filter(
    (t) => t.category === "Faculty" && t.status === "Active",
  );
  const defaultSubjects = [
    "Core foundations",
    "Applied mathematics",
    "Communication",
    "Research methods",
    "Ethics & values",
    "Environmental studies",
    "Digital skills",
  ];
  const defaultCodes = ["CF", "AM", "COM", "RM", "EV", "ES", "DS"];
  const slots = [
    ["09:00", "10:00"],
    ["10:00", "11:00"],
    ["11:30", "12:30"],
    ["13:30", "14:30"],
    ["14:30", "15:30"],
    ["15:30", "16:00"],
  ];
  const morningStart = "09:00",
    morningEnd = "11:00";
  const afternoonStart = "13:30",
    dayEnd = "16:00";
  const records: OperationRecord[] = [];
  for (const [ci, scope] of cohorts.entries())
    for (const [di, day] of timetableDays.entries()) {
      const teacher = faculty[ci % Math.max(1, faculty.length)];
      const courses = courseOfferings(scope.program, Number(scope.semester));
      const theory = courses.filter((c) => c.kind === "Class");
      const subjects = theory.length
        ? theory.map((c) => c.name)
        : defaultSubjects;
      const codes = theory.length ? theory.map((c) => c.code) : defaultCodes;
      const laboratory = courses.find((c) => c.kind === "Lab");
      const add = (
        name: string,
        start: string,
        end: string,
        kind: string,
        code: string,
        room: string,
      ) =>
        records.push({
          id: `${state.slug}-REF-${ci}-${di}-${records.length}`,
          name,
          status: "Active",
          date: "2026-07-13",
          ...scope,
          day,
          start,
          end,
          kind,
          subjectCode: code,
          room,
          employeeId: ["Break", "Lunch"].includes(kind)
            ? ""
            : teacher?.id || "",
          coordinator: teacher?.name || "Unassigned",
        });
      if (di === 0)
        add(
          "Applied learning laboratory",
          morningStart,
          morningEnd,
          "Lab",
          "APPLIED LAB",
          `Lab ${ci + 1}`,
        );
      for (const [si, [start, end]] of slots.entries()) {
        if (
          (di === 0 && si < 2) ||
          (di === 2 && si >= 3) ||
          ([1, 4].includes(di) && si >= 4)
        )
          continue;
        const subject = (di + si + ci) % subjects.length;
        add(
          subjects[subject],
          start,
          end,
          "Class",
          codes[subject],
          `Room ${100 + ci}`,
        );
      }
      add("Morning break", morningEnd, "11:30", "Break", "BREAK", "Campus");
      add("Lunch", "12:30", afternoonStart, "Lunch", "LUNCH", "Dining hall");
      if (di === 2)
        add(
          "Research & practical laboratory",
          afternoonStart,
          dayEnd,
          "Lab",
          "PRACTICAL LAB",
          `Lab ${ci + 1}`,
        );
      else {
        if ([1, 4].includes(di))
          add(
            "Sports & campus activities",
            "14:30",
            dayEnd,
            "Sports",
            "SPORTS",
            "Sports ground",
          );
      }
    }
  return records;
}
