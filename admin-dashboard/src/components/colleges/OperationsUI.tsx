"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { X, ArrowRight } from "lucide-react";
import { useCollege } from "./CollegeStore";
export type OpsField = {
  key: string;
  label: string;
  type?: string;
  value?: string;
  options?: { value: string; label: string }[];
  required?: boolean;
  help?: string;
};
export function OpsSheet({
  title,
  fields,
  onSave,
  onClose,
  children,
}: {
  title: string;
  fields: OpsField[];
  onSave: (data: Record<string, string>) => boolean;
  onClose: () => void;
  children?: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState("");
  const { message } = useCollege();
  useEffect(() => {
    const d = dialog.current;
    d?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      d?.close();
      document.body.style.overflow = overflow;
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="ops-sheet"
      data-panel-size={
        fields.length > 12 ? "wide" : fields.length > 5 ? "medium" : "compact"
      }
      aria-labelledby="ops-sheet-title"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          try {
            const data: Record<string, string> = {};
            for (const [key, value] of form.entries()) {
              if (typeof value === "string") data[key] = value;
              else if (value.size) {
                if (value.size > 200000)
                  throw Error("Demo attachments must be smaller than 200 KB.");
                if (
                  ![
                    "application/pdf",
                    "image/png",
                    "image/jpeg",
                    "image/webp",
                    "text/plain",
                  ].includes(value.type)
                )
                  throw Error("Choose a PDF, image or plain-text attachment.");
                const url = await new Promise<string>((resolve, reject) => {
                  const reader = new FileReader();
                  reader.onload = () => resolve(String(reader.result));
                  reader.onerror = () =>
                    reject(Error("Unable to read this attachment."));
                  reader.readAsDataURL(value);
                });
                data[key] = JSON.stringify({
                  name: value.name,
                  type: value.type,
                  size: value.size,
                  url,
                });
              }
            }
            if (onSave(data)) onClose();
            else
              setError(
                "Unable to save. Check the message below and correct the form.",
              );
          } catch (err) {
            setError(err instanceof Error ? err.message : "Unable to save");
          }
        }}
      >
        <header>
          <div>
            <small>Review details before saving</small>
            <h2 id="ops-sheet-title">{title}</h2>
          </div>
          <button type="button" aria-label="Close form" onClick={onClose}>
            <X size={20} />
          </button>
        </header>
        <div className="ops-sheet-body">
          {children}
          <div className="ops-fields">
            {fields.map((f) => (
              <label key={f.key}>
                <span>
                  {f.label}
                  {f.required !== false ? " *" : ""}
                </span>
                {f.options ? (
                  <select
                    name={f.key}
                    aria-label={f.label}
                    defaultValue={f.value || ""}
                    required={f.required !== false}
                  >
                    <option value="">Select {f.label.toLowerCase()}</option>
                    {f.options.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : f.type === "textarea" ? (
                  <textarea
                    name={f.key}
                    aria-label={f.label}
                    defaultValue={f.value || ""}
                    required={f.required !== false}
                    rows={4}
                  />
                ) : (
                  <input
                    name={f.key}
                    aria-label={f.label}
                    type={f.type || "text"}
                    defaultValue={f.type === "file" ? undefined : f.value || ""}
                    accept={
                      f.type === "file"
                        ? ".pdf,.png,.jpg,.jpeg,.webp,.txt"
                        : undefined
                    }
                    required={f.required !== false}
                    step={f.type === "number" ? "0.01" : undefined}
                  />
                )}{" "}
                {f.help && <small>{f.help}</small>}
              </label>
            ))}
          </div>
          {error && (
            <p role="alert">
              {error} {message}
            </p>
          )}
        </div>
        <footer>
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="erp-primary">
            Save changes <ArrowRight size={15} />
          </button>
        </footer>
      </form>
    </dialog>
  );
}
export function OpsMetrics({ items }: { items: [string, string | number][] }) {
  return (
    <div className="ops-metrics">
      {items.map(([label, value]) => (
        <article key={label}>
          <small>{label}</small>
          <strong>{value}</strong>
        </article>
      ))}
    </div>
  );
}
export function OpsEmpty({ children }: { children: ReactNode }) {
  return <p className="ops-empty">{children}</p>;
}
