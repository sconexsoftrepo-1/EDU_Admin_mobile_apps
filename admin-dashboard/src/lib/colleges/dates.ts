/**
 * Dates shown in the portal: day/month/year everywhere (09/11/2026), times in local 12-hour
 * format (09/11/2026, 2:45 pm). Date-only values ("2026-11-09") are read as calendar dates, so
 * they never shift a day across time zones.
 */
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

function toDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value !== "string" && typeof value !== "number") return null;
  const text = String(value).trim();
  if (!text) return null;
  const day = DATE_ONLY.exec(text);
  if (day) return new Date(+day[1], +day[2] - 1, +day[3]);
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "09/11/2026"; "—" when empty; anything that is not a date is returned unchanged. */
export function formatDate(value: unknown, empty = "—"): string {
  if (value == null || value === "") return empty;
  const date = toDate(value);
  if (!date) return String(value);
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

/** "09/11/2026, 2:45 pm" (a date-only value shows just the date). */
export function formatDateTime(value: unknown, empty = "—"): string {
  if (value == null || value === "") return empty;
  if (typeof value === "string" && DATE_ONLY.test(value.trim())) return formatDate(value, empty);
  const date = toDate(value);
  if (!date) return String(value);
  const hour = date.getHours() % 12 || 12;
  return `${formatDate(date)}, ${hour}:${pad(date.getMinutes())} ${date.getHours() < 12 ? "am" : "pm"}`;
}
