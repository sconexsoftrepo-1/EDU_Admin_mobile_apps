"use client";
/**
 * Reports & analytics: every figure the system keeps (students, fees, collections, overdues,
 * cashbook, late fees and admissions) by course level, branch and academic year. Course and
 * branch carousels and the filters update every card, chart and table instantly.
 */
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlarmClock,
  ArrowRight,
  Banknote,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  GraduationCap,
  IndianRupee,
  Printer,
  Receipt,
  RotateCcw,
  TriangleAlert,
  Users,
  Wallet,
} from "lucide-react";
import { api, errorText, type ReportsAnalyticsData } from "@/services/api";
import { excelTable, pdfTable } from "@/lib/colleges/export-table";
import { Donut, Empty, LoadFailed, Panel, percentOf, rupees } from "./AnalyticsParts";
import PDFActions from "./PDFActions";
import { toast } from "./toast";
import "./reports-analytics.css";

type Period = "all" | "year" | "month" | "custom";
const METHOD = { cash: "Cash", upi: "UPI", bank_transfer: "Bank transfer" } as Record<string, string>;
const METHOD_COLOUR = { cash: "#a56824", upi: "#e0a85a", bank_transfer: "#5b3a17" } as Record<string, string>;
const AGING = [
  ["current", "Not yet due"],
  ["1-30", "1–30 days"],
  ["31-60", "31–60 days"],
  ["61-90", "61–90 days"],
  ["90+", "Over 90 days"],
] as const;
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const compact = (v: number) =>
  v >= 1e7 ? `₹${+(v / 1e7).toFixed(1)}Cr` : v >= 1e5 ? `₹${+(v / 1e5).toFixed(1)}L` : v >= 1e3 ? `₹${+(v / 1e3).toFixed(0)}K` : `₹${v}`;
const sum = <T,>(rows: T[], pick: (r: T) => number) => rows.reduce((n, r) => n + pick(r), 0);
const tooltip = { borderRadius: 10, border: "1px solid #eadccb", fontSize: 12 };
const money = (v: unknown) => rupees(Number(v) || 0);

/** A horizontal card carousel with previous / next buttons. */
export function Carousel({ label, children }: { label: string; children: React.ReactNode }) {
  const track = useRef<HTMLDivElement>(null);
  const move = (step: number) => track.current?.scrollBy({ left: step * (track.current.clientWidth * 0.8), behavior: "smooth" });
  return (
    <div className="rpa-carousel" role="group" aria-label={label}>
      <button type="button" className="rpa-carousel-nav" aria-label={`Previous ${label.toLowerCase()}`} onClick={() => move(-1)}>
        <ChevronLeft size={18} />
      </button>
      <div className="rpa-carousel-track" ref={track}>
        {children}
      </div>
      <button type="button" className="rpa-carousel-nav" aria-label={`Next ${label.toLowerCase()}`} onClick={() => move(1)}>
        <ChevronRight size={18} />
      </button>
    </div>
  );
}

export default function ReportsAnalytics({ nav }: { nav: (module: string) => string }) {
  const [data, setData] = useState<ReportsAnalyticsData | null>(null);
  const [error, setError] = useState("");
  const [level, setLevel] = useState("");
  const [program, setProgram] = useState("");
  const [year, setYear] = useState("");
  const [period, setPeriod] = useState<Period>("all");
  const [showAllBranches, setShowAllBranches] = useState(false);
  const [custom, setCustom] = useState({ from: "", to: "" });
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

  const range = useMemo(() => {
    const now = new Date();
    if (period === "year") return { from: iso(new Date(now.getFullYear(), 0, 1)), to: iso(now) };
    if (period === "month") return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to: iso(now) };
    if (period === "custom") return custom;
    return { from: "", to: "" };
  }, [period, custom]);
  const inRange = useCallback((day: string | null | undefined) => {
    const d = String(day || "").slice(0, 10);
    return (!range.from || d >= range.from) && (!range.to || d <= range.to);
  }, [range]);
  const programs = useMemo(() => new Map((data?.programs || []).map((p) => [p.code, p])), [data]);
  const levelName = useCallback((key: string | null) => data?.levels.find((l) => l.key === key)?.label || (key ? key : "Not set"), [data]);
  const programName = useCallback((code: string | null) => (code && programs.get(code)?.name) || "Not linked to a course", [programs]);

  // Rows narrowed by course level, branch and academic year (and the period for dated rows).
  const scoped = useMemo(() => {
    if (!data) return null;
    const match = (r: { level: string | null; program_code: string | null; year_code: string | null }) =>
      (!level || r.level === level) && (!program || r.program_code === program) && (!year || r.year_code === year);
    const students = data.students.filter(match);
    const codes = new Set(students.map((s) => s.code));
    return {
      students,
      charges: data.charges.filter(match),
      payments: data.payments.filter((p) => match(p) && inRange(p.date)),
      enquiries: data.enquiries.filter((e) => match(e) && inRange(e.recorded_at)),
      late: data.late_fees.items.filter((i) => !level && !program && !year ? true : codes.has(i.student_code)),
    };
  }, [data, level, program, year, inRange]);

  // Cards for the carousels: figures for each course level and each branch under the other filters.
  const cards = useCallback(
    (key: "level" | "program_code", value: string) => {
      if (!data) return { students: 0, collected: 0, billed: 0, outstanding: 0 };
      const match = (r: { level: string | null; program_code: string | null; year_code: string | null }) =>
        r[key] === value && (!year || r.year_code === year) && (key === "program_code" || !program || r.program_code === program);
      const charges = data.charges.filter(match);
      return {
        students: data.students.filter(match).length,
        collected: sum(data.payments.filter((p) => match(p) && inRange(p.date)), (p) => p.amount),
        billed: sum(charges, (c) => c.billed - c.concession),
        outstanding: sum(charges, (c) => c.outstanding),
      };
    },
    [data, year, program, inRange],
  );

  const figures = useMemo(() => {
    if (!scoped || !data) return null;
    const { charges, payments, enquiries, late } = scoped;
    const overdue = charges.filter((c) => c.days_overdue > 0);
    const lateCharges = charges.filter((c) => c.late_fee);
    const cash = data.cashbook.at(-1);
    return {
      students: scoped.students.length,
      active: scoped.students.filter((s) => s.status === "active").length,
      billed: sum(charges, (c) => c.billed - c.concession),
      concession: sum(charges, (c) => c.concession),
      collected: sum(payments, (p) => p.amount),
      paidOnFees: sum(charges, (c) => c.paid),
      outstanding: sum(charges, (c) => c.outstanding),
      overdue: sum(overdue, (c) => c.outstanding),
      overdueStudents: new Set(overdue.map((c) => c.student_code)).size,
      enquiries: enquiries.length,
      joined: enquiries.filter((e) => e.status === "joined").length,
      lateApplied: sum(lateCharges, (c) => c.billed),
      latePending: sum(lateCharges, (c) => c.outstanding),
      lateStudents: late.filter((i) => i.late_fees.some((f) => f.status !== "cancelled")).length,
      lateCleared: late.filter((i) => i.status === "cleared").length,
      lateUncleared: late.filter((i) => i.status === "uncleared").length,
      lateCancelled: sum(late, (i) => i.late_fees.filter((f) => f.status === "cancelled").length),
      cashInHand: Number(cash?.closing || 0),
      withClerks: Number(cash?.with_clerks || 0),
    };
  }, [scoped, data]);

  const trend = useMemo(() => {
    if (!scoped) return [];
    const months = new Map<string, Record<string, number | string>>();
    for (const p of scoped.payments) {
      const key = p.date.slice(0, 7);
      if (!key) continue;
      const row = months.get(key) || { month: key, cash: 0, upi: 0, bank_transfer: 0 };
      row[p.method] = Number(row[p.method] || 0) + p.amount;
      months.set(key, row);
    }
    return [...months.values()]
      .sort((a, b) => String(a.month).localeCompare(String(b.month)))
      .map((r) => ({ ...r, label: new Date(`${r.month}-01T00:00:00`).toLocaleDateString("en-IN", { month: "short", year: "2-digit" }) }));
  }, [scoped]);

  const byMethod = useMemo(() => {
    const totals = new Map<string, number>();
    for (const p of scoped?.payments || []) totals.set(p.method, (totals.get(p.method) || 0) + p.amount);
    return [...totals].map(([key, value]) => ({ key, label: METHOD[key] || key, value, display: rupees(value) }));
  }, [scoped]);

  /** Students, fees and collections grouped by course level, branch or academic year. */
  const groupBy = useCallback(
    (key: "level" | "program_code" | "year_code", name: (code: string | null) => string) => {
      if (!scoped) return [];
      const rows = new Map<string, { key: string; name: string; students: number; billed: number; collected: number; outstanding: number; overdue: number; enquiries: number; joined: number }>();
      const entry = (code: string | null, label?: string) => {
        const k = code || "none";
        if (!rows.has(k)) rows.set(k, { key: k, name: label || name(code), students: 0, billed: 0, collected: 0, outstanding: 0, overdue: 0, enquiries: 0, joined: 0 });
        return rows.get(k)!;
      };
      for (const s of scoped.students) entry(s[key]).students += 1;
      for (const c of scoped.charges) {
        const row = entry(c[key]);
        row.billed += c.billed - c.concession;
        row.outstanding += c.outstanding;
        if (c.days_overdue > 0) row.overdue += c.outstanding;
      }
      for (const p of scoped.payments) {
        // Manual-screen payments have the branch as typed, not a course record.
        const manual = key === "program_code" && !p.program_code && p.branch_label;
        const row = manual ? entry(`manual:${p.branch_label}`, `${p.branch_label} (manual payments)`) : entry(p[key]);
        row.collected += p.amount;
      }
      for (const e of scoped.enquiries) {
        const row = entry(e[key]);
        row.enquiries += 1;
        if (e.status === "joined") row.joined += 1;
      }
      return [...rows.values()].sort((a, b) => b.collected + b.billed - (a.collected + a.billed) || a.name.localeCompare(b.name));
    },
    [scoped],
  );
  const levelRows = useMemo(() => groupBy("level", levelName), [groupBy, levelName]);
  const branchRows = useMemo(() => groupBy("program_code", programName), [groupBy, programName]);
  const yearName = useCallback((code: string | null) => data?.years.find((y) => y.code === code)?.name || code || "Not set", [data]);
  const yearRows = useMemo(() => groupBy("year_code", yearName), [groupBy, yearName]);

  const aging = useMemo(() => {
    const buckets = new Map<string, number>(AGING.map(([k]) => [k, 0]));
    for (const c of scoped?.charges || []) {
      if (c.outstanding <= 0) continue;
      const d = c.days_overdue;
      const k = d <= 0 ? "current" : d <= 30 ? "1-30" : d <= 60 ? "31-60" : d <= 90 ? "61-90" : "90+";
      buckets.set(k, (buckets.get(k) || 0) + c.outstanding);
    }
    return AGING.map(([k, label]) => ({ key: k, label, amount: buckets.get(k) || 0 }));
  }, [scoped]);
  const topOverdue = useMemo(() => {
    const people = new Map<string, { name: string; amount: number; days: number; course: string }>();
    for (const c of scoped?.charges || []) {
      if (c.days_overdue <= 0 || c.outstanding <= 0) continue;
      const row = people.get(c.student_code) || { name: c.student, amount: 0, days: 0, course: programName(c.program_code) };
      row.amount += c.outstanding;
      row.days = Math.max(row.days, c.days_overdue);
      people.set(c.student_code, row);
    }
    return [...people.values()].sort((a, b) => b.amount - a.amount).slice(0, 8);
  }, [scoped, programName]);

  const cashTrend = useMemo(
    () =>
      (data?.cashbook || [])
        .filter((r) => inRange(r.date))
        .slice(-60)
        .map((r) => ({
          label: new Date(`${r.date}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
          received: Number(r.received),
          deposited: Number(r.deposited),
          closing: Number(r.closing),
        })),
    [data, inRange],
  );
  // Fees taken on the Manual payments screen (students not enrolled yet), under the same filters.
  const manual = useMemo(() => {
    const all = (data?.payments || []).filter(
      (p) => inRange(p.date) && (!level || p.level === level) && (!year || p.year_code === year) &&
        (!program || p.program_code === program || (!p.program_code && (p.branch_label || "").trim().toLowerCase() === (programs.get(program)?.name || "").trim().toLowerCase())),
    );
    const rows = all.filter((p) => p.source === "manual");
    const branches = new Map<string, { name: string; level: string; receipts: number; students: Set<string>; cash: number; upi: number; bank_transfer: number }>();
    for (const p of rows) {
      const name = p.branch_label || "Branch not given";
      const row = branches.get(name) || { name, level: levelName(p.level), receipts: 0, students: new Set<string>(), cash: 0, upi: 0, bank_transfer: 0 };
      row.receipts += 1;
      row.students.add((p.student || "").toLowerCase());
      row[p.method as "cash"] = (row[p.method as "cash"] || 0) + p.amount;
      branches.set(name, row);
    }
    return {
      amount: sum(rows, (p) => p.amount),
      linked: sum(all.filter((p) => p.source === "linked"), (p) => p.amount),
      receipts: rows.length,
      students: new Set(rows.map((p) => (p.student || "").toLowerCase())).size,
      branches: [...branches.values()].sort((a, b) => b.cash + b.upi + b.bank_transfer - (a.cash + a.upi + a.bank_transfer)),
    };
  }, [data, inRange, level, year, program, programs, levelName]);
  const lateBySemester = useMemo(() => {
    const rows = new Map<string, { label: string; applied: number; pending: number }>();
    for (const c of (scoped?.charges || []).filter((x) => x.late_fee)) {
      const k = c.semester ? `Semester ${c.semester}` : "Semester not set";
      const row = rows.get(k) || { label: k, applied: 0, pending: 0 };
      row.applied += c.billed;
      row.pending += c.outstanding;
      rows.set(k, row);
    }
    return [...rows.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [scoped]);

  if (error && !data) return <LoadFailed message="Reports & analytics could not be loaded." retry={load} />;
  if (!data || !figures || !scoped)
    return (
      <div className="anw-loading" role="status" aria-label="Loading reports and analytics…">
        <div className="anw-skeleton" />
        <div className="anw-skeleton anw-skeleton-tall" />
      </div>
    );

  const scopeLabel = [
    level && levelName(level),
    program && programName(program),
    year && yearName(year),
    period === "year" ? "This year" : period === "month" ? "This month" : period === "custom" && (custom.from || custom.to) ? `${custom.from || "…"} to ${custom.to || "…"}` : "",
  ]
    .filter(Boolean)
    .join(" · ") || "All courses · All years · All time";
  const summaryColumns = ["Course / branch", "Course level", "Students", "Fees billed", "Collected", "Outstanding", "Overdue", "Collection %", "Enquiries", "Joined"];
  const summaryRows = () =>
    branchRows.map((r) => [
      r.name,
      levelName(programs.get(r.key)?.level || null),
      String(r.students),
      money(r.billed),
      money(r.collected),
      money(r.outstanding),
      money(r.overdue),
      `${percentOf(r.billed - r.outstanding, r.billed)}%`,
      String(r.enquiries),
      String(r.joined),
    ]);
  const allBranches = (data.programs || []).filter((p) => !level || p.level === level);
  const active = new Set([...data.students, ...data.payments, ...data.enquiries].map((r) => r.program_code).filter(Boolean));
  const branchCards = showAllBranches ? allBranches : allBranches.filter((p) => active.has(p.code) || p.code === program);
  const kpis: [typeof Users, string, string, string, string][] = [
    [Users, "Students", String(figures.students), `${figures.active} active`, "students"],
    [GraduationCap, "Admissions", `${figures.joined} / ${figures.enquiries}`, "Joined / enquiries", "admissions"],
    [Receipt, "Fees billed", money(figures.billed), `${money(figures.concession)} concessions`, "fees"],
    [IndianRupee, "Collected", money(figures.collected), "Settled payments", "payments"],
    [Wallet, "Outstanding", money(figures.outstanding), figures.billed ? `${percentOf(figures.billed - figures.outstanding, figures.billed)}% of fees collected` : "No fees billed yet", "fees"],
    [TriangleAlert, "Overdue", money(figures.overdue), `${figures.overdueStudents} students past due`, "fees"],
    [AlarmClock, "Late fees", money(figures.lateApplied), `${money(figures.latePending)} pending`, "late-fees"],
    [Banknote, "Cash in hand", money(figures.cashInHand), `${money(figures.withClerks)} with clerks`, "cashbook"],
  ];

  return (
    <div className="rpa anw">
      <header className="rpa-head">
        <div>
          <h2>Analytics dashboard</h2>
          <p>{scopeLabel}</p>
        </div>
        <div className="rpa-head-actions">
          <button type="button" className="rpa-button" onClick={() => window.print()} title="Opens the print dialog; choose “Save as PDF”">
            <Printer size={15} /> Download PDF
          </button>
          <button type="button" className="rpa-button" onClick={() => excelTable("course-branch-analytics", "Courses & branches", summaryColumns, summaryRows())}>
            <Download size={15} /> Excel
          </button>
          <PDFActions
            viewLabel="View summary"
            onAction={(mode) =>
              pdfTable("course-branch-analytics", "Course & branch analytics", scopeLabel, summaryColumns, summaryRows(), mode).catch((e) =>
                toast.error("Could not create the PDF", errorText(e)),
              )
            }
          >
            <FileText size={15} /> Summary PDF
          </PDFActions>
        </div>
      </header>

      <div className="rpa-filters">
        <div className="fcw-tabs" role="tablist" aria-label="Period">
          {(
            [
              ["all", "All time"],
              ["year", "This year"],
              ["month", "This month"],
              ["custom", "Custom"],
            ] as const
          ).map(([key, label]) => (
            <button key={key} role="tab" aria-selected={period === key} onClick={() => setPeriod(key)}>
              {label}
            </button>
          ))}
        </div>
        {period === "custom" && (
          <>
            <label className="anw-filter">
              From
              <input type="date" value={custom.from} onChange={(e) => setCustom({ ...custom, from: e.target.value })} />
            </label>
            <label className="anw-filter">
              To
              <input type="date" value={custom.to} onChange={(e) => setCustom({ ...custom, to: e.target.value })} />
            </label>
          </>
        )}
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
        {(level || program || year || period !== "all") && (
          <button
            type="button"
            className="rpa-reset"
            onClick={() => {
              setLevel("");
              setProgram("");
              setYear("");
              setPeriod("all");
            }}
          >
            <RotateCcw size={14} /> Clear filters
          </button>
        )}
      </div>

      <h3 className="rpa-label">Courses</h3>
      <Carousel label="Courses">
        {[{ key: "", label: "All courses" }, ...data.levels].map((l) => {
          const f = l.key ? cards("level", l.key) : { students: data.students.length, collected: sum(data.payments.filter((p) => inRange(p.date)), (p) => p.amount), billed: sum(data.charges, (c) => c.billed - c.concession), outstanding: sum(data.charges, (c) => c.outstanding) };
          if (l.key && !f.students && !f.collected && !data.programs.some((p) => p.level === l.key)) return null;
          return (
            <button
              key={l.key || "all"}
              type="button"
              className={`rpa-card ${level === l.key ? "is-on" : ""}`}
              aria-pressed={level === l.key}
              onClick={() => {
                setLevel(l.key);
                setProgram("");
              }}
            >
              <strong>{l.label}</strong>
              <span>{f.students} students</span>
              <b>{compact(f.collected)} collected</b>
              <i style={{ ["--p" as string]: `${percentOf(f.billed - f.outstanding, f.billed)}%` }} aria-hidden="true" />
              <small>{f.billed ? `${percentOf(f.billed - f.outstanding, f.billed)}% of fees collected` : "No fees billed yet"}</small>
            </button>
          );
        })}
      </Carousel>
      <h3 className="rpa-label rpa-label-row">
        <span>Branches{level ? ` · ${levelName(level)}` : ""}</span>
        <button type="button" className="anw-link" onClick={() => setShowAllBranches(!showAllBranches)}>
          {showAllBranches ? "Show branches with activity" : `Show all ${allBranches.length} branches`}
        </button>
      </h3>
      <Carousel label="Branches">
        <button type="button" className={`rpa-card is-small ${!program ? "is-on" : ""}`} aria-pressed={!program} onClick={() => setProgram("")}>
          <strong>All branches</strong>
          <span>{branchCards.length} branches{showAllBranches ? "" : " with activity"}</span>
        </button>
        {branchCards.map((p) => {
          const f = cards("program_code", p.code);
          return (
            <button
              key={p.code}
              type="button"
              className={`rpa-card is-small ${program === p.code ? "is-on" : ""}`}
              aria-pressed={program === p.code}
              onClick={() => setProgram(program === p.code ? "" : p.code)}
            >
              <strong>{p.name}</strong>
              <span>
                {f.students} students · {compact(f.collected)}
              </span>
              <i style={{ ["--p" as string]: `${percentOf(f.billed - f.outstanding, f.billed)}%` }} aria-hidden="true" />
            </button>
          );
        })}
      </Carousel>

      <div className="rpa-kpis">
        {kpis.map(([Icon, label, value, hint, module]) => (
          <Link key={label} href={nav(module)} className="rpa-kpi">
            <span className="rpa-kpi-icon">
              <Icon size={18} />
            </span>
            <span className="rpa-kpi-text">
              <small>{label}</small>
              <strong>{value}</strong>
              <em>{hint}</em>
            </span>
            <ArrowRight size={15} className="rpa-kpi-go" aria-hidden="true" />
          </Link>
        ))}
      </div>

      <div className="anw-grid rpa-grid-2">
        <Panel title="Collection trend (monthly)">
          {trend.length ? (
            <div className="rpa-chart">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#efe6d8" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={compact} tick={{ fontSize: 11 }} width={60} />
                  <Tooltip contentStyle={tooltip} formatter={(v) => rupees(Number(v))} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {["cash", "upi", "bank_transfer"].map((m) => (
                    <Bar key={m} dataKey={m} name={METHOD[m]} stackId="m" fill={METHOD_COLOUR[m]} radius={m === "bank_transfer" ? [6, 6, 0, 0] : 0} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <Empty>No payments in this selection.</Empty>
          )}
        </Panel>
        <Panel title="Payment methods">
          {byMethod.length ? (
            <Donut title="Payment methods" centre={compact(figures.collected)} centreLabel="Collected" slices={byMethod} />
          ) : (
            <Empty>No payments in this selection.</Empty>
          )}
        </Panel>
      </div>

      <div className="anw-grid rpa-grid-2">
        <Panel title="Course levels: collected vs outstanding">
          {levelRows.some((r) => r.collected || r.outstanding) ? (
            <div className="rpa-chart">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={levelRows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#efe6d8" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={compact} tick={{ fontSize: 11 }} width={60} />
                  <Tooltip contentStyle={tooltip} formatter={(v) => rupees(Number(v))} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="collected" name="Collected" fill="#2f6f4f" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="outstanding" name="Outstanding" fill="#c97a3a" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <Empty>No fees or collections in this selection.</Empty>
          )}
        </Panel>
        <Panel title="Overdue aging">
          {aging.some((a) => a.amount) ? (
            <div className="rpa-chart">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={aging} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#efe6d8" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={compact} tick={{ fontSize: 11 }} width={60} />
                  <Tooltip contentStyle={tooltip} formatter={(v) => rupees(Number(v))} />
                  <Bar dataKey="amount" name="Outstanding" fill="#b43540" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <Empty>Nothing outstanding in this selection.</Empty>
          )}
        </Panel>
      </div>

      <Panel title="Branch-wise performance">
        {branchRows.length ? (
          <div className="anw-table">
            <table>
              <thead>
                <tr>
                  <th>Course / branch</th>
                  <th>Students</th>
                  <th>Fees billed</th>
                  <th>Collected</th>
                  <th>Outstanding</th>
                  <th>Overdue</th>
                  <th>Fees collected</th>
                  <th>Enquiries → joined</th>
                </tr>
              </thead>
              <tbody>
                {branchRows.map((r) => (
                  <tr key={r.key}>
                    <td>
                      {r.key !== "none" && !r.key.startsWith("manual:") ? (
                        <button type="button" className="anw-link" onClick={() => setProgram(program === r.key ? "" : r.key)}>
                          {r.name}
                        </button>
                      ) : (
                        r.name
                      )}
                    </td>
                    <td>{r.students}</td>
                    <td>{money(r.billed)}</td>
                    <td>{money(r.collected)}</td>
                    <td>{money(r.outstanding)}</td>
                    <td className={r.overdue > 0 ? "rpa-warn" : undefined}>{money(r.overdue)}</td>
                    <td>
                      <span className="rpa-meter">
                        <i style={{ ["--p" as string]: `${percentOf(r.billed - r.outstanding, r.billed)}%` }} />
                        {percentOf(r.billed - r.outstanding, r.billed)}%
                      </span>
                    </td>
                    <td>
                      {r.enquiries} → {r.joined}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>No courses in this selection.</Empty>
        )}
      </Panel>

      <div className="anw-grid rpa-grid-2">
        <Panel title="Academic year-wise">
          {yearRows.length ? (
            <div className="anw-table">
              <table>
                <thead>
                  <tr>
                    <th>Academic year</th>
                    <th>Students</th>
                    <th>Billed</th>
                    <th>Collected</th>
                    <th>Outstanding</th>
                    <th>Overdue</th>
                  </tr>
                </thead>
                <tbody>
                  {yearRows.map((r) => (
                    <tr key={r.key}>
                      <td>
                        {r.key !== "none" ? (
                          <button type="button" className="anw-link" onClick={() => setYear(year === r.key ? "" : r.key)}>
                            {r.name}
                          </button>
                        ) : (
                          r.name
                        )}
                      </td>
                      <td>{r.students}</td>
                      <td>{money(r.billed)}</td>
                      <td>{money(r.collected)}</td>
                      <td>{money(r.outstanding)}</td>
                      <td className={r.overdue > 0 ? "rpa-warn" : undefined}>{money(r.overdue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty>No academic years in this selection.</Empty>
          )}
        </Panel>
        <Panel title="Top overdue students" action={<Link className="anw-link" href={nav("fees")}>Fee ledger</Link>}>
          {topOverdue.length ? (
            <ul className="rpa-list">
              {topOverdue.map((p, i) => (
                <li key={i}>
                  <span>
                    <strong>{p.name}</strong>
                    <small>
                      {p.course} · {p.days} days overdue
                    </small>
                  </span>
                  <b>{money(p.amount)}</b>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>No overdue fees in this selection.</Empty>
          )}
        </Panel>
      </div>

      <div className="anw-grid rpa-grid-2">
        <Panel title="Cashbook: received, deposited and closing cash" action={<Link className="anw-link" href={nav("cashbook")}>Cashbook</Link>}>
          {cashTrend.length ? (
            <div className="rpa-chart">
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={cashTrend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#efe6d8" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={compact} tick={{ fontSize: 11 }} width={60} />
                  <Tooltip contentStyle={tooltip} formatter={(v) => rupees(Number(v))} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Area type="linear" dataKey="closing" name="Closing cash" stroke="#5b3a17" fill="#e8d5bb" />
                  <Area type="linear" dataKey="received" name="Received" stroke="#2f6f4f" fill="#cfe3d6" />
                  <Area type="linear" dataKey="deposited" name="Deposited to bank" stroke="#a56824" fill="#f3dfc2" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <Empty>No cash movements in this period.</Empty>
          )}
        </Panel>
        <Panel title="Late fees" action={<Link className="anw-link" href={nav("late-fees")}>Late fee dues</Link>}>
          <div className="rpa-mini">
            <span>
              <small>Students</small>
              <strong>{figures.lateStudents}</strong>
            </span>
            <span>
              <small>Cleared</small>
              <strong>{figures.lateCleared}</strong>
            </span>
            <span>
              <small>Not cleared</small>
              <strong>{figures.lateUncleared}</strong>
            </span>
            <span>
              <small>Cancelled</small>
              <strong>{figures.lateCancelled}</strong>
            </span>
          </div>
          {lateBySemester.length ? (
            <div className="rpa-chart">
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={lateBySemester} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#efe6d8" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={compact} tick={{ fontSize: 11 }} width={60} />
                  <Tooltip contentStyle={tooltip} formatter={(v) => rupees(Number(v))} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="applied" name="Applied" fill="#a56824" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="pending" name="Pending" fill="#b43540" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <Empty>No late fees have been added in this selection.</Empty>
          )}
        </Panel>
      </div>

      <Panel title="Manual payments & receipts" action={<Link className="anw-link" href={nav("manual-payments")}>Manual payments screen</Link>}>
        <div className="rpa-mini">
          <span>
            <small>Collected manually</small>
            <strong>{money(manual.amount)}</strong>
          </span>
          <span>
            <small>Receipts issued</small>
            <strong>{manual.receipts}</strong>
          </span>
          <span>
            <small>Students captured</small>
            <strong>{manual.students}</strong>
          </span>
          <span>
            <small>Share of collections</small>
            <strong>{percentOf(manual.amount, manual.amount + manual.linked)}%</strong>
          </span>
        </div>
        {manual.receipts ? (
          <div className="rpa-split">
            <Donut
              title="Payments by screen"
              centre={compact(manual.amount + manual.linked)}
              centreLabel="Collected"
              slices={[
                { key: "linked", label: "Payments & receipts", value: manual.linked, display: money(manual.linked) },
                { key: "manual", label: "Manual payments screen", value: manual.amount, display: money(manual.amount) },
              ].filter((x) => x.value)}
            />
            <div className="anw-table">
              <table>
                <thead>
                  <tr>
                    <th>Branch (as entered)</th>
                    <th>Course level</th>
                    <th>Receipts</th>
                    <th>Students</th>
                    <th>Cash</th>
                    <th>UPI</th>
                    <th>Bank</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {manual.branches.map((r) => (
                    <tr key={r.name}>
                      <td>{r.name}</td>
                      <td>{r.level}</td>
                      <td>{r.receipts}</td>
                      <td>{r.students.size}</td>
                      <td>{money(r.cash)}</td>
                      <td>{money(r.upi)}</td>
                      <td>{money(r.bank_transfer)}</td>
                      <td>
                        <strong>{money(r.cash + r.upi + r.bank_transfer)}</strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <Empty>No manual payments in this selection.</Empty>
        )}
      </Panel>

      <Panel title="Admissions by branch" action={<Link className="anw-link" href={nav("admissions")}>Admissions</Link>}>
        {branchRows.some((r) => r.enquiries) ? (
          <div className="rpa-chart">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={branchRows.filter((r) => r.enquiries)} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#efe6d8" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={40} />
                <Tooltip contentStyle={tooltip} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="enquiries" name="Enquiries" fill="#e0a85a" radius={[6, 6, 0, 0]} />
                <Bar dataKey="joined" name="Joined" fill="#2f6f4f" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <Empty>No admission enquiries in this selection.</Empty>
        )}
      </Panel>
    </div>
  );
}
