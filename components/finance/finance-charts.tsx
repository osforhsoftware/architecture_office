"use client"

import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { ChartContainer } from "@/components/chart-container"
import { formatCurrency } from "@/lib/constants"
import type { FinanceChartPoint } from "@/lib/finance/types"

const tooltipStyle = {
  borderRadius: 10,
  border: "1px solid var(--border)",
  background: "var(--popover)",
  fontSize: 12,
  boxShadow: "0 4px 16px oklch(0.21 0.03 256 / 0.08)",
}

const PIE_COLORS = [
  "oklch(0.43 0.13 256)",
  "oklch(0.55 0.14 200)",
  "oklch(0.62 0.16 145)",
  "oklch(0.65 0.18 70)",
  "oklch(0.58 0.2 25)",
  "oklch(0.55 0.18 290)",
  "oklch(0.7 0.14 85)",
  "oklch(0.62 0.1 180)",
]

type ChartData = {
  monthlyIncomeExpense: FinanceChartPoint[]
  expenseByCategory: FinanceChartPoint[]
  incomeByCategory: FinanceChartPoint[]
  projectProfit: FinanceChartPoint[]
  cashFlow: FinanceChartPoint[]
  paymentMethods: FinanceChartPoint[]
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-5 shadow-premium">
      <div className="mb-4">
        <h3 className="text-sm font-semibold">{title}</h3>
        {subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
      </div>
      {children}
    </div>
  )
}

function currencyTooltip(value: unknown) {
  return formatCurrency(Number(value) || 0)
}

export function FinanceCharts({ charts }: { charts: ChartData }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ChartCard title="Monthly Income vs Expense" subtitle="Last 12 months">
        <ChartContainer height={260}>
          <BarChart data={charts.monthlyIncomeExpense} margin={{ left: 0, right: 8, top: 8 }}>
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              fontSize={10}
              stroke="var(--muted-foreground)"
              interval="preserveStartEnd"
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              fontSize={10}
              stroke="var(--muted-foreground)"
              tickFormatter={(v) => `${Math.round(v / 1000)}k`}
            />
            <Tooltip contentStyle={tooltipStyle} formatter={currencyTooltip} />
            <Legend />
            <Bar dataKey="income" name="Income" fill="oklch(0.55 0.16 145)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="expense" name="Expense" fill="oklch(0.58 0.2 25)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartContainer>
      </ChartCard>

      <ChartCard title="Cash Flow" subtitle="Net monthly flow">
        <ChartContainer height={260}>
          <LineChart data={charts.cashFlow} margin={{ left: 0, right: 8, top: 8 }}>
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              fontSize={10}
              stroke="var(--muted-foreground)"
              interval="preserveStartEnd"
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              fontSize={10}
              stroke="var(--muted-foreground)"
              tickFormatter={(v) => `${Math.round(v / 1000)}k`}
            />
            <Tooltip contentStyle={tooltipStyle} formatter={currencyTooltip} />
            <Line
              type="monotone"
              dataKey="amount"
              name="Net flow"
              stroke="oklch(0.43 0.13 256)"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ChartContainer>
      </ChartCard>

      <ChartCard title="Income by Category">
        <ChartContainer height={260}>
          <PieChart>
            <Pie
              data={charts.incomeByCategory}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={90}
              paddingAngle={2}
            >
              {charts.incomeByCategory.map((entry, i) => (
                <Cell key={entry.name ?? i} fill={entry.color ?? PIE_COLORS[i % PIE_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} formatter={currencyTooltip} />
            <Legend />
          </PieChart>
        </ChartContainer>
      </ChartCard>

      <ChartCard title="Expense by Category">
        <ChartContainer height={260}>
          <PieChart>
            <Pie
              data={charts.expenseByCategory}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={90}
              paddingAngle={2}
            >
              {charts.expenseByCategory.map((entry, i) => (
                <Cell key={entry.name ?? i} fill={entry.color ?? PIE_COLORS[i % PIE_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} formatter={currencyTooltip} />
            <Legend />
          </PieChart>
        </ChartContainer>
      </ChartCard>

      <ChartCard title="Project Profit" subtitle="Top projects by net profit">
        <ChartContainer height={260}>
          <BarChart data={charts.projectProfit} layout="vertical" margin={{ left: 4, right: 16 }}>
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="label"
              width={100}
              tickLine={false}
              axisLine={false}
              fontSize={10}
              stroke="var(--muted-foreground)"
            />
            <Tooltip contentStyle={tooltipStyle} formatter={currencyTooltip} />
            <Bar dataKey="profit" radius={[0, 6, 6, 0]} barSize={16} fill="oklch(0.43 0.13 256)" />
          </BarChart>
        </ChartContainer>
      </ChartCard>

      <ChartCard title="Payment Methods">
        <ChartContainer height={260}>
          <PieChart>
            <Pie
              data={charts.paymentMethods}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={90}
              paddingAngle={2}
            >
              {charts.paymentMethods.map((entry, i) => (
                <Cell key={entry.name ?? i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} formatter={currencyTooltip} />
            <Legend />
          </PieChart>
        </ChartContainer>
      </ChartCard>
    </div>
  )
}
