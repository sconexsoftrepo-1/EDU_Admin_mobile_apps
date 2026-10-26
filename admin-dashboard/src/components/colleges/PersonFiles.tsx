"use client";

import { useEffect, useRef, useState } from "react";
import { apiRequest, fileToBase64, errorText } from "@/services/api/client";
import { documentService } from "@/services/api/modules/documents/service";
import Image from "next/image";
import UploadBox from "./UploadBox";
import { apiUrl } from "@/services/api/config";

type FileRecord = {
  code: string;
  original_filename: string;
  document_type?: string;
  download_kind: string;
  mime_type?: string;
  size_bytes?: number;
};

export default function PersonFiles({
  personKind,
  personCode,
  onClose,
}: {
  personKind: "student" | "employee" | "application";
  personCode: string;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [label, setLabel] = useState("supporting_document");
  const [documentType, setDocumentType] = useState("");
  const [types, setTypes] = useState<{ code: string; name: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const path = `documents/files/${personKind}/${encodeURIComponent(personCode)}`;
  useEffect(() => {
    let active = true;
    apiRequest<{ items: FileRecord[] }>(path)
      .then((r) => {
        if (active) setFiles(r.items);
      })
      .catch((e) => {
        if (active) setError(errorText(e));
      });
    if (personKind === "application")
      apiRequest<{ items: { code: string; name: string }[] }>(
        "admissions/document-types",
      )
        .then((r) => {
          if (active) setTypes(r.items);
        })
        .catch((e) => {
          if (active) setError(errorText(e));
        });
    return () => {
      active = false;
    };
  }, [path, personKind]);
  return (
    <dialog
      ref={dialog}
      className="edu-dialog"
      aria-label={`Files for ${personCode}`}
      onCancel={onClose}
    >
      <section>
        <h2>Files for {personCode}</h2>
        <button type="button" onClick={onClose} disabled={busy}>
          Close
        </button>
        <label>
          Document label{" "}
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="aadhaar_copy, student_photo, qualification"
          />
        </label>
        {personKind === "application" && (
          <label>
            Document type{" "}
            <select
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value)}
            >
              <option value="">Select a type</option>
              {types.map((t) => (
                <option key={t.code} value={t.code}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <UploadBox
          label="Upload document"
          accept=".pdf,.png,.jpg,.jpeg"
          disabled={busy}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setError("");
            if (!/^[a-z][a-z0-9_]{1,59}$/.test(label)) {
              setError(
                "Use a document label with lowercase letters and underscores.",
              );
              return;
            }
            if (personKind === "application" && !documentType) {
              setError("Select a document type.");
              return;
            }
            if (file.size > 650000) {
              setError("Choose a file up to 650 KB.");
              return;
            }
            setBusy(true);
            try {
              await documentService.upload({
                kind:
                  personKind === "application"
                    ? "admission_document"
                    : personKind === "employee"
                      ? "employee_document"
                      : "student_document",
                person_code: personCode,
                document_label: label,
                document_type_code: documentType || undefined,
                filename: file.name,
                content_base64: await fileToBase64(file),
              });
              setFiles((await apiRequest<{ items: FileRecord[] }>(path)).items);
            } catch (e) {
              setError(errorText(e));
            } finally {
              setBusy(false);
            }
          }}
        />
        {error && <p role="alert">{error}</p>}
        <ul>
          {files.map((file) => (
            <li key={file.code}>
              {file.mime_type?.startsWith("image/") && (
                <Image
                  src={apiUrl(
                    `documents/${file.download_kind}/${encodeURIComponent(file.code)}/view`,
                  )}
                  alt={file.document_type || file.original_filename}
                  width={96}
                  height={96}
                  unoptimized
                />
              )}
              {file.original_filename}{" "}
              {file.size_bytes ? `(${file.size_bytes} bytes)` : ""}{" "}
              <a
                href={apiUrl(
                  `documents/${file.download_kind}/${encodeURIComponent(file.code)}/view`,
                )}
                target="_blank"
                rel="noopener noreferrer"
              >
                View
              </a>{" "}
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  try {
                    await documentService.download(
                      file.download_kind,
                      file.code,
                      file.original_filename,
                    );
                  } catch (e) {
                    setError(errorText(e));
                  }
                }}
              >
                Download
              </button>{" "}
              <button
                type="button"
                disabled={busy || file.download_kind === "certificate"}
                onClick={async () => {
                  if (!window.confirm(`Delete ${file.original_filename}?`))
                    return;
                  setBusy(true);
                  try {
                    await documentService.remove(file.download_kind, file.code);
                    setFiles((current) =>
                      current.filter((f) => f.code !== file.code),
                    );
                  } catch (e) {
                    setError(errorText(e));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
        {!busy && !files.length && <p>No files uploaded.</p>}
      </section>
    </dialog>
  );
}
