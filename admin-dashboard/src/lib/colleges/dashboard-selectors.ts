import type { CollegeState } from "./store";
import { opRows } from "./operations";
import { publishedSession } from "./academic-scope";
export function engineeringDashboard(s: CollegeState, now = new Date()) {
  const active = s.students.filter((st) => st.status === "Active");
  const paid = s.payments
    .filter((p) => p.status === "Completed")
    .reduce((n, p) => n + (p.amount || 0), 0);
  const owed = s.students.reduce(
    (n, st) =>
      n +
      Math.max(
        0,
        st.fee -
          st.scholarship -
          s.payments
            .filter((p) => p.studentId === st.id && p.status === "Completed")
            .reduce((a, p) => a + (p.amount || 0), 0),
      ),
    0,
  );
  const day = now.toLocaleDateString("en-US", { weekday: "long" });
  const sessions = opRows(s, "timetable")
    .filter(publishedSession)
    .filter(
      (p) => p.day === day && !["Break", "Lunch"].includes(String(p.kind)),
    );
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const attendance = opRows(s, "attendance").filter((a) => a.date === today);
  const faculty = s.staff.filter(
    (f) => f.category === "Faculty" && f.status === "Active",
  );
  return {
    active,
    paid,
    owed,
    faculty,
    sessions,
    attendance: attendance.length
      ? Math.round(
          (attendance.filter((a) => a.status === "Present").length /
            attendance.length) *
            100,
        )
      : null,
    programs: [...new Set(active.map((st) => st.program))],
    months: Array.from({ length: 12 }, (_, i) => ({
      month: new Date(2026, i, 1).toLocaleDateString("en", { month: "short" }),
      enrolled: s.students.filter((st) => Number(st.date.slice(5, 7)) === i + 1)
        .length,
      collected: s.payments
        .filter(
          (p) =>
            p.status === "Completed" && Number(p.date.slice(5, 7)) === i + 1,
        )
        .reduce((n, p) => n + (p.amount || 0), 0),
    })),
    branches: [...new Set(active.map((st) => st.department))].map((name) => ({
      name,
      value: active.filter((st) => st.department === name).length,
    })),
    buses: s.operations?.buses || [],
    passengers: s.operations?.passengers || [],
    hostel: s.allocations.length,
    beds: s.rooms.reduce((n, r) => n + (r.capacity || 0), 0),
    inventory: opRows(s, "inventory").filter(
      (r) => Number(r.quantity) <= Number(r.minimum),
    ),
    payroll: opRows(s, "payroll"),
    assessments: opRows(s, "assessments").filter(
      (a) => String(a.date) >= today,
    ),
    activity: s.audit.slice(0, 6),
  };
}
