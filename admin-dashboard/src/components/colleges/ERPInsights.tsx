"use client";
import Select from "./SearchSelect";
import { useState } from "react";
import Link from "next/link";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import { money, permissions, type Role } from "@/data/colleges";
import {
  balance,
  paid,
  type CollegeState,
  type Student,
  type RecordRow,
} from "@/lib/colleges/store";
const colors = [
  "#1769ff",
  "#28c8ff",
  "#9a77ec",
  "#22c7a4",
  "#e3b86b",
  "#ff8191",
  "#7fb7ff",
];
export default function ERPInsights({
  state: s,
  students,
  payments,
  expenses,
  nav,
  from,
  to,
  role,
}: {
  role: Role;
  state: CollegeState;
  students: Student[];
  payments: RecordRow[];
  expenses: RecordRow[];
  nav: (m: string) => string;
  from: string;
  to: string;
}) {
  const [metric, setMetric] = useState("Admission sources"),
    [type, setType] = useState("donut"),
    [hidden, setHidden] = useState<string[]>([]);
  const period = (r: RecordRow) =>
    (!from || r.date >= from) && (!to || r.date <= to);
  const ids = new Set(students.map((st) => st.id));
  const applications = s.applications.filter(
    (a) => period(a) && students.some((st) => st.program === a.program),
  );
  const certificates = s.certificates.filter(
    (r) => period(r) && ids.has(r.studentId || ""),
  );
  const group = (
    rows: RecordRow[],
    key: "source" | "category" | "status",
    amount = false,
  ) =>
    Array.from(new Set(rows.map((r) => String(r[key] || "Other")))).map(
      (name) => ({
        name,
        value: rows
          .filter((r) => String(r[key] || "Other") === name)
          .reduce((n, r) => n + (amount ? r.amount || 0 : 1), 0),
      }),
    );
  const capacity = s.rooms.reduce((n, r) => n + (r.capacity || 0), 0),
    occupied = s.allocations.filter((a) => a.status === "Allocated").length;
  const configs: Record<
    string,
    {
      data: { name: string; value: number }[];
      module: string;
      currency?: boolean;
      note: string;
    }
  > = {
    "Admission sources": {
      data: group(applications, "source"),
      module: "admissions",
      note: "Applications in the selected programs and date range",
    },
    "Program distribution": {
      data: Array.from(new Set(students.map((st) => st.program))).map(
        (name) => ({
          name,
          value: students.filter((st) => st.program === name).length,
        }),
      ),
      module: "students",
      note: "Students matching the academic year and department",
    },
    "Paid vs outstanding": {
      data: [
        {
          name: "Paid",
          value: students.reduce((n, st) => n + paid(s, st.id), 0),
        },
        {
          name: "Outstanding",
          value: students.reduce((n, st) => n + balance(s, st), 0),
        },
      ],
      module: "fees",
      currency: true,
      note: "Lifetime ledger for the selected students",
    },
    "Expenses by category": {
      data: group(
        expenses.filter((e) => e.status === "Paid"),
        "category",
        true,
      ),
      module: "expenses",
      currency: true,
      note: "Paid expenses in the selected date range",
    },
    "Hostel occupancy": {
      data: [
        { name: "Occupied", value: occupied },
        { name: "Available", value: Math.max(0, capacity - occupied) },
      ],
      module: "hostels",
      note: "Current campus capacity across all rooms",
    },
    "Certificate requests": {
      data: group(certificates, "status"),
      module: "certificates",
      note: "Requests for selected students and date range",
    },
    "Certificate trends": {
      data: Array.from({ length: 12 }, (_, i) => ({
        name: new Date(2026, i).toLocaleString("en", { month: "short" }),
        value: certificates.filter((r) =>
          r.date.startsWith(`2026-${String(i + 1).padStart(2, "0")}`),
        ).length,
      })),
      module: "certificates",
      note: "Monthly request volumes in 2026",
    },
    "Payment methods": {
      data: group(
        payments.map((p) => ({ ...p, category: p.method })),
        "category",
        true,
      ),
      module: "payments",
      currency: true,
      note: "Completed collections in the selected period",
    },
  };
  const available = Object.keys(configs).filter(
    (key) =>
      permissions[role].includes(configs[key].module) ||
      (role === "Principal" && key === "Paid vs outstanding"),
  );
  const selectedMetric = available.includes(metric) ? metric : available[0];
  const config = configs[selectedMetric],
    data = config.data.filter((d) => !hidden.includes(d.name));
  return (
    <section className="erp-panel erp-insights">
      <div className="erp-panel-title">
        <div>
          <h2>Campus intelligence</h2>
          <p>{config.note}</p>
        </div>
        <div className="erp-chart-controls">
          <Select
            aria-label="Insight metric"
            value={selectedMetric}
            onChange={(e) => {
              setMetric(e.target.value);
              setHidden([]);
            }}
          >
            {available.map((k) => (
              <option key={k}>{k}</option>
            ))}
          </Select>
          <Select
            aria-label="Insight chart type"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            <option value="donut">Donut</option>
            <option value="bars">Bars</option>
          </Select>
        </div>
      </div>
      <div style={{ height: 190, width: "100%" }}>
        {data.some((d) => d.value > 0) ? (
          <ResponsiveContainer width="100%" height="100%">
            {type === "donut" ? (
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="55%"
                  outerRadius="85%"
                  paddingAngle={2}
                  isAnimationActive={false}
                >
                  {data.map((d) => (
                    <Cell
                      key={d.name}
                      fill={colors[config.data.indexOf(d) % colors.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v) =>
                    config.currency ? money(Number(v)) : Number(v)
                  }
                  contentStyle={{
                    background: "var(--erp-surface)",
                    borderColor: "var(--erp-border)",
                    color: "var(--erp-ink)",
                  }}
                />
              </PieChart>
            ) : (
              <BarChart
                data={data}
                margin={{ left: 0, right: 15, bottom: 25, top: 10 }}
              >
                <CartesianGrid vertical={false} stroke="var(--erp-border)" />
                <XAxis
                  dataKey="name"
                  tick={{ fill: "var(--erp-muted)", fontSize: 9 }}
                  interval={0}
                />
                <YAxis
                  width={48}
                  tick={{ fill: "var(--erp-muted)", fontSize: 9 }}
                  tickFormatter={(v) =>
                    config.currency
                      ? `${Math.round(Number(v) / 10000000)}L`
                      : String(v)
                  }
                />
                <Tooltip
                  formatter={(v) =>
                    config.currency ? money(Number(v)) : Number(v)
                  }
                  contentStyle={{
                    background: "var(--erp-surface)",
                    borderColor: "var(--erp-border)",
                    color: "var(--erp-ink)",
                  }}
                />
                <Bar
                  dataKey="value"
                  isAnimationActive={false}
                  radius={[4, 4, 0, 0]}
                >
                  {data.map((d) => (
                    <Cell
                      key={d.name}
                      fill={colors[config.data.indexOf(d) % colors.length]}
                    />
                  ))}
                </Bar>
              </BarChart>
            )}
          </ResponsiveContainer>
        ) : (
          <div className="erp-empty">
            No records for this selection. Adjust the filters or enable a
            series.
          </div>
        )}
      </div>
      <div className="erp-insight-legend">
        {config.data.map((d, i) => (
          <button
            key={d.name}
            aria-pressed={!hidden.includes(d.name)}
            onClick={() =>
              setHidden(
                hidden.includes(d.name)
                  ? hidden.filter((n) => n !== d.name)
                  : [...hidden, d.name],
              )
            }
          >
            <i style={{ background: colors[i % colors.length] }} />
            {d.name}
            <b>{config.currency ? money(d.value) : d.value}</b>
          </button>
        ))}
      </div>
      <Link
        className="erp-insight-link"
        href={nav(
          permissions[role].includes(config.module) ? config.module : "reports",
        )}
      >
        Open {selectedMetric.toLowerCase()} register
      </Link>
    </section>
  );
}
