"use client";
import WorkspaceSkeleton from "./WorkspaceSkeleton";
import { useEffect, useState, type FormEvent } from "react";
import {
  Pencil,
  Plus,
  RefreshCw,
  BookOpen,
  FlaskConical,
  Check,
  X,
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
  useEffect(() => {
    let active = true;
    courseWorkspace
      .get(code)
      .then((r) => {
        if (active) {
          setData(r);
          if (r.academic_years.length === 1) {
            setYear(r.academic_years[0].code);
            const eligible = r.sections.filter(
              (s) =>
                s.academic_year_code === r.academic_years[0].code &&
                (!s.semester_number || s.semester_number === 1),
            );
            if (eligible.length === 1) setSection(eligible[0].code);
          }
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
  const rows = (data?.items || []).filter(
    (s) => s.semester_number === semester,
  );
  const filtered = rows.filter((s) =>
    s.name.toLowerCase().includes(query.toLowerCase()),
  );
  const sections = (data?.sections || []).filter(
    (s) =>
      s.academic_year_code === year &&
      (!s.semester_number || s.semester_number === semester),
  );
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
    if (!data || !year || !section) return;
    const old = data.offerings.find(
      (o) =>
        o.section_code === section && o.subject_code === subject.subject_code,
    );
    setBusy(true);
    setError("");
    setMessage("");
    try {
      setData(
        await courseWorkspace.assign(code, {
          revision: data.allocation_revision,
          academic_year_code: year,
          section_code: section,
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
        error ? <p>Use Refresh to retry.</p> : <WorkspaceSkeleton compact label="Loading semester subjects" />
      ) : (
        <>
          <nav className="cs-tabs" role="tablist" aria-label="Course semesters">
            {Array.from(
              { length: Number(course.duration_semesters) || 4 },
              (_, i) => i + 1,
            ).map((n) => (
              <button
                type="button"
                key={n}
                role="tab"
                aria-selected={semester === n}
                disabled={busy}
                onClick={() => {
                  setSemester(n);
                  setSection("");
                  setQuery("");
                  setEditing(null);
                  setAdding(false);
                  setFaculty({});
                  setMessage("");
                }}
              >
                {semesterName(n)}
              </button>
            ))}
          </nav>
          {intermediate && (
            <p className="cs-note">1-2 means first year, second semester.</p>
          )}
          {data.status === "starter_draft" && (
            <p className="cs-note">
              Generated starter draft · verify against the approved syllabus.
            </p>
          )}
          <div className="cs-summary">
            <strong>
              {rows.filter((s) => s.subject_type !== "practical").length}{" "}
              subjects
            </strong>
            <strong>
              {rows.filter((s) => s.subject_type === "practical").length} labs
            </strong>
            <span>
              {rows.reduce((sum, s) => sum + Number(s.credits || 0), 0)} credits
            </span>
          </div>
          <div className="cs-faculty-scope">
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
            <label>
              Class / section
              <Select
                value={section}
                disabled={busy || !year}
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
          </div>
          {year && !sections.length && (
            <p className="cs-note">
              No sections are configured for this batch and semester. Add a
              class section before allocating faculty.
            </p>
          )}
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
          {adding && editor(null)}
          <ul className="cs-subjects">
            {filtered.map((subject) => {
              const current = data.offerings.find(
                (o) =>
                  o.section_code === section &&
                  o.subject_code === subject.subject_code,
              );
              const selected =
                faculty[subject.subject_code] ?? current?.teacher_code ?? "";
              return (
                <li key={subject.code || subject.subject_code}>
                  {editing?.code === subject.code ? (
                    editor(editing)
                  ) : (
                    <>
                      <div className="cs-subject-main">
                        <div className="cs-subject-name">
                          {subject.subject_type === "practical" ? (
                            <FlaskConical size={19} />
                          ) : (
                            <BookOpen size={19} />
                          )}
                          <div>
                            <strong>{subject.name}</strong>
                            <small>
                              {subject.subject_type === "practical"
                                ? "Lab / practical"
                                : subject.subject_type}{" "}
                              · {subject.credits || 0} credits
                            </small>
                          </div>
                        </div>
                        {data.can_edit && subject.code && (
                          <button
                            type="button"
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
                      </div>
                      <div className="cs-faculty-row">
                        {data.can_assign ? (
                          <>
                            <label>
                              Faculty
                              <Select
                                aria-label={`Faculty for ${subject.name}`}
                                disabled={busy || !section}
                                value={selected}
                                onChange={(e) =>
                                  setFaculty((all) => ({
                                    ...all,
                                    [subject.subject_code]: e.target.value,
                                  }))
                                }
                              >
                                <option value="">
                                  {section
                                    ? "Select faculty"
                                    : "Choose batch & section first"}
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
                            </label>
                            <button
                              type="button"
                              disabled={
                                busy ||
                                !section ||
                                !selected ||
                                selected === current?.teacher_code
                              }
                              onClick={() => void assign(subject)}
                            >
                              Assign faculty
                            </button>
                          </>
                        ) : (
                          <span>
                            Faculty:{" "}
                            {section
                              ? data.teachers.find(
                                  (t) => t.code === current?.teacher_code,
                                )?.name ||
                                current?.teacher_code ||
                                "Unassigned"
                              : "Select a batch and section to view allocations"}
                          </span>
                        )}
                      </div>
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
        </>
      )}
    </section>
  );
}
