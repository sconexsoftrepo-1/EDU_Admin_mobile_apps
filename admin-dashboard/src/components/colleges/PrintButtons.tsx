"use client";
/**
 * "View PDF" (in-app preview) and "Download PDF" for a printable document from the backend
 * (GET print/{path}): student, enquiry, employee, letters, fee statement, expense, scholarship.
 */
import { Download } from "lucide-react";
import { api } from "@/services/api";
import PDFActions from "./PDFActions";

export default function PrintButtons({
  path,
  filename,
  viewLabel = "View PDF",
  label = "Download PDF",
}: {
  path: string;
  filename: string;
  viewLabel?: string;
  label?: string;
}) {
  return (
    <PDFActions
      viewLabel={viewLabel}
      onAction={(mode) =>
        api.documents.openPath(
          `print/${path}${mode === "view" ? "?inline=true" : ""}`,
          filename.endsWith(".pdf") ? filename : `${filename}.pdf`,
          mode,
        )
      }
    >
      <Download size={14} aria-hidden="true" /> {label}
    </PDFActions>
  );
}
