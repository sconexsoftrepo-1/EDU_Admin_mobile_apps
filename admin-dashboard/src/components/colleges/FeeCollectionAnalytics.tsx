"use client";
/** Fee collection analytics for the cashbook: totals, collection progress over time and breakdowns. */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChevronLeft, ChevronRight, IndianRupee, Receipt, TrendingUp, Users } from "lucide-react";
import { api, errorText, type FeeAnalytics } from "@/services/api";
import { BarList, Donut, Empty, FilterDate, LoadFailed, Panel, rupees, Stat } from "./AnalyticsParts";

type Scale = "day" | "week" | "month" | "year";
type Range = "day" | "week" | "month" | "year" | "all" | "custom";

const METHOD_COLOURS: Record<string, string> = { cash: "#a56824", upi: "#e0a85a", bank_transfer: "#5b3a17" };
const METHOD_NAMES: Record<string, string> = { cash: "Cash", upi: "UPI", bank_transfer: "Bank transfer" };
export const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const parse = (s: string) => new Date(`${s}T00:00:00`);
const compact = (v: number) =>
  v >= 1e7 ? `${+(v / 1e7).toFixed(1)}Cr` : v >= 1e5 ? `${+(v / 1e5).toFixed(1)}L` : v >= 1e3 ? `${+(v / 1e3).toFixed(0)}K` : String(v);

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const dayLabel = (d: Date) => d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });

/** First and last day of the day / week (Monday–Sunday) / month / year that contains the anchor. */
export function periodBounds(range: "day" | "week" | "month" | "year", anchor: Date) {
  const y = anchor.getFullYear(), m = anchor.getMonth(), d = anchor.getDate();
  if (range === "day") return [new Date(y, m, d), new Date(y, m, d)];
  if (range === "week") {
    const monday = new Date(y, m, d - ((anchor.getDay() + 6) % 7));
    return [monday, new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6)];
  }
  if (range === "month") return [new Date(y, m, 1), new Date(y, m + 1, 0)];
  return [new Date(y, 0, 1), new Date(y, 11, 31)];
}

/** The anchor moved one period back (-1) or forward (+1). */
export function shift(range: "day" | "week" | "month" | "year", anchor: Date, step: number) {
  const y = anchor.getFullYear(), m = anchor.getMonth(), d = anchor.getDate();
  if (range === "day") return new Date(y, m, d + step);
  if (range === "week") return new Date(y, m, d + 7 * step);
  if (range === "month") return new Date(y, m + step, 1);
  return new Date(y + step, 0, 1);
}

function rangeDates(range: Range, custom: { start: string; end: string }, anchor: Date) {
  if (range === "custom") return custom;
  if (range === "all") return { start: "", end: "" };
  const [start, end] = periodBounds(range, anchor);
  return { start: iso(start), end: iso(end) };
}

/** "Today · Mon, 9 Nov 2026", "This week · 9 – 15 Nov 2026", "November 2026", "2026". */
export function periodTitle(range: "day" | "week" | "month" | "year", anchor: Date) {
  const [start, end] = periodBounds(range, anchor);
  const current = iso(periodBounds(range, new Date())[0]) === iso(start);
  const name = {
    day: dayLabel(start),
    week: `${start.getDate()} ${start.toLocaleDateString("en-IN", { month: "short" })}${start.getFullYear() !== end.getFullYear() ? ` ${start.getFullYear()}` : ""} – ${end.getDate()} ${end.toLocaleDateString("en-IN", { month: "short" })} ${end.getFullYear()}`,
    month: `${MONTHS[start.getMonth()]} ${start.getFullYear()}`,
    year: String(start.getFullYear()),
  }[range];
  const now = { day: "Today", week: "This week", month: "This month", year: "This year" }[range];
  return { current, now, label: current ? `${now} · ${name}` : name };
}

/** Bucket key and label for a day at the chosen scale (weeks start on Monday). */
function bucket(day: string, scale: Scale): [string, string] {
  const d = parse(day);
  if (scale === "day") return [day, d.toLocaleDateString("en-IN", { day: "numeric", month: "short" })];
  if (scale === "week") {
    const monday = new Date(d);
    monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return [iso(monday), `Wk ${monday.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`];
  }
  if (scale === "month") return [day.slice(0, 7), d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" })];
  return [day.slice(0, 4), day.slice(0, 4)];
}

function step(key: string, scale: Scale) {
  if (scale === "year") return String(Number(key) + 1);
  if (scale === "month") {
    const [y, m] = key.split("-").map(Number);
    return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  }
  const d = parse(key);
  d.setDate(d.getDate() + (scale === "week" ? 7 : 1));
  return iso(d);
}

type Point = { key: string; label: string; cash: number; upi: number; bank_transfer: number; total: number; payments: number; running: number };

function series(daily: FeeAnalytics["daily"], scale: Scale): Point[] {
  const map = new Map<string, Point>();
  for (const row of daily) {
    const [key, label] = bucket(row.date, scale);
    const p = map.get(key) || { key, label, cash: 0, upi: 0, bank_transfer: 0, total: 0, payments: 0, running: 0 };
    for (const [m, v] of Object.entries(row.by_method)) if (m in METHOD_COLOURS) p[m as "cash"] += Number(v);
    p.total += Number(row.amount);
    p.payments += row.payments;
    map.set(key, p);
  }
  // Fill the quiet periods between the first and last collection so progress reads continuously.
  const keys = [...map.keys()].sort();
  const out: Point[] = [];
  if (keys.length) {
    const sample = (k: string) => {
      const date = scale === "month" ? `${k}-01` : scale === "year" ? `${k}-01-01` : k;
      return bucket(date, scale)[1];
    };
    for (let k = keys[0], guard = 0; k <= keys[keys.length - 1] && guard < 400; k = step(k, scale), guard++)
      out.push(map.get(k) || { key: k, label: sample(k), cash: 0, upi: 0, bank_transfer: 0, total: 0, payments: 0, running: 0 });
  }
  let running = 0;
  for (const p of out) p.running = running += p.total;
  return out;
}

const tooltipStyle = { borderRadius: 10, border: "1px solid #eadccb", fontSize: 12 };

export default function FeeCollectionAnalytics() {
  const [range, setRange] = useState<Range>("month");
  const [anchor, setAnchor] = useState(() => new Date());
  const [custom, setCustom] = useState({ start: "", end: "" });
  const [source, setSource] = useState<"all" | "manual" | "linked">("all");
  const [scale, setScale] = useState<Scale>("day");
  const [data, setData] = useState<FeeAnalytics | null>(null);
  const [error, setError] = useState("");
  const dates = rangeDates(range, custom, anchor);
  const load = useCallback(() => {
    setError("");
    return api.feePayments
      .analytics({ start: dates.start || undefined, end: dates.end || undefined, source })
      .then(setData)
      .catch((e) => setError(errorText(e)));
  }, [dates.start, dates.end, source]);
  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);
  const points = useMemo(() => (data ? series(data.daily, scale) : []), [data, scale]);

  if (error && !data) return <LoadFailed message="Collection analytics could not be loaded." retry={load} />;
  const s = data?.summary;
  const semesters = data?.by_semester || [];
  return (
    <div className="fca anw">
      <div className="fca-filters">
        <div className="fcw-tabs" role="tablist" aria-label="Period">
          {(
            [
              ["day", "Day"],
              ["week", "Week"],
              ["month", "Month"],
              ["year", "Year"],
              ["all", "All time"],
              ["custom", "Custom"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              role="tab"
              aria-selected={range === key}
              onClick={() => {
                setRange(key);
                // Each period opens on the current one; the chart follows the period's natural unit.
                setAnchor(new Date());
                setScale(key === "year" ? "month" : key === "all" ? "month" : "day");
              }}
            >
              {label}
            </button>
          ))}
        </div>
        {range !== "all" && range !== "custom" && (
          <PeriodPicker range={range} anchor={anchor} onChange={setAnchor} />
        )}
        {range === "custom" && (
          <>
            <FilterDate label="From" value={custom.start} onChange={(start) => setCustom({ ...custom, start })} />
            <FilterDate label="To" value={custom.end} onChange={(end) => setCustom({ ...custom, end })} />
          </>
        )}
        <label className="anw-filter">
          Payments from
          <select value={source} onChange={(e) => setSource(e.target.value as typeof source)}>
            <option value="all">All screens</option>
            <option value="linked">Payments & receipts</option>
            <option value="manual">Manual payments screen</option>
          </select>
        </label>
      </div>

      {!data ? (
        <div className="anw-loading" role="status" aria-label="Loading analytics…">
          <div className="anw-skeleton" />
          <div className="anw-skeleton anw-skeleton-tall" />
        </div>
      ) : (
        <>
          <div className="fcw-stats">
            <Stat icon={IndianRupee} label="Total collected" value={rupees(Number(s!.amount))} hint="Settled payments in this period" />
            <Stat icon={Users} label="Students paid" value={s!.payers} hint="Different students who paid" />
            <Stat icon={Receipt} label="Payments" value={s!.payments} hint="Receipts issued" />
            <Stat icon={TrendingUp} label="Average payment" value={rupees(Number(s!.average))} hint="Per receipt" />
          </div>

          <Panel
            title="Collection progress"
            className="fca-wide"
            action={
              <div className="fca-scale" role="tablist" aria-label="Group by">
                {(["day", "week", "month", "year"] as const).map((k) => (
                  <button key={k} role="tab" aria-selected={scale === k} onClick={() => setScale(k)}>
                    {k[0].toUpperCase() + k.slice(1)}
                  </button>
                ))}
              </div>
            }
          >
            {points.length ? (
              <>
                <div className="fca-chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={points} margin={{ top: 8, right: 8, left: 0 }}>
                      <CartesianGrid vertical={false} stroke="#efe6d8" />
                      <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#76695e" }} minTickGap={8} />
                      <YAxis yAxisId="a" width={52} axisLine={false} tickLine={false} tickFormatter={compact} tick={{ fontSize: 11, fill: "#76695e" }} />
                      <YAxis yAxisId="r" orientation="right" width={52} axisLine={false} tickLine={false} tickFormatter={compact} tick={{ fontSize: 11, fill: "#2f6f4f" }} />
                      <Tooltip
                        cursor={{ fill: "#f6e6ce66" }}
                        contentStyle={tooltipStyle}
                        formatter={(value, name) => [rupees(Number(value)), String(name)]}
                      />
                      {(["cash", "upi", "bank_transfer"] as const).map((m, i, all) => (
                        <Bar
                          key={m}
                          yAxisId="a"
                          dataKey={m}
                          name={METHOD_NAMES[m]}
                          stackId="m"
                          fill={METHOD_COLOURS[m]}
                          maxBarSize={42}
                          radius={i === all.length - 1 ? [4, 4, 0, 0] : 0}
                        />
                      ))}
                      <Line yAxisId="r" type="monotone" dataKey="running" name="Collected so far" stroke="#2f6f4f" strokeWidth={2} dot={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
                <ul className="fca-key">
                  {Object.entries(METHOD_NAMES).map(([m, label]) => (
                    <li key={m}>
                      <i style={{ background: METHOD_COLOURS[m] }} /> {label}
                    </li>
                  ))}
                  <li>
                    <i className="fca-line" /> Collected so far (right scale)
                  </li>
                </ul>
              </>
            ) : (
              <Empty>No payments in this period yet.</Empty>
            )}
          </Panel>

          <div className="fca-grid">
            <Panel title="Collection by semester">
              {semesters.length ? (
                <>
                  <div className="fca-chart fca-chart-sm">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={semesters.map((r) => ({ ...r, value: Number(r.amount) }))} margin={{ top: 8, right: 4, left: 0 }}>
                        <CartesianGrid vertical={false} stroke="#efe6d8" />
                        <XAxis dataKey="label" interval={0} axisLine={false} tickLine={false} tick={{ fontSize: 10.5, fill: "#76695e" }} />
                        <YAxis width={52} axisLine={false} tickLine={false} tickFormatter={compact} tick={{ fontSize: 11, fill: "#76695e" }} />
                        <Tooltip
                          cursor={{ fill: "#f6e6ce66" }}
                          contentStyle={tooltipStyle}
                          formatter={(value) => [rupees(Number(value)), "Collected"]}
                        />
                        <Bar dataKey="value" fill="#a56824" radius={[4, 4, 0, 0]} maxBarSize={46} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="anw-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Semester</th>
                          <th>Students paid</th>
                          <th>Payments</th>
                          <th className="fca-num">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {semesters.map((r) => (
                          <tr key={r.label}>
                            <td>{r.label}</td>
                            <td>{r.payers}</td>
                            <td>{r.payments}</td>
                            <td className="fca-num">{rupees(Number(r.amount))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <Empty>No semester data yet.</Empty>
              )}
            </Panel>

            <Panel title="Source of payment">
              {data.by_method.length ? (
                <Donut
                  title="Source of payment"
                  centre={rupees(Number(s!.amount))}
                  centreLabel="collected"
                  slices={data.by_method.map((m) => ({
                    key: m.method,
                    label: `${m.label} · ${m.payments} payment${m.payments === 1 ? "" : "s"}`,
                    value: Number(m.amount),
                    display: rupees(Number(m.amount)),
                  }))}
                />
              ) : (
                <Empty>No payments yet.</Empty>
              )}
              {data.by_source.length > 0 && (
                <>
                  <h4 className="fca-sub">Recorded on</h4>
                  <BarList
                    items={data.by_source.map((r) => ({
                      key: r.source,
                      label: `${r.label} · ${r.payers} student${r.payers === 1 ? "" : "s"}`,
                      value: Number(r.amount),
                      display: rupees(Number(r.amount)),
                    }))}
                  />
                </>
              )}
            </Panel>

            <Panel title="Collection by fee">
              {data.by_head.length ? (
                <BarList
                  items={data.by_head.map((r) => ({
                    key: r.name,
                    label: `${r.name} · ${r.payments}`,
                    value: Number(r.amount),
                    display: rupees(Number(r.amount)),
                  }))}
                />
              ) : (
                <Empty>No payments yet.</Empty>
              )}
            </Panel>

            <Panel title="Collection by course level">
              {data.by_level.length ? (
                <BarList
                  items={data.by_level.map((r) => ({
                    key: r.label,
                    label: `${r.label} · ${r.payers} student${r.payers === 1 ? "" : "s"}`,
                    value: Number(r.amount),
                    display: rupees(Number(r.amount)),
                  }))}
                />
              ) : (
                <Empty>No payments yet.</Empty>
              )}
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}

/** The selected day / week / month / year with previous–next arrows, a picker and "back to now". */
export function PeriodPicker({
  range,
  anchor,
  onChange,
}: {
  range: "day" | "week" | "month" | "year";
  anchor: Date;
  onChange: (d: Date) => void;
}) {
  const title = periodTitle(range, anchor);
  const thisYear = new Date().getFullYear();
  const unit = { day: "day", week: "week", month: "month", year: "year" }[range];
  return (
    <div className="fca-period" role="group" aria-label={`Selected ${unit}`}>
      <button type="button" className="fcw-icon" aria-label={`Previous ${unit}`} onClick={() => onChange(shift(range, anchor, -1))}>
        <ChevronLeft size={16} />
      </button>
      <strong aria-live="polite">{title.label}</strong>
      <button type="button" className="fcw-icon" aria-label={`Next ${unit}`} onClick={() => onChange(shift(range, anchor, 1))}>
        <ChevronRight size={16} />
      </button>
      <label className="fca-period-pick">
        <span className="sr-only">Choose a {unit}</span>
        {range === "year" ? (
          <select
            aria-label="Choose a year"
            value={anchor.getFullYear()}
            onChange={(e) => onChange(new Date(Number(e.target.value), 0, 1))}
          >
            {Array.from({ length: 12 }, (_, i) => thisYear + 1 - i).map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        ) : range === "month" ? (
          <input
            type="month"
            aria-label="Choose a month"
            value={`${anchor.getFullYear()}-${String(anchor.getMonth() + 1).padStart(2, "0")}`}
            onChange={(e) => e.target.value && onChange(parse(`${e.target.value}-01`))}
          />
        ) : (
          <input
            type="date"
            aria-label={range === "week" ? "Choose any day in the week" : "Choose a day"}
            value={iso(anchor)}
            onChange={(e) => e.target.value && onChange(parse(e.target.value))}
          />
        )}
      </label>
      {!title.current && (
        <button type="button" className="fca-period-now" onClick={() => onChange(new Date())}>
          Back to {title.now.toLowerCase()}
        </button>
      )}
    </div>
  );
}
