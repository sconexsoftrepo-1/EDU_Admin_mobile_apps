import type { CollegeState } from "./store";
import {
  engineeringPrograms,
  engineeringCourses,
  engineeringResources,
} from "@/data/colleges/engineering";
/** Renames known legacy demo program references without changing IDs or finance amounts. */
export function migrateEngineering(state: CollegeState): CollegeState {
  if (
    state.slug !== "skyline-institute" ||
    state.operations?.records["engineering-upgrades"]?.length
  )
    return state;
  const aliases: Record<string, string> = {
    "B.Tech. Computer Science": engineeringPrograms[0].name,
    "B.Tech. Robotics": engineeringPrograms[1].name,
    "B.Tech. Electronics": engineeringPrograms[3].name,
    "B.Sc. Data Science": engineeringPrograms[2].name,
    "B.Sc. Biotechnology": engineeringPrograms[4].name,
    "MBA Technology Management": engineeringPrograms[13].name,
  };
  const next = structuredClone(state);
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!value || typeof value !== "object") return;
    for (const [key, v] of Object.entries(value)) {
      if (
        typeof v === "string" &&
        ["program", "branch", "name"].includes(key) &&
        aliases[v]
      )
        (value as Record<string, unknown>)[key] = aliases[v];
      else if (v && typeof v === "object") visit(v);
    }
  };
  visit(next);
  for (const st of next.students) {
    const p = engineeringPrograms.find((p) => p.name === st.program);
    if (p) {
      st.department = p.department;
      if (st.profile?.branch && aliases[st.profile.branch])
        st.profile.branch = p.name;
    }
  }
  if (next.operations) {
    next.operations.records.syllabus = [
      ...(next.operations.records.syllabus || []).filter(
        (r) => !r.id.startsWith("skyline-resource-"),
      ),
      ...engineeringResources(),
    ];
    // Only names/codes of untouched reference-generator sessions are enriched.
    const edited = next.audit.some(
      (a) => a.name.startsWith("ops.") && a.note?.includes("timetable"),
    );
    if (!edited)
      for (const session of next.operations.records.timetable || []) {
        if (
          !session.id.includes("-REF-") ||
          ["Break", "Lunch", "Sports"].includes(String(session.kind))
        )
          continue;
        const courses = engineeringCourses(
          String(session.program),
          Number(session.semester || 1),
        );
        const choices = courses.filter((c) => c.kind === session.kind);
        const c =
          choices[
            Number(session.id.match(/\d+$/)?.[0] || 0) %
              Math.max(1, choices.length)
          ];
        if (c) {
          session.name = c.name;
          session.subjectCode = c.code;
        }
      }
    next.operations.records["engineering-upgrades"] = [
      {
        id: "engineering-v2",
        name: "Engineering catalog migration; record IDs and financial amounts preserved",
        status: "Completed",
        date: "2026-10-19",
      },
    ];
  }
  return next;
}
