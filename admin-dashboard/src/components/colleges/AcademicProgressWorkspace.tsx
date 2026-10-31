"use client";
import { useEffect, useState, type FormEvent } from "react";
import {
  CalendarDays,
  RefreshCw,
  GraduationCap,
  Clock,
  Info,
} from "lucide-react";
import {
  academicProgress,
  type AcademicProgress,
  type AcademicBatch,
  type ScheduledClass,
} from "@/services/api/modules/academic-progress/service";
import { errorText } from "@/services/api";
import Select from "./SearchSelect";
import SearchField, { searchValues } from "./SearchField";
import SideDrawer from "./SideDrawer";
import AttendanceWorkspace from "./AttendanceWorkspace";
import "./academic-progress.css";
const money = (s: string | number) =>
  Number(s).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  });
const percentage = (v: number | null | undefined) =>
  v == null ? "Pending" : `${v.toFixed(1)}%`;
export default function AcademicProgressWorkspace({
  onNavigate,
}: {
  onNavigate?: (screen: string) => void;
}) {
  const [data, setData] = useState<AcademicProgress | null>(null),
    [program, setProgram] = useState(""),
    [year, setYear] = useState(""),
    [child, setChild] = useState(""),
    [semester, setSemester] = useState(0),
    [batchCode, setBatchCode] = useState(""),
    [query, setQuery] = useState(""),
    [status, setStatus] = useState("all"),
    [error, setError] = useState(""),
    [refresh, setRefresh] = useState(0),
    [editor, setEditor] = useState<"results" | "calendar" | null>(null),
    [session, setSession] = useState<ScheduledClass | null>(null);
  useEffect(() => {
    let active = true;
    const load = () =>
      academicProgress
        .get(program || undefined, year || undefined, child || undefined)
        .then((r) => {
          if (active) {
            setData(r);
            setError("");
          }
        })
        .catch((e) => {
          if (active) setError(errorText(e));
        });
    void load();
    const timer = setInterval(() => void load(), 60000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [program, year, child, refresh]);
  const batch =
    data?.batches.find((b) => b.code === batchCode) ||
    data?.batches.find((b) => b.students.length > 0) ||
    data?.batches[0];
  const term =
    semester ||
    batch?.timeline.current ||
    batch?.semesters[0]?.semester_number ||
    1;
  const summary = batch?.semesters.find((s) => s.semester_number === term);
  const students = (batch?.students || []).filter(
    (s) =>
      s.semester_number === term &&
      (status === "all" || s.status === status) &&
      s.name.toLowerCase().includes(query.toLowerCase()),
  );
  const fees = (data?.fees || []).filter(
    (f) =>
      (!batch || f.academic_year_code === batch.code) &&
      (f.semester_number === term || f.semester_number === null),
  );
  return (
    <section className="ap-workspace">
      <header className="ap-heading">
        <div>
          <span className="ap-eyebrow">Academic progress</span>
          <h2>Every semester, connected</h2>
          <p>
            Current classes, published results, backlogs and fee schedules from
            your academic records.
          </p>
        </div>
        <button
          aria-label="Refresh academic progress"
          onClick={() => setRefresh((n) => n + 1)}
        >
          <RefreshCw size={18} />
        </button>
      </header>
      {error && (
        <p role="alert" className="edu-error">
          {error}
        </p>
      )}
      {!data && !error && <p role="status">Loading academic progress…</p>}
      {data && (
        <>
          <div className="ap-filters">
            <label>
              Course
              <Select
                value={program}
                onChange={(e) => {
                  setProgram(e.target.value);
                  setYear("");
                  setBatchCode("");
                  setSemester(0);
                }}
              >
                <option value="">All permitted courses</option>
                {data.courses.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </label>
            <label>
              Academic batch
              <Select
                value={year}
                onChange={(e) => {
                  setYear(e.target.value);
                  setBatchCode(e.target.value);
                  setSemester(0);
                }}
              >
                <option value="">All permitted batches</option>
                {data.academic_years
                  .filter((y) => !program || y.program_code === program)
                  .map((y) => (
                    <option key={y.code} value={y.code}>
                      {y.name}
                    </option>
                  ))}
              </Select>
            </label>
            {data.children.length > 1 && (
              <label>
                Student
                <Select
                  value={child}
                  onChange={(e) => {
                    setChild(e.target.value);
                    setSemester(0);
                  }}
                >
                  <option value="">All linked children</option>
                  {data.children.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </label>
            )}
          </div>
          <div className="ap-metrics">
            <article>
              <span>Students in scope</span>
              <strong>{data.totals.students}</strong>
            </article>
            <article>
              <span>Students with backlogs</span>
              <strong>{data.totals.backlog_students}</strong>
            </article>
            <article>
              <span>All-clear semester records</span>
              <strong>{data.totals.all_clear_semester_results}</strong>
            </article>
            <article>
              <span>
                {data.personal
                  ? "My academic performance"
                  : data.teacher
                    ? "Allocated subject performance"
                    : "Academic performance"}
              </span>
              <strong>{percentage(data.college_percentage)}</strong>
            </article>
          </div>
          <section className="ap-panel">
            <header>
              <div>
                <h3>
                  <Clock size={19} />
                  Today’s classes
                </h3>
                <p>India Standard Time · live status refreshes every minute.</p>
              </div>
            </header>
            <div className="ap-classes">
              {data.today_classes.map((c) => (
                <article
                  key={c.code}
                  className={c.state === "ongoing" ? "is-current" : ""}
                >
                  <span className="ap-status">{c.state}</span>
                  <strong>{c.subject_name}</strong>
                  <p>
                    {c.start_time}–{c.end_time} · Period {c.period}
                    <br />
                    {c.teacher_name} · Semester {c.semester_number}
                  </p>
                  {c.can_take_attendance && (
                    <button onClick={() => setSession(c)}>
                      Take attendance
                    </button>
                  )}
                </article>
              ))}
              {!data.today_classes.length && (
                <p>No scheduled classes for today in the active semester.</p>
              )}
            </div>
          </section>
          <section className="ap-panel">
            <h3>Course performance comparison</h3>
            <div className="ap-comparison">
              {data.course_comparison.map((c) => (
                <div key={c.code}>
                  <span>{c.name}</span>
                  <div className="ap-bar-track">
                    <i style={{ width: `${c.percentage || 0}%` }} />
                  </div>
                  <strong>{percentage(c.percentage)}</strong>
                </div>
              ))}
            </div>
            <small>
              Weighted by published final subject marks; ungraded results remain
              pending.
            </small>
          </section>
          <section className="ap-panel">
            <h3>Batch comparison · Semester {term}</h3>
            <div className="ap-comparison">
              {data.batches.map((b) => {
                const result = b.semesters.find(
                  (s) => s.semester_number === term,
                );
                return (
                  <div key={b.code}>
                    <span>
                      {b.course_name} · {b.name}
                    </span>
                    <div className="ap-bar-track">
                      <i style={{ width: `${result?.percentage || 0}%` }} />
                    </div>
                    <strong>{percentage(result?.percentage)}</strong>
                  </div>
                );
              })}
            </div>
          </section>
          {batch && (
            <>
              <section className="ap-panel">
                <header>
                  <div>
                    <h3>
                      <GraduationCap size={20} />
                      {batch.course_name}
                    </h3>
                    <p>
                      {batch.name} ·{" "}
                      {batch.timeline.current
                        ? `Current semester ${batch.timeline.current}`
                        : batch.timeline.state.replaceAll("_", " ")}
                    </p>
                  </div>
                  <div className="ap-actions">
                    {data.batches.length > 1 && (
                      <Select
                        aria-label="Batch detail"
                        value={batch.code}
                        onChange={(e) => {
                          setBatchCode(e.target.value);
                          setSemester(0);
                        }}
                      >
                        {data.batches.map((b) => (
                          <option key={b.code} value={b.code}>
                            {b.course_name} · {b.name}
                          </option>
                        ))}
                      </Select>
                    )}
                    {data.can_manage_calendar && (
                      <button onClick={() => setEditor("calendar")}>
                        <CalendarDays size={16} />
                        Semester dates
                      </button>
                    )}
                  </div>
                </header>
                {batch.timeline.semesters.some((s) => s.estimated) && (
                  <p className="ap-note">
                    Semester dates were estimated from the batch duration.
                    Confirm the college calendar before relying on the
                    current-semester indicator.
                  </p>
                )}
                <nav
                  role="tablist"
                  aria-label="Academic semesters"
                  className="ap-tabs"
                >
                  {batch.semesters.map((s) => (
                    <button
                      key={s.semester_number}
                      role="tab"
                      aria-selected={term === s.semester_number}
                      onClick={() => setSemester(s.semester_number)}
                    >
                      Semester {s.semester_number}
                      {batch.timeline.current === s.semester_number
                        ? " · Current"
                        : ""}
                    </button>
                  ))}
                </nav>
                <div
                  className="ap-semester-chart"
                  aria-label="Semester comparison"
                >
                  {batch.semesters.map((s) => (
                    <button
                      key={s.semester_number}
                      onClick={() => setSemester(s.semester_number)}
                      aria-label={`Show semester ${s.semester_number}`}
                    >
                      <span>{percentage(s.percentage)}</span>
                      <div>
                        <i style={{ height: `${s.percentage || 0}%` }} />
                      </div>
                      <strong>S{s.semester_number}</strong>
                    </button>
                  ))}
                </div>
                <div className="ap-semester-stats">
                  <span>
                    <strong>{summary?.all_clear || 0}</strong>all clear
                  </span>
                  <span>
                    <strong>{summary?.backlog_students || 0}</strong>with
                    backlogs
                  </span>
                  <span>
                    <strong>{summary?.pending_students || 0}</strong>awaiting
                    final results
                  </span>
                  <span>
                    <strong>{percentage(summary?.percentage)}</strong>weighted
                    performance
                  </span>
                </div>
              </section>
              <section className="ap-panel">
                <header>
                  <h3>Semester {term} · Subjects & labs</h3>
                  {data.can_grade && (
                    <button onClick={() => setEditor("results")}>
                      Enter final results / reattempt
                    </button>
                  )}
                </header>
                <div className="ap-subjects">
                  {batch.subjects
                    .filter((s) => s.semester_number === term)
                    .map((s) => (
                      <article key={s.subject_code}>
                        <strong>{s.name}</strong>
                        <span>
                          {s.subject_type === "practical"
                            ? "Lab / practical"
                            : s.subject_type}{" "}
                          · {s.credits || 0} credits
                        </span>
                        <span>
                          {[
                            ...new Set(s.faculty?.map((f) => f.teacher_name)),
                          ].join(", ") || "Faculty allocation pending"}
                        </span>
                      </article>
                    ))}
                </div>
              </section>
              <section className="ap-panel">
                <header>
                  <h3>Student semester records</h3>
                  <div className="ap-actions">
                    <SearchField
                      aria-label="Search academic students"
                      value={query}
                      onValueChange={setQuery}
                      placeholder="Search students"
                      suggestions={searchValues(batch.students, ["name"])}
                    />
                    <Select
                      aria-label="Semester result status"
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                    >
                      <option value="all">All students</option>
                      <option value="all_clear">All clear</option>
                      <option value="backlogs">Backlogs</option>
                      <option value="pending">Pending results</option>
                    </Select>
                  </div>
                </header>
                <div className="ap-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Student</th>
                        <th>Semester status</th>
                        <th>Backlogs / pending</th>
                        <th>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((s) => (
                        <tr key={s.code}>
                          <td>{s.name}</td>
                          <td>
                            <span className={`ap-badge ${s.status}`}>
                              {s.status.replaceAll("_", " ")}
                            </span>
                          </td>
                          <td>
                            {s.backlogs.length} backlogs · {s.pending_subjects}{" "}
                            pending
                          </td>
                          <td>
                            <details>
                              <summary aria-label={`Results for ${s.name}`}>
                                <Info size={17} />
                              </summary>
                              {batch.results
                                .filter(
                                  (r) =>
                                    r.student_code === s.code &&
                                    r.semester_number === term,
                                )
                                .map((r) => (
                                  <p key={r.code}>
                                    {
                                      batch.subjects.find(
                                        (v) =>
                                          v.subject_code === r.subject_code,
                                      )?.name
                                    }
                                    :{" "}
                                    {r.absent
                                      ? "Absent"
                                      : r.marks === null
                                        ? "Pending"
                                        : `${r.marks} / ${r.max_marks}`}{" "}
                                    · Attempt {r.attempt}
                                  </p>
                                ))}
                              {s.backlogs.map((b) => (
                                <p className="ap-backlog" key={b.subject_code}>
                                  {b.subject_name} · needs a passing reattempt
                                </p>
                              ))}
                            </details>
                          </td>
                        </tr>
                      ))}
                      {!students.length && (
                        <tr>
                          <td colSpan={4}>No matching semester records.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
          {data.fees.length > 0 && (
            <section className="ap-panel">
              <header>
                <div>
                  <h3>Semester fees & due dates</h3>
                  <p>
                    Semester {term}; annual or unallocated charges are labelled
                    separately.
                  </p>
                </div>
                {onNavigate && (
                  <button onClick={() => onNavigate("fees")}>
                    Fees & payments
                  </button>
                )}
              </header>
              <div className="ap-table">
                <table>
                  <thead>
                    <tr>
                      <th>Fee</th>
                      <th>Period</th>
                      <th>Amount</th>
                      <th>Paid</th>
                      <th>Balance</th>
                      <th>Due date</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fees.map((f) => (
                      <tr key={f.code}>
                        <td>{f.fee_head}</td>
                        <td>
                          {f.semester_number
                            ? `Semester ${f.semester_number}`
                            : "Annual / unallocated"}
                        </td>
                        <td>{money(f.amount)}</td>
                        <td>{money(f.paid)}</td>
                        <td>{money(f.outstanding)}</td>
                        <td>{f.due_date || "Not scheduled"}</td>
                        <td>{f.reminder_state.replaceAll("_", " ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <details>
                <summary>Payment history ({data.payments.length})</summary>
                {data.payments.map((p) => (
                  <p key={p.code}>
                    {p.paid_on} · {money(p.amount)} · {p.method} · {p.status}
                  </p>
                ))}
              </details>
            </section>
          )}
          <small>
            Updated{" "}
            {new Date(data.generated_at).toLocaleString("en-IN", {
              timeZone: "Asia/Kolkata",
            })}
          </small>
        </>
      )}
      {editor && batch && (
        <AcademicEditor
          key={`${editor}-${batch.code}-${term}`}
          kind={editor}
          batch={batch}
          term={term}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null);
            setRefresh((n) => n + 1);
          }}
        />
      )}
      {session && (
        <SideDrawer
          title={`${session.subject_name} · Attendance`}
          expanded
          onClose={() => setSession(null)}
        >
          <AttendanceWorkspace initialClass={session} />
        </SideDrawer>
      )}
    </section>
  );
}
function AcademicEditor({
  kind,
  batch,
  term,
  onClose,
  onSaved,
}: {
  kind: string;
  batch: AcademicBatch;
  term: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [subject, setSubject] = useState(""),
    [attempt, setAttempt] = useState(1),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const eligible = batch.subjects.find(
    (s) => s.subject_code === subject,
  )?.eligible_student_codes;
  const roster = batch.students.filter(
    (s) =>
      s.semester_number === term &&
      (!subject || !eligible || eligible.includes(s.code)),
  );
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      if (kind === "calendar") {
        await academicProgress.calendar({
          program_code: batch.program_code,
          academic_year_code: batch.code,
          revision: batch.calendar_revision,
          semesters: batch.timeline.semesters.map((s) => ({
            semester_number: s.semester_number,
            start_date: f.get(`start-${s.semester_number}`),
            end_date: f.get(`end-${s.semester_number}`),
          })),
        });
      } else {
        const rows = roster.flatMap((s) => {
          const marks = String(f.get(`marks-${s.code}`) || "");
          const absent = f.has(`absent-${s.code}`);
          return marks || absent
            ? [{ student_code: s.code, marks: absent ? null : marks, absent }]
            : [];
        });
        await academicProgress.results({
          program_code: batch.program_code,
          academic_year_code: batch.code,
          semester_number: term,
          subject_code: subject,
          attempt,
          revision:
            batch.result_groups.find(
              (g) =>
                g.subject_code === subject &&
                g.semester_number === term &&
                g.attempt === attempt,
            )?.revision || 0,
          max_marks: f.get("max_marks"),
          pass_marks: f.get("pass_marks"),
          assessed_on: f.get("assessed_on"),
          published: f.has("published"),
          students: rows,
        });
      }
      onSaved();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <SideDrawer
      title={
        kind === "calendar"
          ? "Semester calendar"
          : `Semester ${term} · Final results`
      }
      onClose={onClose}
    >
      <form className="ap-editor" onSubmit={save}>
        {kind === "calendar" ? (
          <>
            <p>
              These dates determine the current semester and its subjects. Gaps
              are treated as semester breaks.
            </p>
            {batch.timeline.semesters.map((s) => (
              <fieldset key={s.semester_number}>
                <legend>Semester {s.semester_number}</legend>
                <label>
                  Start date
                  <input
                    type="date"
                    name={`start-${s.semester_number}`}
                    defaultValue={s.start_date}
                    required
                  />
                </label>
                <label>
                  End date
                  <input
                    type="date"
                    name={`end-${s.semester_number}`}
                    defaultValue={s.end_date}
                    required
                  />
                </label>
              </fieldset>
            ))}
          </>
        ) : (
          <>
            <p>
              Published final results determine all-clear and backlog status.
              Use a new attempt for supplementary results; pending marks do not
              become backlogs.
            </p>
            <label>
              Subject *
              <Select
                required
                aria-label="Subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              >
                <option value="">Select subject</option>
                {batch.subjects
                  .filter((s) => s.semester_number === term)
                  .map((s) => (
                    <option key={s.subject_code} value={s.subject_code}>
                      {s.name}
                    </option>
                  ))}
              </Select>
            </label>
            <label>
              Attempt
              <input
                type="number"
                min="1"
                max="20"
                value={attempt}
                onChange={(e) => setAttempt(Number(e.target.value))}
              />
            </label>
            <label>
              Maximum marks
              <input
                name="max_marks"
                type="number"
                min="1"
                max="10000"
                required
                defaultValue="100"
              />
            </label>
            <label>
              Pass marks
              <input
                name="pass_marks"
                type="number"
                min="0"
                max="10000"
                required
                defaultValue="40"
              />
            </label>
            <label>
              Assessment date
              <input name="assessed_on" type="date" required />
            </label>
            <div className="ap-table">
              <table>
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Marks</th>
                    <th>Absent</th>
                  </tr>
                </thead>
                <tbody>
                  {roster.map((s) => (
                    <tr key={s.code}>
                      <td>{s.name}</td>
                      <td>
                        <input
                          name={`marks-${s.code}`}
                          aria-label={`Final marks for ${s.name}`}
                          type="number"
                          min="0"
                          max="10000"
                          step="0.01"
                        />
                      </td>
                      <td>
                        <input
                          name={`absent-${s.code}`}
                          aria-label={`Absent ${s.name}`}
                          type="checkbox"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <label className="ap-check">
              <input type="checkbox" name="published" defaultChecked />
              Publish results to students and parents
            </label>
          </>
        )}
        {error && (
          <p role="alert" className="edu-error">
            {error}
          </p>
        )}
        <footer>
          <button type="button" disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button className="edu-primary" disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </button>
        </footer>
      </form>
    </SideDrawer>
  );
}

export function AcademicProgressOverview({ onOpen }: { onOpen: () => void }) {
  const [data, setData] = useState<AcademicProgress | null>(null);
  useEffect(() => {
    let active = true;
    void academicProgress
      .get()
      .then((r) => {
        if (active) setData(r);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  if (!data) return null;
  const active = data.batches.filter((b) => b.timeline.current);
  return (
    <section className="ap-panel ap-overview">
      <header>
        <div>
          <h3>Academic progress</h3>
          <p>
            {active
              .slice(0, 2)
              .map((b) => `${b.course_name} · Semester ${b.timeline.current}`)
              .join(" / ") || "Review your semester calendar"}
            {active.length > 2 ? ` · +${active.length - 2} batches` : ""}
          </p>
        </div>
        <button onClick={onOpen}>View semester dashboard</button>
      </header>
      <div className="ap-semester-stats">
        <span>
          <strong>{data.totals.students}</strong>students
        </span>
        <span>
          <strong>{data.totals.backlog_students}</strong>with backlogs
        </span>
        <span>
          <strong>{data.totals.all_clear_semester_results}</strong>all-clear
          semesters
        </span>
        <span>
          <strong>{percentage(data.college_percentage)}</strong>published final
          results
        </span>
      </div>
    </section>
  );
}
