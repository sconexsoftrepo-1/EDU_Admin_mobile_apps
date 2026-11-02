"use client";
/**
 * Offer, joining and acceptance letters for an employee (generated from the staff record and dated
 * from the date of joining), plus upload of the signed acceptance letter to the staff file.
 * Backend: app/core/print_pdfs.py (GET print/letter/{kind}/{employee}).
 */
import { useEffect, useState } from "react";
import { CheckCircle2, FileSignature, Upload } from "lucide-react";
import { api, errorText, type Row } from "@/services/api";
import { apiRequest, fileToBase64 } from "@/services/api/client";
import PrintButtons from "../PrintButtons";
import { toast } from "../toast";

const LETTERS = [
  {
    kind: "offer",
    title: "Offer letter",
    text: "Position, salary structure and terms of appointment — issued 15 days before joining.",
  },
  {
    kind: "acceptance",
    title: "Acceptance letter",
    text: "For the employee to sign and return; upload the signed copy below.",
  },
  {
    kind: "joining",
    title: "Joining letter",
    text: "Confirms joining on the date of enrollment with employee ID, pay and first-week steps.",
  },
] as const;

export default function AppointmentLetters({
  employeeCode,
  name,
  joinDate,
}: {
  employeeCode: string;
  name: string;
  joinDate?: string | null;
}) {
  const [signed, setSigned] = useState<Row | null>(null);
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let live = true;
    apiRequest<{ items: Row[] }>(
      `documents/files/employee/${encodeURIComponent(employeeCode)}`,
    )
      .then(
        (r) =>
          live &&
          setSigned(
            r.items.find((d) => d.document_type === "acceptance_letter") ||
              null,
          ),
      )
      .catch(() => live && setSigned(null));
    return () => {
      live = false;
    };
  }, [employeeCode, version]);

  async function upload(file?: File | null) {
    if (!file) return;
    setBusy(true);
    try {
      await api.documents.upload({
        kind: "employee_document",
        person_code: employeeCode,
        filename: file.name,
        content_base64: await fileToBase64(file),
        document_label: "acceptance_letter",
      });
      toast.success(
        "Signed acceptance uploaded",
        "It is saved in the employee's staff file.",
      );
      setVersion((n) => n + 1);
    } catch (e) {
      toast.error("Upload failed", errorText(e));
    } finally {
      setBusy(false);
    }
  }

  const slug = name.trim().replaceAll(/\s+/g, "-") || employeeCode;
  return (
    <section className="edu-student-section stf-letters">
      <h3>Appointment letters</h3>
      <p className="stf-letters-note">
        Generated from this staff record with the college logo
        {joinDate
          ? `, dated from the date of joining (${joinDate.slice(0, 10)})`
          : ""}
        .
      </p>
      <div className="stf-letter-grid">
        {LETTERS.map((l) => (
          <article key={l.kind} className="stf-letter">
            <header>
              <FileSignature size={18} aria-hidden="true" />
              <strong>{l.title}</strong>
              {l.kind === "acceptance" && signed && (
                <span className="stf-letter-signed">
                  <CheckCircle2 size={14} aria-hidden="true" /> Signed copy on
                  file
                </span>
              )}
            </header>
            <p>{l.text}</p>
            <PrintButtons
              path={`letter/${l.kind}/${encodeURIComponent(employeeCode)}`}
              filename={`${l.kind}-letter-${slug}`}
              viewLabel="View"
              label="Download"
            />
            {l.kind === "acceptance" && (
              <label className="stf-letter-upload">
                <Upload size={14} aria-hidden="true" />
                {busy
                  ? "Uploading…"
                  : signed
                    ? "Replace signed copy"
                    : "Upload signed copy (PDF / image)"}
                <input
                  type="file"
                  accept="application/pdf,image/png,image/jpeg"
                  hidden
                  disabled={busy}
                  onChange={(e) => {
                    void upload(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
              </label>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
