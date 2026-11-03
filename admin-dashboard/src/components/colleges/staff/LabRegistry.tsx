"use client";
/** Lab register: every lab with its floor, room, type, lab in-charge and the lab subjects held there. */
import PDFActions from "../PDFActions";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Check,
  Download,
  FileText,
  FlaskConical,
  LoaderCircle,
  Plus,
  RefreshCw,
  X,
} from "lucide-react";
import SearchField, { searchValues } from "../SearchField";
import { excelTable, pdfTable } from "@/lib/colleges/export-table";
import IconAction from "../IconAction";
import { useErrorToast } from "../toast";
import {
  LAB_TYPES,
  api,
  errorText,
  type Lab,
  type LabInput,
  type LabRegister,
} from "@/services/api";
import "./labs.css";

const blank: LabInput = {
  name: "",
  floor: "",
  room_number: "",
  lab_type: "Other",
  incharge_employee_code: null,
  subject_codes: [],
  status: "active",
};

/** Register or edit one lab. */
export function LabForm({
  register,
  lab,
  onClose,
  onSaved,
}: {
  register: LabRegister;
  lab?: Lab | null;
  onClose: () => void;
  onSaved: (lab: Lab) => void;
}) {
  const [values, setValues] = useState<LabInput>(
    lab
      ? {
          name: lab.name,
          floor: lab.floor,
          room_number: lab.room_number,
          lab_type: lab.lab_type,
          incharge_employee_code: lab.incharge_employee_code || null,
          subject_codes: lab.subject_codes || [],
          campus_code: lab.campus_code || null,
          capacity: lab.capacity ?? null,
          status: lab.status || "active",
        }
      : blank,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = <K extends keyof LabInput>(key: K, value: LabInput[K]) =>
    setValues((v) => ({ ...v, [key]: value }));
  async function save(event: React.FormEvent) {
    event.preventDefault();
    // Opened from the staff onboarding form too: never submit that form.
    event.stopPropagation();
    setBusy(true);
    setError("");
    try {
      const body = {
        ...values,
        name: values.name.trim(),
        floor: values.floor.trim(),
        room_number: values.room_number.trim(),
        incharge_employee_code: values.incharge_employee_code || null,
      };
      const saved = lab
        ? await api.labs.update(lab.code, { ...body, revision: lab.revision })
        : await api.labs.register(body);
      onSaved(saved);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  const dialog = useRef<HTMLDialogElement>(null);
  const formId = useId();
  useEffect(() => {
    const node = dialog.current;
    if (node && !node.open) node.showModal();
    return () => node?.close();
  }, []);
  const drawer = (
    <dialog
      ref={dialog}
      className="edu-connected edu-form-drawer"
      aria-labelledby={`${formId}-title`}
      onClose={onClose}
      onCancel={(event) => {
        if (busy) event.preventDefault();
      }}
    >
      <header className="edu-drawer-header">
        <div>
          <p className="edu-drawer-eyebrow">Labs &amp; lab in-charges</p>
          <h2 id={`${formId}-title`}>
            {lab ? `Edit ${lab.name}` : "Register lab"}
          </h2>
          <p>
            Where the lab is, what it is used for and who runs it. Required
            fields are marked <span aria-hidden="true">*</span>.
          </p>
        </div>
        <button
          type="button"
          className="edu-drawer-close"
          aria-label="Close form"
          onClick={onClose}
          disabled={busy}
        >
          <X size={20} />
        </button>
      </header>
      <form className="edu-drawer-form" onSubmit={save} aria-busy={busy}>
        <div className="edu-drawer-body">
          {error && (
            <p className="edu-error" role="alert">
              {error}
            </p>
          )}
          <section className="edu-form-section">
            <div className="edu-form-section-heading">
              <h3>Lab details</h3>
              <span>Location</span>
            </div>
            <div className="edu-field-grid">
              <label className="edu-field-wide">
                <span>
                  Lab name{" "}
                  <span className="edu-required" aria-hidden="true">
                    *
                  </span>
                </span>
                <input
                  required
                  minLength={2}
                  maxLength={120}
                  value={values.name}
                  placeholder="e.g. Chemistry Lab 1"
                  onChange={(e) => set("name", e.target.value)}
                />
              </label>
              <label>
                <span>
                  Floor{" "}
                  <span className="edu-required" aria-hidden="true">
                    *
                  </span>
                </span>
                <input
                  required
                  maxLength={40}
                  value={values.floor}
                  placeholder="e.g. Ground, 1st"
                  onChange={(e) => set("floor", e.target.value)}
                />
              </label>
              <label>
                <span>
                  Room number{" "}
                  <span className="edu-required" aria-hidden="true">
                    *
                  </span>
                </span>
                <input
                  required
                  maxLength={40}
                  value={values.room_number}
                  placeholder="e.g. 104"
                  onChange={(e) => set("room_number", e.target.value)}
                />
              </label>
              <label>
                <span>
                  Type of lab{" "}
                  <span className="edu-required" aria-hidden="true">
                    *
                  </span>
                </span>
                <select
                  value={values.lab_type}
                  onChange={(e) =>
                    set("lab_type", e.target.value as LabInput["lab_type"])
                  }
                >
                  {(register.lab_types?.length
                    ? register.lab_types
                    : LAB_TYPES
                  ).map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Capacity (students)</span>
                <input
                  type="number"
                  min={1}
                  max={1000}
                  value={values.capacity ?? ""}
                  onChange={(e) =>
                    set(
                      "capacity",
                      e.target.value ? Number(e.target.value) : null,
                    )
                  }
                />
              </label>
              {register.campuses.length > 1 && (
                <label>
                  <span>Campus</span>
                  <select
                    value={values.campus_code || ""}
                    onChange={(e) => set("campus_code", e.target.value || null)}
                  >
                    <option value="">Main campus</option>
                    {register.campuses.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {lab && (
                <label>
                  <span>Status</span>
                  <select
                    value={values.status}
                    onChange={(e) =>
                      set("status", e.target.value as "active" | "inactive")
                    }
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </label>
              )}
            </div>
          </section>
          <section className="edu-form-section">
            <div className="edu-form-section-heading">
              <h3>Lab in-charge</h3>
              <span>Non-teaching staff</span>
            </div>
            <div className="edu-field-grid">
              <label className="edu-field-wide">
                <span>Lab in-charge</span>
                <select
                  value={values.incharge_employee_code || ""}
                  onChange={(e) =>
                    set("incharge_employee_code", e.target.value || null)
                  }
                >
                  <option value="">Not assigned yet</option>
                  {register.incharges.map((p) => (
                    <option key={p.code} value={p.code}>
                      {p.name}
                      {p.designation ? ` · ${p.designation}` : ""} ({p.code})
                    </option>
                  ))}
                </select>
                <small className="edu-checkbox-description">
                  Add a person under Non-teaching staff with the designation
                  &ldquo;Lab in-charge&rdquo;. They sign in to the Staff app for
                  lab sessions, payslips and Form 16.
                </small>
              </label>
            </div>
          </section>
          <section className="edu-form-section">
            <div className="edu-form-section-heading">
              <h3>Lab subjects held here</h3>
              <span>{values.subject_codes.length} selected</span>
            </div>
            {register.subjects.length === 0 ? (
              <p className="lab-muted">
                No practical or lab subjects in the course curricula yet.
              </p>
            ) : (
              <div className="lab-subject-grid">
                {register.subjects.map((s) => (
                  <label key={s.code} className="lab-check">
                    <input
                      type="checkbox"
                      checked={values.subject_codes.includes(s.code)}
                      onChange={(e) =>
                        set(
                          "subject_codes",
                          e.target.checked
                            ? [...values.subject_codes, s.code]
                            : values.subject_codes.filter((c) => c !== s.code),
                        )
                      }
                    />
                    {s.name}
                  </label>
                ))}
              </div>
            )}
            <small className="edu-checkbox-description">
              Faculty assigned to these subjects supervise the students; the lab
              in-charge runs the lab.
            </small>
          </section>
        </div>
        <footer className="edu-drawer-footer">
          <span>Your changes are saved when you submit this form.</span>
          <div>
            <button type="button" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="edu-primary" disabled={busy}>
              {busy ? (
                <LoaderCircle size={16} className="edu-spin" />
              ) : (
                <Check size={16} />
              )}{" "}
              {busy ? "Saving…" : lab ? "Save lab" : "Register lab"}
            </button>
          </div>
        </footer>
      </form>
    </dialog>
  );
  // Rendered on <body> so it is never nested inside another form.
  return typeof document === "undefined"
    ? drawer
    : createPortal(drawer, document.body);
}

export default function LabRegistry({
  reloadKey = 0,
  onChanged,
  standalone = false,
}: {
  reloadKey?: number;
  onChanged?: () => void;
  /** The Labs screen: full page heading and refresh, like the staff screens. */
  standalone?: boolean;
}) {
  const [register, setRegister] = useState<LabRegister | null>(null);
  const [editing, setEditing] = useState<Lab | "new" | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  useErrorToast(error);
  const [version, setVersion] = useState(0);
  const load = useCallback(() => setVersion((n) => n + 1), []);
  useEffect(() => {
    let active = true;
    api.labs
      .list()
      .then((r) => active && setRegister(r))
      .catch((e) => active && setError(errorText(e)));
    return () => {
      active = false;
    };
  }, [reloadKey, version]);
  const rows = register?.items || [];
  const visible = rows.filter((lab) =>
    `${lab.name} ${lab.lab_type} ${lab.floor} ${lab.room_number} ${lab.incharge_name || ""} ${lab.subjects.map((x) => x.name).join(" ")}`
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );
  const exportColumns = [
    "Lab",
    "Type",
    "Floor",
    "Room",
    "Lab in-charge",
    "Lab subjects",
    "Status",
  ];
  const exportRows = visible.map((lab) => [
    lab.name,
    lab.lab_type,
    lab.floor,
    lab.room_number,
    lab.incharge_name || "Not assigned",
    lab.subjects.map((x) => x.name).join(", "),
    lab.status === "inactive" ? "Inactive" : "Active",
  ]);
  const exportPdf = async (mode: "view" | "download" = "download") => {
    try {
      await pdfTable(
        "labs",
        "Lab register",
        `${visible.length} labs`,
        exportColumns,
        exportRows, mode);
    } catch (e) {
      setError(errorText(e));
    }
  };
  const card = (
    <section className="stf-card lab-register" aria-label="Lab register">
      <div className="stf-dir-bar">
        {standalone ? (
          <SearchField
            aria-label="Search labs"
            placeholder="Search by lab, type, room or in-charge"
            value={query}
            onValueChange={setQuery}
            suggestions={searchValues(
              rows.map((lab) => ({
                name: lab.name,
                type: lab.lab_type,
                incharge: lab.incharge_name || "",
              })),
              ["name", "type", "incharge"],
            )}
          />
        ) : (
          <div className="lab-title">
            <FlaskConical size={18} aria-hidden="true" />
            <strong>Labs</strong>
          </div>
        )}
        <p>
          {register
            ? `${rows.length} labs · ${rows.filter((l) => l.incharge_employee_code).length} with an in-charge`
            : "Loading…"}
        </p>
        <div className="stf-directory-actions">
          {register?.can_manage && (
            <button
              type="button"
              className="stf-directory-add"
              onClick={() => setEditing("new")}
            >
              <Plus size={14} aria-hidden="true" />
              Register lab
            </button>
          )}
          <button
            type="button"
            onClick={() =>
              excelTable("labs", "Labs", exportColumns, exportRows)
            }
            disabled={!visible.length}
          >
            <Download size={14} aria-hidden="true" />
            Excel
          </button>
          <PDFActions viewLabel="View PDF" onAction={(mode) => exportPdf(mode)}>
            <FileText size={14} aria-hidden="true" /> Download PDF
          </PDFActions>
        </div>
      </div>
      <div className="stf-table-wrap">
        <table className="stf-table">
          <thead>
            <tr>
              <th>Lab</th>
              <th>Type</th>
              <th>Floor · Room</th>
              <th>Lab in-charge</th>
              <th>Lab subjects</th>
              <th>Status</th>
              {register?.can_manage && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {visible.map((lab) => (
              <tr key={lab.code}>
                <td>
                  <strong>{lab.name}</strong>
                  {lab.capacity ? <small> · {lab.capacity} seats</small> : null}
                </td>
                <td>
                  <span className="lab-type">{lab.lab_type}</span>
                </td>
                <td>
                  {lab.floor} · Room {lab.room_number}
                </td>
                <td>
                  {lab.incharge_name || (
                    <span className="lab-muted">Not assigned</span>
                  )}
                </td>
                <td>
                  {lab.subjects.length ? (
                    lab.subjects.map((x) => x.name).join(", ")
                  ) : (
                    <span className="lab-muted">Matched by lab type</span>
                  )}
                </td>
                <td>
                  <span
                    className={
                      lab.status === "inactive"
                        ? "stf-docs-badge"
                        : "stf-docs-badge done"
                    }
                  >
                    {lab.status === "inactive" ? "Inactive" : "Active"}
                  </span>
                </td>
                {register?.can_manage && (
                  <td>
                    <div className="stf-row-actions">
                      <IconAction
                        kind="edit"
                        label={`Edit ${lab.name}`}
                        onClick={() => setEditing(lab)}
                      />
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {register && visible.length === 0 && (
          <p className="stf-empty">
            {rows.length
              ? "No lab matches the search."
              : `No labs registered yet.${register.can_manage ? " Use Register lab to add the first one." : ""}`}
          </p>
        )}
      </div>
      {editing && register && (
        <LabForm
          register={register}
          lab={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
            onChanged?.();
          }}
        />
      )}
    </section>
  );
  if (!standalone) return register ? card : null;
  return (
    <section className="stf-dir" aria-label="Labs and lab in-charges">
      <header className="stf-dir-heading">
        <div>
          <p>College administration</p>
          <h1>Labs &amp; lab in-charges</h1>
        </div>
        <button
          className="stf-refresh"
          type="button"
          onClick={load}
          aria-label="Refresh labs"
          title="Refresh"
        >
          <RefreshCw size={16} aria-hidden="true" />
        </button>
      </header>
      {card}
    </section>
  );
}
