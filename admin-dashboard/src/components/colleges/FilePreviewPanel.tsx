"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import {
  Download,
  ExternalLink,
  Minus,
  Plus,
  RotateCcw,
  X,
} from "lucide-react";
import { apiUrl } from "@/services/api/config";
import { documentService } from "@/services/api/modules/documents/service";
import { errorText } from "@/services/api/client";

const PDFCanvasViewer = dynamic(() => import("./PDFCanvasViewer"), {
  ssr: false,
  loading: () => <p role="status">Loading PDF viewer…</p>,
});
export type StoredFile = {
  code: string;
  original_filename: string;
  document_type?: string;
  download_kind: string;
  mime_type?: string;
  size_bytes?: number;
};

export default function FilePreviewPanel({
  file,
  onClose,
}: {
  file: StoredFile;
  onClose: () => void;
}) {
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    panel.current?.focus({ preventScroll: true });
    panel.current?.scrollIntoView({
      block: "nearest",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  }, []);
  const [zoom, setZoom] = useState(100);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const url = apiUrl(
    `documents/${file.download_kind}/${encodeURIComponent(file.code)}/view`,
  );
  const image = file.mime_type?.startsWith("image/");
  const pdf =
    file.mime_type === "application/pdf" ||
    /\.pdf$/i.test(file.original_filename);
  return (
    <section
      ref={panel}
      tabIndex={-1}
      className="edu-file-preview"
      aria-label={`Preview ${file.original_filename}`}
    >
      <header className="edu-file-preview-header">
        <div>
          <h4>{file.original_filename}</h4>
          <small>{file.document_type?.replaceAll("_", " ")}</small>
        </div>
        <div>
          {pdf && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="edu-file-original"
            >
              <ExternalLink size={16} aria-hidden="true" />
              Open original
            </a>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await documentService.download(
                  file.download_kind,
                  file.code,
                  file.original_filename,
                );
              } catch (e) {
                setError(errorText(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            <Download size={16} /> Download
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close file preview"
            title="Close preview"
          >
            <X size={16} />
          </button>
        </div>
      </header>

      {error && (
        <p role="alert" className="edu-error">
          {error}
        </p>
      )}
      {image ? (
        <>
          <div
            className="edu-image-controls"
            role="group"
            aria-label="Image zoom"
          >
            <button
              type="button"
              aria-label="Zoom out"
              disabled={zoom <= 50}
              onClick={() => setZoom((z) => Math.max(50, z - 25))}
            >
              <Minus size={16} />
            </button>
            <span>{zoom}%</span>
            <button
              type="button"
              aria-label="Zoom in"
              disabled={zoom >= 250}
              onClick={() => setZoom((z) => Math.min(250, z + 25))}
            >
              <Plus size={16} />
            </button>
            <button type="button" onClick={() => setZoom(100)}>
              <RotateCcw size={15} /> Fit image
            </button>
          </div>
          <div className="edu-image-viewer">
            <div>
              <Image
                src={url}
                alt={file.original_filename}
                width={1600}
                height={1200}
                unoptimized
                style={{ height: `${(320 * zoom) / 100}px` }}
                onError={() =>
                  setError(
                    "This image could not be loaded. Try downloading it or reopening the file.",
                  )
                }
              />
            </div>
          </div>
        </>
      ) : pdf ? (
        <PDFCanvasViewer key={url} url={url} name={file.original_filename} />
      ) : (
        <p>
          Preview is unavailable for this file type. Use Download to save the
          file.
        </p>
      )}
    </section>
  );
}
