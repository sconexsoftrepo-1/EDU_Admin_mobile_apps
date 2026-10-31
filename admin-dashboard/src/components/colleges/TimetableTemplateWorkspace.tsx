"use client";
import SearchField, { searchValues } from "./SearchField";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  BookOpen,
  Check,
  ChevronDown,
  Copy,
  FilePlus2,
  FlaskConical,
  LoaderCircle,
  Plus,
  Printer,
  RotateCcw,
  Save,
  Trash2,
  Undo2,
} from "lucide-react";
import type { College } from "@/data/colleges";
import { errorText } from "@/services/api";
import {
  addDayEdge,
  createTimetable,
  removePeriod,
  timetableApi,
  timetablePayload,
  type TemplateKind,
  type TimetableDraft,
  type TimetableList,
  type TimetableOptions,
  type TimetableRecord,
} from "@/lib/colleges/timetable-templates";
import TimetableCanvas from "./TimetableCanvas";
import "./timetable-templates.css";

export default function TimetableTemplateWorkspace({
  college,
}: {
  college: College;
}) {
  const [options, setOptions] = useState<TimetableOptions>({
    courses: [],
    batches: [],
  });
  const [records, setRecords] = useState<TimetableList>({
    items: [],
    can_create: false,
    can_edit: false,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [level, setLevel] = useState<TemplateKind>("intermediate");
  const [program, setProgram] = useState("");
  const [batch, setBatch] = useState("");
  const [draft, setDraft] = useState<TimetableDraft | null>(null);
  const [code, setCode] = useState<string>();
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [history, setHistory] = useState<TimetableDraft[]>([]);
  const pristine = useRef<TimetableDraft | null>(null);
  const canWrite = code ? records.can_edit : records.can_create;
  const readOnly = saving || !canWrite;
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [choices, saved] = await Promise.all([
        timetableApi.options(),
        timetableApi.list(),
      ]);
      setOptions(choices);
      setRecords(saved);
    } catch (e) {
      setError(`Could not load timetables. ${errorText(e)}`);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const discard = () =>
    !dirty || window.confirm("Discard unsaved timetable changes?");
  function change(value: TimetableDraft) {
    if (draft) setHistory((old) => [...old.slice(-59), draft]);
    setDraft(value);
    setDirty(true);
    setNotice("");
  }
  function open(record: TimetableRecord) {
    if (!discard()) return;
    const value = timetablePayload(record);
    setCode(record.code);
    setDraft(value);
    pristine.current = value;
    setHistory([]);
    setDirty(false);
    setLevel(value.template);
    setProgram(value.program_code);
    setBatch(value.batch_code);
    setError("");
    setNotice("");
  }
  function create() {
    if (!program || !batch || !discard()) return;
    const course = options.courses.find((c) => c.code === program);
    const value = {
      ...createTimetable(level),
      program_code: program,
      batch_code: batch,
      name: `${course?.name || "Class"} · Weekly timetable`,
    };
    setDraft(value);
    setCode(undefined);
    pristine.current = value;
    setHistory([]);
    setDirty(true);
    setError("");
    setNotice("");
  }
  async function save(status: TimetableDraft["status"]) {
    if (!draft || saving) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const saved = await timetableApi.save({ ...draft, status }, code);
      const value = timetablePayload(saved);
      setCode(saved.code);
      setDraft(value);
      pristine.current = value;
      setDirty(false);
      setHistory([]);
      setRecords((old) => ({
        ...old,
        items: [saved, ...old.items.filter((r) => r.code !== saved.code)],
      }));
      setNotice(
        status === "Published"
          ? "Timetable published."
          : "Draft saved. You can reopen it from Saved timetables.",
      );
    } catch (e) {
      setError(errorText(e));
    } finally {
      setSaving(false);
    }
  }
  function addPeriod(
    kind: "teaching" | "break" | "lunch",
    edge: "morning" | "evening" = "evening",
  ) {
    if (!draft) return;
    try {
      change(addDayEdge(draft, edge, kind));
      setError("");
    } catch (e) {
      setError(errorText(e));
    }
  }
  const course = options.courses.find((c) => c.code === draft?.program_code);
  const selectedBatch = options.batches.find(
    (b) => b.code === draft?.batch_code,
  );
  const courses = options.courses.filter((c) => c.course_level === level);
  const batches = options.batches.filter((b) => b.program_code === program);
  const filtered = records.items.filter((r) =>
    `${r.name} ${r.course_name} ${r.batch_name} ${r.section}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <section className="tt-workspace tt-studio">
      <header className="tt-page-header">
        <div>
          <h2>Timetable studio</h2>
          <p>Choose a class. Shape the week. Edit directly in the timetable.</p>
        </div>
        <span className="tt-record-count">
          {records.items.length} saved timetable
          {records.items.length !== 1 ? "s" : ""}
        </span>
      </header>
      {error && (
        <div className="tt-feedback tt-error" role="alert">
          {error}
          {!draft && (
            <button type="button" onClick={() => void load()}>
              Retry
            </button>
          )}
        </div>
      )}
      {notice && (
        <div className="tt-feedback tt-success" role="status">
          <Check size={16} />
          {notice}
        </div>
      )}
      {loading ? (
        <div className="tt-loading">
          <LoaderCircle className="tt-spinner" size={20} />
          Loading courses and saved timetables…
        </div>
      ) : (
        <>
          {records.can_create && (
            <section className="tt-setup" aria-label="Create a timetable">
              <div className="tt-setup-heading">
                <h3>Start with a template</h3>
                <p>
                  Both layouts are fully editable. Blank boxes are ready for
                  your subjects.
                </p>
              </div>
              <div className="tt-template-choices">
                {(["intermediate", "degree"] as const).map((kind) => (
                  <button
                    type="button"
                    key={kind}
                    aria-pressed={level === kind}
                    className={`tt-template-choice${level === kind ? " is-active" : ""}`}
                    onClick={() => {
                      setLevel(kind);
                      setProgram("");
                      setBatch("");
                    }}
                  >
                    <span
                      className={`tt-miniature tt-mini-${kind}`}
                      aria-hidden="true"
                    >
                      {Array.from({ length: 24 }, (_, i) => (
                        <i key={i} />
                      ))}
                    </span>
                    <span>
                      {kind === "intermediate" ? (
                        <BookOpen size={18} />
                      ) : (
                        <FlaskConical size={18} />
                      )}
                      <strong>
                        {kind === "intermediate" ? "Intermediate" : "Degree"}
                      </strong>
                      <small>
                        {kind === "intermediate"
                          ? "Regular periods with room for practicals"
                          : "Extended labs, theory & activities"}
                      </small>
                    </span>
                    {level === kind && (
                      <Check size={18} className="tt-template-check" />
                    )}
                  </button>
                ))}
              </div>
              <div className="tt-create-fields">
                <label>
                  Course
                  <select
                    aria-label="Timetable course"
                    value={program}
                    onChange={(e) => {
                      setProgram(e.target.value);
                      setBatch("");
                    }}
                  >
                    <option value="">Select a course</option>
                    {courses.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Batch year
                  <select
                    aria-label="Timetable batch year"
                    value={batch}
                    disabled={!program}
                    onChange={(e) => setBatch(e.target.value)}
                  >
                    <option value="">Select a batch</option>
                    {batches.map((b) => (
                      <option key={b.code} value={b.code}>
                        {b.name}
                        {b.entry_year
                          ? ` · ${b.entry_year}–${b.graduation_year}`
                          : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="tt-primary"
                  disabled={!program || !batch || saving}
                  onClick={create}
                >
                  <FilePlus2 size={17} />
                  Create timetable
                </button>
              </div>
              {!courses.length && (
                <p className="tt-empty-hint">
                  No {level} courses are registered yet. Add the course and its
                  batch in Course setup first.
                </p>
              )}
              {program && !batches.length && (
                <p className="tt-empty-hint">
                  This course has no batches yet. Add a batch in Course setup
                  first.
                </p>
              )}
            </section>
          )}
          {draft && (
            <section className="tt-editor" aria-label="Timetable editor">
              <div className="tt-editor-toolbar">
                <div>
                  <span
                    className={`tt-status tt-status-${draft.status.toLowerCase()}`}
                  >
                    {dirty ? "Unsaved changes" : draft.status}
                  </span>
                  <span>
                    {code ? `Revision ${draft.revision}` : "New timetable"}
                  </span>
                </div>
                <div>
                  {canWrite && (
                    <>
                      <button
                        type="button"
                        disabled={!history.length || saving}
                        onClick={() => {
                          const previous = history.at(-1);
                          setHistory((old) => old.slice(0, -1));
                          if (previous) {
                            setDraft(previous);
                            setDirty(true);
                          }
                        }}
                      >
                        <Undo2 size={15} />
                        Undo
                      </button>
                      <button
                        type="button"
                        disabled={!dirty || saving}
                        onClick={() => {
                          if (discard() && pristine.current) {
                            setDraft(pristine.current);
                            setHistory([]);
                            setDirty(false);
                            setError("");
                          }
                        }}
                      >
                        <RotateCcw size={15} />
                        Discard changes
                      </button>
                    </>
                  )}
                  {records.can_create && (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => {
                        if (discard()) {
                          setCode(undefined);
                          setDraft({
                            ...draft,
                            name: `${draft.name} (copy)`,
                            revision: 0,
                            status: "Draft",
                          });
                          setHistory([]);
                          setDirty(true);
                          setNotice("");
                        }
                      }}
                    >
                      <Copy size={15} />
                      Duplicate
                    </button>
                  )}
                  <button type="button" onClick={() => window.print()}>
                    <Printer size={15} />
                    Print / PDF
                  </button>
                  {canWrite && (
                    <>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => void save("Draft")}
                      >
                        <Save size={15} />
                        Save draft
                      </button>
                      <button
                        type="button"
                        className="tt-primary"
                        disabled={saving}
                        onClick={() => void save("Published")}
                      >
                        {saving ? (
                          <LoaderCircle size={15} className="tt-spinner" />
                        ) : (
                          <Check size={15} />
                        )}
                        Publish timetable
                      </button>
                    </>
                  )}
                </div>
              </div>
              <div className="tt-sheet-heading">
                <span>{college.name}</span>
                <input
                  aria-label="Timetable title"
                  readOnly={readOnly}
                  value={draft.name}
                  onChange={(e) => change({ ...draft, name: e.target.value })}
                />
                <p>
                  {course?.name || draft.program_code} ·{" "}
                  {selectedBatch?.name || draft.batch_code}
                </p>
                <div className="tt-sheet-meta">
                  <label>
                    Year
                    <input
                      aria-label="Year of study"
                      type="number"
                      min={1}
                      max={10}
                      readOnly={readOnly}
                      value={draft.study_year}
                      onChange={(e) =>
                        change({ ...draft, study_year: Number(e.target.value) })
                      }
                    />
                  </label>
                  <label>
                    Semester
                    <input
                      aria-label="Timetable semester"
                      type="number"
                      min={1}
                      max={20}
                      readOnly={readOnly}
                      value={draft.semester}
                      onChange={(e) =>
                        change({ ...draft, semester: Number(e.target.value) })
                      }
                    />
                  </label>
                  <label>
                    Section
                    <input
                      aria-label="Timetable section"
                      readOnly={readOnly}
                      value={draft.section}
                      maxLength={40}
                      onChange={(e) =>
                        change({ ...draft, section: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Class coordinator
                    <input
                      aria-label="Class coordinator"
                      readOnly={readOnly}
                      value={draft.coordinator}
                      placeholder="Enter name"
                      maxLength={160}
                      onChange={(e) =>
                        change({ ...draft, coordinator: e.target.value })
                      }
                    />
                  </label>
                </div>
              </div>
              {!readOnly && (
                <p className="tt-instructions">
                  Click any text to edit. Change times on the left. Drag a box’s
                  bottom handle or use + / − to extend a class into empty
                  periods.
                </p>
              )}
              <TimetableCanvas
                draft={draft}
                readOnly={readOnly}
                change={change}
                onError={setError}
              />
              {!readOnly && (
                <details className="tt-period-settings">
                  <summary>
                    <ChevronDown size={16} />
                    Manage periods & breaks
                  </summary>
                  <p>
                    Changes apply to every day. Removing a period also removes
                    its class content.
                  </p>
                  <div className="tt-period-list">
                    {draft.periods.map((p, row) => (
                      <div key={row}>
                        <span>{row + 1}</span>
                        <input
                          aria-label={`Period ${row + 1} label`}
                          value={p.label}
                          onChange={(e) =>
                            change({
                              ...draft,
                              periods: draft.periods.map((v, i) =>
                                i === row ? { ...v, label: e.target.value } : v,
                              ),
                            })
                          }
                        />
                        <span>
                          {p.start}–{p.end}
                        </span>
                        <span>{p.kind}</span>
                        <button
                          type="button"
                          aria-label={`Remove period ${row + 1}`}
                          onClick={() => {
                            if (
                              window.confirm(
                                `Remove ${p.label || "this period"} and its class content?`,
                              )
                            ) {
                              try {
                                change(removePeriod(draft, row));
                              } catch (e) {
                                setError(errorText(e));
                              }
                            }
                          }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="tt-period-actions">
                    <button
                      type="button"
                      disabled={draft.periods.length >= 24}
                      onClick={() => addPeriod("teaching", "morning")}
                    >
                      <Plus size={15} />
                      Add morning period
                    </button>
                    <button
                      type="button"
                      disabled={draft.periods.length >= 24}
                      onClick={() => addPeriod("teaching")}
                    >
                      <Plus size={15} />
                      Add evening period
                    </button>
                    <button
                      type="button"
                      disabled={draft.periods.length >= 24}
                      onClick={() => addPeriod("break")}
                    >
                      <Plus size={15} />
                      Add break
                    </button>
                    <button
                      type="button"
                      disabled={draft.periods.length >= 24}
                      onClick={() => addPeriod("lunch")}
                    >
                      <Plus size={15} />
                      Add lunch
                    </button>
                  </div>
                </details>
              )}
            </section>
          )}
          <section className="tt-saved">
            <div className="tt-saved-heading">
              <div>
                <h3>Saved timetables</h3>
                <p>Reopen a draft or edit a published class timetable.</p>
              </div>
              <SearchField
                aria-label="Search saved timetables"
                placeholder="Search course, batch or section"
                value={search}
                onValueChange={setSearch}
                suggestions={searchValues(records.items, ["name", "course_name", "batch_name", "section"])}
              />
            </div>
            {!filtered.length ? (
              <div className="tt-empty">
                <BookOpen size={28} />
                <strong>
                  {records.items.length
                    ? "No matching timetables"
                    : "Your class timetables will appear here"}
                </strong>
                <p>
                  {records.items.length
                    ? "Try another course or batch name."
                    : "Choose a course and batch above to create your first timetable."}
                </p>
              </div>
            ) : (
              <div className="tt-records">
                {filtered.map((r) => (
                  <button
                    type="button"
                    key={r.code}
                    onClick={() => open(r)}
                    disabled={saving}
                    className={r.code === code ? "is-open" : ""}
                  >
                    <div>
                      <strong>{r.name}</strong>
                      <small>
                        {r.course_name} · {r.batch_name} · Year {r.study_year} ·
                        Section {r.section}
                      </small>
                    </div>
                    <span
                      className={`tt-status tt-status-${r.status.toLowerCase()}`}
                    >
                      {r.status}
                    </span>
                    <small>
                      {new Date(r.updated_at).toLocaleDateString("en-IN")}
                    </small>
                    <span>
                      {records.can_edit ? "Open & edit" : "View timetable"} →
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </section>
  );
}
