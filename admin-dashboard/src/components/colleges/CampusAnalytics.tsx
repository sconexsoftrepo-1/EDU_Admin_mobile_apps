"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  BarChart3,
  CalendarDays,
  ChevronRight,
  Receipt,
  Wallet,
} from "lucide-react";
import { api, errorText, type CampusAnalyticsData } from "@/services/api";
import {
  BarList,
  Donut,
  Empty,
  FilterDate,
  FilterSelect,
  LoadFailed,
  nice,
  Panel,
  percentOf,
  rupees,
  shortDate,
  Stat,
} from "./AnalyticsParts";

const Trend = dynamic(() => import("./DashboardFeeChart"), {
  ssr: false,
  loading: () => <div className="anw-skeleton" />,
});
const NO_FILTERS = { year: "", department: "", from: "", to: "", method: "", purpose: "" };
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const sumBy = <T,>(rows: T[], keyOf: (row: T) => string, valueOf: (row: T) => number) => {
  const totals = new Map<string, { value: number; count: number }>();
  for (const row of rows) {
    const key = keyOf(row);
    const item = totals.get(key) || { value: 0, count: 0 };
    item.value += valueOf(row);
    item.count += 1;
    totals.set(key, item);
  }
  return [...totals.entries()].sort((a, b) => b[1].value - a[1].value);
};
const total = <T,>(rows: T[], valueOf: (row: T) => number) => rows.reduce((sum, row) => sum + valueOf(row), 0);

export default function CampusAnalytics({
  moduleHref,
  more,
}: {
  moduleHref: (module: string) => string | undefined;
  /** The existing campus panels, kept below the new analytics. */
  more?: ReactNode;
}) {
  const [data, setData] = useState<CampusAnalyticsData | null>(null);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState(NO_FILTERS);
  const load = useCallback(() => {
    setError("");
    return api.analytics.campus().then(setData).catch((e) => setError(errorText(e)));
  }, []);
  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);
  const set = (patch: Partial<typeof NO_FILTERS>) => setFilters((current) => ({ ...current, ...patch }));
  const toggle = (key: keyof typeof NO_FILTERS, value: string) => set({ [key]: filters[key] === value ? "" : value });

  const collections = useMemo(
    () =>
      (data?.collections || []).filter(
        (r) =>
          (!filters.year || r.year === filters.year) &&
          (!filters.department || r.department === filters.department) &&
          (!filters.method || r.method === filters.method) &&
          (!filters.purpose || r.purpose === filters.purpose) &&
          (!filters.from || r.date >= filters.from) &&
          (!filters.to || r.date <= filters.to),
      ),
    [data, filters],
  );
  const dues = useMemo(
    () =>
      (data?.dues || []).filter(
        (r) =>
          (!filters.year || r.year === filters.year) &&
          (!filters.department || r.department === filters.department) &&
          (!filters.purpose || r.purpose === filters.purpose),
      ),
    [data, filters],
  );
  const today = data?.today || "";
  const overdue = useMemo(() => dues.filter((r) => r.days_overdue > 0), [dues]);
  const ageing = useMemo(() => {
    const buckets = [["1–30 days", 1, 30], ["31–60 days", 31, 60], ["61–90 days", 61, 90], ["Over 90 days", 91, Infinity]] as const;
    return buckets.map(([label, low, high]) => {
      const rows = overdue.filter((r) => r.days_overdue >= low && r.days_overdue <= high);
      const value = total(rows, (r) => r.amount);
      return { key: label, label, value, display: `${rupees(value)} · ${new Set(rows.map((r) => r.student_code)).size} students` };
    });
  }, [overdue]);
  const studentOverdue = useMemo(() => {
    const students = new Map<string, { code: string; name: string; course: string | null; amount: number; oldest: string; days: number }>();
    for (const row of overdue) {
      const item = students.get(row.student_code) || { code: row.student_code, name: row.student, course: row.course, amount: 0, oldest: row.due_date, days: 0 };
      item.amount += row.amount;
      if (row.due_date < item.oldest) item.oldest = row.due_date;
      item.days = Math.max(item.days, row.days_overdue);
      students.set(row.student_code, item);
    }
    return [...students.values()].sort((a, b) => b.amount - a.amount);
  }, [overdue]);
  const trend = useMemo(() => {
    const months = new Map<string, number>();
    for (const row of collections) if (row.date) months.set(row.date.slice(0, 7), (months.get(row.date.slice(0, 7)) || 0) + row.amount);
    return [...months.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-12).map(([month, collected]) => ({
      name: `${MONTHS[Number(month.slice(5)) - 1]} ${month.slice(2, 4)}`, collected, outstanding: 0,
    }));
  }, [collections]);

  if (error && !data) return <LoadFailed message="Campus insights could not be loaded." retry={load} />;
  if (!data)
    return (
      <div role="status" aria-label="Loading campus insights…" className="anw-loading">
        <div className="anw-skeleton" />
        <div className="anw-skeleton" />
        <div className="anw-skeleton anw-skeleton-tall" />
      </div>
    );
  const finance = data.collections !== null;
  const collected = total(collections, (r) => r.amount);
  const collectedToday = total(collections.filter((r) => r.date === today), (r) => r.amount);
  const outstanding = total(dues, (r) => r.amount);
  const overdueTotal = total(overdue, (r) => r.amount);
  const dueToday = total(dues.filter((r) => r.due_date === today), (r) => r.amount);
  const upcoming = total(dues.filter((r) => r.due_date > today), (r) => r.amount);
  const expenses = data.expenses || [];
  const month = today.slice(0, 7);
  const purposeOptions = [...new Set([...(data.collections || []).map((r) => r.purpose), ...(data.dues || []).map((r) => r.purpose || "")])].filter(Boolean).sort();
  const methodOptions = [...new Set((data.collections || []).map((r) => r.method || ""))].filter(Boolean).sort();
  const purposes = sumBy(collections, (r) => r.purpose, (r) => r.amount);
  const methods = sumBy(collections, (r) => r.method || "unknown", (r) => r.amount);
  const cashbookHref = moduleHref("cashbook");
  const operations = Object.entries(data.operations);
  const active = Object.values(filters).some(Boolean);
  return (
    <div className="anw">
      <header className="anw-head">
        <span className="anw-head-icon"><BarChart3 size={22} /></span>
        <div>
          <h2>Campus insights</h2>
          <p>Fee collections, cashbook, overdues, expenses and campus operations.</p>
        </div>
      </header>
      {finance && (
        <div className="anw-filters">
          <FilterSelect label="Academic year" value={filters.year} onChange={(v) => set({ year: v })} all="All years"
            options={data.options.years.map((y) => ({ value: y.code, label: y.name }))} />
          <FilterSelect label="Department" value={filters.department} onChange={(v) => set({ department: v })} all="All departments"
            options={data.options.departments.map((d) => ({ value: d.code, label: d.name }))} />
          <FilterDate label="From" value={filters.from} onChange={(v) => set({ from: v })} />
          <FilterDate label="To" value={filters.to} onChange={(v) => set({ to: v })} />
          <FilterSelect label="Payment method" value={filters.method} onChange={(v) => set({ method: v })} all="All methods"
            options={methodOptions.map((m) => ({ value: m, label: nice(m) }))} />
          <FilterSelect label="Collection purpose" value={filters.purpose} onChange={(v) => set({ purpose: v })} all="All purposes"
            options={purposeOptions.map((p) => ({ value: p, label: p }))} />
          <button className="anw-reset" disabled={!active} onClick={() => setFilters(NO_FILTERS)}>Reset</button>
        </div>
      )}
      {finance && (
        <div className="anw-stats">
          <Stat icon={Wallet} label="Total collections" value={rupees(collected)} />
          <Stat icon={Wallet} label="Collected today" value={rupees(collectedToday)} />
          <Stat icon={Receipt} label="Outstanding fees" value={rupees(outstanding)} hint="All unpaid" />
          <Stat icon={AlertTriangle} label="Overdue fees" value={rupees(overdueTotal)} hint="Past the due date" tone={overdueTotal ? "warn" : undefined} />
          {data.expenses && <Stat icon={Receipt} label="Today's expenses" value={rupees(total(expenses.filter((e) => e.date === today), (e) => e.amount))} />}
          {data.cashbook && <Stat icon={Banknote} label="Cash balance" value={rupees(data.cashbook.closing)} hint="Physical cash only" />}
        </div>
      )}
      {finance && (
        <div className="anw-grid anw-grid-3">
          <Panel title="Collection by purpose">
            {purposes.length ? (
              <Donut title="Collection by purpose" centre={rupees(collected)} centreLabel="Total" selected={filters.purpose}
                onSelect={(key) => toggle("purpose", key)}
                slices={purposes.map(([key, item]) => ({ key, label: key, value: item.value, display: rupees(item.value) }))} />
            ) : <Empty>No collections match these filters.</Empty>}
          </Panel>
          <Panel title="Collection by payment method">
            {methods.length ? (
              <Donut title="Collection by payment method" centre={String(total(methods, ([, item]) => item.count))} centreLabel="Allocations" selected={filters.method}
                onSelect={(key) => toggle("method", key)}
                slices={methods.map(([key, item]) => ({ key, label: nice(key), value: item.value, display: rupees(item.value) }))} />
            ) : <Empty>No collections match these filters.</Empty>}
          </Panel>
          <Panel title="Today's cashbook" className="anw-cashbook"
            action={cashbookHref ? <Link className="anw-head-link" href={cashbookHref} aria-label="Open cashbook"><ArrowRight size={16} /></Link> : undefined}>
            {data.cashbook ? (
              <>
                <dl className="anw-cash">
                  <div><dt>Opening balance</dt><dd>{rupees(data.cashbook.opening)}</dd></div>
                  <div><dt>Cash received today</dt><dd>{rupees(data.cashbook.receipts)}</dd></div>
                  <div><dt>Cash paid today</dt><dd>{rupees(data.cashbook.payments)}</dd></div>
                  <div className="is-total"><dt>Current balance</dt><dd>{rupees(data.cashbook.closing)}</dd></div>
                </dl>
                <p className="anw-note">Physical cash only. Bank and online payments are not in the cashbook.</p>
                {data.cashbook.recent.length > 0 && (
                  <ul className="anw-list">
                    {data.cashbook.recent.slice(0, 3).map((row) => (
                      <li key={row.reference}>
                        <div><strong>{row.description}</strong><small>{shortDate(row.date)}</small></div>
                        <b>{row.receipt ? `+${rupees(row.receipt)}` : `−${rupees(row.payment)}`}</b>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : <Empty>Your role does not include the cashbook.</Empty>}
          </Panel>
        </div>
      )}
      {finance && trend.length > 0 && (
        <Panel title="Collection trend">
          <div className="anw-trend" role="img" aria-label="Collections by month for the selected filters">
            <Trend rows={trend} show={{ collected: true, outstanding: false }} />
          </div>
        </Panel>
      )}
      {finance && (
        <div className="anw-grid anw-grid-2">
          <Panel title="Overdue fee analytics">
            <div className="anw-mini-stats">
              <div><strong>{rupees(overdueTotal)}</strong><small>Total overdue</small></div>
              <div><strong>{studentOverdue.length}</strong><small>Students overdue</small></div>
              <div><strong>{rupees(dueToday)}</strong><small>Due today</small></div>
              <div><strong>{rupees(upcoming)}</strong><small>Upcoming dues</small></div>
            </div>
            <h4>Overdue ageing</h4>
            {overdueTotal > 0 ? <BarList items={ageing} /> : <Empty>Nothing is overdue.</Empty>}
          </Panel>
          <Panel title="Students with overdue fees" action={moduleHref("fees") ? <Link className="anw-link" href={moduleHref("fees")!}>View all</Link> : undefined}>
            {studentOverdue.length ? (
              <div className="anw-table">
                <table>
                  <thead><tr><th>Student</th><th>Course</th><th>Overdue</th><th>Oldest due</th><th>Ledger</th></tr></thead>
                  <tbody>
                    {studentOverdue.slice(0, 6).map((row) => {
                      const href = moduleHref("students");
                      return (
                        <tr key={row.code}>
                          <td>{row.name}</td><td>{row.course || "—"}</td><td>{rupees(row.amount)}</td>
                          <td>{row.days} days ago</td>
                          <td>{href ? <Link className="anw-link" href={`${href}/${encodeURIComponent(row.code)}`}>View ledger</Link> : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : <Empty>No student has overdue fees.</Empty>}
          </Panel>
        </div>
      )}
      <div className="anw-grid anw-grid-3">
        {data.expenses && (
          <Panel title="Expense analytics" action={moduleHref("expense-dashboard") ? <Link className="anw-head-link" href={moduleHref("expense-dashboard")!} aria-label="Open expense dashboard"><ArrowRight size={16} /></Link> : undefined}>
            <div className="anw-mini-stats">
              <div><strong>{rupees(total(expenses, (e) => e.amount))}</strong><small>Recorded</small></div>
              <div><strong>{rupees(total(expenses.filter((e) => e.date.startsWith(month)), (e) => e.amount))}</strong><small>This month</small></div>
              <div><strong>{rupees(total(expenses.filter((e) => e.status === "unpaid"), (e) => e.amount))}</strong><small>Unpaid</small></div>
            </div>
            {expenses.length ? (
              <BarList items={sumBy(expenses, (e) => e.category, (e) => e.amount).slice(0, 5).map(([key, item]) => ({
                key, label: key, value: item.value, display: `${rupees(item.value)} · ${percentOf(item.value, total(expenses, (e) => e.amount))}%`,
              }))} />
            ) : <Empty>No expenses recorded.</Empty>}
          </Panel>
        )}
        {operations.length > 0 && (
          <Panel title="Key metrics">
            <div className="anw-ops">
              {operations.map(([key, item]) => {
                const href = item.module ? moduleHref(item.module) : undefined;
                const body = (<><strong>{item.value}</strong><span>{item.label}</span><small>{item.hint}</small></>);
                return href ? <Link key={key} href={href}>{body}</Link> : <div key={key}>{body}</div>;
              })}
            </div>
          </Panel>
        )}
        {data.activity && (
          <Panel title="Campus activity" action={moduleHref("calendar") ? <Link className="anw-link" href={moduleHref("calendar")!}>View all</Link> : undefined}>
            {data.activity.length ? (
              <ul className="anw-events">
                {data.activity.map((event) => {
                  const date = new Date(event.starts_at);
                  const href = moduleHref("calendar");
                  const body = (
                    <>
                      <span className="anw-event-date"><small>{date.toLocaleDateString("en-IN", { month: "short" })}</small><b>{date.toLocaleDateString("en-IN", { day: "2-digit" })}</b></span>
                      <span className="anw-event-text"><strong>{event.title}</strong><small>{event.detail}</small></span>
                      {href && <ChevronRight size={15} />}
                    </>
                  );
                  return <li key={event.code}>{href ? <Link href={href}>{body}</Link> : <div>{body}</div>}</li>;
                })}
              </ul>
            ) : <Empty><CalendarDays size={14} /> No campus activities scheduled.</Empty>}
          </Panel>
        )}
      </div>
      {more && (
        <details className="anw-more">
          <summary>More campus records</summary>
          <div>{more}</div>
        </details>
      )}
    </div>
  );
}
