"use client";
import { preciseMoney as money } from "@/lib/colleges/operations";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { useCollege } from "./CollegeStore";
import { occupancy, opRows } from "@/lib/colleges/operations";

export default function OperationsCharts({ kind }: { kind: string }) {
  const { state } = useCollege();
  const data =
    kind === "transport"
      ? state.operations!.buses.map((b) => ({
          name: b.name,
          value: occupancy(state, b.id).occupied,
        }))
      : kind === "payroll"
        ? Array.from(
            new Set(opRows(state, "payroll").map((x) => String(x.period))),
          )
            .sort()
            .map((period) => ({
              name: period,
              value: opRows(state, "payroll")
                .filter((x) => x.period === period)
                .reduce((n, r) => n + Number(r.net), 0),
            }))
        : Array.from(
            new Set(state.expenses.map((x) => x.category || "Other")),
          ).map((category) => ({
            name: category,
            value: state.expenses
              .filter((x) => (x.category || "Other") === category)
              .reduce((n, r) => n + (r.amount || 0), 0),
          }));
  return (
    <section className="erp-panel ops-chart">
      <h2>
        {kind === "payroll"
          ? "Payroll by period"
          : kind === "transport"
            ? "Passengers by bus"
            : "Expenses by category"}
      </h2>
      {data.length ? (
        <>
          <div
            role="img"
            aria-label={`${kind} chart based on ${data.length} current record groups`}
          >
            <ResponsiveContainer width="100%" height={240}>
              <BarChart
                data={data}
                margin={{ left: 0, right: 12, bottom: 16, top: 10 }}
              >
                <CartesianGrid vertical={false} stroke="var(--erp-border)" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fill: "var(--erp-muted)" }}
                />
                <YAxis
                  width={55}
                  tickFormatter={(n) =>
                    kind === "transport"
                      ? String(n)
                      : `${Math.round(n / 100000)}k`
                  }
                  tick={{ fontSize: 10, fill: "var(--erp-muted)" }}
                />
                <Tooltip
                  formatter={(v) =>
                    kind === "transport" ? String(v) : money(Number(v))
                  }
                  contentStyle={{
                    background: "var(--erp-raised)",
                    border: "1px solid var(--erp-border)",
                    color: "var(--erp-ink)",
                  }}
                />
                <Bar
                  dataKey="value"
                  fill="var(--erp-accent)"
                  radius={[5, 5, 0, 0]}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <details>
            <summary>View chart data</summary>
            <dl>
              {data.map((d) => (
                <div key={d.name}>
                  <dt>{d.name}</dt>
                  <dd>{kind === "transport" ? d.value : money(d.value)}</dd>
                </div>
              ))}
            </dl>
          </details>
        </>
      ) : (
        <p>No records yet. Calculate a payroll period to build this chart.</p>
      )}
    </section>
  );
}
