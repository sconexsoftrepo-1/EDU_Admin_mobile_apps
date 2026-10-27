"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Download, ExternalLink, X } from "lucide-react";
const PDFCanvasViewer = dynamic(() => import("./PDFCanvasViewer"), {
  ssr: false,
  loading: () => <p role="status">Loading PDF viewer…</p>,
});
/** One listener per college page; generated reports keep the same preview/download bytes. */
export default function PDFPreview() {
  const [file, setFile] = useState<{
    name: string;
    url: string;
  } | null>(null);
  const dialog = useRef<HTMLDialogElement>(null),
    trigger = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const open = (event: Event) => {
      const detail = (
        event as CustomEvent<{
          name: string;
          blob: Blob;
          trigger?: HTMLElement | null;
        }>
      ).detail;
      if (!detail || !(detail.blob instanceof Blob)) return;
      trigger.current =
        detail.trigger || (document.activeElement as HTMLElement);
      setFile({ name: detail.name, url: URL.createObjectURL(detail.blob) });
    };
    window.addEventListener("college:pdf-preview", open);
    return () => window.removeEventListener("college:pdf-preview", open);
  }, []);
  useLayoutEffect(() => {
    if (!file) return;
    const d = dialog.current;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    d?.showModal();
    return () => {
      d?.close();
      URL.revokeObjectURL(file.url);
      document.body.style.overflow = previous;
      trigger.current?.focus({ preventScroll: true });
    };
  }, [file]);
  return file ? (
    <dialog
      ref={dialog}
      className="erp-pdf-preview"
      data-theme={"edunexa"}
      aria-labelledby="pdf-preview-heading"
      onCancel={() => setFile(null)}
    >
      <header>
        <div>
          <small>Document preview</small>
          <h2 id="pdf-preview-heading">{file.name}</h2>
        </div>
        <button
          type="button"
          aria-label="Close PDF preview"
          onClick={() => setFile(null)}
        >
          <X size={21} />
        </button>
      </header>
      <nav aria-label="PDF preview actions">
        <a href={file.url} download={file.name + ".pdf"}>
          <Download size={15} /> Download PDF
        </a>
        <a href={file.url} target="_blank" rel="noopener noreferrer">
          <ExternalLink size={15} /> Open PDF in new tab
        </a>
      </nav>
      <PDFCanvasViewer key={file.url} url={file.url} name={file.name} />
      <p>Preview the pages here, then download the same document when ready.</p>
    </dialog>
  ) : null;
}
