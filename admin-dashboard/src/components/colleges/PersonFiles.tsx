"use client";

import Select from "./SearchSelect";
import { useEffect, useRef, useState } from "react";
import {
  Download,
  Eye,
  FileText,
  Image as ImageIcon,
  Paperclip,
  Trash2,
} from "lucide-react";
import { apiRequest, fileToBase64, errorText } from "@/services/api/client";
import { documentService } from "@/services/api/modules/documents/service";
import UploadBox from "./UploadBox";
import SideDrawer from "./SideDrawer";
import FilePreviewPanel, { type StoredFile } from "./FilePreviewPanel";

type Owner = {
  personKind: "student" | "employee" | "application";
  personCode: string;
};

export function PersonFileList({
  personKind,
  personCode,
  onPreviewChange,
}: Owner & { onPreviewChange?: (open: boolean) => void }) {
  const previewTrigger = useRef<HTMLButtonElement | null>(null);
  const [files, setFiles] = useState<StoredFile[]>([]);
  const [preview, setPreview] = useState<StoredFile | null>(null);
  const [label, setLabel] = useState("supporting_document");
  const [documentType, setDocumentType] = useState("");
  const [types, setTypes] = useState<{ code: string; name: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const path = `documents/files/${personKind}/${encodeURIComponent(personCode)}`;
  useEffect(() => {
    let active = true;
    apiRequest<{ items: StoredFile[] }>(path)
      .then((r) => {
        if (active) setFiles(r.items);
      })
      .catch((e) => {
        if (active) setError(errorText(e));
      })
      .finally(() => {
        if (active) setLoading(false);
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
    <section
      className={`edu-person-files ${preview ? "edu-files-expanded" : ""}`}
      aria-label="Uploaded files"
    >
      <div className="edu-detail-section-heading">
        <div>
          <h3>Documents & files</h3>
          <p>View the uploaded originals or download a copy.</p>
        </div>
        <button
          type="button"
          onClick={() => setUploadOpen((open) => !open)}
          aria-expanded={uploadOpen}
        >
          <Paperclip size={15} />
          {uploadOpen ? "Cancel upload" : "Upload file"}
        </button>
      </div>
      {uploadOpen && (
        <div className="edu-file-upload-form">
          <label>
            Document label
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="student_photo, aadhaar_copy, qualification"
            />
          </label>
          {personKind === "application" && (
            <label>
              Document type
              <Select
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value)}
              >
                <option value="">Select a type</option>
                {types.map((t) => (
                  <option key={t.code} value={t.code}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </label>
          )}
          <UploadBox
            label="Upload document"
            accept=".pdf,.png,.jpg,.jpeg"
            disabled={busy || loading}
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
                setError("Choose a PDF, JPEG or PNG file up to 650 KB.");
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
                setFiles(
                  (await apiRequest<{ items: StoredFile[] }>(path)).items,
                );
                setUploadOpen(false);
              } catch (e) {
                setError(errorText(e));
              } finally {
                setBusy(false);
              }
            }}
          />
          <small>PDF, JPEG or PNG · maximum 650 KB per file.</small>
        </div>
      )}
      {error && (
        <p role="alert" className="edu-error">
          {error}
        </p>
      )}
      {loading ? (
        <p role="status">Loading files…</p>
      ) : files.length ? (
        <ul className="edu-file-list">
          {files.map((file) => (
            <li key={file.code}>
              <span className="edu-file-type" aria-hidden="true">
                {file.mime_type?.startsWith("image/") ? (
                  <ImageIcon size={22} />
                ) : (
                  <FileText size={22} />
                )}
              </span>
              <div className="edu-file-description">
                <strong>
                  {file.document_type?.replaceAll("_", " ") ||
                    file.original_filename}
                </strong>
                <span>
                  {file.original_filename}
                  {file.size_bytes
                    ? ` · ${Math.ceil(file.size_bytes / 1024)} KB`
                    : ""}
                </span>
              </div>
              <div className="edu-file-actions">
                <button
                  type="button"
                  title={`View ${file.original_filename}`}
                  aria-label={`View ${file.original_filename}`}
                  onClick={(event) => {
                    previewTrigger.current = event.currentTarget;
                    setPreview(file);
                    onPreviewChange?.(true);
                  }}
                >
                  <Eye size={16} />
                  <span>View</span>
                </button>
                <button
                  type="button"
                  disabled={busy}
                  title={`Download ${file.original_filename}`}
                  aria-label={`Download ${file.original_filename}`}
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
                  <Download size={16} />
                </button>
                {file.download_kind !== "certificate" && (
                  <button
                    type="button"
                    disabled={busy}
                    title={`Delete ${file.original_filename}`}
                    aria-label={`Delete ${file.original_filename}`}
                    onClick={async () => {
                      if (!window.confirm(`Delete ${file.original_filename}?`))
                        return;
                      setBusy(true);
                      try {
                        await documentService.remove(
                          file.download_kind,
                          file.code,
                        );
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
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="edu-detail-empty">
          No files have been uploaded for this record.
        </p>
      )}
      {preview && (
        <FilePreviewPanel
          key={preview.code}
          file={preview}
          onClose={() => {
            setPreview(null);
            onPreviewChange?.(false);
            previewTrigger.current?.focus();
          }}
        />
      )}
    </section>
  );
}

export default function PersonFiles({
  onClose,
  ...owner
}: Owner & { onClose: () => void }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <SideDrawer
      expanded={expanded}
      title="Record files"
      subtitle={owner.personCode}
      onClose={onClose}
    >
      <PersonFileList {...owner} onPreviewChange={setExpanded} />
    </SideDrawer>
  );
}
