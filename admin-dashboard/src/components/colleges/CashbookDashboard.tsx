"use client";
/**
 * Cashbook dashboard: cash, UPI and bank transfer collections for a day / week / month / year
 * (current by default), narrowed by course level, branch, academic year and payment screen, with
 * the cash book's opening, received, deposited and closing cash for the same period.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Download, IndianRupee, Landmark, RotateCcw, Search, Smartphone, Wallet } from "lucide-react";
import { api, errorText, type ReportsAnalyticsData } from "@/services/api";
import { excelTable } from "@/lib/colleges/export-table";
import { BarList, Donut, Empty, LoadFailed, Panel, rupees, shortDate } from "./AnalyticsParts";
import { PeriodPicker, iso, periodBounds } from "./FeeCollectionAnalytics";
import { Carousel } from "./ReportsAnalytics";
import "./reports-analytics.css";

type Unit = "day" | "week" | "month" | "year";
type Range = Unit | "all";
type Payment = ReportsAnalyticsData["payments"][number];
const METHODS = [
  ["cash", "Cash", "#a56824", Wallet],
  ["upi", "UPI", "#e0a85a", Smartphone],
  ["bank_transfer", "Bank transfer", "#5b3a17", Landmark],
] as const;
const NAME: Record<string, string> = { cash: "Cash", upi: "UPI", bank_transfer: "Bank transfer" };
const compact = (v: number) =>
  v >= 1e7 ? `₹${+(v / 1e7).toFixed(1)}Cr` : v >= 1e5 ? `₹${+(v / 1e5).toFixed(1)}L` : v >= 1e3 ? `₹${+(v / 1e3).toFixed(0)}K` : `₹${v}`;
const tip = { borderRadius: 10, border: "1px solid #eadccb", fontSize: 12 };
const total = (rows: Payment[]) => rows.reduce((n, p) => n + p.amount, 0);

export default function CashbookDashboard() {
  const [data, setData] = useState<ReportsAnalyticsData | null>(null);
  const [error, setError] = useState("");
  const [range, setRange] = useState<Range>("month");
  const [anchor, setAnchor] = useState(() => new Date());
  const [level, setLevel] = useState("");
  const [program, setProgram] = useState("");
  const [year, setYear] = useState("");
  const [source, setSource] = useState<"all" | "linked" | "manual">("all");
  const [method, setMethod] = useState("");
  const [query, setQuery] = useState("");
  const load = useCallback(() => {
    setError("");
    return api.analytics
      .reports()
      .then(setData)
      .catch((e) => setError(errorText(e)));
  }, []);
  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  const programs = useMemo(() => new Map((data?.programs || []).map((p) => [p.code, p])), [data]);
  const [from, to] = useMemo(() => (range === "all" ? ["", ""] : periodBounds(range, anchor).map(iso)), [range, anchor]);
  const inPeriod = useCallback((day: string) => (!from || day >= from) && (!to || day <= to), [from, to]);
  // Manual-screen payments carry the branch as typed; match it to the course by name.
  const inBranch = useCallback(
    (p: Payment, code: string) =>
      p.program_code === code ||
      (!p.program_code && !!p.branch_label && p.branch_label.trim().toLowerCase() === (programs.get(code)?.name || "").trim().toLowerCase()),
    [programs],
  );
  const base = useMemo(
    () =>
      (data?.payments || []).filter(
        (p) => inPeriod(p.date) && (source === "all" || p.source === source) && (!year || p.year_code === year),
      ),
    [data, inPeriod, source, year],
  );
  const scoped = useMemo(
    () => base.filter((p) => (!level || p.level === level) && (!program || inBranch(p, program))),
    [base, level, program, inBranch],
  );
  const shown = useMemo(() => scoped.filter((p) => !method || p.method === method), [scoped, method]);

  const byMethod = useMemo(
    () => METHODS.map(([key, label]) => ({ key, label, value: total(scoped.filter((p) => p.method === key)) })),
    [scoped],
  );
  const cash = useMemo(() => {
    const rows = (data?.cashbook || []).filter((r) => inPeriod(r.date));
    if (!rows.length) return null;
    const add = (k: "received" | "paid" | "deposited") => rows.reduce((n, r) => n + Number(r[k]), 0);
    return {
      opening: Number(rows[0].opening),
      received: add("received"),
      paid: add("paid"),
      deposited: add("deposited"),
      closing: Number(rows.at(-1)!.closing),
      withClerks: Number(rows.at(-1)!.with_clerks),
    };
  }, [data, inPeriod]);

  // Collection over the period: by day for a week or month, by month for a year or all time.
  const trend = useMemo(() => {
    const monthly = range === "year" || range === "all";
    const buckets = new Map<string, Record<string, number | string>>();
    if (range === "week" || range === "month") {
      for (let d = new Date(`${from}T00:00:00`); iso(d) <= to; d.setDate(d.getDate() + 1)) buckets.set(iso(d), { key: iso(d) });
    }
    for (const p of shown) {
      const key = monthly ? p.date.slice(0, 7) : range === "day" ? NAME[p.method] || p.method : p.date;
      const row = buckets.get(key) || { key };
      row[p.method] = Number(row[p.method] || 0) + p.amount;
      buckets.set(key, row);
    }
    return [...buckets.values()]
      .sort((a, b) => String(a.key).localeCompare(String(b.key)))
      .map((r) => ({
        ...r,
        label:
          range === "day"
            ? String(r.key)
            : monthly
              ? new Date(`${r.key}-01T00:00:00`).toLocaleDateString("en-IN", { month: "short", year: "2-digit" })
              : new Date(`${r.key}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
      }));
  }, [shown, range, from, to]);

  const branchRows = useMemo(() => {
    const rows = new Map<string, { name: string; cash: number; upi: number; bank_transfer: number; count: number }>();
    for (const p of scoped) {
      const name = p.program_code ? programs.get(p.program_code)?.name || p.program_code : p.branch_label ? `${p.branch_label} (manual)` : "Not linked to a course";
      const row = rows.get(name) || { name, cash: 0, upi: 0, bank_transfer: 0, count: 0 };
      row[p.method as "cash"] = (row[p.method as "cash"] || 0) + p.amount;
      row.count += 1;
      rows.set(name, row);
    }
    return [...rows.values()].sort((a, b) => b.cash + b.upi + b.bank_transfer - (a.cash + a.upi + a.bank_transfer));
  }, [scoped, programs]);
  const levelItems = useMemo(() => {
    const totals = new Map<string, number>();
    for (const p of scoped) totals.set(p.level || "", (totals.get(p.level || "") || 0) + p.amount);
    return [...totals].map(([key, value]) => ({
      key: key || "none",
      label: data?.levels.find((l) => l.key === key)?.label || "Not set",
      value,
      display: rupees(value),
    }));
  }, [scoped, data]);
  const transactions = useMemo(() => {
    const text = query.trim().toLowerCase();
    return [...shown]
      .filter((p) => !text || [p.student, p.receipt_number, p.reference, p.branch_label, programs.get(p.program_code || "")?.name].join(" ").toLowerCase().includes(text))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [shown, query, programs]);

  if (error && !data) return <LoadFailed message="The cashbook dashboard could not be loaded." retry={load} />;
  if (!data)
    return (
      <div className="anw-loading" role="status" aria-label="Loading cashbook dashboard…">
        <div className="anw-skeleton" />
        <div className="anw-skeleton anw-skeleton-tall" />
      </div>
    );

  const levelCard = (key: string) => total(base.filter((p) => !key || p.level === key));
  const activeBranches = data.programs.filter(
    (p) => (!level || p.level === level) && (base.some((x) => inBranch(x, p.code)) || data.students.some((s) => s.program_code === p.code) || p.code === program),
  );
  const columns = ["Date", "Receipt no.", "Student", "Course / branch", "Method", "Reference", "Amount"];
  const exportRows = () =>
    transactions.map((p) => [
      shortDate(p.date),
      p.receipt_number || "—",
      p.student || "—",
      p.program_code ? programs.get(p.program_code)?.name || "—" : p.branch_label || "—",
      NAME[p.method] || p.method,
      p.reference || "—",
      rupees(p.amount),
    ]);

  return (
    <div className="rpa anw">
      <div className="rpa-filters">
        <div className="fcw-tabs" role="tablist" aria-label="Period">
          {(
            [
              ["day", "Day"],
              ["week", "Week"],
              ["month", "Month"],
              ["year", "Year"],
              ["all", "All time"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              role="tab"
              aria-selected={range === key}
              onClick={() => {
                setRange(key);
                setAnchor(new Date());
              }}
            >
              {label}
            </button>
          ))}
        </div>
        {range !== "all" && <PeriodPicker range={range} anchor={anchor} onChange={setAnchor} />}
      </div>
      <div className="rpa-filters">
        <div className="fcw-tabs" role="tablist" aria-label="Payments from">
          {(
            [
              ["all", "All screens"],
              ["linked", "Payments & receipts"],
              ["manual", "Manual payments"],
            ] as const
          ).map(([key, label]) => (
            <button key={key} role="tab" aria-selected={source === key} onClick={() => setSource(key)}>
              {label}
            </button>
          ))}
        </div>
        <label className="anw-filter">
          Academic year
          <select value={year} onChange={(e) => setYear(e.target.value)}>
            <option value="">All academic years</option>
            {data.years
              .filter((y) => !program || y.program_code === program)
              .map((y) => (
                <option key={y.code} value={y.code}>
                  {y.name}
                </option>
              ))}
          </select>
        </label>
        {(level || program || year || source !== "all" || method) && (
          <button
            type="button"
            className="rpa-reset"
            onClick={() => {
              setLevel("");
              setProgram("");
              setYear("");
              setSource("all");
              setMethod("");
            }}
          >
            <RotateCcw size={14} /> Clear filters
          </button>
        )}
      </div>

      <h3 className="rpa-label">Courses</h3>
      <Carousel label="Courses">
        {[{ key: "", label: "All courses" }, ...data.levels].map((l) => (
          <button
            key={l.key || "all"}
            type="button"
            className={`rpa-card is-small ${level === l.key ? "is-on" : ""}`}
            aria-pressed={level === l.key}
            onClick={() => {
              setLevel(l.key);
              setProgram("");
            }}
          >
            <strong>{l.label}</strong>
            <b>{compact(levelCard(l.key))}</b>
            <span>collected in this period</span>
          </button>
        ))}
      </Carousel>
      <h3 className="rpa-label">Branches{level ? ` · ${data.levels.find((l) => l.key === level)?.label}` : ""}</h3>
      <Carousel label="Branches">
        <button type="button" className={`rpa-card is-small ${!program ? "is-on" : ""}`} aria-pressed={!program} onClick={() => setProgram("")}>
          <strong>All branches</strong>
          <span>{activeBranches.length} branches</span>
        </button>
        {activeBranches.map((p) => (
          <button
            key={p.code}
            type="button"
            className={`rpa-card is-small ${program === p.code ? "is-on" : ""}`}
            aria-pressed={program === p.code}
            onClick={() => setProgram(program === p.code ? "" : p.code)}
          >
            <strong>{p.name}</strong>
            <b>{compact(total(base.filter((x) => inBranch(x, p.code))))}</b>
            <span>collected in this period</span>
          </button>
        ))}
      </Carousel>

      <div className="rpa-kpis">
        <button type="button" className={`rpa-kpi ${!method ? "is-on" : ""}`} onClick={() => setMethod("")}>
          <span className="rpa-kpi-icon">
            <IndianRupee size={18} />
          </span>
          <span className="rpa-kpi-text">
            <small>Total collected</small>
            <strong>{rupees(total(scoped))}</strong>
            <em>
              {scoped.length} transactions · {new Set(scoped.map((p) => (p.source === "manual" ? `m:${(p.student || "").toLowerCase()}` : p.student_code))).size} students paid
            </em>
          </span>
        </button>
        {METHODS.map(([key, label, , Icon]) => {
          const rows = scoped.filter((p) => p.method === key);
          return (
            <button
              key={key}
              type="button"
              className={`rpa-kpi ${method === key ? "is-on" : ""}`}
              aria-pressed={method === key}
              onClick={() => setMethod(method === key ? "" : key)}
            >
              <span className="rpa-kpi-icon">
                <Icon size={18} />
              </span>
              <span className="rpa-kpi-text">
                <small>{label}</small>
                <strong>{rupees(total(rows))}</strong>
                <em>
                  {rows.length} transaction{rows.length === 1 ? "" : "s"} · {method === key ? "showing only these" : "click to show only these"}
                </em>
              </span>
            </button>
          );
        })}
      </div>

      <Panel title="Cash book for this period" className="rpa-cashbook">
        {cash ? (
          <div className="rpa-mini rpa-mini-5">
            <span>
              <small>Opening cash</small>
              <strong>{rupees(cash.opening)}</strong>
            </span>
            <span>
              <small>Cash received</small>
              <strong>{rupees(cash.received)}</strong>
            </span>
            <span>
              <small>Paid out</small>
              <strong>{rupees(cash.paid)}</strong>
            </span>
            <span>
              <small>Deposited to bank</small>
              <strong>{rupees(cash.deposited)}</strong>
            </span>
            <span>
              <small>Closing cash</small>
              <strong>{rupees(cash.closing)}</strong>
              <em>{rupees(cash.withClerks)} with clerks</em>
            </span>
          </div>
        ) : (
          <Empty>No cash movements in this period.</Empty>
        )}
        <p className="rpa-note">The cash book covers the whole college; course and branch filters apply to collections.</p>
      </Panel>

      <div className="anw-grid rpa-grid-2">
        <Panel title="Collection over the period">
          {shown.length ? (
            <div className="rpa-chart">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#efe6d8" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                  <YAxis tickFormatter={compact} tick={{ fontSize: 11 }} width={60} />
                  <Tooltip contentStyle={tip} formatter={(v) => rupees(Number(v))} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {METHODS.filter(([key]) => !method || key === method).map(([key, label, colour]) => (
                    <Bar key={key} dataKey={key} name={label} stackId="m" fill={colour} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <Empty>No collections in this period.</Empty>
          )}
        </Panel>
        <Panel title="Cash, UPI and bank transfer">
          {total(scoped) ? (
            <Donut
              title="Payment methods"
              centre={compact(total(scoped))}
              centreLabel="Collected"
              selected={method}
              onSelect={(key) => setMethod(method === key ? "" : key)}
              slices={byMethod.filter((m) => m.value).map((m) => ({ ...m, display: rupees(m.value) }))}
            />
          ) : (
            <Empty>No collections in this period.</Empty>
          )}
        </Panel>
      </div>

      <div className="anw-grid rpa-grid-2">
        <Panel title="By course level">
          {levelItems.length ? <BarList items={levelItems} selected={level} onSelect={(key) => setLevel(level === key || key === "none" ? "" : key)} /> : <Empty>No collections in this period.</Empty>}
        </Panel>
        <Panel title="By branch">
          {branchRows.length ? (
            <div className="anw-table">
              <table>
                <thead>
                  <tr>
                    <th>Course / branch</th>
                    <th>Cash</th>
                    <th>UPI</th>
                    <th>Bank</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {branchRows.map((r) => (
                    <tr key={r.name}>
                      <td>{r.name}</td>
                      <td>{rupees(r.cash)}</td>
                      <td>{rupees(r.upi)}</td>
                      <td>{rupees(r.bank_transfer)}</td>
                      <td>
                        <strong>{rupees(r.cash + r.upi + r.bank_transfer)}</strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty>No collections in this period.</Empty>
          )}
        </Panel>
      </div>

      <Panel
        title={`Transactions${method ? ` · ${NAME[method]}` : ""} (${transactions.length})`}
        action={
          <span className="anw-actions">
            <label className="fcw-search">
              <Search size={14} />
              <input aria-label="Search transactions" placeholder="Student, receipt or reference…" value={query} onChange={(e) => setQuery(e.target.value)} />
            </label>
            <button type="button" className="anw-link" onClick={() => excelTable("cashbook-transactions", "Transactions", columns, exportRows())}>
              <Download size={14} /> Excel
            </button>
          </span>
        }
      >
        {transactions.length ? (
          <div className="anw-table">
            <table>
              <thead>
                <tr>
                  {columns.map((c) => (
                    <th key={c}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {transactions.slice(0, 100).map((p, i) => (
                  <tr key={`${p.receipt_number}-${i}`}>
                    <td>{shortDate(p.date)}</td>
                    <td>{p.receipt_number || "—"}</td>
                    <td>{p.student || "—"}</td>
                    <td>{p.program_code ? programs.get(p.program_code)?.name || "—" : p.branch_label || "—"}</td>
                    <td>
                      <span className={`rpa-method is-${p.method}`}>{NAME[p.method] || p.method}</span>
                    </td>
                    <td>{p.reference || "—"}</td>
                    <td>
                      <strong>{rupees(p.amount)}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {transactions.length > 100 && <p className="rpa-note">Showing the latest 100; Excel has all {transactions.length}.</p>}
          </div>
        ) : (
          <Empty>No transactions match these filters.</Empty>
        )}
      </Panel>
      <p className="rpa-note">Figures use settled payments; UPI and bank transfers count on the day the money moved.</p>
    </div>
  );
}
