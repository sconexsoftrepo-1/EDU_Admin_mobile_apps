"use client";
import { useState, type ChangeEvent, type SyntheticEvent } from "react";
import Image from "next/image";
import { Camera, CheckCircle2, ArrowDown } from "lucide-react";
import { useCollege } from "./CollegeStore";
import { money } from "@/data/colleges";
import { balance } from "@/lib/colleges/store";
import { FormPhoneInput, isPhoneField } from "./CountryCodePicker";
import UploadBox from "./UploadBox";
import DateInput from "./DateInput";
export type FormField = {
  key: string;
  label: string;
  type?: string;
  options?: string[];
  value?: string;
  required?: boolean;
  section?: string;
  help?: string;
};
function group(field: FormField, type: string) {
  if (field.section) return field.section;
  if (field.key === "studentId") return "Student selection";
  if (type === "payment")
    return ["method", "reference", "outcome"].includes(field.key)
      ? "Payment & confirmation"
      : "Fee allocation";
  if (type === "leave.request")
    return ["departure", "expectedReturn"].includes(field.key)
      ? "Travel schedule"
      : ["pickup", "relationship", "contact"].includes(field.key)
        ? "Guardian & travel details"
        : "Leave details";
  if (type === "certificate.request")
    return field.key === "note"
      ? "Purpose & supporting details"
      : "Certificate details";
  if (type.startsWith("expense") || type.startsWith("invoice"))
    return ["method", "reference"].includes(field.key)
      ? "Payment instructions"
      : field.key === "note"
        ? "Supporting details"
        : "Document & allocation";
  if (type === "notification")
    return field.key === "note" ? "Message content" : "Audience & delivery";
  return field.type === "textarea" ? "Additional information" : "Details";
}
export default function ERPFormFields({
  fields,
  type,
  onBusyChange,
}: {
  fields: FormField[];
  type: string;
  onBusyChange?: (busy: boolean) => void;
}) {
  const { state, role } = useCollege();
  const [studentQuery, setStudentQuery] = useState("");
  const [values, setValues] = useState<Record<string, string>>(() =>
      Object.fromEntries(
        fields.map((f) => [f.key, f.value ?? f.options?.[0] ?? ""]),
      ),
    ),
    [errors, setErrors] = useState<Record<string, string>>({}),
    [photo, setPhoto] = useState(
      fields.find((f) => f.type === "photo")?.value || "",
    ),
    [photoError, setPhotoError] = useState(""),
    [uploading, setUploading] = useState(false);
  const sectionOrder = [
    "Student identity",
    "Contact & address",
    "Guardian & emergency contact",
    "Academic information",
    "Additional information",
  ];
  const groups = Array.from(new Set(fields.map((f) => group(f, type)))).sort(
    (a, b) => {
      const ai = sectionOrder.indexOf(a),
        bi = sectionOrder.indexOf(b);
      return ai < 0 || bi < 0 ? 0 : ai - bi;
    },
  );
  const required = fields.filter((f) => f.required),
    complete = required.filter((f) => values[f.key]?.trim()).length;
  const change = (key: string, value: string) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => ({ ...e, [key]: "" }));
  };
  const upload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoError("");
    if (
      !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
      file.size > 5 * 1024 * 1024
    ) {
      setPhotoError("Choose a PNG, JPG, or WebP image under 5 MB.");
      e.target.value = "";
      return;
    }
    setUploading(true);
    onBusyChange?.(true);
    let url = "";
    try {
      url = URL.createObjectURL(file);
      const image = new window.Image();
      image.src = url;
      await image.decode();
      const scale = Math.min(
        1,
        320 / Math.max(image.naturalWidth, image.naturalHeight),
      );
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      canvas
        .getContext("2d")!
        .drawImage(image, 0, 0, canvas.width, canvas.height);
      const data = canvas.toDataURL("image/webp", 0.82);
      if (data.length > 250000)
        throw Error(
          "Image is too large after optimization. Choose a smaller photo.",
        );
      setPhoto(data);
      change("photo", data);
    } catch {
      setPhotoError(
        "This image could not be read. Choose a valid PNG, JPG, or WebP file.",
      );
    } finally {
      if (url) URL.revokeObjectURL(url);
      setUploading(false);
      onBusyChange?.(false);
      e.target.value = "";
    }
  };
  const selected = state.students.find((st) => st.id === values.studentId);
  return (
    <div className="erp-form-flow">
      <div className="erp-form-progress">
        <span>
          {required.length
            ? `${complete} of ${required.length} required fields complete`
            : "Complete the details you want to update"}
        </span>
        <progress
          aria-label="Form completion"
          value={complete}
          max={Math.max(1, required.length)}
        />
      </div>
      {groups.length > 1 && (
        <nav className="erp-form-steps" aria-label="Form sections">
          {groups.map((name, i) => (
            <button
              key={name}
              type="button"
              onClick={(e) => {
                const fieldset = e.currentTarget
                  .closest("form")
                  ?.querySelector<HTMLElement>(`[data-form-section="${i}"]`);
                fieldset?.scrollIntoView({
                  behavior: matchMedia("(prefers-reduced-motion: reduce)")
                    .matches
                    ? "instant"
                    : "smooth",
                  block: "start",
                });
                fieldset
                  ?.querySelector<HTMLElement>(
                    "input:not([type=hidden]),select,textarea",
                  )
                  ?.focus({ preventScroll: true });
              }}
            >
              <span>{i + 1}</span>
              {name}
              <ArrowDown size={12} />
            </button>
          ))}
        </nav>
      )}
      {groups.map((name, i) => (
        <fieldset className="erp-form-section" data-form-section={i} key={name}>
          <legend>
            <span>{String(i + 1).padStart(2, "0")}</span>
            {name}
          </legend>
          <div className="erp-form-section-fields">
            {fields
              .filter((f) => group(f, type) === name)
              .map((f) => {
                if (f.type === "photo")
                  return (
                    <div className="erp-photo-field" key={f.key}>
                      <div className="erp-photo-preview">
                        {photo ? (
                          <Image
                            src={photo}
                            width={88}
                            height={104}
                            alt="Student photo preview"
                            unoptimized
                          />
                        ) : (
                          <Camera size={30} />
                        )}
                      </div>
                      <div>
                        <span className="erp-photo-label">{f.label}</span>
                        <UploadBox
                          label={f.label}
                          accept="image/png,image/jpeg,image/webp"
                          onChange={upload}
                          disabled={uploading}
                          placeholder="No photo chosen"
                        />
                        <input type="hidden" name={f.key} value={photo} />
                        <small>
                          {uploading
                            ? "Optimizing image…"
                            : "PNG, JPG or WebP, up to 5 MB. Optimized and stored in this browser only."}
                        </small>
                        {photo && (
                          <button
                            type="button"
                            onClick={() => {
                              setPhoto("");
                              change(f.key, "");
                            }}
                          >
                            Remove photo
                          </button>
                        )}
                        {photoError && <p role="alert">{photoError}</p>}
                      </div>
                    </div>
                  );
                const props = {
                  id: `erp-field-${f.key}`,
                  name: f.key,
                  "aria-label": f.label,
                  required: f.required,
                  defaultValue: f.value,
                  "aria-invalid": !!errors[f.key],
                  "aria-describedby": `erp-help-${f.key}`,
                  onChange: (
                    e: ChangeEvent<
                      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
                    >,
                  ) => change(f.key, e.target.value),
                  onInvalid: (
                    e: SyntheticEvent<
                      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
                    >,
                  ) =>
                    setErrors((old) => ({
                      ...old,
                      [f.key]: e.currentTarget.validationMessage,
                    })),
                };
                return (
                  <div
                    key={f.key}
                    className={`erp-form-field ${f.type === "textarea" ? "is-full" : ""}`}
                  >
                    <label htmlFor={props.id}>
                      {f.label}
                      {f.required ? (
                        <span aria-hidden="true"> *</span>
                      ) : (
                        <small aria-hidden="true"> Optional</small>
                      )}
                    </label>
                    {f.key === "studentId" && (
                      <div className="erp-student-picker-search">
                        <input
                          type="search"
                          aria-label="Find student by name or roll number"
                          placeholder="Find a student by name or roll number"
                          value={studentQuery}
                          onChange={(e) => setStudentQuery(e.target.value)}
                        />
                        <small>
                          The selected student remains in the list while you
                          search.
                        </small>
                      </div>
                    )}
                    {f.type === "select" ? (
                      <select {...props}>
                        {f.options
                          ?.filter(
                            (o) =>
                              f.key !== "studentId" ||
                              o === values.studentId ||
                              `${o} ${state.students.find((st) => st.id === o)?.name || ""}`
                                .toLowerCase()
                                .includes(studentQuery.toLowerCase()),
                          )
                          .map((o) => (
                            <option value={o} key={o}>
                              {f.key === "paymentTaxMode"
                                ? {
                                    "not-configured":
                                      "Not recorded / not configured",
                                    "no-tax": "No GST applied (configured)",
                                    "intra-state": "CGST + SGST included",
                                    "inter-state": "IGST included",
                                  }[o] || o
                                : f.key === "studentId"
                                  ? `${state.students.find((st) => st.id === o)?.name || "Student"} — ${o}`
                                  : f.key === "room"
                                    ? `${state.rooms.find((r) => r.id === o)?.name || o} (${o})`
                                    : o}
                            </option>
                          ))}
                      </select>
                    ) : f.type === "textarea" ? (
                      <textarea {...props} rows={4} />
                    ) : f.type === "date" ? (
                      <DateInput
                        id={props.id}
                        name={f.key}
                        aria-label={f.label}
                        required={f.required}
                        defaultValue={f.value}
                        onChange={(e) => change(f.key, e.target.value)}
                      />
                    ) : isPhoneField(f.key, f.type) ? (
                      <FormPhoneInput
                        id={props.id}
                        name={f.key}
                        label={f.label}
                        required={f.required}
                        defaultValue={f.value}
                        onValue={(v) => change(f.key, v)}
                      />
                    ) : (
                      <input
                        {...props}
                        type={f.type || "text"}
                        min={
                          f.type === "number"
                            ? f.key === "paymentGstRate"
                              ? "0"
                              : "0.01"
                            : undefined
                        }
                        step={f.type === "number" ? "0.01" : undefined}
                        autoComplete="off"
                      />
                    )}
                    <small
                      id={`erp-help-${f.key}`}
                      className={errors[f.key] ? "erp-field-error" : ""}
                    >
                      {errors[f.key] ||
                        f.help ||
                        (f.type === "email"
                          ? "Use a fictional email address."
                          : f.key === "studentId"
                            ? "Search the student directory first if you need to confirm the roll number."
                            : f.type === "datetime-local"
                              ? "Select local date and time."
                              : f.type === "number"
                                ? "Enter an amount with up to two decimal places."
                                : "")}
                    </small>
                  </div>
                );
              })}
          </div>
          {name === "Student selection" && selected && (
            <aside className="erp-selected-student">
              <CheckCircle2 size={20} />
              <div>
                <strong>{selected.name}</strong>
                <span>
                  {selected.id} · {selected.program} · {selected.year}
                </span>
                {["Super Admin", "Accounts Manager", "Student"].includes(
                  role || "",
                ) && (
                  <small>Outstanding: {money(balance(state, selected))}</small>
                )}
              </div>
            </aside>
          )}
        </fieldset>
      ))}
      <details className="erp-form-review">
        <summary>Review entered details before saving</summary>
        <dl>
          {fields
            .filter((f) => f.type !== "photo")
            .map((f) => (
              <div key={f.key}>
                <dt>{f.label}</dt>
                <dd>{values[f.key] || "Not provided"}</dd>
              </div>
            ))}
        </dl>
        <p>
          Saving updates this college’s browser-local demo records. Use Cancel
          to discard the form.
        </p>
      </details>
    </div>
  );
}
