"use client"

import {
  Bar,
  BarChart,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Treemap,
} from "recharts"
import { motion } from "framer-motion"
import { formatCurrency } from "@/lib/constants"
import { toSafeNumber } from "@/lib/utils"

const DEPT_COLORS = [
  "oklch(0.43 0.13 256)",
  "oklch(0.55 0.14 200)",
  "oklch(0.62 0.16 145)",
  "oklch(0.65 0.18 70)",
  "oklch(0.58 0.2 25)",
]

const STATUS_COLORS: Record<string, string> = {
  New: "oklch(0.55 0.02 256)",
  Assigned: "oklch(0.43 0.13 256)",
  "In Progress": "oklch(0.62 0.16 145)",
  Pending: "oklch(0.65 0.18 70)",
  "Pending Review": "oklch(0.55 0.18 290)",
  "Correction Required": "oklch(0.58 0.2 25)",
  "Waiting for Documents": "oklch(0.7 0.14 85)",
  "Awaiting Assignment": "oklch(0.65 0.12 240)",
  "Work Completed": "oklch(0.62 0.1 180)",
  Returned: "oklch(0.55 0.22 25)",
  Completed: "oklch(0.55 0.16 145)",
  Closed: "oklch(0.45 0.12 200)",
}

const tooltipStyle = {
  borderRadius: 10,
  border: "1px solid var(--border)",
  background: "var(--popover)",
  fontSize: 12,
  boxShadow: "0 4px 16px oklch(0.21 0.03 256 / 0.08)",
}

function ChartCard({
  title,
  subtitle,
  children,
  delay = 0,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
  delay?: number
}) {
  return (
    <motion.div
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay }}
      className="rounded-xl border border-border/60 bg-card p-5 shadow-premium"
    >
      <div className="mb-4">
        <h3 className="text-sm font-semibold">{title}</h3>
        {subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
      </div>
      {children}
    </motion.div>
  )
}

export function DepartmentAnalytics({
  data,
}: {
  data: { section: string; count: number }[]
}) {
  const horizontal = [...data]
    .sort((a, b) => toSafeNumber(b.count) - toSafeNumber(a.count))
    .map((d) => ({
      ...d,
      count: toSafeNumber(d.count),
      short: d.section.replace(" & ", " · ").replace("Estimation & Construction", "Estimation"),
    }))

  const treemapData = data.map((d, i) => ({
    name: d.section.split(" ")[0],
    size: toSafeNumber(d.count) || 1,
    fill: DEPT_COLORS[i % DEPT_COLORS.length],
  }))

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <ChartCard title="Projects by Department" subtitle="Horizontal breakdown" delay={0.1} >
        <div className="lg:col-span-3">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={horizontal} layout="vertical" margin={{ left: 4, right: 16 }}>
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="short"
                width={90}
                tickLine={false}
                axisLine={false}
                fontSize={11}
                stroke="var(--muted-foreground)"
              />
              <Tooltip cursor={{ fill: "var(--muted)" }} contentStyle={tooltipStyle} />
              <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={18}>
                {horizontal.map((_, i) => (
                  <Cell key={i} fill={DEPT_COLORS[i % DEPT_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>
      <ChartCard title="Distribution" subtitle="Treemap view" delay={0.15}>
        <ResponsiveContainer width="100%" height={220}>
          <Treemap
            data={treemapData}
            dataKey="size"
            stroke="var(--card)"
            fill="var(--chart-1)"
            content={({ x, y, width, height, name, fill }) => {
              const color = typeof fill === "string" ? fill : "var(--chart-1)"
              return width > 40 && height > 24 ? (
                <g>
                  <rect x={x} y={y} width={width} height={height} fill={color} rx={6} />
                  <text
                    x={(x ?? 0) + (width ?? 0) / 2}
                    y={(y ?? 0) + (height ?? 0) / 2}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="white"
                    fontSize={11}
                    fontWeight={600}
                  >
                    {name}
                  </text>
                </g>
              ) : (
                <rect x={x} y={y} width={width} height={height} fill={color} rx={4} />
              )
            }}
          />
        </ResponsiveContainer>
      </ChartCard>
    </div>
  )
}

export function StatusDonutChart({
  data,
}: {
  data: { status: string; count: number }[]
}) {
  const total = data.reduce((s, d) => s + toSafeNumber(d.count), 0)
  const sorted = [...data]
    .map((d) => ({ ...d, count: toSafeNumber(d.count) }))
    .sort((a, b) => b.count - a.count)

  return (
    <ChartCard title="Status Breakdown" subtitle="Interactive distribution" delay={0.2}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative mx-auto sm:mx-0" style={{ width: 200, height: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={sorted}
                dataKey="count"
                nameKey="status"
                innerRadius={62}
                outerRadius={88}
                paddingAngle={3}
                strokeWidth={0}
              >
                {sorted.map((d, i) => (
                  <Cell key={i} fill={STATUS_COLORS[d.status] ?? DEPT_COLORS[i % DEPT_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-semibold">{total}</span>
            <span className="text-xs text-muted-foreground">Total</span>
          </div>
        </div>
        <div className="flex-1 space-y-2">
          {sorted.slice(0, 7).map((d) => {
            const pct = total ? Math.round((d.count / total) * 100) : 0
            return (
              <div key={d.status} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2">
                    <span
                      className="size-2 rounded-full"
                      style={{ background: STATUS_COLORS[d.status] }}
                    />
                    {d.status}
                  </span>
                  <span className="font-medium tabular-nums">{d.count}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${pct}%`,
                      background: STATUS_COLORS[d.status],
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </ChartCard>
  )
}

export function RevenueTrendChart({
  data,
  currentMonth,
  previousMonth,
}: {
  data: { month: string; revenue: number; projects: number }[]
  currentMonth: number
  previousMonth: number
}) {
  const growth =
    previousMonth > 0
      ? Math.round(((currentMonth - previousMonth) / previousMonth) * 100)
      : currentMonth > 0
        ? 100
        : 0

  return (
    <ChartCard
      title="Monthly Revenue"
      subtitle={`${growth >= 0 ? "+" : ""}${growth}% vs last month`}
      delay={0.25}
    >
      <div className="mb-4 flex items-end justify-between">
        <div>
          <p className="text-2xl font-semibold tracking-tight">{formatCurrency(currentMonth)}</p>
          <p className="text-xs text-muted-foreground">This month</p>
        </div>
        <p className="text-sm text-muted-foreground">
          Prev: {formatCurrency(previousMonth)}
        </p>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
          <defs>
            <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.15} />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="month"
            tickLine={false}
            axisLine={false}
            fontSize={11}
            stroke="var(--muted-foreground)"
          />
          <YAxis
            tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
            tickLine={false}
            axisLine={false}
            fontSize={11}
            stroke="var(--muted-foreground)"
            width={48}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value) => [formatCurrency(Number(value ?? 0)), "Revenue"]}
          />
          <Line
            type="monotone"
            dataKey="revenue"
            stroke="var(--primary)"
            strokeWidth={2.5}
            dot={{ r: 3, fill: "var(--primary)", strokeWidth: 0 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}
