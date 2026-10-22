"use client";
import { useState, type ReactNode } from "react";
import { Eye } from "lucide-react";
import type { PDFMode } from "@/lib/colleges/download";
export default function PDFActions({
  onAction,
  children,
  className,
}: {
  onAction: (mode: PDFMode) => unknown;
  children: ReactNode;
  className?: string;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function act(mode: PDFMode) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await onAction(mode);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Unable to generate the PDF. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <span className="erp-pdf-actions" aria-busy={busy}>
      <button type="button" onClick={() => act("view")} disabled={busy}>
        <Eye size={14} /> View PDF
      </button>
      <button
        type="button"
        className={className}
        onClick={() => act("download")}
        disabled={busy}
      >
        {children}
      </button>
      {busy && <small role="status">Preparing PDF…</small>}
      {error && <span role="alert">{error}</span>}
    </span>
  );
}
