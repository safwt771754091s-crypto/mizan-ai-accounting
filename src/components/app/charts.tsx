"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { currencySymbol, formatNumber } from "@/lib/accounting/money";

const COLORS = ["#0b4234", "#199b8c", "#38b8a7", "#d97706", "#b91c1c", "#5f716b", "#7cbfa4", "#0284c7"];

export interface MonthlyPoint {
  period: string;
  label: string;
  revenue: number;
  expenses: number;
  profit: number;
}

function compact(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}م`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(0)}ألف`;
  return String(Math.round(value));
}

function ChartTooltip({
  active,
  payload,
  label,
  currency,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number | string; color?: string; dataKey?: string }>;
  label?: string;
  currency: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div dir="rtl" className="rounded-xl border border-line bg-white/95 p-3 text-xs shadow-float backdrop-blur">
      <p className="mb-1.5 font-bold text-ink">{label}</p>
      {payload.map((item) => (
        <div key={String(item.dataKey)} className="flex items-center justify-between gap-4 py-0.5">
          <span className="flex items-center gap-1.5 text-muted">
            <span className="h-2 w-2 rounded-full" style={{ background: item.color }} />
            {item.name}
          </span>
          <span dir="ltr" className="num font-semibold text-ink">
            {formatNumber(Number(item.value ?? 0), 2)} {currencySymbol(currency)}
          </span>
        </div>
      ))}
    </div>
  );
}

export function MonthlyPerformanceChart({ data, currency }: { data: MonthlyPoint[]; currency: string }) {
  return (
    <div dir="ltr" className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e9efed" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#5f716b" }} tickLine={false} axisLine={false} />
          <YAxis tickFormatter={compact} tick={{ fontSize: 10, fill: "#5f716b" }} tickLine={false} axisLine={false} width={46} />
          <Tooltip content={<ChartTooltip currency={currency} />} />
          <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
          <Bar dataKey="revenue" name="الإيرادات" fill="#199b8c" radius={[6, 6, 0, 0]} maxBarSize={26} />
          <Bar dataKey="expenses" name="المصروفات" fill="#d97706" radius={[6, 6, 0, 0]} maxBarSize={26} />
          <Line type="monotone" dataKey="profit" name="صافي الربح" stroke="#0b4234" strokeWidth={2.5} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ProfitAreaChart({ data, currency }: { data: MonthlyPoint[]; currency: string }) {
  return (
    <div dir="ltr" className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 8, left: 8, bottom: 0 }}>
          <defs>
            <linearGradient id="profitFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#199b8c" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#199b8c" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e9efed" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#5f716b" }} tickLine={false} axisLine={false} />
          <YAxis tickFormatter={compact} tick={{ fontSize: 10, fill: "#5f716b" }} tickLine={false} axisLine={false} width={46} />
          <Tooltip content={<ChartTooltip currency={currency} />} />
          <Area type="monotone" dataKey="profit" name="صافي الربح" stroke="#0f7d71" strokeWidth={2.5} fill="url(#profitFill)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ExpenseDonutChart({
  data,
  currency,
}: {
  data: Array<{ name: string; amount: number }>;
  currency: string;
}) {
  const top = data.slice(0, 6);
  return (
    <div dir="ltr" className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={top} dataKey="amount" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
            {top.map((entry, index) => (
              <Cell key={entry.name} fill={COLORS[index % COLORS.length]} stroke="#fff" strokeWidth={2} />
            ))}
          </Pie>
          <Tooltip content={<ChartTooltip currency={currency} />} />
          <Legend wrapperStyle={{ fontSize: 10 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function BalanceBarsChart({
  data,
  currency,
}: {
  data: Array<{ name: string; value: number }>;
  currency: string;
}) {
  return (
    <div dir="ltr" className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e9efed" horizontal={false} />
          <XAxis type="number" tickFormatter={compact} tick={{ fontSize: 10, fill: "#5f716b" }} tickLine={false} axisLine={false} />
          <YAxis
            type="category"
            dataKey="name"
            width={90}
            tick={{ fontSize: 11, fill: "#12201c" }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<ChartTooltip currency={currency} />} />
          <Bar dataKey="value" name="المبلغ" radius={[0, 6, 6, 0]} maxBarSize={26}>
            {data.map((entry, index) => (
              <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function RatioBarChart({ data }: { data: Array<{ name: string; value: number | null }> }) {
  const filtered = data.filter((item) => item.value !== null).map((item) => ({ ...item, value: Number(item.value) }));
  if (!filtered.length) return <p className="py-10 text-center text-xs text-muted">لا توجد نسب قابلة للعرض.</p>;
  return (
    <div dir="ltr" className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={filtered} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e9efed" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#5f716b" }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 10, fill: "#5f716b" }} tickLine={false} axisLine={false} width={38} />
          <Tooltip formatter={(value) => [`${Number(value).toFixed(1)}%`, "النسبة"]} />
          <Bar dataKey="value" name="النسبة" fill="#0f7d71" radius={[6, 6, 0, 0]} maxBarSize={30} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
