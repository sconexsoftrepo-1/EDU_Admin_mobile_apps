"use client";
import { useEffect, useState } from "react";
import { Info, Plus, Users, Layers } from "lucide-react";
import { errorText } from "@/services/api";
import {
  academicBatches,
  type BatchRow,
  type SectionSpec,
  type SectionPlan,
  type PlacementPreview,
} from "@/services/api/modules/academic-progress/batches";
import AcademicYearForm from "./AcademicYearForm";
import SideDrawer from "./SideDrawer";
import WorkspaceSkeleton from "./WorkspaceSkeleton";
import SearchField, { searchValues } from "./SearchField";

export default function AcademicBatchManager({
  onSelect,
  onChanged,
}: {
  onSelect: (code: string) => void;
  onChanged: () => void;
}) {
  const [data, setData] = useState<Awaited<
      ReturnType<typeof academicBatches.list>
    > | null>(null),
    [error, setError] = useState(""),
    [creating, setCreating] = useState(false),
    [selected, setSelected] = useState<BatchRow | null>(null),
    [query, setQuery] = useState("");
  function load() {
    return academicBatches
      .list()
      .then((value) => {
        setData(value);
        setError("");
      })
      .catch((e) => setError(errorText(e)));
  }
  useEffect(() => {
    let active = true;
    academicBatches
      .list()
      .then((value) => {
        if (active) setData(value);
      })
      .catch((e) => {
        if (active) setError(errorText(e));
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <section className="ap-panel ap-batch-manager">
      <header>
        <div>
          <h3>Academic batches</h3>
          <p>
            Create cohorts, review student counts, and manage semester sections.
          </p>
        </div>
        {data?.can_create && (
          <button onClick={() => setCreating(true)}>
            <Plus size={16} /> Create academic batch
          </button>
        )}
      </header>
      {error && (
        <p role="alert">
          {error} <button onClick={() => void load()}>Retry</button>
        </p>
      )}
      {!data && !error && (
        <WorkspaceSkeleton compact label="Loading academic batches" />
      )}
      {data && (
        <>
          <SearchField
            aria-label="Search academic batches"
            placeholder="Search course or batch"
            value={query}
            onValueChange={setQuery}
            suggestions={searchValues(data.items, [
              "name",
              "course_name",
              "code",
            ])}
          />
          <div className="ap-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Academic batch / course</th>
                  <th>Dates</th>
                  <th>Students</th>
                  <th>Sections</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.items
                  .filter((b) =>
                    `${b.name} ${b.course_name}`
                      .toLowerCase()
                      .includes(query.toLowerCase()),
                  )
                  .map((b) => (
                    <tr key={b.code}>
                      <td>
                        <strong>{b.name}</strong>
                        <small>{b.course_name}</small>
                      </td>
                      <td>
                        {b.start_date} – {b.end_date}
                      </td>
                      <td>
                        <button
                          onClick={() => {
                            onSelect(b.code);
                            setSelected(b);
                          }}
                          aria-label={`View ${b.students} students in ${b.name}`}
                        >
                          <Users size={16} /> {b.students}
                        </button>
                      </td>
                      <td>{b.section_count}</td>
                      <td>
                        <div className="ap-actions">
                          <button
                            aria-label={`Details for ${b.name}`}
                            onClick={() => {
                              onSelect(b.code);
                              setSelected(b);
                            }}
                          >
                            <Info size={17} />
                          </button>
                          {data.can_manage_sections && (
                            <button
                              onClick={() => {
                                onSelect(b.code);
                                setSelected(b);
                              }}
                            >
                              <Layers size={16} /> Manage sections
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
            {!data.items.length && (
              <p>No academic batches yet. Create a batch to get started.</p>
            )}
          </div>
        </>
      )}
      {creating && (
        <AcademicYearForm
          title="Create academic batch"
          onClose={() => setCreating(false)}
          onSave={async (values) => {
            await academicBatches.create({
              program_code: String(values.program_code),
              start_date: String(values.start_date),
              end_date: String(values.end_date),
            });
            await load();
            onChanged();
          }}
        />
      )}
      {selected && (
        <SectionManager
          key={selected.code}
          batch={selected}
          canManage={!!data?.can_manage_sections}
          onClose={() => setSelected(null)}
          onChanged={() => {
            void load();
            onChanged();
          }}
        />
      )}
    </section>
  );
}
function SectionManager({
  batch,
  canManage,
  onClose,
  onChanged,
}: {
  batch: BatchRow;
  canManage: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [semester, setSemester] = useState(batch.current_semester || 1),
    [sections, setSections] = useState<SectionSpec[]>([]),
    [count, setCount] = useState(2),
    [order, setOrder] = useState<SectionPlan["order_by"]>(
      "university_roll_number",
    ),
    [overrides, setOverrides] = useState<Record<string, number>>({}),
    [preview, setPreview] = useState<PlacementPreview | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [message, setMessage] = useState("");
  const [dirty, setDirty] = useState(false);
  const [currentStudents, setCurrentStudents] = useState<
    Awaited<ReturnType<typeof academicBatches.sections>>["students"]
  >([]);
  useEffect(() => {
    const state = { active: true };
    academicBatches
      .sections(batch.code, semester)
      .then((result) => {
        if (state.active) {
          setSections(result.sections);
          setCount(result.sections.length || 2);
          setCurrentStudents(result.students);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (state.active) {
          setError(errorText(e));
          setLoading(false);
        }
      });
    return () => {
      state.active = false;
    };
  }, [batch.code, semester]);
  const body: SectionPlan = {
    semester_number: semester,
    sections,
    order_by: order,
    overrides,
  };
  function invalidate() {
    setPreview(null);
    setMessage("");
    setError("");
  }
  async function calculate() {
    setBusy(true);
    setError("");
    try {
      setPreview(await academicBatches.preview(batch.code, body));
      setDirty(false);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    if (!preview) return;
    setBusy(true);
    setError("");
    try {
      await academicBatches.apply(batch.code, {
        ...body,
        expected_revision: preview.revision,
      });
      setPreview(null);
      setOverrides({});
      const result = await academicBatches.sections(batch.code, semester);
      setSections(result.sections);
      setCurrentStudents(result.students);
      setMessage(
        "Sections and student placements saved. Student and parent apps use these enrollment records.",
      );
      onChanged();
    } catch (e) {
      setPreview(null);
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <SideDrawer
      expanded
      className="ap-section-drawer"
      title={`${batch.name} · Sections & students`}
      subtitle={`${batch.course_name} · ${batch.students} students`}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <div className="ap-workspace">
        <nav
          className="ap-tabs"
          role="tablist"
          aria-label="Section placement semester"
        >
          {Array.from({ length: batch.semester_count }, (_, i) => i + 1).map(
            (n) => (
              <button
                role="tab"
                aria-selected={semester === n}
                key={n}
                disabled={busy}
                onClick={() => {
                  if (n === semester) return;
                  setSemester(n);
                  setLoading(true);
                  setSections([]);
                  setOverrides({});
                  invalidate();
                }}
              >
                Semester {n}
              </button>
            ),
          )}
        </nav>
        <div className="ap-filters">
          <label>
            Order students by
            <select
              value={order}
              disabled={busy}
              onChange={(e) => {
                setOrder(e.target.value as SectionPlan["order_by"]);
                invalidate();
              }}
            >
              <option value="university_roll_number">
                University roll number (admission number fallback)
              </option>
              <option value="admission_number">
                Admission / academic number
              </option>
            </select>
          </label>
        </div>
        {error && (
          <p role="alert" className="edu-error">
            {error}
          </p>
        )}
        {message && <p role="status">{message}</p>}
        {loading ? (
          <WorkspaceSkeleton compact label="Loading semester sections" />
        ) : (
          <>
            {canManage && (
              <div className="ap-actions">
                <label>
                  Number of sections
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={count}
                    disabled={busy}
                    onChange={(e) =>
                      setCount(
                        Math.min(50, Math.max(1, Number(e.target.value) || 1)),
                      )
                    }
                  />
                </label>
                <button
                  disabled={busy}
                  onClick={() => {
                    setSections(
                      Array.from(
                        { length: count },
                        (_, i) =>
                          sections[i] || {
                            name: `Section ${i < 26 ? String.fromCharCode(65 + i) : String.fromCharCode(64 + Math.floor(i / 26)) + String.fromCharCode(65 + (i % 26))}`,
                            capacity: null,
                          },
                      ),
                    );
                    setOverrides({});
                    invalidate();
                  }}
                >
                  Set section count
                </button>
                <button
                  disabled={busy}
                  onClick={() => {
                    setSections([
                      ...sections,
                      {
                        name: `Section ${sections.length + 1}`,
                        capacity: null,
                      },
                    ]);
                    invalidate();
                  }}
                >
                  <Plus size={16} /> Add section
                </button>
              </div>
            )}
            <p>
              Preview distributes students in roll-number order with section
              sizes differing by at most one. You can adjust individual
              placements before saving. Earlier semester records are retained.
            </p>
            <div className="ap-section-settings">
              {sections.map((s, i) => (
                <div key={s.code || i}>
                  <label>
                    Section name
                    <input
                      value={s.name}
                      disabled={busy || !canManage}
                      onChange={(e) => {
                        setSections(
                          sections.map((v, n) =>
                            n === i ? { ...v, name: e.target.value } : v,
                          ),
                        );
                        invalidate();
                      }}
                    />
                  </label>
                  <label>
                    Capacity (optional)
                    <input
                      type="number"
                      min={1}
                      value={s.capacity ?? ""}
                      disabled={busy || !canManage}
                      onChange={(e) => {
                        setSections(
                          sections.map((v, n) =>
                            n === i
                              ? {
                                  ...v,
                                  capacity: e.target.value
                                    ? Number(e.target.value)
                                    : null,
                                }
                              : v,
                          ),
                        );
                        invalidate();
                      }}
                    />
                  </label>
                  {canManage && (
                    <button
                      disabled={busy}
                      onClick={() => {
                        setSections(sections.filter((_, n) => n !== i));
                        setOverrides({});
                        invalidate();
                      }}
                    >
                      Remove from plan
                    </button>
                  )}
                </div>
              ))}
            </div>
            <p>
              Existing sections are retained in the records. Sections removed
              from this plan receive no newly allocated students. New sections
              need faculty and timetable allocation.
            </p>
            <div className="ap-actions">
              <button
                disabled={busy || !sections.length}
                onClick={() => void calculate()}
              >
                {busy ? "Working…" : "Preview student placement"}
              </button>
              {canManage && (
                <button
                  disabled={busy || !preview || dirty}
                  onClick={() => void save()}
                >
                  Save sections & placements
                </button>
              )}
            </div>
            {!preview && (
              <div className="ap-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Academic number</th>
                      <th>Roll number</th>
                      <th>Saved section</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentStudents.map((student) => (
                      <tr key={student.student_code}>
                        <td>{student.name}</td>
                        <td>{student.admission_number}</td>
                        <td>{student.roll_number}</td>
                        <td>{student.section_name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!currentStudents.length && (
                  <p>No students registered in this academic batch.</p>
                )}
              </div>
            )}
            {preview && (
              <>
                <div className="ap-actions">
                  {preview.sections.map((s, i) => (
                    <span className="ap-note" key={i}>
                      {s.name}: {s.students} students
                    </span>
                  ))}
                </div>
                <div className="ap-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Student</th>
                        <th>University / academic roll</th>
                        <th>Current section</th>
                        <th>Proposed section</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.students.map((s) => (
                        <tr key={s.student_code}>
                          <td>
                            {s.name}
                            <small>{s.admission_number}</small>
                          </td>
                          <td>{s.roll_number}</td>
                          <td>{s.current_section_name}</td>
                          <td>
                            <select
                              aria-label={`Section for ${s.name}`}
                              disabled={!canManage || busy}
                              value={
                                overrides[s.student_code] ?? s.section_index
                              }
                              onChange={(e) => {
                                setOverrides({
                                  ...overrides,
                                  [s.student_code]: Number(e.target.value),
                                });
                                setDirty(true);
                                setMessage(
                                  "Placement adjusted. Preview again to recalculate the remaining students.",
                                );
                              }}
                            >
                              {sections.map((section, i) => (
                                <option value={i} key={section.code || i}>
                                  {section.name}
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </SideDrawer>
  );
}
