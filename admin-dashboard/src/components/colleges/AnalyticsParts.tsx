"use client";
import type { ComponentType, ReactNode } from "react";
import { RefreshCw, type LucideProps } from "lucide-react";
import { money } from "@/data/colleges";
import "./analytics-workspace.css";

/** The analytics APIs send rupees; money() takes paise. */
export const rupees = (value: number) => money(value * 100);
export const nice = (value: string | null | undefined) =>
  String(value || "—")
    .replaceAll("_", " ")
    .replace(/^\w/, (c) => c.toUpperCase());
export const shortDate = (value: string | null | undefined) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-IN", { dateStyle: "medium" });
};
export const percentOf = (part: number, whole: number) =>
  whole ? Math.round((part * 1000) / whole) / 10 : 0;

const COLOURS = ["#8a5520", "#a56824", "#c99448", "#e0bb82", "#6b441b", "#d9a766", "#f0d8b4", "#b98a54", "#7a6a58", "#e8cfa8"];
export const colourAt = (index: number) => COLOURS[index % COLOURS.length];

export type Slice = { key: string; label: string; value: number; display?: string };

export function Donut({
  title,
  centre,
  centreLabel,
  slices,
  selected,
  onSelect,
}: {
  title: string;
  centre: string;
  centreLabel: string;
  slices: Slice[];
  selected?: string;
  onSelect?: (key: string) => void;
}) {
  const total = slices.reduce((sum, slice) => sum + Math.max(0, slice.value), 0);
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  return (
    <div className="anw-donut">
      <div className="anw-donut-ring">
        <svg viewBox="0 0 100 100" role="img" aria-label={`${title}: ${centre} ${centreLabel}`}>
          <circle cx="50" cy="50" r={radius} className="anw-donut-track" />
          {total > 0 &&
            slices.map((slice, index) => {
              if (slice.value <= 0) return null;
              const length = (slice.value / total) * circumference;
              const circle = (
                <circle
                  key={slice.key}
                  cx="50"
                  cy="50"
                  r={radius}
                  stroke={colourAt(index)}
                  strokeDasharray={`${length} ${circumference - length}`}
                  strokeDashoffset={-offset}
                  transform="rotate(-90 50 50)"
                  className={selected && selected !== slice.key ? "is-dim" : ""}
                  onClick={onSelect ? () => onSelect(slice.key) : undefined}
                />
              );
              offset += length;
              return circle;
            })}
        </svg>
        <div>
          <strong>{centre}</strong>
          <small>{centreLabel}</small>
        </div>
      </div>
      <ul className="anw-legend">
        {slices.map((slice, index) => {
          const body = (
            <>
              <i style={{ background: colourAt(index) }} />
              <span>{slice.label}</span>
              <small>{percentOf(Math.max(0, slice.value), total)}%</small>
              <b>{slice.display ?? slice.value}</b>
            </>
          );
          return (
            <li key={slice.key}>
              {onSelect ? (
                <button aria-pressed={selected === slice.key} onClick={() => onSelect(slice.key)}>
                  {body}
                </button>
              ) : (
                <div>{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function BarList({
  items,
  selected,
  onSelect,
}: {
  items: Slice[];
  selected?: string;
  onSelect?: (key: string) => void;
}) {
  const largest = Math.max(1, ...items.map((item) => item.value));
  return (
    <ul className="anw-bars">
      {items.map((item) => {
        const body = (
          <>
            <span>{item.label}</span>
            <b>{item.display ?? item.value}</b>
            <i>
              <em style={{ width: `${(Math.max(0, item.value) / largest) * 100}%` }} />
            </i>
          </>
        );
        return (
          <li key={item.key}>
            {onSelect ? (
              <button aria-pressed={selected === item.key} onClick={() => onSelect(item.key)}>
                {body}
              </button>
            ) : (
              <div>{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function Stat({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: ComponentType<LucideProps>;
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "warn";
}) {
  return (
    <div className={`anw-stat ${tone === "warn" ? "is-warn" : ""}`}>
      <span className="anw-stat-icon">
        <Icon size={18} />
      </span>
      <span className="anw-stat-text">
        <small>{label}</small>
        <strong>{value}</strong>
        {hint && <em>{hint}</em>}
      </span>
    </div>
  );
}

export function Panel({
  title,
  action,
  className = "",
  children,
}: {
  title: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`anw-panel ${className}`}>
      <header>
        <h3>{title}</h3>
        {action}
      </header>
      {children}
    </section>
  );
}

export function FilterSelect({
  label,
  value,
  onChange,
  all,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  all: string;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="anw-filter">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{all}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function FilterDate({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="anw-filter">
      {label}
      <input type="date" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

export const Empty = ({ children }: { children: ReactNode }) => (
  <p className="anw-empty">{children}</p>
);

export function LoadFailed({ message, retry }: { message: string; retry: () => void }) {
  return (
    <div className="anw-failed" role="alert">
      <p>{message}</p>
      <button onClick={retry}>
        <RefreshCw size={14} /> Try again
      </button>
    </div>
  );
}
