"use client";
import Select from "./SearchSelect";
import { useErrorToast } from "./toast";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  CalendarRange,
  Check,
  Layers,
  Pencil,
  RefreshCw,
  Trash2,
  Users,
  X,
} from "lucide-react";
import {
  api,
  errorText,
  type BatchOverview,
  type LookupOption,
  type Resource,
} from "@/services/api";
import IconAction from "./IconAction";

type Batch = BatchOverview["batches"][number];
export default function BatchManager({
  resource,
  sectionResource,
  onChanged,
}: {
  resource?: Resource;
  sectionResource?: Resource;
  onChanged: () => Promise<void>;
}) {
  const [courses, setCourses] = useState<LookupOption[]>([]);
  const [course, setCourse] = useState("");
  const [data, setData] = useState<BatchOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useErrorToast(error);
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState("");
  const [confirming, setConfirming] = useState("");
  const [saving, setSaving] = useState(false);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [sectionNames, setSectionNames] = useState<Record<string, string>>({});
  const request = useRef(0);
  useEffect(() => {
    let active = true;
    api.workspace
      .lookup("programs")
      .then((items) => {
        if (!active) return;
        setCourses(items);
        if (!items.length) setLoading(false);
      })
      .catch((e) => {
        if (active) {
          setError(errorText(e));
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);
  const refresh = useCallback(async () => {
    const sequence = ++request.current;
    try {
      const value = await api.masterData.batchOverview(course);
      if (sequence === request.current) {
        setData(value);
        setError("");
      }
    } catch (e) {
      if (sequence === request.current) setError(errorText(e));
    } finally {
      if (sequence === request.current) setLoading(false);
    }
  }, [course]);
  useEffect(() => {
    const pendingRequests = request;
    const sequence = ++pendingRequests.current;
    api.masterData
      .batchOverview(course)
      .then((value) => {
        if (sequence === pendingRequests.current) {
          setData(value);
          setError("");
        }
      })
      .catch((e) => {
        if (sequence === pendingRequests.current) setError(errorText(e));
      })
      .finally(() => {
        if (sequence === pendingRequests.current) setLoading(false);
      });
    return () => {
      pendingRequests.current++;
    };
  }, [course]);
  async function save(batch: Batch) {
    const from = Number(start),
      to = Number(end);
    if (
      !Number.isInteger(from) ||
      !Number.isInteger(to) ||
      from < 1000 ||
      to > 9999 ||
      to <= from
    ) {
      setError(
        "Enter valid start and end years. End year must be after start year.",
      );
      return;
    }
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const sectionChanges = sectionResource?.actions.includes("edit")
        ? batch.sections.map((section) => ({
            code: section.code,
            name: (sectionNames[section.code] ?? section.name).trim(),
          }))
        : [];
      if (sectionChanges.some((section) => !section.name))
        throw new Error("Section names cannot be empty.");
      const result = await api.masterData.updateBatch(batch.code, {
        entry_year: from,
        graduation_year: to,
        sections: sectionChanges,
      });
      // Ignore count responses requested before the save committed.
      request.current++;
      const names = new Map(
        sectionChanges.map((section) => [section.code, section.name]),
      );
      setData((current) =>
        current
          ? {
              ...current,
              batches: current.batches.map((item) =>
                item.code === batch.code
                  ? {
                      ...item,
                      name: String(result.batch.name ?? item.name),
                      entry_year: Number(
                        result.batch.entry_year ?? item.entry_year,
                      ),
                      graduation_year: Number(
                        result.batch.graduation_year ?? item.graduation_year,
                      ),
                      sections: item.sections.map((section) => ({
                        ...section,
                        name: names.get(section.code) ?? section.name,
                      })),
                    }
                  : item,
              ),
            }
          : current,
      );
      setEditing("");
      setMessage("Batch updated.");
      void Promise.allSettled([refresh(), onChanged()]);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setSaving(false);
    }
  }
  async function remove(batch: Batch) {
    if (!resource) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await api.workspace.remove(resource.path, batch.code);
      request.current++;
      setData((current) => {
        if (!current) return current;
        const batches = current.batches.filter(
          (item) => item.code !== batch.code,
        );
        return {
          ...current,
          batches,
          totals: { ...current.totals, batches: batches.length },
        };
      });
      setConfirming("");
      setMessage("Batch deleted.");
      void Promise.allSettled([refresh(), onChanged()]);
    } catch (e) {
      setError(
        errorText(e).includes("referenced by")
          ? "This batch has linked sections or student records. Remove or reassign those records before deleting the batch."
          : errorText(e),
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <section className="edu-batch-manager" aria-label="Created batches">
      <div className="edu-batch-controls">
        <label>
          Course
          <Select
            aria-label="View batches for course"
            value={course}
            disabled={saving}
            onChange={(e) => {
              request.current++;
              setData(null);
              setCourse(e.target.value);
              setLoading(true);
              setEditing("");
              setConfirming("");
              setError("");
              setMessage("");
            }}
          >
            <option value="">All courses</option>
            {courses.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </Select>
        </label>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={saving || loading}
        >
          <RefreshCw size={15} /> Refresh counts
        </button>
      </div>
      <p className="edu-batch-hint">
        Counts load when this view opens. Use Refresh counts to get the latest
        student totals.
      </p>
      {error && (
        <p className="edu-error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="edu-batch-success">
          {message}
        </p>
      )}
      {loading ? (
        <div className="edu-batch-loading" role="status">
          <span />
          <span />
          <span />
          Loading created batches…
        </div>
      ) : !data?.batches.length ? (
        <div className="edu-batch-empty">
          <CalendarRange size={28} />
          <h3>No batches created yet</h3>
          <p>
            Turn off View created batches to add the first batch for this
            course.
          </p>
        </div>
      ) : (
        <>
          <div className="edu-batch-summary">
            <span>
              <strong>{data.batches.length}</strong> batches
            </span>
            <span>
              <strong>{data.totals.students}</strong> students
            </span>
          </div>
          <div className="edu-batch-grid">
            {data.batches.map((batch) => (
              <article className="edu-batch-card" key={batch.code}>
                <header>
                  <div>
                    <span className="edu-batch-course-name">
                      {batch.course_name}
                    </span>
                    <h3>{batch.name}</h3>
                    <p>{batch.code}</p>
                  </div>
                  <span className="edu-batch-years">
                    <CalendarRange size={15} />
                    {batch.entry_year} – {batch.graduation_year}
                  </span>
                </header>
                <div className="edu-batch-stats">
                  <span>
                    <Users size={17} />
                    <strong>{batch.students}</strong>
                    <small>Students</small>
                  </span>
                  <span>
                    <Layers size={17} />
                    <strong>{batch.sections.length}</strong>
                    <small>Sections</small>
                  </span>
                </div>
                <div className="edu-batch-sections">
                  <h4>Section-wise students</h4>
                  {batch.sections.length ? (
                    <ul>
                      {batch.sections.map((section) => (
                        <li key={section.code}>
                          {editing === batch.code &&
                          sectionResource?.actions.includes("edit") ? (
                            <label className="edu-batch-section-edit">
                              Section name
                              <input
                                aria-label={`Section name ${section.name}`}
                                value={
                                  sectionNames[section.code] ?? section.name
                                }
                                required
                                maxLength={200}
                                disabled={saving}
                                onChange={(e) =>
                                  setSectionNames((old) => ({
                                    ...old,
                                    [section.code]: e.target.value,
                                  }))
                                }
                              />
                            </label>
                          ) : (
                            <span>{section.name}</span>
                          )}
                          <strong>
                            {section.students} students
                            {section.capacity
                              ? ` / ${section.capacity} seats`
                              : ""}
                          </strong>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>No sections configured.</p>
                  )}
                </div>
                {editing === batch.code ? (
                  <div
                    className="edu-batch-edit"
                    role="group"
                    aria-label={`Edit batch ${batch.name}`}
                  >
                    <label>
                      Start year
                      <input
                        type="number"
                        min="1000"
                        max="9998"
                        required
                        value={start}
                        onChange={(e) => setStart(e.target.value)}
                        disabled={saving}
                      />
                    </label>
                    <label>
                      End year
                      <input
                        type="number"
                        min="1001"
                        max="9999"
                        required
                        value={end}
                        onChange={(e) => setEnd(e.target.value)}
                        disabled={saving}
                      />
                    </label>
                    <div>
                      <button
                        type="button"
                        className="edu-primary"
                        onClick={() => void save(batch)}
                        disabled={saving}
                      >
                        <Check size={14} />
                        {saving ? "Saving…" : "Save changes"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditing("")}
                        disabled={saving}
                      >
                        <X size={14} /> Cancel
                      </button>
                    </div>
                  </div>
                ) : confirming === batch.code ? (
                  <div
                    className="edu-batch-confirm"
                    role="group"
                    aria-label={`Confirm deletion of batch ${batch.name}`}
                  >
                    <p>
                      Delete this batch? Batches with linked records cannot be
                      deleted.
                    </p>
                    <button
                      type="button"
                      className="edu-batch-delete"
                      disabled={saving}
                      onClick={() => void remove(batch)}
                    >
                      {saving ? "Deleting…" : "Confirm delete"}
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => setConfirming("")}
                    >
                      Keep batch
                    </button>
                  </div>
                ) : (
                  <div className="edu-batch-actions">
                    {resource?.actions.includes("edit") && (
                      <IconAction
                        kind="edit"
                        label={`Edit batch ${batch.name ?? ""}`.trim()}
                        onClick={() => {
                          setSectionNames(
                            Object.fromEntries(
                              batch.sections.map((section) => [
                                section.code,
                                section.name,
                              ]),
                            ),
                          );
                          setEditing(batch.code);
                          setStart(String(batch.entry_year));
                          setEnd(String(batch.graduation_year));
                          setConfirming("");
                          setError("");
                        }}
                      />
                    )}
                    {resource?.actions.includes("delete") && (
                      <IconAction
                        kind="delete"
                        label={`Delete batch ${batch.name ?? ""}`.trim()}
                        onClick={() => {
                          setConfirming(batch.code);
                          setEditing("");
                          setError("");
                        }}
                      />
                    )}
                  </div>
                )}
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
