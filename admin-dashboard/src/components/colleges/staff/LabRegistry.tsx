"use client";
/** Lab register: every lab with its floor, room, type, lab in-charge and the lab subjects held there. */
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { FlaskConical, Plus, X } from "lucide-react";
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
  const dialog = (
    <div
      className="lab-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={lab ? "Edit lab" : "Register lab"}
    >
      <form className="lab-dialog" onSubmit={save}>
        <header>
          <span className="lab-dialog-icon" aria-hidden="true">
            <FlaskConical size={18} />
          </span>
          <div>
            <h2>{lab ? "Edit lab" : "Register lab"}</h2>
            <p>Where the lab is, what it is used for and who runs it.</p>
          </div>
          <button
            type="button"
            className="lab-close"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        <div className="lab-grid">
          <label className="lab-wide">
            Lab name *
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
            Floor *
            <input
              required
              maxLength={40}
              value={values.floor}
              placeholder="e.g. Ground, 1st"
              onChange={(e) => set("floor", e.target.value)}
            />
          </label>
          <label>
            Room number *
            <input
              required
              maxLength={40}
              value={values.room_number}
              placeholder="e.g. 104"
              onChange={(e) => set("room_number", e.target.value)}
            />
          </label>
          <label>
            Type of lab *
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
            Capacity
            <input
              type="number"
              min={1}
              max={1000}
              value={values.capacity ?? ""}
              placeholder="Students"
              onChange={(e) =>
                set("capacity", e.target.value ? Number(e.target.value) : null)
              }
            />
          </label>
          <label className="lab-wide">
            Lab in-charge
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
            <small>
              Non-teaching staff. Add one under Non-teaching staff with the
              designation &ldquo;Lab in-charge&rdquo;.
            </small>
          </label>
          {register.campuses.length > 1 && (
            <label className="lab-wide">
              Campus
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
          <fieldset className="lab-wide lab-subjects">
            <legend>Lab subjects held here</legend>
            {register.subjects.length === 0 ? (
              <p>No practical or lab subjects in the course curricula yet.</p>
            ) : (
              <div>
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
            <small>
              Faculty assigned to these subjects supervise the students; the lab
              in-charge runs the lab.
            </small>
          </fieldset>
          {lab && (
            <label>
              Status
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
        {error && (
          <p className="edu-error" role="alert">
            {error}
          </p>
        )}
        <footer>
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="lab-primary" disabled={busy}>
            {busy ? "Saving…" : lab ? "Save lab" : "Register lab"}
          </button>
        </footer>
      </form>
    </div>
  );
  // Rendered on <body> so it is never nested inside another form.
  return typeof document === "undefined"
    ? dialog
    : createPortal(dialog, document.body);
}

/** Lab register section with a "Register lab" button (shown on the staff screens). */
export default function LabRegistry({
  reloadKey = 0,
  onChanged,
}: {
  reloadKey?: number;
  onChanged?: () => void;
}) {
  const [register, setRegister] = useState<LabRegister | null>(null);
  const [editing, setEditing] = useState<Lab | "new" | null>(null);
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
  if (!register) return null;
  return (
    <section className="stf-card lab-register" aria-label="Lab register">
      <div className="stf-dir-bar">
        <div className="lab-title">
          <FlaskConical size={18} aria-hidden="true" />
          <div>
            <strong>Labs</strong>
            <p>
              {register.total} registered ·{" "}
              {register.items.filter((l) => l.incharge_employee_code).length}{" "}
              with an in-charge
            </p>
          </div>
        </div>
        {register.can_manage && (
          <div className="stf-directory-actions">
            <button
              type="button"
              className="stf-directory-add"
              onClick={() => setEditing("new")}
            >
              <Plus size={14} aria-hidden="true" />
              Register lab
            </button>
          </div>
        )}
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
              {register.can_manage && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {register.items.map((lab) => (
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
                    lab.subjects.map((s) => s.name).join(", ")
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
                {register.can_manage && (
                  <td>
                    <IconAction
                      kind="edit"
                      label={`Edit ${lab.name}`}
                      onClick={() => setEditing(lab)}
                    />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {register.items.length === 0 && (
          <p className="stf-empty">
            No labs registered yet.
            {register.can_manage && " Use Register lab to add the first one."}
          </p>
        )}
      </div>
      {editing && (
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
}
