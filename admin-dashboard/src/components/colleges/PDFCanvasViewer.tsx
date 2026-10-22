"use client";
import { useEffect, useRef, useState } from "react";
import type {
  PDFDocumentProxy,
  PDFDocumentLoadingTask,
  RenderTask,
} from "pdfjs-dist";
export default function PDFCanvasViewer({
  url,
  name,
}: {
  url: string;
  name: string;
}) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null),
    [pageNumber, setPageNumber] = useState(1),
    [zoom, setZoom] = useState("fit"),
    [width, setWidth] = useState(720),
    [error, setError] = useState(""),
    [rendering, setRendering] = useState(true),
    [text, setText] = useState("");
  const canvas = useRef<HTMLCanvasElement>(null),
    container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = container.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      setWidth(Math.max(200, Math.floor(entries[0].contentRect.width) - 32));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    let cancelled = false;
    let loading: PDFDocumentLoadingTask | undefined;
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        if (cancelled) return;
        pdfjs.GlobalWorkerOptions.workerSrc = `/vendor/pdfjs/pdf.worker.min.mjs?v=${pdfjs.version}`;
        loading = pdfjs.getDocument({
          url,
          useSystemFonts: true,
          useWorkerFetch: false,
        });
        const loaded = await loading.promise;
        if (cancelled) {
          await loading.destroy();
          return;
        }
        setDoc(loaded);
      } catch (e) {
        if (!cancelled)
          setError(
            e instanceof Error ? e.message : "Unable to display this PDF.",
          );
      }
    })();
    return () => {
      cancelled = true;
      void loading?.destroy();
    };
  }, [url]);
  useEffect(() => {
    if (!doc || !canvas.current) return;
    let cancelled = false,
      render: RenderTask | undefined;
    const node = canvas.current;
    (async () => {
      try {
        const page = await doc.getPage(pageNumber);
        if (cancelled) return;
        setRendering(true);
        const base = page.getViewport({ scale: 1 });
        const scale =
          zoom === "fit" ? Math.min(2, width / base.width) : Number(zoom);
        const viewport = page.getViewport({ scale });
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
        node.width = Math.ceil(viewport.width * pixelRatio);
        node.height = Math.ceil(viewport.height * pixelRatio);
        node.style.width = viewport.width + "px";
        node.style.height = viewport.height + "px";
        render = page.render({
          canvas: node,
          viewport,
          transform:
            pixelRatio === 1 ? undefined : [pixelRatio, 0, 0, pixelRatio, 0, 0],
        });
        await render.promise;
        const content = await page.getTextContent();
        if (cancelled) return;
        setText(content.items.map((i) => ("str" in i ? i.str : "")).join(" "));
        setRendering(false);
      } catch (e) {
        if (!cancelled) {
          setRendering(false);
          setError(
            e instanceof Error ? e.message : "Unable to render this page.",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
      render?.cancel();
    };
  }, [doc, pageNumber, zoom, width]);
  return (
    <div className="erp-pdf-viewer">
      <div className="erp-pdf-page-controls">
        <button
          disabled={!doc || pageNumber === 1}
          onClick={() => setPageNumber((n) => Math.max(1, n - 1))}
        >
          Previous page
        </button>
        <label>
          Page{" "}
          <input
            aria-label="PDF page number"
            type="number"
            min={1}
            max={doc?.numPages || 1}
            value={pageNumber}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isInteger(n) && doc && n >= 1 && n <= doc.numPages)
                setPageNumber(n);
            }}
          />{" "}
          of {doc?.numPages || "…"}
        </label>
        <button
          disabled={!doc || pageNumber === doc.numPages}
          onClick={() =>
            setPageNumber((n) => Math.min(doc?.numPages || 1, n + 1))
          }
        >
          Next page
        </button>
        <label>
          Zoom
          <select
            aria-label="PDF zoom"
            value={zoom}
            onChange={(e) => setZoom(e.target.value)}
          >
            <option value="fit">Fit width</option>
            <option value="0.75">75%</option>
            <option value="1">100%</option>
            <option value="1.25">125%</option>
            <option value="1.5">150%</option>
          </select>
        </label>
      </div>
      <div
        ref={container}
        className="erp-pdf-canvas-scroll"
        aria-busy={!doc || rendering}
      >
        {error ? (
          <p role="alert">
            {error} You can still download the document or open it in a new tab.
          </p>
        ) : (
          <>
            {(!doc || rendering) && <p role="status">Rendering PDF page…</p>}
            <canvas
              ref={canvas}
              role="img"
              aria-label={`${name}, page ${pageNumber}${doc ? ` of ${doc.numPages}` : ""}`}
              data-rendered={doc && !rendering ? "true" : "false"}
            />
          </>
        )}
      </div>
      {text && (
        <details className="erp-pdf-page-text">
          <summary>Read page text</summary>
          <p>{text}</p>
        </details>
      )}
    </div>
  );
}
