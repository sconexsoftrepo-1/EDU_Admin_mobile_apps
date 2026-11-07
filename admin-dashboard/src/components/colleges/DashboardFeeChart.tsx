"use client";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { money } from "@/data/colleges";

const compact = (value: number) =>
  value >= 1e7
    ? `${+(value / 1e7).toFixed(1)} Cr`
    : value >= 1e5
      ? `${+(value / 1e5).toFixed(1)} L`
      : value >= 1e3
        ? `${+(value / 1e3).toFixed(0)} K`
        : String(value);

export default function DashboardFeeChart({
  rows,
  show,
}: {
  rows: { name: string; collected: number; outstanding: number }[];
  show: { collected: boolean; outstanding: boolean };
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={rows} barGap={1} barCategoryGap="14%" margin={{ left: 0, right: 4, top: 8 }}>
        <CartesianGrid vertical={false} stroke="#efe6d8" />
        <XAxis
          dataKey="name"
          axisLine={false}
          tickLine={false}
          interval={0}
          tick={{ fontSize: 11, fill: "#76695e" }}
        />
        <YAxis
          width={48}
          axisLine={false}
          tickLine={false}
          tickFormatter={compact}
          tick={{ fontSize: 11, fill: "#76695e" }}
        />
        <Tooltip
          cursor={{ fill: "#f6e6ce66" }}
          formatter={(value, name) => [money(Number(value) * 100), String(name)]}
          contentStyle={{
            borderRadius: 10,
            border: "1px solid #eadccb",
            fontSize: 12,
          }}
        />
        {show.collected && (
          <Bar
            dataKey="collected"
            name="Collected"
            fill="#a56824"
            radius={[4, 4, 0, 0]}
            maxBarSize={22}
            animationDuration={350}
          />
        )}
        {show.outstanding && (
          <Bar
            dataKey="outstanding"
            name="Outstanding"
            fill="#e8cfa8"
            radius={[4, 4, 0, 0]}
            maxBarSize={22}
            animationDuration={350}
          />
        )}
      </BarChart>
    </ResponsiveContainer>
  );
}
