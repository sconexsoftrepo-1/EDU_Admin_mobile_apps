"use client";
import {
  useCallback,
  useEffect,
  useState,
  useRef,
  type FormEvent,
} from "react";
import { Info, Plus, RefreshCw, FileText } from "lucide-react";
import {
  assessments,
  type Assessment,
  type AssessmentList,
  type AssessmentOptions,
  type AssessmentMark,
} from "@/services/api/modules/assessments/service";
import { assignments } from "@/services/api/modules/assignments/service";
import { errorText } from "@/services/api";
import SideDrawer from "./SideDrawer";
import Select from "./SearchSelect";
import SearchField, { searchValues } from "./SearchField";
import "./assessment-workspace.css";
const date = (v: string) =>
  new Date(v).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
export default function AssessmentWorkspace() {
  const [data, setData] = useState<AssessmentList | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(true),
    [tab, setTab] = useState("upcoming"),
    [query, setQuery] = useState(""),
    [child, setChild] = useState("");
  const [selected, setSelected] = useState<Assessment | null>(null),
    [compose, setCompose] = useState(false),
    [draft, setDraft] = useState<Assessment | undefined>();
  const request = useRef(0);
  const load = useCallback(async () => {
    const id = ++request.current;
    setBusy(true);
    setError("");
    try {
      const result = await assessments.list(child || undefined);
      if (request.current === id) setData(result);
    } catch (e) {
      if (request.current === id) setError(errorText(e));
    } finally {
      if (request.current === id) setBusy(false);
    }
  }, [child]);
  useEffect(() => {
    let active = true;
    assessments
      .list(child || undefined)
      .then((result) => {
        if (active) {
          setData(result);
          setError("");
          setBusy(false);
        }
      })
      .catch((e) => {
        if (active) {
          setError(errorText(e));
          setBusy(false);
        }
      });
    const t = setInterval(() => void load(), 60000);
    const invalidate = () => {
      request.current++;
    };
    return () => {
      active = false;
      invalidate();
      clearInterval(t);
    };
  }, [child, load]);
  const items = (data?.items || []).filter(
    (a) =>
      a.bucket === tab &&
      `${a.title} ${a.subject_name} ${a.batch_name}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <section className="assessment-workspace">
      <div className="assessment-toolbar">
        <h2>Assessments</h2>
        <button
          onClick={() => void load()}
          disabled={busy}
          aria-label="Refresh assessments"
        >
          <RefreshCw size={18} />
        </button>
        {data?.can_create && (
          <button
            className="edu-primary"
            onClick={() => {
              setDraft(undefined);
              setCompose(true);
            }}
          >
            <Plus size={16} /> Add assessment
          </button>
        )}
      </div>
      <p>
        Publish class assessments, review completed work, and follow subject and
        batch performance.
      </p>
      {data && (
        <div className="assessment-performance">
          <div>
            <span>Assessment performance</span>
            <strong>
              {data.performance.percentage === null
                ? "—"
                : `${data.performance.percentage}%`}
            </strong>
            <small>
              {data.performance.graded} graded student results · weighted by
              maximum marks
            </small>
          </div>
          {data.batch_performance.map((b) => (
            <div key={b.code}>
              <span>{b.name}</span>
              <strong>
                {b.percentage === null ? "—" : `${b.percentage}%`}
              </strong>
              <small>{b.graded} graded results</small>
            </div>
          ))}
        </div>
      )}
      {data && (
        <details>
          <summary>Performance by student & subject</summary>
          <div className="assessment-table">
            <table>
              <thead>
                <tr>
                  <th>Breakdown</th>
                  <th>Student / subject</th>
                  <th>Results</th>
                  <th>Weighted percentage</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Student", data.student_performance || []],
                  ["Subject", data.subject_performance || []],
                ].map(([label, values]) =>
                  (
                    values as {
                      code: string;
                      name: string;
                      graded: number;
                      percentage: number | null;
                    }[]
                  ).map((v) => (
                    <tr key={`${label}-${v.code}`}>
                      <td>{String(label)}</td>
                      <td>{v.name}</td>
                      <td>{v.graded}</td>
                      <td>
                        {v.percentage === null ? "—" : `${v.percentage}%`}
                      </td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>
        </details>
      )}
      {(data?.students.length || 0) > 1 && (
        <label>
          Student
          <Select
            value={child}
            onChange={(e) => {
              setData(null);
              setBusy(true);
              setSelected(null);
              setChild(e.target.value);
            }}
          >
            <option value="">All linked children</option>
            {data?.students.map((s) => (
              <option key={s.code} value={s.code}>
                {s.name}
              </option>
            ))}
          </Select>
        </label>
      )}
      <div className="assessment-toolbar">
        <div
          className="assessment-tabs"
          role="tablist"
          aria-label="Assessment status"
        >
          {[
            ["upcoming", "Current & upcoming"],
            ["completed", "Completed"],
            ...(data?.can_create ||
            data?.items.some((a) => a.bucket === "draft")
              ? [["draft", "Drafts"]]
              : []),
          ].map(([key, label]) => (
            <button
              key={key}
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
            >
              {label} ({data?.items.filter((a) => a.bucket === key).length || 0}
              )
            </button>
          ))}
        </div>
        <SearchField
          value={query}
          onValueChange={setQuery}
          placeholder="Search assessments"
          suggestions={searchValues(data?.items || [], [
            "title",
            "subject_name",
            "batch_name",
          ])}
        />
      </div>
      {error && (
        <p role="alert" className="edu-error">
          {error}
        </p>
      )}
      <div className="assessment-table">
        <table>
          <thead>
            <tr>
              <th>Assessment</th>
              <th>Subject</th>
              <th>Date & time</th>
              <th>Academic batch</th>
              <th>Results</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {items.map((a) => (
              <tr key={a.code}>
                <td>{a.title}</td>
                <td>{a.subject_name}</td>
                <td>{date(a.scheduled_at)}</td>
                <td>{a.batch_name}</td>
                <td>
                  {a.counts.graded} / {a.counts.assigned} graded
                  {Object.entries(a.marks)
                    .filter(([, m]) => m.marks !== null || m.absent)
                    .map(([s, m]) => (
                      <div key={s}>
                        {data?.students.find((c) => c.code === s)?.name || s}:{" "}
                        {m.absent ? "Absent" : `${m.marks} / ${a.max_marks}`}
                      </div>
                    ))}
                </td>
                <td>
                  <button
                    aria-label={`View details for ${a.title}`}
                    onClick={async () => {
                      try {
                        setSelected(
                          await assessments.detail(a.code, child || undefined),
                        );
                      } catch (e) {
                        setError(errorText(e));
                      }
                    }}
                  >
                    <Info size={18} />
                  </button>
                </td>
              </tr>
            ))}
            {!items.length && (
              <tr>
                <td colSpan={6}>
                  {busy
                    ? "Loading assessments…"
                    : "No assessments in this tab."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {compose && (
        <AssessmentComposer
          initial={draft}
          onClose={() => setCompose(false)}
          onSaved={() => {
            setCompose(false);
            void load();
          }}
        />
      )}
      {selected && (
        <AssessmentDetails
          initial={selected}
          onClose={() => setSelected(null)}
          onSaved={load}
          onEdit={() => {
            setDraft(selected);
            setSelected(null);
            setCompose(true);
          }}
        />
      )}
    </section>
  );
}
function AssessmentComposer({
  initial,
  onClose,
  onSaved,
}: {
  initial?: Assessment;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [options, setOptions] = useState<AssessmentOptions | null>(null),
    [level, setLevel] = useState(initial?.course_level || ""),
    [program, setProgram] = useState(initial?.program_code || ""),
    [year, setYear] = useState(initial?.academic_year_code || ""),
    [section, setSection] = useState(initial?.section_code || ""),
    [semester, setSemester] = useState(initial?.semester_number || 1),
    [subject, setSubject] = useState(initial?.subject_code || ""),
    [teacher, setTeacher] = useState(initial?.teacher_code || ""),
    [files, setFiles] = useState<File[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    assessments
      .options(program || undefined, year || undefined, section || undefined)
      .then((r) => {
        if (active) setOptions(r);
      })
      .catch((e) => {
        if (active) setError(errorText(e));
      });
    return () => {
      active = false;
    };
  }, [program, year, section]);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const form = e.currentTarget;
    const f = new FormData(form);
    setBusy(true);
    setError("");
    try {
      const attached = [...(initial?.attachments.map((a) => a.code) || [])];
      for (const file of files)
        attached.push((await assessments.upload(file)).code);
      await assessments.save(
        {
          title: f.get("title"),
          description: f.get("description"),
          guidance: f.get("guidance"),
          course_level: level,
          program_code: program,
          academic_year_code: year,
          section_code: section || null,
          teacher_code: f.get("teacher_code"),
          semester_number: semester,
          subject_code: subject,
          scheduled_at: new Date(String(f.get("scheduled_at"))).toISOString(),
          max_marks: f.get("max_marks"),
          status:
            (e.nativeEvent as SubmitEvent).submitter?.getAttribute("value") ||
            "draft",
          revision: initial?.revision || 0,
          attachments: attached,
        },
        initial?.code,
      );
      onSaved();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  const selected = options?.courses.find((c) => c.code === program);
  return (
    <SideDrawer
      title={initial ? "Edit draft assessment" : "Create assessment"}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <form className="assessment-form" onSubmit={save}>
        <fieldset disabled={busy}>
          <legend>Class & subject</legend>
          <div className="assessment-grid">
            <label>
              Course level *
              <Select
                required
                value={level}
                onChange={(e) => {
                  setLevel(e.target.value);
                  setProgram("");
                  setYear("");
                  setSubject("");
                }}
              >
                <option value="">Select level</option>
                <option value="intermediate">Intermediate</option>
                <option value="degree">Degree</option>
              </Select>
            </label>
            <label>
              Course / branch *
              <Select
                required
                value={program}
                onChange={(e) => {
                  setProgram(e.target.value);
                  setYear("");
                  setSection("");
                  setSubject("");
                }}
              >
                <option value="">Select course</option>
                {options?.courses
                  .filter((c) => c.course_level === level)
                  .map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name}
                      {c.branch ? ` · ${c.branch}` : ""}
                    </option>
                  ))}
              </Select>
            </label>
            <label>
              Academic batch *
              <Select
                required
                value={year}
                onChange={(e) => {
                  setYear(e.target.value);
                  setSection("");
                }}
              >
                <option value="">Select batch</option>
                {options?.academic_years
                  .filter((y) => y.program_code === program)
                  .map((y) => (
                    <option key={y.code} value={y.code}>
                      {y.name}
                    </option>
                  ))}
              </Select>
            </label>
            <label>
              Section
              <Select
                value={section}
                onChange={(e) => setSection(e.target.value)}
              >
                <option value="">All eligible sections</option>
                {options?.sections.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </label>
            <label>
              Semester *
              <Select
                value={String(semester)}
                onChange={(e) => {
                  setSemester(Number(e.target.value));
                  setSubject("");
                }}
              >
                {[
                  ...new Set(
                    options?.subjects.map((s) => s.semester_number) || [1],
                  ),
                ].map((n) => (
                  <option key={n} value={n}>
                    Semester {n}
                  </option>
                ))}
              </Select>
            </label>
            <label>
              Subject *
              <Select
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              >
                <option value="">Select subject</option>
                {options?.subjects
                  .filter((s) => s.semester_number === semester)
                  .map((s) => (
                    <option key={s.subject_code} value={s.subject_code}>
                      {s.name}
                      {s.subject_type === "practical" ? " (lab)" : ""}
                    </option>
                  ))}
              </Select>
            </label>
            <label>
              Teacher *
              <Select
                name="teacher_code"
                value={teacher}
                onChange={(e) => setTeacher(e.target.value)}
                required
              >
                <option value="">Select teacher</option>
                {options?.teachers.map((t) => (
                  <option key={t.code} value={t.code}>
                    {t.name || t.code}
                  </option>
                ))}
              </Select>
            </label>
          </div>
          <p>
            {selected?.name} · All {options?.students.length || 0} eligible
            students in this selection receive a published assessment.
          </p>
        </fieldset>
        <label>
          Assessment name *
          <input
            name="title"
            required
            maxLength={180}
            defaultValue={initial?.title}
          />
        </label>
        <label>
          Description
          <textarea name="description" defaultValue={initial?.description} />
        </label>
        <label>
          Guidance & preparation
          <textarea name="guidance" defaultValue={initial?.guidance} />
        </label>
        <div className="assessment-grid">
          <label>
            Date & time *
            <input
              name="scheduled_at"
              type="datetime-local"
              required
              defaultValue={
                initial
                  ? new Date(
                      new Date(initial.scheduled_at).getTime() -
                        new Date(initial.scheduled_at).getTimezoneOffset() *
                          60000,
                    )
                      .toISOString()
                      .slice(0, 16)
                  : ""
              }
            />
          </label>
          <label>
            Maximum marks *
            <input
              name="max_marks"
              type="number"
              min="0.01"
              max="10000"
              step="0.01"
              defaultValue={initial?.max_marks || 100}
              required
            />
          </label>
        </div>
        <label>
          Images & PDFs · up to 10 MB each
          <input
            type="file"
            multiple
            accept="image/png,image/jpeg,image/webp,application/pdf"
            disabled={busy}
            onChange={(e) => setFiles(Array.from(e.target.files || []))}
          />
        </label>
        <p>
          {[
            ...(initial?.attachments.map((f) => f.filename) || []),
            ...files.map((f) => f.name),
          ].join(" · ")}
        </p>
        {error && (
          <p role="alert" className="edu-error">
            {error}
          </p>
        )}
        <footer>
          <button type="submit" value="draft" disabled={busy}>
            Save draft
          </button>
          <button
            className="edu-primary"
            type="submit"
            value="published"
            disabled={busy}
          >
            {busy ? "Saving…" : "Publish & notify class"}
          </button>
        </footer>
      </form>
    </SideDrawer>
  );
}
function AssessmentDetails({
  initial,
  onClose,
  onSaved,
  onEdit,
}: {
  initial: Assessment;
  onClose: () => void;
  onSaved: () => Promise<void>;
  onEdit: () => void;
}) {
  const [data, setData] = useState(initial),
    [marks, setMarks] = useState<Record<string, AssessmentMark>>(initial.marks),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <SideDrawer title={data.title} onClose={onClose}>
      <div className="assessment-form">
        <p>
          {data.subject_name} · {data.course_name} · {data.batch_name}
          <br />
          {date(data.scheduled_at)} · {data.bucket} · Maximum {data.max_marks}
        </p>
        <h3>Description</h3>
        <p>{data.description || "No description supplied."}</p>
        <h3>Guidance</h3>
        <p>{data.guidance || "No additional guidance."}</p>
        <div className="assessment-files">
          {data.attachments.map((f) => (
            <button
              key={f.code}
              onClick={async () => {
                try {
                  const bytes = await assignments.bytes(f);
                  const url = URL.createObjectURL(bytes);
                  window.open(url, "_blank", "noopener");
                  setTimeout(() => URL.revokeObjectURL(url), 60000);
                } catch (e) {
                  setError(errorText(e));
                }
              }}
            >
              <FileText size={16} />
              {f.filename}
            </button>
          ))}
        </div>
        {data.status === "draft" && data.can_manage && (
          <button onClick={onEdit}>Edit or publish draft</button>
        )}
        {data.can_grade ? (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              try {
                const saved = await assessments.grade(
                  data.code,
                  data.revision,
                  Object.entries(marks).map(([student_code, m]) => ({
                    student_code,
                    ...m,
                  })),
                );
                setData(saved);
                setMarks(saved.marks);
                await onSaved();
              } catch (e) {
                setError(errorText(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            <h3>Student marks</h3>
            <p>
              Leave ungraded students blank. Save marks to make them visible to
              students and parents.
            </p>
            <div className="assessment-table assessment-marks">
              <table>
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Marks / {data.max_marks}</th>
                    <th>Absent</th>
                    <th>Feedback</th>
                  </tr>
                </thead>
                <tbody>
                  {data.students?.map((s) => {
                    const m = marks[s.code] || {
                      marks: null,
                      absent: false,
                      feedback: "",
                    };
                    const change = (v: Partial<AssessmentMark>) =>
                      setMarks((all) => ({ ...all, [s.code]: { ...m, ...v } }));
                    return (
                      <tr key={s.code}>
                        <td>{s.name}</td>
                        <td>
                          <input
                            aria-label={`Marks for ${s.name}`}
                            type="number"
                            min="0"
                            max={data.max_marks}
                            step="0.01"
                            disabled={busy || m.absent}
                            value={m.marks ?? ""}
                            onChange={(e) =>
                              change({ marks: e.target.value || null })
                            }
                          />
                        </td>
                        <td>
                          <input
                            aria-label={`Absent ${s.name}`}
                            type="checkbox"
                            checked={m.absent}
                            disabled={busy}
                            onChange={(e) =>
                              change({
                                absent: e.target.checked,
                                marks: e.target.checked ? null : m.marks,
                              })
                            }
                          />
                        </td>
                        <td>
                          <textarea
                            aria-label={`Feedback for ${s.name}`}
                            value={m.feedback}
                            disabled={busy}
                            onChange={(e) =>
                              change({ feedback: e.target.value })
                            }
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <button
              className="edu-primary"
              disabled={busy || !Object.keys(marks).length}
            >
              {busy ? "Saving…" : "Save & publish marks"}
            </button>
          </form>
        ) : (
          data.students?.map((s) => (
            <p key={s.code}>
              {s.name}:{" "}
              {s.mark?.absent
                ? "Absent"
                : s.mark?.marks !== null && s.mark?.marks !== undefined
                  ? `${s.mark.marks} / ${data.max_marks}`
                  : "Marks pending"}
              <br />
              {s.mark?.feedback}
            </p>
          ))
        )}
        {error && (
          <p role="alert" className="edu-error">
            {error}
          </p>
        )}
      </div>
    </SideDrawer>
  );
}
