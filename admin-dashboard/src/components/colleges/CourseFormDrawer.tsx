"use client";
import { COURSE_LEVELS } from "@/lib/colleges/course-levels";

import { useId, useState, type FormEvent } from "react";
import type { Row } from "@/services/api";
import SideDrawer from "./SideDrawer";
import { toast } from "./toast";

type Subject = { name: string; semester_number: number; subject_type: string };
type Props = {
  title: string;
  initial?: Row;
  onSave: (row: Row) => Promise<void>;
  onClose: () => void;
};
export default function CourseFormDrawer({
  title,
  initial = {},
  onSave,
  onClose,
}: Props) {
  const id = useId();
  const editing = !!initial.code;
  const [level, setLevel] = useState(String(initial.course_level || ""));
  const [courseCode, setCourseCode] = useState(
    String(initial.branch_code || ""),
  );
  const prefix =
    COURSE_LEVELS.find((l) => l.key === level)?.code || "";
  const [years, setYears] = useState(
    String(
      initial.duration_years || Number(initial.duration_semesters || 4) / 2,
    ),
  );
  const [count, setCount] = useState(Number(initial.duration_semesters || 4));
  const [labels, setLabels] = useState<string[]>(
    Array.isArray(initial.semester_labels)
      ? initial.semester_labels.map(String)
      : [],
  );
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [draft, setDraft] = useState("");
  const [semester, setSemester] = useState(1);
  const [kind, setKind] = useState("theory");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const semesterLabel = (n: number) =>
    labels[n - 1] ??
    (level === "intermediate"
      ? `${Math.floor((n - 1) / 2) + 1}-${((n - 1) % 2) + 1}`
      : `Semester ${n}`);
  function addSubject() {
    const name = draft.trim();
    if (!name) return;
    if (
      subjects.some(
        (s) =>
          s.semester_number === semester &&
          s.name.toLowerCase() === name.toLowerCase(),
      )
    ) {
      setError("This subject is already added to this semester.");
      return;
    }
    setSubjects([
      ...subjects,
      { name, semester_number: semester, subject_type: kind },
    ]);
    setDraft("");
    setError("");
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (draft.trim()) {
      setError("Add the pending subject before saving.");
      return;
    }
    if (subjects.some((s) => s.semester_number > count)) {
      setError(
        "Remove subjects from later semesters before reducing the count.",
      );
      return;
    }
    const form = new FormData(event.currentTarget);
    const row: Row = {
      course_level: level,
      branch: String(form.get("branch") || "").trim(),
      branch_code: String(form.get("branch_code") || "")
        .trim()
        .toUpperCase(),
      duration_years: Number(years),
      duration_semesters: count,
      semester_labels: Array.from({ length: count }, (_, i) =>
        semesterLabel(i + 1).trim(),
      ),
      details: String(form.get("details") || "").trim(),
    };
    if (!editing) row.subject_entries = subjects;
    setBusy(true);
    setError("");
    try {
      await onSave(row);
      toast.success(editing ? "Course updated" : "Course created");
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save course");
    } finally {
      setBusy(false);
    }
  }
  return (
    <SideDrawer
      title={title}
      subtitle="Set the course duration, semester labels and subjects."
      onClose={() => !busy && onClose()}
      actions={
        <button type="submit" form={id} disabled={busy}>
          {busy ? "Saving…" : editing ? "Save changes" : "Create course"}
        </button>
      }
    >
      <form
        id={id}
        className="edu-drawer-form"
        onSubmit={save}
        aria-busy={busy}
      >
        <fieldset disabled={busy} className="edu-form-section">
          <legend>Course details</legend>
          <div className="edu-field-grid">
            <label>
              Course level *
              <select
                required
                value={level}
                onChange={(e) => setLevel(e.target.value)}
              >
                <option value="">Select course level</option>
                {COURSE_LEVELS.map((l) => (
                  <option key={l.key} value={l.key}>
                    {l.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Course name *
              <input
                required
                name="branch"
                defaultValue={String(initial.branch || "")}
              />
            </label>
            <label>
              Course code *
              <input
                required
                name="branch_code"
                maxLength={40}
                pattern="[A-Za-z0-9]+"
                value={courseCode}
                onChange={(event) =>
                  setCourseCode(event.target.value.toUpperCase())
                }
                placeholder="e.g. HAC"
              />
              <small aria-live="polite">
                {editing
                  ? `Course ID: ${initial.code}`
                  : prefix && courseCode.trim()
                    ? `Course ID: ${prefix}-${courseCode.trim()}`
                    : "Select a level and enter a course code"}
              </small>
            </label>
            <label>
              Duration (years) *
              <input
                required
                type="number"
                min="0.5"
                max="20"
                step="0.5"
                value={years}
                onChange={(e) => setYears(e.target.value)}
              />
              <small>
                {years
                  ? `${years} ${Number(years) === 1 ? "year" : "years"}`
                  : "Duration label is generated automatically"}
              </small>
            </label>
            <label>
              Number of semesters *
              <input
                required
                type="number"
                min={1}
                max={16}
                value={count || ""}
                onChange={(e) =>
                  setCount(Math.min(16, Math.max(0, Number(e.target.value))))
                }
              />
            </label>
            {Array.from({ length: count }, (_, i) => (
              <label key={i}>
                Semester {i + 1} label *
                <input
                  required
                  maxLength={100}
                  value={semesterLabel(i + 1)}
                  onChange={(e) =>
                    setLabels(
                      Array.from({ length: count }, (_, j) =>
                        j === i ? e.target.value : semesterLabel(j + 1),
                      ),
                    )
                  }
                />
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset disabled={busy} className="edu-form-section">
          <legend>Subjects</legend>
          {editing ? (
            <p>
              Manage subjects, theory/practical types and teacher assignments in
              this course’s semester workspace.
            </p>
          ) : (
            <>
              <div className="edu-field-grid">
                <label>
                  Semester
                  <select
                    value={semester}
                    onChange={(e) => setSemester(Number(e.target.value))}
                  >
                    {Array.from({ length: count }, (_, i) => (
                      <option key={i} value={i + 1}>
                        {semesterLabel(i + 1)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Subject type
                  <select
                    value={kind}
                    onChange={(e) => setKind(e.target.value)}
                  >
                    <option value="theory">Theory</option>
                    <option value="practical">Practical / lab</option>
                  </select>
                </label>
                <label className="edu-field-wide">
                  Subject
                  <input
                    maxLength={180}
                    value={draft}
                    placeholder="Enter a subject and press Enter"
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addSubject();
                      }
                    }}
                  />
                </label>
              </div>
              <button
                type="button"
                disabled={!draft.trim() || !count || semester > count}
                onClick={addSubject}
              >
                Add subject
              </button>
              <ul>
                {subjects.map((s, i) => (
                  <li key={`${s.semester_number}-${s.name}`}>
                    {s.name} · {semesterLabel(s.semester_number)} ·{" "}
                    {s.subject_type}{" "}
                    <button
                      type="button"
                      aria-label={`Remove ${s.name}`}
                      onClick={() =>
                        setSubjects(subjects.filter((_, j) => j !== i))
                      }
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
              <p>
                Subjects will appear in semester management, where teachers can
                be assigned later.
              </p>
            </>
          )}
        </fieldset>
        <label className="edu-field-wide">
          Details
          <textarea
            name="details"
            rows={4}
            defaultValue={String(initial.details || "")}
          />
        </label>
        {error && <p role="alert">{error}</p>}
      </form>
    </SideDrawer>
  );
}
