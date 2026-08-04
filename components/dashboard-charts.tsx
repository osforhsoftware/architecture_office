"use client"

import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { ChartContainer } from "@/components/chart-container"

const SECTION_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
]

export function SectionBarChart({
  data,
}: {
  data: { section: string; count: number }[]
}) {
  const shortened = data.map((d) => ({
    ...d,
    label: d.section.replace(" & ", " &\n"),
  }))
  return (
    <ChartContainer height={240}>
      <BarChart data={shortened} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <XAxis
          dataKey="section"
          tickFormatter={(v: string) => v.split(" ")[0]}
          tickLine={false}
          axisLine={false}
          fontSize={12}
          stroke="var(--muted-foreground)"
        />
        <YAxis
          allowDecimals={false}
          tickLine={false}
          axisLine={false}
          fontSize={12}
          stroke="var(--muted-foreground)"
        />
        <Tooltip
          cursor={{ fill: "var(--muted)" }}
          contentStyle={{
            borderRadius: 8,
            border: "1px solid var(--border)",
            background: "var(--popover)",
            fontSize: 12,
          }}
        />
        <Bar dataKey="count" radius={[6, 6, 0, 0]}>
          {shortened.map((_, i) => (
            <Cell key={i} fill={SECTION_COLORS[i % SECTION_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}

const STATUS_COLORS: Record<string, string> = {
  New: "var(--chart-1)",
  Assigned: "var(--chart-2)",
  "In Progress": "var(--chart-3)",
  Pending: "var(--chart-4)",
  "Pending Review": "var(--chart-5)",
  "Correction Required": "var(--chart-1)",
  "Waiting For Documents": "var(--chart-2)",
  Returned: "var(--chart-5)",
  Completed: "var(--chart-3)",
  Closed: "var(--chart-4)",
}

export function StatusPieChart({
  data,
}: {
  data: { status: string; count: number }[]
}) {
  return (
    <ChartContainer height={240}>
      <PieChart>
        <Pie
          data={data}
          dataKey="count"
          nameKey="status"
          innerRadius={50}
          outerRadius={90}
          paddingAngle={2}
        >
          {data.map((d, i) => (
            <Cell key={i} fill={STATUS_COLORS[d.status] ?? "var(--chart-2)"} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            borderRadius: 8,
            border: "1px solid var(--border)",
            background: "var(--popover)",
            fontSize: 12,
          }}
        />
      </PieChart>
    </ChartContainer>
  )
}
