"use client";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type FormEvent,
} from "react";
import { Check, ChevronRight, LoaderCircle, X } from "lucide-react";
import { api, type Field, type LookupOption, type Row } from "@/services/api";
import { useOptionalCollege } from "./CollegeStore";
import type { ResourceFormResponse } from "@/services/api/modules/workspace/consts";
import { successText, toast } from "./toast";
import {
  readWorkspaceCache,
  refreshWorkspaceCache,
  workspaceCacheKey,
} from "@/lib/colleges/workspace-cache";
import Select from "./SearchSelect";
import { FormPhoneInput, isPhoneField } from "./CountryCodePicker";
import DateInput from "./DateInput";
const pretty = (key: string) =>
  key
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/^./, (c) => c.toUpperCase());
function standard(fields: Field[]) {
  return fields.map((f) => ({
    ...f,
    key: f.key || f.name!,
    label: f.label || pretty(f.name || f.key || "Field"),
    type: f.type.includes("timestamp")
      ? "datetime-local"
      : f.type === "boolean"
        ? "boolean"
        : f.type === "date"
          ? "date"
          : f.type.startsWith("time")
            ? "time"
            : [
                  "numeric",
                  "integer",
                  "bigint",
                  "smallint",
                  "number",
                  "decimal",
                ].includes(f.type)
              ? "number"
              : ["jsonb", "json", "ARRAY"].includes(f.type)
                ? "json"
                : f.type,
  }));
}
const sections: Record<string, string> = {
  student: "Student details",
  father: "Guardian details",
  mother: "Mother’s details",
  parent: "Parent / guardian details",
  guardian: "Guardian details",
  application: "Admission details",
  qualification: "Previous education",
  employee: "Employee details",
  teacher: "Teaching details",
  staff: "Staff details",
  salary: "Salary details",
  course: "Course details",
  program: "Course details",
  batch: "Batch details",
  link: "Relationship & permissions",
};
export default function RecordFormDrawer({
  title,
  fields,
  initial = {},
  onSave,
  onClose,
  renderBrowse,
}: {
  title: string;
  fields: Field[];
  initial?: Row;
  onSave: (row: Row) => Promise<void>;
  onClose: () => void;
  renderBrowse?: (values: Row) => ReactNode;
}) {
  const session = useOptionalCollege();
  const [browsing, setBrowsing] = useState(false);
  const [browseValues, setBrowseValues] = useState<Row>({});
  const dialog = useRef<HTMLDialogElement>(null);
  const formId = useId();
  const normalized = standard(fields);
  const isFeeHead = normalized.some((f) => f.key === "collection_ownership");
  const [ownership, setOwnership] = useState(
    String(initial.collection_ownership || "internal"),
  );
  const hasParentDetails = normalized.some((field) =>
    field.key.startsWith("parent."),
  );
  const parentLinkFields = new Set([
    "link.relationship",
    "link.is_primary",
    "link.can_pickup",
  ]);
  const grouped = new Map<string, typeof normalized>();
  for (const field of normalized) {
    const prefix = field.key.includes(".") ? field.key.split(".")[0] : "";
    const group =
      hasParentDetails &&
      (prefix === "parent" || parentLinkFields.has(field.key))
        ? sections.parent
        : field.section ||
          (prefix ? sections[prefix] || pretty(prefix) : "Details");
    grouped.set(group, [...(grouped.get(group) || []), field]);
  }
  const groups = [...grouped];
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [lookups, setLookups] = useState<Record<string, LookupOption[]>>(() =>
    Object.fromEntries(
      [
        ...new Set(fields.flatMap((f) => (f.reference ? [f.reference] : []))),
      ].flatMap((table) => {
        const cached = readWorkspaceCache<LookupOption[]>(
          workspaceCacheKey(
            session?.account?.code,
            session?.activeRole?.code,
            `lookup:${table}`,
          ),
        );
        return cached ? [[table, cached]] : [];
      }),
    ),
  );
  const [referenceValues, setReferenceValues] = useState<
    Record<string, string>
  >({});
  const [referenceForm, setReferenceForm] = useState<{
    field: string;
    table: string;
    bound: ResourceFormResponse;
  } | null>(null);
  const [loadingReference, setLoadingReference] = useState("");
  async function addReference(field: string, table: string) {
    setLoadingReference(field);
    setError("");
    try {
      const bound = await api.workspace.resourceForm(table);
      if (!bound.resource?.actions.includes("create"))
        throw new Error(
          "You do not have permission to create these records. Ask an administrator to add one.",
        );
      setReferenceForm({ field, table, bound });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to open related form");
    } finally {
      setLoadingReference("");
    }
  }
  const [lookupErrors, setLookupErrors] = useState<Record<string, string>>({});
  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (!node.open) node.showModal();
    return () => {
      document.body.style.overflow = overflow;
      requestAnimationFrame(() => {
        if (!node.isConnected && previous?.isConnected) previous.focus();
      });
    };
  }, []);
  useEffect(() => {
    let active = true;
    void Promise.all(
      [
        ...new Set(fields.flatMap((f) => (f.reference ? [f.reference] : []))),
      ].map(async (table) => {
        try {
          const items = await refreshWorkspaceCache(
            workspaceCacheKey(
              session?.account?.code,
              session?.activeRole?.code,
              `lookup:${table}`,
            ),
            () => api.workspace.lookup(table),
          );
          if (active) setLookups((old) => ({ ...old, [table]: items }));
        } catch {
          if (active) {
            setLookups((old) => ({ ...old, [table]: old[table] || [] }));
            setLookupErrors((old) => ({
              ...old,
              [table]: "Options could not be loaded. Try reopening this form.",
            }));
          }
        }
      }),
    );
    return () => {
      active = false;
    };
  }, [fields, session?.account?.code, session?.activeRole?.code]);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const data = new FormData(event.currentTarget),
        row: Row = {};
      for (const field of normalized) {
        if (
          isFeeHead &&
          field.key === "external_party_code" &&
          ownership === "internal"
        ) {
          row[field.key] = null;
          continue;
        }
        const value = data.get(field.key);
        if (field.type === "boolean") {
          row[field.key] = value === "on";
          continue;
        }
        if (value === null || value === "") {
          if (initial[field.key] !== undefined) row[field.key] = null;
          continue;
        }
        let parsed: unknown = value;
        if (field.type === "json") {
          try {
            parsed = JSON.parse(String(value));
          } catch {
            throw new Error(
              `${field.label}: enter valid JSON, for example {} for no rules.`,
            );
          }
        }
        row[field.key] =
          field.type === "json"
            ? parsed
            : field.type === "datetime-local"
              ? new Date(String(value)).toISOString()
              : field.type === "number" &&
                  ["integer", "bigint", "smallint"].includes(
                    fields.find((f) => (f.name || f.key) === field.key)?.type ||
                      "",
                  )
                ? Number(value)
                : String(value);
      }
      await onSave(row);
      dialog.current?.close();
      toast.success(successText(title));
    } catch (e) {
      const text = e instanceof Error ? e.message : "Unable to save";
      setError(text);
      toast.error("Could not save", text);
    } finally {
      setBusy(false);
    }
  }
  const close = () => {
    if (!busy) dialog.current?.close();
  };
  const pending = normalized.some(
    (f) =>
      (f.required ||
        (isFeeHead &&
          f.key === "external_party_code" &&
          ownership === "external")) &&
      f.reference &&
      lookups[f.reference] === undefined &&
      !initial[f.key],
  );
  const primary = /student.*enrol|enrol.*student/i.test(title)
    ? "Enroll student"
    : /^create|^add /i.test(title)
      ? "Create record"
      : "Save changes";
  return (
    <>
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
            <p className="edu-drawer-eyebrow">College records</p>
            <h2 id={`${formId}-title`}>{title}</h2>
            <p>
              Enter the details below. Required fields are marked{" "}
              <span aria-hidden="true">*</span>.
            </p>
          </div>
          <button
            type="button"
            className="edu-drawer-close"
            aria-label="Close form"
            onClick={close}
            disabled={busy}
          >
            <X size={20} />
          </button>
        </header>
        {renderBrowse && (
          <div className="edu-batch-tabbar">
            <div
              className="edu-batch-tabs"
              role="group"
              aria-label="Batch workspace view"
            >
              <button
                type="button"
                aria-pressed={!browsing}
                disabled={busy}
                onClick={() => setBrowsing(false)}
              >
                Create batch
              </button>
              <button
                type="button"
                aria-pressed={browsing}
                disabled={busy}
                onClick={() => {
                  const form = document.getElementById(
                    formId,
                  ) as HTMLFormElement | null;
                  if (form)
                    setBrowseValues(Object.fromEntries(new FormData(form)));
                  setBrowsing(true);
                }}
              >
                Batch cards
              </button>
            </div>
          </div>
        )}
        {browsing && renderBrowse && (
          <div className="edu-drawer-body">{renderBrowse(browseValues)}</div>
        )}
        {!renderBrowse && !browsing && groups.length > 1 && (
          <nav className="edu-drawer-sections" aria-label="Form sections">
            {groups.map(([name], index) => (
              <button
                key={name}
                type="button"
                onClick={() =>
                  document
                    .getElementById(`${formId}-section-${index}`)
                    ?.scrollIntoView({
                      behavior: window.matchMedia(
                        "(prefers-reduced-motion: reduce)",
                      ).matches
                        ? "instant"
                        : "smooth",
                      block: "start",
                    })
                }
              >
                {name}
                <ChevronRight size={13} />
              </button>
            ))}
          </nav>
        )}
        <form
          onSubmit={save}
          hidden={browsing}
          style={browsing ? { display: "none" } : undefined}
          className="edu-drawer-form"
          id={formId}
          aria-busy={busy}
        >
          <div className="edu-drawer-body">
            {groups.map(([name, items], index) => (
              <section
                className="edu-form-section"
                key={name}
                id={`${formId}-section-${index}`}
                aria-labelledby={`${formId}-section-title-${index}`}
              >
                <div className="edu-form-section-heading">
                  <h3 id={`${formId}-section-title-${index}`}>{name}</h3>
                  {items.every((f) => !f.required) && <span>Optional</span>}
                </div>
                <div className="edu-field-grid">
                  {items.map((original) => {
                    if (
                      isFeeHead &&
                      original.key === "external_party_code" &&
                      ownership === "internal"
                    )
                      return null;
                    const f =
                      isFeeHead && original.key === "external_party_code"
                        ? { ...original, required: true }
                        : original;
                    const options = f.reference
                      ? lookups[f.reference]
                      : undefined;
                    const label = f.key.includes(".")
                      ? pretty(f.label.replace(/^[^:]+:\s*/, ""))
                      : f.label;
                    const multiline =
                      f.type === "json" ||
                      f.type === "textarea" ||
                      /(^|[._])(address|remarks|notes|description|body)$/.test(
                        f.key,
                      );
                    const value = initial[f.key];
                    return (
                      <label
                        key={f.key}
                        className={`${multiline ? "edu-field-wide" : ""} ${f.type === "boolean" ? "edu-field-checkbox" : ""}`}
                      >
                        <span>
                          {label}
                          {f.required && f.key !== "code" && (
                            <span className="edu-required" aria-hidden="true">
                              {" "}
                              *
                            </span>
                          )}
                          {f.key === "link.is_primary" && (
                            <small className="edu-checkbox-description">
                              Use as the main contact for student updates.
                            </small>
                          )}
                        </span>
                        {f.type === "fee-category" ? (
                          <>
                            <input
                              name={f.key}
                              aria-label={label}
                              required={f.required}
                              defaultValue={String(value || "")}
                              list={`${formId}-fee-categories`}
                              maxLength={80}
                              placeholder="Choose or type a category"
                            />
                            <datalist id={`${formId}-fee-categories`}>
                              {(f.choices || []).map((category) => (
                                <option key={category} value={category} />
                              ))}
                            </datalist>
                          </>
                        ) : f.type === "boolean" ? (
                          <input
                            type="checkbox"
                            name={f.key}
                            defaultChecked={value === true}
                          />
                        ) : f.reference ||
                          f.choices?.length ||
                          f.options?.length ? (
                          <Select
                            aria-label={label}
                            name={f.key}
                            value={
                              f.reference
                                ? (referenceValues[f.key] ??
                                  String(value ?? ""))
                                : undefined
                            }
                            onChange={(event) => {
                              if (f.reference)
                                setReferenceValues((old) => ({
                                  ...old,
                                  [f.key]: event.target.value,
                                }));
                              if (isFeeHead && f.key === "collection_ownership")
                                setOwnership(event.target.value);
                            }}
                            required={f.required}
                            defaultValue={String(value ?? "")}
                            disabled={
                              !!f.reference && options === undefined && !value
                            }
                          >
                            <option value="">
                              {f.reference && options === undefined
                                ? "Loading options…"
                                : f.reference && options?.length === 0
                                  ? "No records available"
                                  : `Select ${label.toLowerCase()}`}
                            </option>
                            {f.reference ? (
                              <>
                                {value &&
                                  !options?.some(
                                    (o) => o.value === String(value),
                                  ) && (
                                    <option value={String(value)}>
                                      {String(value)}
                                    </option>
                                  )}
                                {options?.map((o) => (
                                  <option key={o.value} value={o.value}>
                                    {o.label}
                                  </option>
                                ))}
                              </>
                            ) : (
                              (f.choices?.length
                                ? f.choices
                                : f.options || []
                              ).map((o) => (
                                <option key={o} value={o}>
                                  {isFeeHead && f.key === "collection_ownership"
                                    ? o === "internal"
                                      ? "Internal — college income"
                                      : "External — collected for another organization"
                                    : isFeeHead && f.key === "category"
                                      ? {
                                          academic: "Academic — all students",
                                          hostel: "Hostel — residents only",
                                          transport:
                                            "Transport — bus users only",
                                          other: "Other — all students",
                                        }[o] || o
                                      : f.key === "previous_education.level"
                                        ? o === "ssc"
                                          ? "SSC / 10th class"
                                          : o === "intermediate"
                                            ? "Intermediate"
                                            : o
                                        : o}
                                </option>
                              ))
                            )}
                          </Select>
                        ) : multiline ? (
                          <textarea
                            name={f.key}
                            required={f.required}
                            rows={f.type === "json" ? 5 : 3}
                            defaultValue={
                              value === undefined
                                ? ""
                                : f.type === "json"
                                  ? JSON.stringify(value, null, 2)
                                  : String(value)
                            }
                          />
                        ) : f.type === "date" ? (
                          <DateInput
                            name={f.key}
                            aria-label={label}
                            required={f.required}
                            defaultValue={
                              value === undefined || value === null
                                ? ""
                                : String(value)
                            }
                          />
                        ) : isPhoneField(f.key, f.type) ? (
                          <FormPhoneInput
                            name={f.key}
                            label={label}
                            required={f.required}
                            defaultValue={
                              value === undefined || value === null
                                ? ""
                                : String(value)
                            }
                          />
                        ) : (
                          <input
                            name={f.key}
                            type={
                              [
                                "date",
                                "datetime-local",
                                "time",
                                "number",
                                "email",
                                "password",
                              ].includes(f.type)
                                ? f.type
                                : "text"
                            }
                            step="any"
                            required={f.required && f.key !== "code"}
                            defaultValue={
                              value === undefined ? "" : String(value)
                            }
                          />
                        )}{" "}
                        {f.reference && (
                          <button
                            type="button"
                            disabled={busy || !!loadingReference}
                            onClick={(event) => {
                              event.preventDefault();
                              void addReference(f.key, f.reference!);
                            }}
                          >
                            {loadingReference === f.key
                              ? "Loading…"
                              : `Add ${pretty(f.reference.replaceAll("_", " "))}`}
                          </button>
                        )}
                        {f.help && (
                          <small className="edu-field-help">{f.help}</small>
                        )}
                        {f.reference && lookupErrors[f.reference] && (
                          <small className="edu-field-error">
                            {lookupErrors[f.reference]}
                          </small>
                        )}
                      </label>
                    );
                  })}
                </div>
              </section>
            ))}
            {error && (
              <p role="alert" className="edu-error">
                {error}
              </p>
            )}
          </div>
          <footer className="edu-drawer-footer">
            <span>Your changes are saved when you submit this form.</span>
            <div>
              <button type="button" onClick={close} disabled={busy}>
                Cancel
              </button>
              <button
                type="submit"
                className="edu-primary"
                disabled={busy || pending}
              >
                {busy ? (
                  <LoaderCircle size={16} className="edu-spin" />
                ) : (
                  <Check size={16} />
                )}{" "}
                {busy ? "Saving…" : primary}
              </button>
            </div>
          </footer>
        </form>
      </dialog>
      {referenceForm && (
        <RecordFormDrawer
          title={`Create ${referenceForm.bound.resource!.title}`}
          fields={[
            ...referenceForm.bound.resource!.fields.map((field) => {
              const custom = referenceForm.bound.form?.fields.find(
                (item) => item.key === field.name,
              );
              return custom
                ? {
                    ...field,
                    label: custom.label,
                    required: field.required || custom.required,
                    choices: custom.options,
                  }
                : field;
            }),
            ...(referenceForm.bound.form?.fields.filter(
              (field) =>
                !referenceForm.bound.resource!.fields.some(
                  (item) => item.name === field.key,
                ),
            ) || []),
          ]}
          initial={referenceForm.bound.defaults}
          onClose={() => setReferenceForm(null)}
          onSave={async (values) => {
            const { field, table, bound } = referenceForm;
            const created = await api.workspace.create(table, {
              values,
              form_code: bound.form?.code,
              form_revision: bound.form?.revision,
            });
            const createdOption = {
              value: String(created.code),
              label: String(
                created.name || created.registration_number || created.code,
              ),
            };
            const loaded = await refreshWorkspaceCache(
              workspaceCacheKey(
                session?.account?.code,
                session?.activeRole?.code,
                `lookup:${table}`,
              ),
              () => api.workspace.lookup(table),
            ).catch(() => lookups[table] || []);
            // A saved record remains selectable if reloading the options fails or
            // the new code falls outside the lookup endpoint's first 1000 rows.
            const options = loaded.some(
              (option) => option.value === createdOption.value,
            )
              ? loaded
              : [...loaded, createdOption];
            setLookups((old) => ({ ...old, [table]: options }));
            setLookupErrors((old) => ({ ...old, [table]: "" }));
            setReferenceValues((old) => ({
              ...old,
              [field]: String(created.code),
            }));
          }}
        />
      )}
    </>
  );
}
