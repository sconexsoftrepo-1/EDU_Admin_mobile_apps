"use client";

import { FileText, FolderOpen } from "lucide-react";

export default function RecordDetailTabs({
  active,
  onChange,
  label,
}: {
  active: "details" | "files";
  onChange: (tab: "details" | "files") => void;
  label: string;
}) {
  return (
    <nav className="edu-detail-tabs" aria-label={label}>
      <button
        type="button"
        aria-current={active === "details" ? "page" : undefined}
        aria-pressed={active === "details"}
        onClick={() => onChange("details")}
      >
        <FileText size={15} aria-hidden="true" />
        Registered details
      </button>
      <button
        type="button"
        aria-current={active === "files" ? "page" : undefined}
        aria-pressed={active === "files"}
        onClick={() => onChange("files")}
      >
        <FolderOpen size={15} aria-hidden="true" />
        Documents & files
      </button>
    </nav>
  );
}
