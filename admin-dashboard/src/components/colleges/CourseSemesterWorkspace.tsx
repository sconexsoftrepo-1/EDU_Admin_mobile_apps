"use client";
import WorkspaceSkeleton from "./WorkspaceSkeleton";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import {
  Pencil,
  Plus,
  RefreshCw,
  BookOpen,
  FlaskConical,
  Check,
  X,
  Layers,
} from "lucide-react";
import {
  courseWorkspace,
  type CourseWorkspace,
  type CurriculumItem,
} from "@/services/api/modules/assessments/service";
import { errorText, type Row } from "@/services/api";
import Select from "./SearchSelect";
import SearchField, { searchValues } from "./SearchField";
import "./course-semester-workspace.css";
type Edit = {
  code: string;
  name: string;
  subject_type: string;
  credits: string;
};
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
export default function CourseSemesterWorkspace({ course }: { course: Row }) {
  const code = String(course.code);
  const intermediate =
    course.course_level === "intermediate" ||
    course.qualification === "Intermediate";
  const [data, setData] = useState<CourseWorkspace | null>(null),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [semester, setSemester] = useState(1),
    [query, setQuery] = useState(""),
    [year, setYear] = useState(""),
    [section, setSection] = useState(""),
    [busy, setBusy] = useState(false),
    [editing, setEditing] = useState<Edit | null>(null),
    [adding, setAdding] = useState(false),
    [faculty, setFaculty] = useState<Record<string, string>>({});
  const tabsId = useId();
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  useEffect(() => {
    let active = true;
    courseWorkspace
      .get(code)
      .then((r) => {
        if (active) {
          setData(r);
          if (r.academic_years.length === 1) setYear(r.academic_years[0].code);
        }
      })
      .catch((e) => {
        if (active) setError(errorText(e));
      });
    return () => {
      active = false;
    };
  }, [code]);
  async function refresh() {
    setBusy(true);
    setError("");
    try {
      setData(await courseWorkspace.get(code));
      setEditing(null);
      setFaculty({});
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  const semesterName = (n: number) =>
    intermediate
      ? `${Math.floor((n - 1) / 2) + 1}-${((n - 1) % 2) + 1}`
      : `Semester ${n}`;
  const semesters = Array.from(
    { length: Number(course.duration_semesters) || 4 },
    (_, i) => i + 1,
  );
  const rows = (data?.items || []).filter(
    (s) => s.semester_number === semester,
  );
  const filtered = rows.filter((s) =>
    s.name.toLowerCase().includes(query.toLowerCase()),
  );
  const yearSections = (data?.sections || []).filter(
    (s) => s.academic_year_code === year,
  );
  const sections = yearSections.filter(
    (s) => !s.semester_number || s.semester_number === semester,
  );
  // One class for this semester is the active class; a batch without any section allocates
  // to the whole batch (the backend creates its section on the first allocation).
  const activeSection =
    sections.length === 1
      ? sections[0].code
      : sections.some((s) => s.code === section)
        ? section
        : "";
  const batchWide = !!year && !yearSections.length;
  const scopeReady = !!activeSection || batchWide;
  const offering = (subject: CurriculumItem) =>
    activeSection
      ? data?.offerings.find(
          (o) =>
            o.section_code === activeSection &&
            o.subject_code === subject.subject_code,
        )
      : undefined;
  const allocated = rows.filter((s) => offering(s)).length;
  const teacherName = (teacher?: string) =>
    data?.teachers.find((t) => t.code === teacher)?.name || teacher || "";
  function chooseSemester(n: number) {
    setSemester(n);
    setSection("");
    setQuery("");
    setEditing(null);
    setAdding(false);
    setFaculty({});
    setMessage("");
  }
  function tabKeys(event: KeyboardEvent<HTMLDivElement>) {
    const index = semesters.indexOf(semester);
    const next =
      event.key === "ArrowRight"
        ? (index + 1) % semesters.length
        : event.key === "ArrowLeft"
          ? (index - 1 + semesters.length) % semesters.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? semesters.length - 1
              : -1;
    if (next < 0 || busy) return;
    event.preventDefault();
    chooseSemester(semesters[next]);
    tabRefs.current[next]?.focus();
    tabRefs.current[next]?.scrollIntoView({
      block: "nearest",
      inline: "nearest",
    });
  }
  async function saveSubject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data) return;
    const f = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const body = {
        revision: data.revision,
        name: f.get("subject_name"),
        subject_type: f.get("subject_type"),
        credits: f.get("credits"),
      };
      setData(
        editing
          ? await courseWorkspace.edit(code, editing.code, body)
          : await courseWorkspace.add(code, {
              ...body,
              semester_number: semester,
            }),
      );
      setEditing(null);
      setAdding(false);
      setMessage("Semester subject plan saved.");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function assign(subject: CurriculumItem) {
    if (!data || !year || !scopeReady) return;
    const old = offering(subject);
    setBusy(true);
    setError("");
    setMessage("");
    try {
      setData(
        await courseWorkspace.assign(code, {
          revision: data.allocation_revision,
          academic_year_code: year,
          section_code: activeSection || null,
          subject_code: subject.subject_code,
          teacher_code: faculty[subject.subject_code],
          expected_teacher_code: old?.teacher_code || null,
        }),
      );
      setFaculty((all) => {
        const next = { ...all };
        delete next[subject.subject_code];
        return next;
      });
      setMessage(`Faculty allocation saved for ${subject.name}.`);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  function editor(value: Edit | null) {
    return (
      <form className="cs-inline-form" onSubmit={saveSubject}>
        <label>
          Subject / lab name *
          <input
            name="subject_name"
            aria-label="Subject or lab name"
            defaultValue={value?.name || ""}
            required
            maxLength={180}
            disabled={busy}
          />
        </label>
        <label>
          Type
          <Select
            name="subject_type"
            defaultValue={value?.subject_type || "theory"}
            disabled={busy}
          >
            <option value="theory">Theory</option>
            <option value="practical">Lab / practical</option>
            <option value="project">Project</option>
            <option value="elective">Elective</option>
          </Select>
        </label>
        <label>
          Credits
          <input
            name="credits"
            aria-label="Credits"
            type="number"
            min="0"
            max="40"
            step="0.01"
            defaultValue={value?.credits || "3"}
            required
            disabled={busy}
          />
        </label>
        <div className="cs-edit-actions">
          <button type="submit" disabled={busy}>
            <Check size={15} />
            Save
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setAdding(false);
              setEditing(null);
            }}
          >
            <X size={15} />
            Cancel
          </button>
        </div>
      </form>
    );
  }
  const sectionName = sections.find((s) => s.code === activeSection)?.name;
  const labs = rows.filter((s) => s.subject_type === "practical").length;
  const theory = rows.length - labs;
  const credits = rows.reduce((sum, s) => sum + Number(s.credits || 0), 0);
  return (
    <section
      className="crs-panel-section cs-workspace"
      aria-label="Semester subjects and faculty"
    >
      <header className="cs-heading">
        <div>
          <h3>Semester subjects & labs</h3>
          <p>Review each semester and allocate faculty to its class.</p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={busy}
          aria-label="Refresh semester subjects"
        >
          <RefreshCw size={17} />
        </button>
      </header>
      {error && (
        <p role="alert" className="cs-error">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="cs-status">
          {message}
        </p>
      )}
      {!data ? (
        error ? (
          <p>Use Refresh to retry.</p>
        ) : (
          <WorkspaceSkeleton compact label="Loading semester subjects" />
        )
      ) : (
        <>
          <div
            className="cs-tabs"
            role="tablist"
            aria-label="Course semesters"
            onKeyDown={tabKeys}
          >
            {semesters.map((n, i) => {
              const count = data.items.filter(
                (s) => s.semester_number === n,
              ).length;
              return (
                <button
                  type="button"
                  key={n}
                  ref={(node) => {
                    tabRefs.current[i] = node;
                  }}
                  id={`${tabsId}-tab-${n}`}
                  role="tab"
                  aria-selected={semester === n}
                  aria-controls={`${tabsId}-panel`}
                  tabIndex={semester === n ? 0 : -1}
                  aria-label={`${semesterName(n)}, ${plural(count, "item")}`}
                  disabled={busy}
                  onClick={() => chooseSemester(n)}
                >
                  <span aria-hidden="true">
                    {intermediate ? (
                      semesterName(n)
                    ) : (
                      <>
                        Sem<span className="cs-tab-long">ester</span> {n}
                      </>
                    )}
                  </span>
                  <small aria-hidden="true">{count}</small>
                </button>
              );
            })}
          </div>
          <div
            className="cs-panel"
            role="tabpanel"
            id={`${tabsId}-panel`}
            aria-labelledby={`${tabsId}-tab-${semester}`}
          >
            {intermediate && (
              <p className="cs-note">1-2 means first year, second semester.</p>
            )}
            {data.status === "starter_draft" && (
              <p className="cs-note">
                Generated starter draft · verify against the approved syllabus.
              </p>
            )}
            <div className="cs-scope">
              <label>
                Academic batch
                <Select
                  value={year}
                  disabled={busy}
                  onChange={(e) => {
                    setYear(e.target.value);
                    setSection("");
                    setFaculty({});
                  }}
                >
                  <option value="">Select academic batch</option>
                  {data.academic_years.map((y) => (
                    <option key={y.code} value={y.code}>
                      {y.name}
                    </option>
                  ))}
                </Select>
              </label>
              {sections.length > 1 ? (
                <label>
                  Class / section
                  <Select
                    value={activeSection}
                    disabled={busy}
                    onChange={(e) => {
                      setSection(e.target.value);
                      setFaculty({});
                    }}
                  >
                    <option value="">Select section</option>
                    {sections.map((s) => (
                      <option key={s.code} value={s.code}>
                        {s.name}
                      </option>
                    ))}
                  </Select>
                </label>
              ) : (
                <div className="cs-scope-field">
                  <span>Class / section</span>
                  <div
                    className={`cs-scope-static ${scopeReady ? "is-active" : ""}`}
                    role="status"
                  >
                    <Layers size={16} aria-hidden="true" />
                    <strong>
                      {!year
                        ? "Select a batch first"
                        : sectionName
                          ? `Section ${sectionName}`
                          : batchWide
                            ? "Whole batch"
                            : "No section this semester"}
                    </strong>
                    {scopeReady && <em>Active</em>}
                  </div>
                </div>
              )}
            </div>
            {batchWide && (
              <p className="cs-note">
                This batch has no sections, so it is treated as one class. Its
                section is created when you assign the first faculty.
              </p>
            )}
            {year && !scopeReady && !sections.length && (
              <p className="cs-note">
                No section of this batch belongs to {semesterName(semester)}.
                Add a class section before allocating faculty.
              </p>
            )}
            <div className="cs-toolbar">
              <div className="cs-summary" aria-label="Semester summary">
                {(
                  [
                    [theory, "subject"],
                    [labs, "lab"],
                    [credits, "credit"],
                  ] as const
                ).map(([n, word]) => (
                  <span key={word}>
                    <strong>{n}</strong> {word}
                    {n === 1 ? "" : "s"}
                  </span>
                ))}
                {scopeReady && rows.length > 0 && (
                  <span className="cs-summary-progress">
                    <strong>
                      {allocated}/{rows.length}
                    </strong>{" "}
                    faculty assigned
                  </span>
                )}
              </div>
              <div className="cs-tools">
                <SearchField
                  aria-label="Search semester subjects"
                  placeholder="Search subjects or labs"
                  value={query}
                  onValueChange={setQuery}
                  suggestions={searchValues(rows, ["name"])}
                />
                {data.can_edit && (
                  <button
                    type="button"
                    disabled={busy || adding || !!editing}
                    onClick={() => setAdding(true)}
                  >
                    <Plus size={16} />
                    Add subject / lab
                  </button>
                )}
              </div>
            </div>
            {adding && editor(null)}
            <ul className="cs-subjects">
              {filtered.map((subject) => {
                const current = offering(subject);
                const selected =
                  faculty[subject.subject_code] ?? current?.teacher_code ?? "";
                return (
                  <li key={subject.code || subject.subject_code}>
                    {editing?.code === subject.code ? (
                      editor(editing)
                    ) : (
                      <>
                        <div className="cs-subject-name">
                          {subject.subject_type === "practical" ? (
                            <FlaskConical size={18} />
                          ) : (
                            <BookOpen size={18} />
                          )}
                          <div>
                            <strong>{subject.name}</strong>
                            <div className="cs-subject-meta">
                              <small>
                                {subject.subject_type === "practical"
                                  ? "Lab / practical"
                                  : subject.subject_type}{" "}
                                · {subject.credits || 0} credits
                              </small>
                              {scopeReady && (
                                <span
                                  className={`cs-pill ${current ? "is-assigned" : ""}`}
                                >
                                  {current ? "Assigned" : "Unassigned"}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="cs-faculty-row">
                          {data.can_assign ? (
                            <>
                              <Select
                                aria-label={`Faculty for ${subject.name}`}
                                disabled={busy || !scopeReady}
                                value={selected}
                                onChange={(e) =>
                                  setFaculty((all) => ({
                                    ...all,
                                    [subject.subject_code]: e.target.value,
                                  }))
                                }
                              >
                                <option value="">
                                  {scopeReady
                                    ? "Select faculty"
                                    : year
                                      ? "Select a section first"
                                      : "Choose a batch first"}
                                </option>
                                {data.teachers.map((t) => (
                                  <option key={t.code} value={t.code}>
                                    {t.name}
                                  </option>
                                ))}
                                {current &&
                                  !data.teachers.some(
                                    (t) => t.code === current.teacher_code,
                                  ) && (
                                    <option value={current.teacher_code}>
                                      {current.teacher_code} (inactive)
                                    </option>
                                  )}
                              </Select>
                              <button
                                type="button"
                                disabled={
                                  busy ||
                                  !scopeReady ||
                                  !selected ||
                                  selected === current?.teacher_code
                                }
                                onClick={() => void assign(subject)}
                              >
                                {current ? "Update" : "Assign"}
                              </button>
                            </>
                          ) : (
                            <span className="cs-faculty-readonly">
                              {scopeReady
                                ? teacherName(current?.teacher_code) ||
                                  "Unassigned"
                                : "Select a batch and section to view allocations"}
                            </span>
                          )}
                        </div>
                        {data.can_edit && subject.code && (
                          <button
                            type="button"
                            className="cs-edit"
                            disabled={busy || adding || !!editing}
                            aria-label={`Edit ${subject.name}`}
                            onClick={() =>
                              setEditing({
                                code: subject.code!,
                                name: subject.name,
                                subject_type: subject.subject_type,
                                credits: subject.credits || "0",
                              })
                            }
                          >
                            <Pencil size={15} />
                          </button>
                        )}
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
            {!filtered.length && (
              <p className="cs-note">
                {rows.length
                  ? "No matching subjects."
                  : "No subjects or labs in this semester yet."}
              </p>
            )}
          </div>
        </>
      )}
    </section>
  );
}
