"use client";
import Image from "next/image";
import Link from "next/link";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  Users,
  GraduationCap,
  Wallet,
  Landmark,
  CalendarDays,
  ArrowUpRight,
  Bus,
  BedDouble,
  PackageCheck,
} from "lucide-react";
import type { College } from "@/data/colleges";
import { money } from "@/data/colleges";
import { useCollege } from "./CollegeStore";
import { engineeringDashboard } from "@/lib/colleges/dashboard-selectors";
export default function SkylineDashboard({
  college,
  nav,
  filters,
}: {
  filters: { year: string; department: string; from: string; to: string };
  college: College;
  nav: (m: string) => string;
}) {
  const { state: fullState } = useCollege();
  const filteredStudents = fullState.students.filter(
    (st) =>
      (filters.year === "all" || st.year === filters.year) &&
      (filters.department === "all" || st.department === filters.department) &&
      (!filters.from || st.date >= filters.from) &&
      (!filters.to || st.date <= filters.to),
  );
  const ids = new Set(filteredStudents.map((st) => st.id));
  const programs = new Set(filteredStudents.map((st) => st.program));
  const dateMatch = (date: string) =>
    (!filters.from || date >= filters.from) &&
    (!filters.to || date <= filters.to);
  const state = {
    ...fullState,
    students: filteredStudents,
    staff: fullState.staff.filter(
      (f) => filters.department === "all" || f.note === filters.department,
    ),
    payments: fullState.payments.filter(
      (p) => (!p.studentId || ids.has(p.studentId)) && dateMatch(p.date),
    ),
    applications: fullState.applications.filter(
      (a) => (!a.program || programs.has(a.program)) && dateMatch(a.date),
    ),
    operations: fullState.operations
      ? {
          ...fullState.operations,
          records: {
            ...fullState.operations.records,
            timetable: (fullState.operations.records.timetable || []).filter(
              (p) => programs.has(String(p.program)),
            ),
          },
        }
      : undefined,
  };
  const d = engineeringDashboard(state);
  const palette = [
    "#2563eb",
    "#0ea5e9",
    "#8b5cf6",
    "#14b8a6",
    "#f59e0b",
    "#ec4899",
    "#6366f1",
    "#22c55e",
  ];
  const chartStyle = {
    background: "var(--erp-surface)",
    border: "1px solid var(--erp-border)",
    borderRadius: 10,
    color: "var(--erp-ink)",
  };
  const cards = [
    {
      label: "Enrolled students",
      value: d.active.length,
      icon: Users,
      to: "students",
    },
    {
      label: "Active faculty",
      value: d.faculty.length,
      icon: GraduationCap,
      to: "employees",
    },
    {
      label: "Fee collection",
      value: money(d.paid),
      icon: Wallet,
      to: "payments",
    },
    {
      label: "Outstanding fees",
      value: money(d.owed),
      icon: Landmark,
      to: "fees",
    },
  ];
  return (
    <div className="skyline-dashboard">
      <header className="skyline-welcome">
        <div>
          <span className="skyline-eyebrow">
            ENGINEERING WORKSPACE / 2026–27
          </span>
          <h1>A clear view of your campus.</h1>
          <p>Welcome back, Admin. Your institution, connected.</p>
          <div className="skyline-quick-links">
            {[
              ["New admission", "admissions"],
              ["Collect fee", "fees"],
              ["Academic timetable", "timetable"],
              ["Send notification", "notifications"],
            ].map(([label, to]) => (
              <Link key={to} href={nav(to)}>
                {label}
                <ArrowUpRight size={14} />
              </Link>
            ))}
          </div>
        </div>
        <div className="skyline-welcome-date">
          <CalendarDays size={18} />
          <span>
            {new Date().toLocaleDateString("en-IN", {
              weekday: "short",
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </span>
          <small>{college.name}</small>
        </div>
      </header>
      <div className="skyline-stat-row">
        {cards.map(({ label, value, icon: Icon, to }, i) => (
          <Link href={nav(to)} key={label}>
            <span className={`skyline-stat-icon tone-${i}`}>
              <Icon size={22} />
            </span>
            <div>
              <small>{label}</small>
              <strong>{value}</strong>
              <span>Live institution records</span>
            </div>
          </Link>
        ))}
      </div>
      <div className="skyline-academic-pulse">
        <span>
          <b>{d.sessions.length}</b> sessions today
        </span>
        <span>
          <b>{d.sessions.filter((s) => s.status === "Completed").length}</b>{" "}
          completed
        </span>
        <span>
          <b>{d.sessions.filter((s) => s.status !== "Completed").length}</b>{" "}
          pending completion
        </span>
        <span>
          <b>
            {
              new Set(
                d.sessions.filter((s) => s.kind === "Lab").map((s) => s.room),
              ).size
            }
          </b>{" "}
          active laboratories
        </span>
        <span>
          <b>{d.attendance === null ? "—" : `${d.attendance}%`}</b> today’s
          attendance
        </span>
        <span>
          <b>{d.programs.length}</b> active programs
        </span>
      </div>
      <div className="skyline-chart-grid">
        <section className="skyline-panel">
          <header>
            <h2>Enrollment trend</h2>
            <span>2026 · enrolled records</span>
          </header>
          <div className="skyline-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={d.months}>
                <CartesianGrid vertical={false} stroke="var(--erp-border)" />
                <XAxis
                  dataKey="month"
                  tick={{ fill: "var(--erp-muted)", fontSize: 11 }}
                />
                <YAxis tick={{ fill: "var(--erp-muted)", fontSize: 10 }} />
                <Tooltip contentStyle={chartStyle} />
                <Bar
                  dataKey="enrolled"
                  name="Students"
                  fill="#3b82f6"
                  radius={[5, 5, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="skyline-panel">
          <header>
            <h2>Students by branch</h2>
            <Link href={nav("students")}>View students ↗</Link>
          </header>
          <div className="skyline-donut">
            <ResponsiveContainer width="48%" height={210}>
              <PieChart>
                <Pie
                  data={d.branches}
                  dataKey="value"
                  innerRadius="58%"
                  outerRadius="85%"
                  paddingAngle={2}
                >
                  {d.branches.map((b, i) => (
                    <Cell key={b.name} fill={palette[i % palette.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={chartStyle} />
              </PieChart>
            </ResponsiveContainer>
            <ul>
              {d.branches.map((b, i) => (
                <li key={b.name}>
                  <i style={{ background: palette[i % palette.length] }} />
                  {b.name}
                  <b>{b.value}</b>
                </li>
              ))}
            </ul>
          </div>
        </section>
        <section className="skyline-panel skyline-finance-chart">
          <header>
            <h2>Fee collection overview</h2>
            <Link href={nav("reports")}>Financial reports ↗</Link>
          </header>
          <div className="skyline-chart">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={d.months}>
                <defs>
                  <linearGradient id="skyline-fees" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--erp-border)" />
                <XAxis
                  dataKey="month"
                  tick={{ fill: "var(--erp-muted)", fontSize: 11 }}
                />
                <YAxis
                  tickFormatter={(v) => `${Math.round(v / 10000000)}L`}
                  tick={{ fill: "var(--erp-muted)", fontSize: 10 }}
                />
                <Tooltip
                  contentStyle={chartStyle}
                  formatter={(v) => money(Number(v))}
                />
                <Area
                  dataKey="collected"
                  name="Collection"
                  stroke="#3b82f6"
                  fill="url(#skyline-fees)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
      <div className="skyline-operations-row">
        {[
          {
            icon: BedDouble,
            label: "Hostel occupancy",
            value: `${d.hostel} / ${d.beds}`,
            to: "hostels",
          },
          {
            icon: Bus,
            label: "Transport passengers",
            value: d.passengers.length,
            to: "bus-seating",
          },
          {
            icon: PackageCheck,
            label: "Low stock alerts",
            value: d.inventory.length,
            to: "inventory",
          },
          {
            icon: Wallet,
            label: "Payroll records",
            value: d.payroll.length,
            to: "payroll",
          },
        ].map(({ icon: Icon, label, value, to }) => (
          <Link href={nav(to)} key={to}>
            <Icon size={23} />
            <small>{label}</small>
            <strong>{value}</strong>
            <span>Open workspace ↗</span>
          </Link>
        ))}
      </div>
      <div className="skyline-bottom-grid">
        <section className="skyline-panel">
          <header>
            <h2>Today’s academic schedule</h2>
            <Link href={nav("timetable")}>Full week ↗</Link>
          </header>
          {d.sessions.slice(0, 5).map((s) => (
            <Link
              className="skyline-schedule-row"
              key={s.id}
              href={nav("timetable")}
            >
              <time>
                {s.start}–{s.end}
              </time>
              <div>
                <strong>{s.name}</strong>
                <small>
                  {s.program} · Section {s.section} · {s.room}
                </small>
              </div>
              <span>{s.kind}</span>
            </Link>
          ))}
          {!d.sessions.length && (
            <p>
              No teaching sessions scheduled today. Open the timetable to view
              the week.
            </p>
          )}
        </section>
        <section className="skyline-panel">
          <header>
            <h2>Recent admissions</h2>
            <Link href={nav("admissions")}>View all ↗</Link>
          </header>
          <div className="skyline-mini-table">
            {state.applications
              .slice(-5)
              .reverse()
              .map((s) => (
                <Link href={nav("admissions")} key={s.id}>
                  <strong>{s.name}</strong>
                  <small>{s.program}</small>
                  <span>{s.status}</span>
                </Link>
              ))}
          </div>
        </section>
        <section className="skyline-panel">
          <header>
            <h2>Campus activity</h2>
            <Link href={nav("audit-logs")}>Audit log ↗</Link>
          </header>
          {d.activity.map((a) => (
            <div className="skyline-activity" key={a.id}>
              <i />
              <div>
                <strong>{a.name}</strong>
                <small>
                  {a.actor} · {a.date.slice(0, 10)}
                </small>
              </div>
            </div>
          ))}
        </section>
      </div>
      <Link className="skyline-mobile-promo" href={nav("mobile-apps")}>
        <Image
          src="/assets/colleges/skyline/branding/app.svg"
          width="52"
          height="52"
          alt=""
        />
        <div>
          <h2>One campus. Three connected apps.</h2>
          <p>
            Parent, Student and Faculty portals share the same published
            timetable, academic and transport records.
          </p>
        </div>
        <span>Open mobile apps emulator ↗</span>
      </Link>
    </div>
  );
}
