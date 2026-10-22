"use client";
import { useId, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { money } from "@/data/colleges";
import type { RecordRow } from "@/lib/colleges/store";
const months = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
export default function ERPAnalytics({
  payments,
  useAreaDefault,
  onMonth,
}: {
  payments: RecordRow[];
  useAreaDefault: boolean;
  onMonth: (month: number, year: string) => void;
}) {
  const [year, setYear] = useState("2026"),
    [kind, setKind] = useState(useAreaDefault ? "area" : "bars"),
    [visible, setVisible] = useState(true);
  const id = useId().replaceAll(":", "");
  const years = Array.from(
    new Set(["2026", ...payments.map((p) => p.date.slice(0, 4))]),
  ).sort();
  const data = months.map((name, i) => ({
    name,
    value: payments
      .filter((p) =>
        p.date.startsWith(`${year}-${String(i + 1).padStart(2, "0")}`),
      )
      .reduce((n, p) => n + (p.amount || 0), 0),
  }));
  const chartProps = {
    data,
    margin: { top: 12, right: 10, left: 0, bottom: 0 },
  };
  const contents = (
    <>
      <CartesianGrid vertical={false} stroke="var(--erp-border)" />
      <XAxis
        dataKey="name"
        tick={{ fill: "var(--erp-muted)", fontSize: 9 }}
        axisLine={false}
        tickLine={false}
      />
      <YAxis
        width={47}
        tickFormatter={(n: number) => `${Math.round(n / 10000000)}L`}
        tick={{ fill: "var(--erp-muted)", fontSize: 9 }}
        axisLine={false}
        tickLine={false}
      />
      <Tooltip
        contentStyle={{
          background: "var(--erp-surface)",
          border: "1px solid var(--erp-border)",
          borderRadius: 8,
          color: "var(--erp-ink)",
        }}
        formatter={(v) => [money(Number(v)), "Collection"]}
      />
    </>
  );
  return (
    <section className="erp-panel erp-collection-chart">
      <div className="erp-panel-title">
        <div>
          <h2>Monthly fee collection</h2>
          <p>Completed payments · INR</p>
        </div>
        <div className="erp-chart-controls">
          <select
            aria-label="Chart year"
            value={year}
            onChange={(e) => setYear(e.target.value)}
          >
            {years.map((y) => (
              <option key={y}>{y}</option>
            ))}
          </select>
          <select
            aria-label="Chart type"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            <option value="bars">Bars</option>
            <option value="area">Area</option>
          </select>
        </div>
      </div>
      <button
        className="erp-chart-toggle"
        aria-pressed={visible}
        onClick={() => setVisible(!visible)}
      >
        ● {year} payments {visible ? "(hide)" : "(show)"}
      </button>
      <div
        className="erp-recharts-monthly"
        style={{ height: 215, width: "100%" }}
      >
        <ResponsiveContainer width="100%" height="100%">
          {kind === "area" ? (
            <AreaChart {...chartProps}>
              {contents}
              <defs>
                <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor="var(--erp-accent)"
                    stopOpacity={0.5}
                  />
                  <stop
                    offset="100%"
                    stopColor="var(--erp-accent)"
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <Area
                dataKey="value"
                hide={!visible}
                stroke="var(--erp-accent)"
                fill={`url(#${id})`}
                strokeWidth={2}
                isAnimationActive={false}
              />
            </AreaChart>
          ) : (
            <BarChart {...chartProps}>
              {contents}
              <Bar
                dataKey="value"
                hide={!visible}
                fill="var(--erp-glow)"
                radius={[4, 4, 0, 0]}
                isAnimationActive={false}
              />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
      <div
        className="erp-month-drilldown"
        aria-label="Filter payment register by month"
      >
        {data.map((d, i) => (
          <button
            key={d.name}
            title={`${d.name} ${year}: ${money(d.value)}`}
            aria-label={`${d.name} ${year}: ${money(d.value)}. View payments`}
            onClick={() => onMonth(i + 1, year)}
          >
            {d.name}
          </button>
        ))}
      </div>
      <output className="erp-chart-tooltip">
        Year total: {money(data.reduce((n, d) => n + d.value, 0))}
      </output>
      {!data.some((d) => d.value > 0) && (
        <p>No payments in this period. Choose another year.</p>
      )}
    </section>
  );
}
