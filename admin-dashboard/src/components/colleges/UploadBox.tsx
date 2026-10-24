"use client";
/**
 * Upload field in one box: file name (or "No file chosen") on the left, "📎 Upload" on the right
 * with a light grey icon tile. Wraps a native file input, so existing onChange handlers keep working.
 */
import { useState, type ChangeEvent } from "react";
import { Paperclip } from "lucide-react";
import "./upload-box.css";

export function UploadButton({
  label,
  hasFile,
  accept,
  required,
  name,
  disabled,
  onChange,
}: {
  label: string;
  hasFile?: boolean;
  accept?: string;
  required?: boolean;
  name?: string;
  disabled?: boolean;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label className="upl-btn" title={label}>
      <span className="upl-icon" aria-hidden="true">
        <Paperclip size={14} />
      </span>
      {hasFile ? "Change" : "Upload"}
      <input
        type="file"
        name={name}
        aria-label={label}
        accept={accept}
        required={required}
        disabled={disabled}
        onChange={onChange}
      />
    </label>
  );
}

/** Drop-in for `<input type="file">` (uncontrolled): shows the picked file's name. */
export default function UploadBox({
  label,
  accept,
  required,
  name,
  disabled,
  onChange,
  placeholder = "No file chosen",
}: {
  label: string;
  accept?: string;
  required?: boolean;
  name?: string;
  disabled?: boolean;
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
}) {
  const [picked, setPicked] = useState("");
  return (
    <span className="upl-box">
      <span className={picked ? "upl-text" : "upl-text is-empty"}>
        {picked || placeholder}
      </span>
      <UploadButton
        label={label}
        hasFile={!!picked}
        accept={accept}
        required={required}
        name={name}
        disabled={disabled}
        onChange={(e) => {
          setPicked(e.target.files?.[0]?.name || "");
          onChange?.(e);
        }}
      />
    </span>
  );
}
