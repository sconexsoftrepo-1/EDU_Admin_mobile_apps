"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, Pencil, Plus, Save, Trash2 } from "lucide-react";
import { api, errorText, type LookupOption, type Row } from "@/services/api";
import { programFeeSchedules } from "@/lib/colleges/program-fee-schedules";
import type { RecordRow } from "@/lib/colleges/store";
import { money } from "@/data/colleges";
import DateInput from "./DateInput";
import "./fee-structures.css";

type Snapshot = {
  records: Row[];
  heads: Row[];
  programs: LookupOption[];
  years: LookupOption[];
};
type Line = {
  key: string;
  code?: string;
  feeHead: string;
  name: string;
  category: string;
  amount: string;
  dueDate?: string;
};
type Draft = {
  existing: boolean;
  program: string;
  year: string;
  studyYear: number;
  installment: number;
  frequency: string;
  currency: string;
  dueDate: string;
  lines: Line[];
};
const optionsAsRows = (options: LookupOption[]) =>
  options.map((option) => ({ code: option.value, name: option.label }));
const schedules = (data: Snapshot) =>
  programFeeSchedules(
    data.records,
    optionsAsRows(data.programs),
    data.heads,
    optionsAsRows(data.years),
  );
const newLine = (): Line => ({
  key: crypto.randomUUID(),
  feeHead: "",
  name: "",
  category: "academic",
  amount: "",
});

async function loadFees(): Promise<Snapshot> {
  const [screen, programs, years] = await Promise.all([
    api.workspace.screen("fee-structures"),
    api.workspace.lookup("programs"),
    api.workspace.lookup("academic_years"),
  ]);
  async function all(table: string) {
    const resource = screen.resources.find(
      (resource) => resource.name === table,
    );
    if (!resource)
      throw Error(`Your role cannot view ${table.replaceAll("_", " ")}.`);
    const items: Row[] = [];
    for (;;) {
      const page = await api.workspace.list(resource.path, items.length, 100);
      items.push(...page.items);
      if (!page.items.length || items.length >= page.total) return items;
    }
  }
  const [records, heads] = await Promise.all([
    all("fee_structures"),
    all("fee_heads"),
  ]);
  return { records, heads, programs, years };
}
function fromSchedule(schedule: RecordRow, data: Snapshot): Draft {
  const rows = data.records.filter((row) =>
    schedule.feeSchedule!.sourceIds.includes(String(row.code)),
  );
  const first = rows[0];
  return {
    existing: true,
    program: String(first.program_code),
    year: String(first.academic_year_code),
    studyYear: Number(first.semester_number || 1),
    installment: Number(first.installment_number || 1),
    frequency: String(first.billing_frequency || "annual"),
    currency: String(first.currency || "INR"),
    dueDate: String(first.due_date || ""),
    lines: rows.map((row) => ({
      key: String(row.code),
      code: String(row.code),
      feeHead: String(row.fee_head_code),
      name: "",
      category: String(
        data.heads.find((head) => head.code === row.fee_head_code)?.category ||
          "academic",
      ),
      amount: Number(row.amount || 0).toFixed(2),
      dueDate: String(row.due_date || ""),
    })),
  };
}

export default function FeeStructureManager({
  initialId,
}: {
  initialId?: string | null;
}) {
  const [data, setData] = useState<Snapshot | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    void loadFees()
      .then((snapshot) => {
        if (!active) return;
        setData(snapshot);
        const selected = schedules(snapshot).find((schedule) =>
          schedule.feeSchedule?.sourceIds.includes(initialId || ""),
        );
        setDraft(selected ? fromSchedule(selected, snapshot) : null);
      })
      .catch((error) => {
        if (active) setError(errorText(error));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [initialId]);

  const updateLine = (key: string, value: Partial<Line>) => {
    setDraft(
      (current) =>
        current && {
          ...current,
          lines: current.lines.map((line) =>
            line.key === key ? { ...line, ...value } : line,
          ),
        },
    );
    setSuccess("");
  };
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft || saving) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const result = await api.masterData.runAction("course-fee-structure", {
        program_code: draft.program,
        academic_year_code: draft.year,
        year_of_study: draft.studyYear,
        installment_number: draft.installment,
        billing_frequency: draft.frequency,
        currency: draft.currency,
        due_date: draft.dueDate,
        lines: draft.lines.map((line) => ({
          ...(line.code ? { code: line.code } : {}),
          ...(line.feeHead === "_new"
            ? { name: line.name.trim(), category: line.category }
            : { fee_head_code: line.feeHead }),
          amount: line.amount,
          ...(line.dueDate ? { due_date: line.dueDate } : {}),
        })),
      });
      const snapshot = await loadFees();
      setData(snapshot);
      const first = (result.fee_structures as Row[])[0]?.code;
      const saved = schedules(snapshot).find((schedule) =>
        schedule.feeSchedule?.sourceIds.includes(String(first)),
      );
      if (saved) setDraft(fromSchedule(saved, snapshot));
      setSuccess(
        "Fee structure saved. The course card now includes the complete breakdown.",
      );
      window.dispatchEvent(new Event("edunexa:records-changed"));
    } catch (error) {
      setError(errorText(error));
    } finally {
      setSaving(false);
    }
  }
  if (loading) return <p role="status">Loading course fee structures…</p>;
  if (!data)
    return (
      <p role="alert" className="edu-error">
        {error || "Fee structures could not be loaded."}
      </p>
    );
  const total =
    draft?.lines.reduce(
      (sum, line) => sum + Math.round(Number(line.amount || 0) * 100),
      0,
    ) || 0;
  return (
    <section className="erp-fee-manager">
      <div className="erp-fee-manager-title">
        <div>
          <h3>
            {draft
              ? draft.existing
                ? "Edit course fee breakdown"
                : "New course fee structure"
              : "Course fee structures"}
          </h3>
          <p>Course, academic year and saved fee heads in one place.</p>
        </div>
        {!draft && (
          <button
            type="button"
            className="erp-primary"
            onClick={() => {
              setError("");
              setSuccess("");
              setDraft({
                existing: false,
                program: "",
                year: "",
                studyYear: 1,
                installment: 1,
                frequency: "annual",
                currency: "INR",
                dueDate: "",
                lines: [newLine()],
              });
            }}
          >
            <Plus size={15} />
            New fee structure
          </button>
        )}
        {draft && (
          <button
            type="button"
            disabled={saving}
            onClick={() => {
              setDraft(null);
              setError("");
              setSuccess("");
            }}
          >
            <ArrowLeft size={15} />
            All course schedules
          </button>
        )}
      </div>
      {!draft ? (
        <div className="erp-fee-manager-scroll">
          <table>
            <thead>
              <tr>
                <th>Course</th>
                <th>Academic year</th>
                <th>Study year</th>
                <th>Fee heads</th>
                <th>Total (INR)</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {schedules(data).map((schedule) => (
                <tr key={schedule.id}>
                  <td>
                    <strong>{schedule.name}</strong>
                  </td>
                  <td>{schedule.feeSchedule?.academicYear}</td>
                  <td>{schedule.feeSchedule?.studyYear}</td>
                  <td>{schedule.components?.length}</td>
                  <td>{money(schedule.amount || 0)}</td>
                  <td>
                    <button
                      type="button"
                      aria-label={`Edit ${schedule.name} fee breakdown`}
                      onClick={() => {
                        setDraft(fromSchedule(schedule, data));
                        setError("");
                        setSuccess("");
                      }}
                    >
                      <Pencil size={15} />
                    </button>
                  </td>
                </tr>
              ))}
              {!data.records.length && (
                <tr>
                  <td colSpan={6}>
                    No saved fee structures. Create a course schedule to get
                    started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <form onSubmit={submit}>
          <fieldset disabled={saving}>
            <div className="erp-fee-manager-fields">
              <label>
                Course
                <select
                  required
                  value={draft.program}
                  disabled={draft.existing}
                  onChange={(event) =>
                    setDraft({ ...draft, program: event.target.value })
                  }
                >
                  <option value="">Choose course</option>
                  {data.programs.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Academic year
                <select
                  required
                  value={draft.year}
                  disabled={draft.existing}
                  onChange={(event) =>
                    setDraft({ ...draft, year: event.target.value })
                  }
                >
                  <option value="">Choose academic year</option>
                  {data.years.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Year of study
                <input
                  type="number"
                  required
                  min={1}
                  max={20}
                  value={draft.studyYear}
                  disabled={draft.existing}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      studyYear: Number(event.target.value),
                    })
                  }
                />
              </label>
              <label>
                Due date
                <DateInput
                  required
                  value={draft.dueDate}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      dueDate: event.target.value,
                      lines: draft.lines.map((line) => ({
                        ...line,
                        dueDate: event.target.value,
                      })),
                    })
                  }
                />
              </label>
            </div>
            <p className="erp-help">
              Edit amounts directly in the table. Add a row to include another
              fee head in this course schedule. Amounts already assigned to
              students cannot be changed.
            </p>
            <div className="erp-fee-manager-scroll">
              <table aria-label="Course fee breakdown">
                <thead>
                  <tr>
                    <th>Fee head</th>
                    <th>Category</th>
                    <th>Amount ({draft.currency})</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {draft.lines.map((line, index) => (
                    <tr key={line.key}>
                      <td>
                        <select
                          aria-label={`Fee head ${index + 1}`}
                          required
                          value={line.feeHead}
                          disabled={!!line.code}
                          onChange={(event) =>
                            updateLine(line.key, {
                              feeHead: event.target.value,
                            })
                          }
                        >
                          <option value="">Choose fee head</option>
                          {data.heads.map((head) => (
                            <option
                              key={String(head.code)}
                              value={String(head.code)}
                            >
                              {String(head.name)}
                            </option>
                          ))}
                          <option value="_new">New fee head…</option>
                        </select>
                        {line.feeHead === "_new" && (
                          <input
                            aria-label={`New fee head name ${index + 1}`}
                            placeholder="Fee head name"
                            required
                            maxLength={100}
                            value={line.name}
                            onChange={(event) =>
                              updateLine(line.key, { name: event.target.value })
                            }
                          />
                        )}
                      </td>
                      <td>
                        {line.feeHead === "_new" ? (
                          <select
                            aria-label={`Category ${index + 1}`}
                            value={line.category}
                            onChange={(event) =>
                              updateLine(line.key, {
                                category: event.target.value,
                              })
                            }
                          >
                            {["academic", "hostel", "transport", "other"].map(
                              (category) => (
                                <option key={category}>{category}</option>
                              ),
                            )}
                          </select>
                        ) : (
                          String(
                            data.heads.find(
                              (head) => head.code === line.feeHead,
                            )?.category || line.category,
                          )
                        )}
                      </td>
                      <td>
                        <input
                          aria-label={`Amount ${index + 1}`}
                          type="number"
                          min="0"
                          step="0.01"
                          required
                          value={line.amount}
                          onChange={(event) =>
                            updateLine(line.key, { amount: event.target.value })
                          }
                        />
                      </td>
                      <td>
                        {!line.code && draft.lines.length > 1 ? (
                          <button
                            type="button"
                            aria-label={`Remove new fee row ${index + 1}`}
                            onClick={() =>
                              setDraft({
                                ...draft,
                                lines: draft.lines.filter(
                                  (row) => row.key !== line.key,
                                ),
                              })
                            }
                          >
                            <Trash2 size={15} />
                          </button>
                        ) : (
                          <span className="erp-help">
                            {line.code ? "Saved" : "New"}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              type="button"
              className="erp-fee-add-row"
              onClick={() =>
                setDraft({ ...draft, lines: [...draft.lines, newLine()] })
              }
            >
              <Plus size={15} />
              Add fee row
            </button>
          </fieldset>
          <div className="erp-fee-manager-save">
            <strong>
              Course total <span>{money(total)}</span>
            </strong>
            <button className="erp-primary" type="submit" disabled={saving}>
              <Save size={15} />
              {saving ? "Saving…" : "Save fee structure"}
            </button>
          </div>
        </form>
      )}
      {error && (
        <p role="alert" className="edu-error">
          {error}
        </p>
      )}
      {success && (
        <p role="status" className="erp-fee-manager-success">
          {success}
        </p>
      )}
    </section>
  );
}
