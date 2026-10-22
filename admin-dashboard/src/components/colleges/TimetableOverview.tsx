"use client";
import TimetableEditor from "./TimetableEditor";
import type { OperationRecord } from "@/lib/colleges/operations";
import { academicRooms, teachingLoad } from "@/lib/colleges/academic-engine";
import AcademicCalendarDrawer from "./AcademicCalendarDrawer";
import { CalendarDays } from "lucide-react";
import { useState } from "react";
import { useCollege } from "./CollegeStore";
import { opRows } from "@/lib/colleges/operations";
import {
  sessionScope,
  studentScope,
  sessionForStudent,
  publishedSession,
  cohortKey,
  timeMinutes,
  clockTime,
} from "@/lib/colleges/academic-scope";
import type { College } from "@/data/colleges";
import { professionalPdf } from "@/lib/colleges/download";
import PDFActions from "./PDFActions";
import AcademicTimetableGrid from "./AcademicTimetableGrid";
export default function TimetableOverview({ college }: { college: College }) {
  const { state, run, role } = useCollege();
  const manage = role === "Super Admin";
  const [program, setProgram] = useState(
    manage ? college.programs[0]?.name || "" : "",
  );
  const [teacher, setTeacher] = useState("");
  const [section, setSection] = useState("");
  const [semester, setSemester] = useState("");
  const [studyYear, setStudyYear] = useState(manage ? "1" : "");
  const [branch, setBranch] = useState("");
  const [specialization, setSpecialization] = useState("");
  const [academicYear, setAcademicYear] = useState("");
  const [childId, setChildId] = useState("");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);
  const [view, setView] = useState("Week");
  const [day, setDay] = useState("Monday");
  const [room, setRoom] = useState("");
  const [editor, setEditor] = useState<{
    session?: OperationRecord;
    action?: string;
  } | null>(null);
  const weekStart = new Date();
  weekStart.setDate(
    weekStart.getDate() - ((weekStart.getDay() + 6) % 7) + weekOffset * 7,
  );

  const all = opRows(state, "timetable");
  const parent = opRows(state, "accounts").find(
    (a) => a.role === "Parent" && a.status === "Active",
  );
  const linked =
    role === "Parent"
      ? (JSON.parse(String(parent?.studentIds || "[]")) as string[])
      : [];
  const children = state.students.filter((s) => linked.includes(s.id));
  const student =
    role === "Student"
      ? state.students[0]
      : role === "Parent"
        ? children.find((s) => s.id === childId) || children[0]
        : undefined;
  const faculty =
    role === "Faculty"
      ? state.staff.find(
          (t) => t.category === "Faculty" && t.status === "Active",
        )
      : undefined;
  const assigned = all.filter(
    (s) => s.employeeId === faculty?.id && publishedSession(s),
  );
  const assignedGroups = new Set(
    assigned.map((s) => cohortKey(sessionScope(s))),
  );
  const permitted = all.filter((s) =>
    student
      ? sessionForStudent(s, student)
      : role === "Parent"
        ? false
        : faculty
          ? s.employeeId === faculty.id ||
            (["Break", "Lunch"].includes(String(s.kind)) &&
              assignedGroups.has(cohortKey(sessionScope(s))))
          : true,
  );
  const filtered = permitted.filter((s) => {
    const c = sessionScope(s);
    return (
      (!program || c.program === program) &&
      (!section || c.section === section) &&
      (!semester || c.semester === semester) &&
      (!studyYear || c.studyYear === studyYear) &&
      (!branch || c.branch === branch) &&
      (!specialization || c.specialization === specialization) &&
      (!academicYear || c.academicYear === academicYear)
    );
  });
  const teacherGroups = new Set(
    filtered
      .filter((s) => s.employeeId === teacher)
      .map((s) => cohortKey(sessionScope(s))),
  );
  const display = filtered.filter(
    (s) =>
      (!teacher ||
        s.employeeId === teacher ||
        (["Break", "Lunch"].includes(String(s.kind)) &&
          teacherGroups.has(cohortKey(sessionScope(s))))) &&
      publishedSession(s) &&
      (!room || s.room === room),
  );
  const scopes = permitted.map(sessionScope);
  const choices = (key: keyof ReturnType<typeof sessionScope>) =>
    Array.from(
      new Set(
        scopes
          .filter((s) => key === "program" || !program || s.program === program)
          .map((s) => s[key]),
      ),
    ).sort();
  return (
    <section className="erp-panel timetable-overview">
      {editor && (
        <TimetableEditor
          college={college}
          {...editor}
          close={() => setEditor(null)}
        />
      )}
      {calendarOpen && (
        <AcademicCalendarDrawer
          college={college}
          staff={state.staff}
          periods={display}
          events={[
            ...opRows(state, "calendar"),
            ...opRows(state, "assessments"),
          ].filter(
            (e) =>
              !e.program ||
              display.some(
                (p) =>
                  p.program === e.program &&
                  (!e.studyYear ||
                    String(p.studyYear || "1") === String(e.studyYear)) &&
                  (!e.section ||
                    String(p.section || "A") === String(e.section)),
              ),
          )}
          close={() => setCalendarOpen(false)}
        />
      )}
      <div className="ops-page-intro">
        <div>
          <h3>
            {faculty
              ? "My teaching timetable"
              : student
                ? "Class timetable"
                : "Academic timetable"}
          </h3>
          <p>
            Recurring weekly periods, laboratory blocks, breaks and faculty
            allocations. Calendar holidays apply to the selected week.
          </p>
        </div>
        <div className="ops-row-actions">
          <button onClick={() => setCalendarOpen(true)}>
            <CalendarDays size={16} />
            Shared academic calendar
          </button>
          <PDFActions
            onAction={(mode) =>
              professionalPdf(
                "Academic-timetable",
                {
                  title: "Academic timetable",
                  context: { college, institution: state.institution },
                  sections: [
                    {
                      title: student
                        ? `${student.name} · ${studentScope(student).branch}`
                        : program || "Published academic groups",
                      columns: [
                        "Year / section",
                        "Day",
                        "Time",
                        "Subject",
                        "Faculty",
                        "Room",
                        "Status",
                      ],
                      rows: display.map((s) => [
                        `${sessionScope(s).studyYear} / ${sessionScope(s).section}`,
                        String(s.day),
                        `${s.start}–${s.end}`,
                        s.name,
                        state.staff.find((t) => t.id === s.employeeId)?.name ||
                          "—",
                        String(s.room),
                        s.status,
                      ]),
                    },
                  ],
                },
                mode,
              )
            }
          >
            Timetable PDF
          </PDFActions>
        </div>
      </div>
      {role === "Parent" && (
        <label>
          Linked student
          <select
            aria-label="Timetable linked student"
            value={student?.id || ""}
            onChange={(e) => setChildId(e.target.value)}
          >
            {children.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {!student && (
        <div className="ops-toolbar">
          {(
            [
              {
                key: "program",
                label: "Program",
                value: program,
                set: setProgram,
              },
              {
                key: "academicYear",
                label: "Academic year",
                value: academicYear,
                set: setAcademicYear,
              },
              {
                key: "studyYear",
                label: "Year of study",
                value: studyYear,
                set: setStudyYear,
              },
              { key: "branch", label: "Branch", value: branch, set: setBranch },
              {
                key: "specialization",
                label: "Specialization",
                value: specialization,
                set: setSpecialization,
              },
              {
                key: "semester",
                label: "Semester",
                value: semester,
                set: setSemester,
              },
              {
                key: "section",
                label: "Section",
                value: section,
                set: setSection,
              },
            ] as const
          ).map((f) => (
            <label key={f.key}>
              {f.label}
              <select
                aria-label={`Timetable ${f.label.toLowerCase()}`}
                value={f.value}
                onChange={(e) => {
                  f.set(e.target.value);
                  if (f.key === "program") {
                    setBranch("");
                    setSpecialization("");
                    setSemester("");
                    setSection("");
                    setStudyYear("");
                  }
                  if (f.key === "studyYear") setSemester("");
                }}
              >
                <option value="">All {f.label.toLowerCase()}</option>
                {choices(f.key).map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
          ))}
          {!faculty && (
            <label>
              Faculty
              <select
                aria-label="Timetable faculty"
                value={teacher}
                onChange={(e) => setTeacher(e.target.value)}
              >
                <option value="">All faculty</option>
                {state.staff
                  .filter((s) => s.category === "Faculty")
                  .map((s) => (
                    <option value={s.id} key={s.id}>
                      {s.name}
                    </option>
                  ))}
              </select>
            </label>
          )}
        </div>
      )}
      {manage && (
        <p className="academic-grid-hint">
          Drag a session to an empty period to preview a move, or select a
          session and choose Edit. Changes remain drafts until publication.
        </p>
      )}
      <div className="academic-view-toolbar">
        <div>
          <button
            aria-label="Previous timetable week"
            onClick={() => setWeekOffset(weekOffset - 1)}
          >
            ←
          </button>
          <strong>
            Week of{" "}
            {weekStart.toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </strong>
          <button
            aria-label="Next timetable week"
            onClick={() => setWeekOffset(weekOffset + 1)}
          >
            →
          </button>
          <button onClick={() => setWeekOffset(0)}>This week</button>
        </div>
        <div>
          {["Week", "Day", "Faculty", "Room"].map((v) => (
            <button
              key={v}
              aria-pressed={view === v}
              onClick={() => setView(v)}
            >
              {v}
            </button>
          ))}
          <button onClick={() => window.print()}>Print</button>
          {manage && (
            <button onClick={() => setEditor({})}>Create timetable</button>
          )}
        </div>
      </div>
      {view === "Day" && (
        <label>
          Selected day
          <select value={day} onChange={(e) => setDay(e.target.value)}>
            {[
              "Monday",
              "Tuesday",
              "Wednesday",
              "Thursday",
              "Friday",
              "Saturday",
            ].map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </label>
      )}
      {view === "Room" && (
        <label>
          Room view
          <select value={room} onChange={(e) => setRoom(e.target.value)}>
            <option value="">All rooms</option>
            {academicRooms(state).map((r) => (
              <option key={r.id} value={r.name}>
                {r.name} · {r.capacity} seats
              </option>
            ))}
          </select>
        </label>
      )}
      {view === "Faculty" && (
        <div className="academic-load-summary">
          {state.staff
            .filter(
              (f) => f.id === teacher || (!teacher && f.category === "Faculty"),
            )
            .slice(0, 8)
            .map((f) => (
              <button key={f.id} onClick={() => setTeacher(f.id)}>
                {f.name} · {teachingLoad(state, f.id).toFixed(1)} hours/week
              </button>
            ))}
        </div>
      )}
      <AcademicTimetableGrid
        onSessionMove={
          manage
            ? (session, day, start) =>
                setEditor({
                  session: {
                    ...session,
                    day,
                    start,
                    end: clockTime(
                      timeMinutes(start) +
                        timeMinutes(String(session.end)) -
                        timeMinutes(String(session.start)),
                    ),
                  },
                  action: "edit",
                })
            : undefined
        }
        weekOffset={weekOffset}
        mode={view}
        selectedDay={day}
        onSessionAction={
          manage
            ? (session, action) => setEditor({ session, action })
            : undefined
        }
        college={college}
        sessions={display}
        staff={state.staff}
        teacherView={!!faculty}
      />
      {manage && (
        <section className="academic-publication">
          <h3>Draft review & publication</h3>
          <p>
            {filtered.filter((s) => s.status === "Draft").length} draft sessions
            in the selected academic group. Students and parents see published
            records only.
          </p>
          <button
            disabled={!filtered.some((s) => s.status === "Draft")}
            onClick={() =>
              run({
                type: "ops.timetable.publish",
                data: {
                  ids: JSON.stringify(
                    filtered
                      .filter((s) => s.status === "Draft")
                      .map((s) => s.id),
                  ),
                },
              })
            }
          >
            Validate & publish drafts
          </button>
          <details>
            <summary>
              Publication history ({opRows(state, "timetable-versions").length})
            </summary>
            {opRows(state, "timetable-versions").map((v) => (
              <div key={v.id}>
                <strong>{v.name}</strong> · {v.date}
                <button
                  onClick={() => {
                    if (
                      window.confirm(
                        "Restore this institution timetable snapshot? The current published timetable will be backed up.",
                      )
                    )
                      run({ type: "ops.timetable.restore", id: v.id });
                  }}
                >
                  Restore version
                </button>
              </div>
            ))}
          </details>
        </section>
      )}
      {manage && (
        <details className="academic-session-management">
          <summary>
            Manage sessions & unpublished drafts ({filtered.length})
          </summary>
          <div className="timetable-week-grid">
            {filtered.map((s) => (
              <details key={s.id}>
                <summary>
                  <strong>{s.name}</strong>
                  <small>
                    Year {sessionScope(s).studyYear} · {s.day} {s.start}–{s.end}{" "}
                    · {s.status}
                  </small>
                </summary>
                <button onClick={() => setEditor({ session: s })}>
                  Review / edit
                </button>
                <button
                  onClick={() =>
                    run({
                      type: "ops.record.save",
                      data: {
                        ...Object.fromEntries(
                          Object.entries(s)
                            .filter(
                              ([k]) => !["id", "status", "date"].includes(k),
                            )
                            .map(([k, v]) => [k, String(v)]),
                        ),
                        collection: "timetable",
                        name: `${s.name} (copy)`,
                        saveAsDraft: "Yes",
                      },
                    })
                  }
                >
                  Copy to draft
                </button>
                {s.status === "Draft" && (
                  <button
                    onClick={() =>
                      run({
                        type: "ops.timetable.publish",
                        data: { ids: JSON.stringify([s.id]) },
                      })
                    }
                  >
                    Publish session
                  </button>
                )}
              </details>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}
