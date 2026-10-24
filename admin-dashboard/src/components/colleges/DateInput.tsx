"use client";
/**
 * Date field shown as dd/mm/yyyy everywhere (a native date input follows the browser's locale,
 * e.g. mm/dd/yyyy). Drop-in for `<input type="date">`: same props, and the value stays ISO
 * (yyyy-mm-dd) for state, FormData and the API. The calendar button opens the browser's picker.
 */
import { useEffect, useRef, useState, type FocusEvent } from "react";
import { CalendarDays } from "lucide-react";
import "./date-input.css";

const ISO = /^(\d{4})-(\d{2})-(\d{2})/;

/** "2026-10-24" (or an ISO date-time) → "24/10/2026"; anything else is returned unchanged. */
export function formatDate(value: unknown): string {
  if (typeof value !== "string") return value == null ? "" : String(value);
  const m = ISO.exec(value);
  if (!m) return value;
  const date = `${m[3]}/${m[2]}/${m[1]}`;
  const time = /T(\d{2}):(\d{2})/.exec(value);
  return time && value.length > 10 ? `${date} ${time[1]}:${time[2]}` : date;
}

/** "24/10/2026" → "2026-10-24", or "" when it is not a real calendar date. */
function toIso(text: string): string {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  if (!m) return "";
  const [, d, mo, y] = m;
  const date = new Date(Date.UTC(+y, +mo - 1, +d));
  return date.getUTCFullYear() === +y &&
    date.getUTCMonth() === +mo - 1 &&
    date.getUTCDate() === +d
    ? `${y}-${mo}-${d}`
    : "";
}

/** Typed digits → "dd/mm/yyyy" with the slashes added as you type. */
function mask(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)]
    .filter(Boolean)
    .join("/");
}

export default function DateInput({
  value,
  defaultValue,
  onChange,
  name,
  required,
  min,
  max,
  disabled,
  id,
  className,
  onBlur,
  "aria-label": ariaLabel,
}: {
  value?: string;
  defaultValue?: string;
  onChange?: (e: { target: { value: string } }) => void;
  name?: string;
  required?: boolean;
  min?: string;
  max?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
  onBlur?: (e: FocusEvent<HTMLInputElement>) => void;
  "aria-label"?: string;
}) {
  const [inner, setInner] = useState(defaultValue ?? "");
  const iso = (value ?? inner).slice(0, 10);
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft ?? formatDate(iso);
  const field = useRef<HTMLInputElement>(null);
  const picker = useRef<HTMLInputElement>(null);

  const commit = (next: string) => {
    if (value === undefined) setInner(next);
    if (next !== iso) onChange?.({ target: { value: next } });
  };

  // Incomplete, impossible (31/02) or out-of-range dates block the form like a native input.
  useEffect(() => {
    const parsed = toIso(text);
    field.current?.setCustomValidity(
      !text
        ? ""
        : !parsed
          ? "Enter a valid date as dd/mm/yyyy"
          : min && parsed < min
            ? `Date must be on or after ${formatDate(min)}`
            : max && parsed > max
              ? `Date must be on or before ${formatDate(max)}`
              : "",
    );
  }, [text, min, max]);

  return (
    <span className={`date-input ${className ?? ""}`}>
      {name && <input type="hidden" name={name} value={iso} />}
      <input
        ref={field}
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="dd/mm/yyyy"
        maxLength={10}
        aria-label={ariaLabel}
        required={required}
        disabled={disabled}
        value={text}
        onChange={(e) => {
          const next = mask(e.target.value);
          setDraft(next);
          const parsed = toIso(next);
          if (parsed || !next) commit(parsed);
        }}
        onBlur={(e) => {
          if (draft !== null && (toIso(draft) || !draft)) setDraft(null);
          onBlur?.(e);
        }}
      />
      <button
        type="button"
        className="date-input-open"
        aria-label="Open calendar"
        tabIndex={-1}
        disabled={disabled}
        onClick={(e) => {
          e.preventDefault();
          const el = picker.current;
          if (!el) return;
          try {
            el.showPicker();
          } catch {
            el.focus();
            el.click();
          }
        }}
      >
        <CalendarDays size={15} aria-hidden="true" />
      </button>
      <input
        ref={picker}
        className="date-input-native"
        type="date"
        tabIndex={-1}
        aria-hidden="true"
        value={iso}
        min={min}
        max={max}
        onChange={(e) => {
          setDraft(null);
          commit(e.target.value);
        }}
      />
    </span>
  );
}
