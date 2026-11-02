"use client";
/**
 * PDF preview: every page rendered one under another in a single scroll (page 2 follows page 1).
 * Previous / Next scroll to a page; the page counter follows the scroll position.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  PDFDocumentProxy,
  PDFDocumentLoadingTask,
  RenderTask,
} from "pdfjs-dist";

function PdfPage({
  doc,
  number,
  zoom,
  width,
  name,
  onText,
  onRendered,
}: {
  doc: PDFDocumentProxy;
  number: number;
  zoom: string;
  width: number;
  name: string;
  onText: (page: number, text: string) => void;
  onRendered: (page: number) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const node = canvas.current;
    if (!node) return;
    let cancelled = false,
      render: RenderTask | undefined;
    (async () => {
      try {
        const page = await doc.getPage(number);
        if (cancelled) return;
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
        if (cancelled) return;
        onRendered(number);
        const content = await page.getTextContent();
        if (!cancelled)
          onText(
            number,
            content.items.map((i) => ("str" in i ? i.str : "")).join(" "),
          );
      } catch (e) {
        if (
          !cancelled &&
          !(e instanceof Error && e.name === "RenderingCancelledException")
        )
          setError(
            e instanceof Error ? e.message : "Unable to render this page.",
          );
      }
    })();
    return () => {
      cancelled = true;
      render?.cancel();
    };
  }, [doc, number, zoom, width, onText, onRendered]);
  return error ? (
    <p role="alert">{error}</p>
  ) : (
    <canvas
      ref={canvas}
      role="img"
      aria-label={`${name}, page ${number} of ${doc.numPages}`}
    />
  );
}

export default function PDFCanvasViewer({
  url,
  name,
}: {
  url: string;
  name: string;
}) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null),
    [current, setCurrent] = useState(1),
    [zoom, setZoom] = useState("fit"),
    [width, setWidth] = useState(720),
    [error, setError] = useState(""),
    [rendered, setRendered] = useState<Set<number>>(new Set()),
    [texts, setTexts] = useState<Record<number, string>>({});
  const container = useRef<HTMLDivElement>(null),
    pages = useRef<(HTMLDivElement | null)[]>([]);

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

  // The page counter follows whichever page fills most of the scroll area.
  useEffect(() => {
    const root = container.current;
    if (!doc || !root) return;
    const ratios = new Map<number, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries)
          ratios.set(
            Number((e.target as HTMLElement).dataset.page),
            e.intersectionRatio,
          );
        const best = [...ratios.entries()].sort((a, b) => b[1] - a[1])[0];
        if (best && best[1] > 0) setCurrent(best[0]);
      },
      { root, threshold: [0, 0.25, 0.5, 0.75, 1] },
    );
    pages.current.forEach((p) => p && observer.observe(p));
    return () => observer.disconnect();
  }, [doc]);

  const go = (n: number) => {
    const target = pages.current[n - 1];
    if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    setCurrent(n);
  };
  const onText = useCallback(
    (page: number, text: string) =>
      setTexts((t) => (t[page] === text ? t : { ...t, [page]: text })),
    [],
  );
  const onRendered = useCallback(
    (page: number) =>
      setRendered((r) => (r.has(page) ? r : new Set(r).add(page))),
    [],
  );
  const total = doc?.numPages || 0;
  const allText = Object.keys(texts)
    .map(Number)
    .sort((a, b) => a - b)
    .map((n) => `Page ${n}: ${texts[n]}`);
  return (
    <div className="erp-pdf-viewer">
      <div className="erp-pdf-page-controls">
        <button
          type="button"
          disabled={!doc || current <= 1}
          onClick={() => go(Math.max(1, current - 1))}
        >
          Previous page
        </button>
        <label>
          Page{" "}
          <input
            aria-label="PDF page number"
            type="number"
            min={1}
            max={total || 1}
            value={current}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isInteger(n) && n >= 1 && n <= total) go(n);
            }}
          />{" "}
          of {total || "…"}
        </label>
        <button
          type="button"
          disabled={!doc || current >= total}
          onClick={() => go(Math.min(total, current + 1))}
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
        className="erp-pdf-canvas-scroll erp-pdf-pages"
        aria-busy={!doc || rendered.size < total}
      >
        {error ? (
          <p role="alert">
            {error} You can still download the document or open it in a new tab.
          </p>
        ) : !doc ? (
          <p role="status">Rendering PDF…</p>
        ) : (
          Array.from({ length: total }, (_, i) => (
            <div
              key={i + 1}
              ref={(el) => {
                pages.current[i] = el;
              }}
              data-page={i + 1}
              className="erp-pdf-page"
              data-rendered={rendered.has(i + 1) ? "true" : "false"}
            >
              {total > 1 && (
                <span className="erp-pdf-page-number">
                  Page {i + 1} of {total}
                </span>
              )}
              <PdfPage
                doc={doc}
                number={i + 1}
                zoom={zoom}
                width={width}
                name={name}
                onText={onText}
                onRendered={onRendered}
              />
            </div>
          ))
        )}
      </div>
      {allText.length > 0 && (
        <details className="erp-pdf-page-text">
          <summary>Read page text</summary>
          {allText.map((t) => (
            <p key={t.slice(0, 12)}>{t}</p>
          ))}
        </details>
      )}
    </div>
  );
}
