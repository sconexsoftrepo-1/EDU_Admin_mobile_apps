"use client";
import WorkspaceSkeleton from "./WorkspaceSkeleton";
import { useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Check,
  RefreshCw,
  Save,
} from "lucide-react";
import {
  attendanceApi,
  type AttendanceData,
  type AttendanceOptions,
  type AttendanceStatus,
} from "@/services/api/modules/attendance/service";
import { errorText } from "@/services/api";
import SearchField, { searchValues } from "./SearchField";
import "./attendance-workspace.css";
const localDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const statusNames: Record<AttendanceStatus, string> = {
  present: "Present",
  absent: "Absent",
  late: "Late",
  excused: "Leave / excused",
};
const empty = {
  recorded: 0,
  attended: 0,
  percentage: null,
  leave_days: 0,
  absent_days: 0,
  recorded_days: 0,
  present: 0,
  late: 0,
  absent: 0,
  excused: 0,
};

export default function AttendanceWorkspace({
  initialClass,
}: {
  initialClass?: {
    code: string;
    program_code: string;
    academic_year_code: string;
    section_code: string;
    subject_code: string;
    subject_name: string;
    semester_number: number;
    period: number;
    session_date: string;
  };
} = {}) {
  const [options, setOptions] = useState<AttendanceOptions | null>(null),
    [data, setData] = useState<AttendanceData | null>(null);
  const [level, setLevel] = useState("intermediate"),
    [course, setCourse] = useState(""),
    [program, setProgram] = useState(initialClass?.program_code || ""),
    [year, setYear] = useState(initialClass?.academic_year_code || ""),
    [section, setSection] = useState(initialClass?.section_code || ""),
    [child, setChild] = useState("");
  const [day, setDay] = useState(
      () => initialClass?.session_date || localDate(new Date()),
    ),
    [period, setPeriod] = useState(initialClass?.period || 1),
    [scope, setScope] = useState("month"),
    [query, setQuery] = useState(""),
    [subject, setSubject] = useState(initialClass?.subject_name || "");
  const [draft, setDraft] = useState<Record<string, AttendanceStatus>>({}),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [saving, setSaving] = useState(false),
    [revision, setRevision] = useState(0);
  const [optionsRevision, setOptionsRevision] = useState(0);
  const request = useRef(0);
  const pending = Object.keys(draft).length > 0;
  useEffect(() => {
    let active = true;
    void attendanceApi
      .options()
      .then((value) => {
        if (!active) return;
        setOptions(value);
        if (initialClass) {
          const chosen = value.courses.find(
            (p) => p.code === initialClass.program_code,
          );
          if (chosen) {
            setLevel(chosen.course_level);
            setCourse(chosen.name);
          }
        }
        if (value.students.length) setChild(value.students[0].code);
      })
      .catch((e) => active && setError(errorText(e)));
    return () => {
      active = false;
    };
  }, [optionsRevision, initialClass]);
  const personal = !!options?.personal;
  useEffect(() => {
    if (!options || (!personal && (!program || !year))) return;
    const token = ++request.current;
    let active = true;
    void Promise.resolve()
      .then(() => {
        if (active) setBusy(true);
      })
      .then(() =>
        attendanceApi.list({
          program_code: personal ? undefined : program,
          academic_year_code: personal ? undefined : year,
          section_code: personal ? undefined : section || undefined,
          student_code: child || undefined,
          on: day,
          period,
        }),
      )
      .then((value) => {
        if (active && token === request.current) {
          setData(value);
          setError("");
        }
      })
      .catch((e) => {
        if (active) setError(errorText(e));
      })
      .finally(() => active && setBusy(false));
    return () => {
      active = false;
    };
  }, [options, personal, program, year, section, child, day, period, revision]);
  useEffect(() => {
    if (!pending) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [pending]);
  const courses =
    options?.courses.filter((c) => c.course_level === level) || [];
  const names = [...new Set(courses.map((c) => c.name))];
  const years =
    options?.academic_years.filter((y) => y.program_code === program) || [];
  const selectedYear = years.find((y) => y.code === year);
  const sections =
    options?.sections.filter(
      (s) =>
        selectedYear?.section_codes?.includes(s.code) ||
        (!!selectedYear?.batch_code &&
          s.batch_code === selectedYear.batch_code),
    ) || [];
  const current = data?.registers.find(
    (r) =>
      r.session_date === day &&
      r.period === period &&
      (personal || (r.section_code || "") === section),
  );
  const marks = { ...current?.marks, ...draft };
  const students = (data?.students || []).filter((s) =>
    `${s.name} ${s.admission_number}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const stats = data?.summaries[scope] || empty;
  const canMark =
    !!options?.can_mark &&
    !personal &&
    (!options.teacher || !!section) &&
    day <= localDate(new Date());
  const ready = personal || !!(program && year);
  const navigate = (fn: () => void) => {
    if (pending && !window.confirm("Discard unsaved attendance changes?"))
      return;
    setDraft({});
    setSubject("");
    setData(null);
    setNotice("");
    fn();
  };
  const selectDay = (value: string) => {
    if (value !== day) navigate(() => setDay(value));
  };
  const monthDays = data?.calendar || [];
  const offset = new Date(`${day.slice(0, 7)}-01T12:00:00`).getDay();
  const percentages = monthDays.map((d) => d.percentage);
  async function save() {
    if (!canMark || !program || !year || !data) return;
    setSaving(true);
    setNotice("");
    setError("");
    try {
      await attendanceApi.save({
        program_code: program,
        academic_year_code: year,
        section_code: section || null,
        slot_code:
          initialClass &&
          program === initialClass.program_code &&
          year === initialClass.academic_year_code &&
          section === initialClass.section_code &&
          day === initialClass.session_date &&
          period === initialClass.period
            ? initialClass.code
            : undefined,
        session_date: day,
        period,
        subject: subject || current?.subject || "",
        revision: current?.legacy ? 0 : current?.revision || 0,
        marks: data.students
          .filter((s) => marks[s.code])
          .map((s) => ({ student_code: s.code, status: marks[s.code] })),
      });
      setDraft({});
      setNotice(
        "Attendance saved. All attendance views will use this register.",
      );
      setRevision((r) => r + 1);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setSaving(false);
    }
  }
  const changeMonth = (delta: number) => {
    const value = new Date(`${day}T12:00:00`);
    selectDay(
      localDate(new Date(value.getFullYear(), value.getMonth() + delta, 1)),
    );
  };
  return (
    <section className="att-workspace" aria-busy={busy || saving}>
      <header className="att-heading">
        <div>
          <p>Student attendance</p>
          <h1>{personal ? "My attendance" : "Class attendance register"}</h1>
          <span>
            Choose a class and date. Review attendance by period, day, week,
            month or year.
          </span>
        </div>
        <button
          onClick={() =>
            options
              ? navigate(() => setRevision((r) => r + 1))
              : setOptionsRevision((r) => r + 1)
          }
          disabled={busy || saving}
        >
          <RefreshCw size={16} /> Refresh
        </button>
      </header>
      {error && (
        <p role="alert" className="att-error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="att-success">
          <Check size={16} />
          {notice}
        </p>
      )}
      <div className="att-filters">
        {personal ? (
          <label>
            Student
            <select
              value={child}
              onChange={(e) => navigate(() => setChild(e.target.value))}
            >
              {options?.students.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <>
            <label>
              Course level
              <select
                value={level}
                onChange={(e) =>
                  navigate(() => {
                    setLevel(e.target.value);
                    setCourse("");
                    setProgram("");
                    setYear("");
                    setSection("");
                  })
                }
              >
                <option value="intermediate">Intermediate</option>
                <option value="degree">Degree</option>
              </select>
            </label>
            <label>
              Course
              <select
                value={course}
                onChange={(e) =>
                  navigate(() => {
                    setCourse(e.target.value);
                    setProgram("");
                    setYear("");
                    setSection("");
                  })
                }
              >
                <option value="">Select course</option>
                {names.map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </label>
            <label>
              Branch / specialization
              <select
                value={program}
                disabled={!course}
                onChange={(e) =>
                  navigate(() => {
                    setProgram(e.target.value);
                    setYear("");
                    setSection("");
                  })
                }
              >
                <option value="">Select branch</option>
                {courses
                  .filter((c) => c.name === course)
                  .map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.branch}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Academic batch
              <select
                value={year}
                disabled={!program}
                onChange={(e) =>
                  navigate(() => {
                    setYear(e.target.value);
                    setSection("");
                  })
                }
              >
                <option value="">Select batch</option>
                {years.map((y) => (
                  <option key={y.code} value={y.code}>
                    {y.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Section
              <select
                value={section}
                disabled={!year}
                onChange={(e) => navigate(() => setSection(e.target.value))}
              >
                <option value="">
                  {options?.teacher
                    ? "Select assigned section"
                    : "All sections"}
                </option>
                {sections.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
        <label>
          Date
          <input
            type="date"
            value={day}
            onChange={(e) => e.target.value && selectDay(e.target.value)}
          />
        </label>
        <label>
          Register
          <select
            value={period}
            onChange={(e) => navigate(() => setPeriod(Number(e.target.value)))}
          >
            {options?.periods.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {!ready ? (
        <div className="att-empty">
          Select a course, branch and academic batch to load its students and
          attendance calendar.
        </div>
      ) : (
        <>
          <nav className="att-tabs" aria-label="Attendance summary period">
            {["period", "day", "week", "month", "year"].map((s) => (
              <button
                key={s}
                aria-pressed={scope === s}
                onClick={() => setScope(s)}
              >
                {s[0].toUpperCase() + s.slice(1)}
              </button>
            ))}
          </nav>
          <div className="att-metrics">
            {[
              [
                "Attendance",
                stats.percentage === null ? "—" : `${stats.percentage}%`,
              ],
              ["Attended sessions", `${stats.attended} / ${stats.recorded}`],
              ["Leave days", stats.leave_days],
              ["Days with absences", stats.absent_days],
            ].map(([label, value]) => (
              <article key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </article>
            ))}
          </div>
          <div className="att-overview">
            <section className="att-calendar">
              <header>
                <button
                  aria-label="Previous month"
                  onClick={() => changeMonth(-1)}
                >
                  <ChevronLeft size={18} />
                </button>
                <h2>
                  {new Date(`${day}T12:00:00`).toLocaleDateString("en-IN", {
                    month: "long",
                    year: "numeric",
                  })}
                </h2>
                <button aria-label="Next month" onClick={() => changeMonth(1)}>
                  <ChevronRight size={18} />
                </button>
              </header>
              <div className="att-calendar-grid">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                  <small key={d}>{d}</small>
                ))}
                {Array.from({ length: offset }, (_, i) => (
                  <span key={`blank${i}`} />
                ))}
                {monthDays.map((d) => (
                  <button
                    key={d.date}
                    aria-pressed={day === d.date}
                    title={`${d.date}: ${d.recorded ? `${d.percentage}% attendance` : "Not recorded"}${d.leave_days ? `, ${d.leave_days} leave days` : ""}`}
                    className={
                      d.absent
                        ? "has-absence"
                        : d.leave_days
                          ? "has-leave"
                          : d.recorded
                            ? "has-presence"
                            : ""
                    }
                    onClick={() => selectDay(d.date)}
                  >
                    <span>{Number(d.date.slice(-2))}</span>
                    <small>
                      {d.recorded
                        ? `${d.percentage}%`
                        : d.leave_days
                          ? "Leave"
                          : "—"}
                    </small>
                  </button>
                ))}
              </div>
              <p className="att-legend">
                P Present · L Late · A Absent · E Leave · — Not recorded
              </p>
            </section>
            <section className="att-trend">
              <h2>Monthly attendance pattern</h2>
              <div
                className="att-bars"
                aria-label="Daily attendance percentages"
              >
                {monthDays.map((d, i) => (
                  <button
                    key={d.date}
                    onClick={() => selectDay(d.date)}
                    title={`${d.date}: ${percentages[i] ?? "Not recorded"}${percentages[i] === null ? "" : "%"}`}
                    aria-label={`${d.date}: ${percentages[i] ?? "Not recorded"}`}
                  >
                    <span
                      style={{ height: `${Math.max(3, percentages[i] || 0)}%` }}
                    />
                    <small>{i + 1}</small>
                  </button>
                ))}
              </div>
              <p>{data?.calculation}</p>
              <p>
                Week leave days: {data?.summaries.week.leave_days || 0} · Month
                leave days: {data?.summaries.month.leave_days || 0}
              </p>
            </section>
          </div>
          <section className="att-register">
            <header>
              <div>
                <h2>
                  {day} · {period ? `Period ${period}` : "Whole day"}
                </h2>
                <p>
                  {data?.students.length || 0} students ·{" "}
                  {current?.subject || "Class register"}
                  {current?.legacy ? " · Historical record" : ""}
                </p>
              </div>
              <SearchField
                value={query}
                onValueChange={setQuery}
                placeholder="Search student or admission number"
                suggestions={searchValues(data?.students || [], [
                  "name",
                  "admission_number",
                ])}
              />
            </header>
            {canMark && (
              <div className="att-register-actions">
                <label>
                  Subject / class note
                  <input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder={current?.subject || "Optional subject"}
                    maxLength={160}
                  />
                </label>
                <button
                  disabled={saving || busy}
                  onClick={() =>
                    setDraft(
                      Object.fromEntries(
                        (data?.students || []).map((s) => [s.code, "present"]),
                      ),
                    )
                  }
                >
                  Mark all present
                </button>
                <button
                  disabled={saving || busy || !pending}
                  onClick={() => setDraft({})}
                >
                  Reset changes
                </button>
                <button
                  className="att-save"
                  disabled={saving || busy || !pending}
                  onClick={() => void save()}
                >
                  <Save size={16} />
                  {saving ? "Saving…" : "Save attendance"}
                </button>
              </div>
            )}
            {busy ? (
              <WorkspaceSkeleton compact label="Loading attendance" />
            ) : (
              <div className="att-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>{canMark ? "Mark attendance" : "Attendance"}</th>
                      {monthDays.map((d) => (
                        <th key={d.date}>
                          <button
                            onClick={() => selectDay(d.date)}
                            aria-pressed={day === d.date}
                          >
                            {Number(d.date.slice(-2))}
                          </button>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((s) => (
                      <tr key={s.code}>
                        <th>
                          {s.name}
                          <small>{s.admission_number}</small>
                        </th>
                        <td>
                          {canMark ? (
                            <select
                              aria-label={`Attendance for ${s.name}`}
                              value={marks[s.code] || ""}
                              onChange={(e) => {
                                if (e.target.value)
                                  setDraft((d) => ({
                                    ...d,
                                    [s.code]: e.target
                                      .value as AttendanceStatus,
                                  }));
                              }}
                            >
                              <option value="">Not recorded</option>
                              {Object.entries(statusNames).map(([v, label]) => (
                                <option key={v} value={v}>
                                  {label}
                                </option>
                              ))}
                            </select>
                          ) : (
                            statusNames[marks[s.code]] || "Not recorded"
                          )}
                        </td>
                        {monthDays.map((d) => {
                          const values =
                            data?.registers
                              .filter(
                                (r) =>
                                  r.session_date === d.date &&
                                  (period === 0 || r.period === period),
                              )
                              .map((r) => r.marks[s.code])
                              .filter(Boolean) || [];
                          const text = values.includes("absent")
                            ? "A"
                            : values.includes("excused")
                              ? "E"
                              : values.includes("late")
                                ? "L"
                                : values.length
                                  ? "P"
                                  : data?.leave_dates?.[s.code]?.includes(
                                        d.date,
                                      )
                                    ? "E"
                                    : "—";
                          return (
                            <td key={d.date}>
                              <button
                                className={`att-cell att-cell-${text}`}
                                title={`${s.name} · ${d.date} · ${text === "—" ? "Not recorded" : text}`}
                                onClick={() => selectDay(d.date)}
                              >
                                {text}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!students.length && (
                  <p className="att-empty">No students in this selection.</p>
                )}
              </div>
            )}
          </section>
        </>
      )}
    </section>
  );
}
