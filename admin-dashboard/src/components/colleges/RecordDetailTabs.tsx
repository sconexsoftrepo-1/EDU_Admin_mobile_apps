"use client";

import { FileText, FolderOpen, KeyRound } from "lucide-react";

export default function RecordDetailTabs({
  active,
  onChange,
  label,
}: {
  active: "details" | "files" | "logins";
  onChange: (tab: "details" | "files" | "logins") => void;
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
      <button
        type="button"
        aria-current={active === "logins" ? "page" : undefined}
        aria-pressed={active === "logins"}
        onClick={() => onChange("logins")}
      >
        <KeyRound size={15} aria-hidden="true" />
        Login management
      </button>
    </nav>
  );
}
