"use client";
/** Calendar-style year picker: a field that opens a grid of twelve years with previous / next pages. */
import { useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

export default function YearPicker({
  label,
  value,
  onChange,
  min = 1990,
  max = new Date().getFullYear() + 10,
  required,
  placeholder = "Select year",
}: {
  label: string;
  value: number | null;
  onChange: (year: number) => void;
  min?: number;
  max?: number;
  required?: boolean;
  placeholder?: string;
}) {
  const thisYear = new Date().getFullYear();
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const start = page;
  const years = Array.from({ length: 12 }, (_, i) => start + i);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <div className="ypk" ref={root}>
      <button
        type="button"
        className="ypk-field"
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          // Open on a page with the chosen (or current) year in the second row.
          setPage((value ?? Math.min(max, Math.max(min, thisYear))) - 4);
          setOpen(!open);
        }}
      >
        <span className={value ? undefined : "ypk-placeholder"}>{value ?? placeholder}</span>
        <CalendarDays size={16} aria-hidden="true" />
      </button>
      {/* Lets the browser's required-field check cover this custom control. */}
      <input className="ypk-proxy" tabIndex={-1} aria-hidden="true" required={required} value={value ?? ""} onChange={() => undefined} />
      {open && (
        <div className="ypk-panel" role="dialog" aria-label={label}>
          <div className="ypk-nav">
            <button type="button" aria-label="Earlier years" disabled={start <= min} onClick={() => setPage(start - 12)}>
              <ChevronLeft size={16} />
            </button>
            <strong>
              {years[0]} – {years[11]}
            </strong>
            <button type="button" aria-label="Later years" disabled={start + 11 >= max} onClick={() => setPage(start + 12)}>
              <ChevronRight size={16} />
            </button>
          </div>
          <div className="ypk-grid">
            {years.map((y) => (
              <button
                key={y}
                type="button"
                disabled={y < min || y > max}
                aria-pressed={y === value}
                className={y === thisYear ? "is-now" : undefined}
                onClick={() => {
                  onChange(y);
                  setOpen(false);
                }}
              >
                {y}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
