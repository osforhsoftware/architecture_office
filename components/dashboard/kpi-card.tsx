"use client"

import { useId } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import {
  TrendingDown,
  TrendingUp,
  Minus,
  Users,
  FolderKanban,
  Clock,
  CheckCircle2,
  Wallet,
  CalendarDays,
  type LucideIcon,
} from "lucide-react"
import { Area, AreaChart, ResponsiveContainer } from "recharts"
import { cn } from "@/lib/utils"

const KPI_ICONS = {
  users: Users,
  "folder-kanban": FolderKanban,
  clock: Clock,
  "check-circle": CheckCircle2,
  wallet: Wallet,
  calendar: CalendarDays,
} as const satisfies Record<string, LucideIcon>

export type KpiIconName = keyof typeof KPI_ICONS

const KPI_ICON_STYLES: Record<
  KpiIconName,
  { bg: string; text: string; border: string; spark: string }
> = {
  users: {
    bg: "bg-blue-500/12",
    text: "text-blue-600 dark:text-blue-400",
    border: "border-blue-500/25",
    spark: "#3b82f6",
  },
  "folder-kanban": {
    bg: "bg-violet-500/12",
    text: "text-violet-600 dark:text-violet-400",
    border: "border-violet-500/25",
    spark: "#7c3aed",
  },
  clock: {
    bg: "bg-amber-500/12",
    text: "text-amber-600 dark:text-amber-400",
    border: "border-amber-500/25",
    spark: "#d97706",
  },
  "check-circle": {
    bg: "bg-emerald-500/12",
    text: "text-emerald-600 dark:text-emerald-400",
    border: "border-emerald-500/25",
    spark: "#059669",
  },
  wallet: {
    bg: "bg-cyan-500/12",
    text: "text-cyan-600 dark:text-cyan-400",
    border: "border-cyan-500/25",
    spark: "#0891b2",
  },
  calendar: {
    bg: "bg-rose-500/12",
    text: "text-rose-600 dark:text-rose-400",
    border: "border-rose-500/25",
    spark: "#e11d48",
  },
}

function formatKpiValue(value: string | number): string | number {
  if (typeof value === "number" && !Number.isFinite(value)) return 0
  return value
}

function formatTrendComparison(trend: number, trendLabel?: string): string {
  const prefix = trend > 0 ? "+" : trend < 0 ? "" : ""
  const suffix = trendLabel ?? "vs last week"
  return `${prefix}${trend}% ${suffix}`
}

function InlineSparkline({
  data,
  gradientId,
  color,
}: {
  data: number[]
  gradientId: string
  color: string
}) {
  const chartData = data.map((v, i) => ({ v, i }))

  return (
    <div className="h-7 w-[72px] shrink-0 opacity-90">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.22} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={1.25}
            fill={`url(#${gradientId})`}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export function KpiCard({
  label,
  value,
  icon,
  trend,
  trendLabel,
  sparkline,
  href,
  delay = 0,
}: {
  label: string
  value: string | number
  icon: KpiIconName
  trend?: number
  trendLabel?: string
  sparkline?: number[]
  href?: string
  delay?: number
}) {
  const gradientId = useId().replace(/:/g, "")
  const Icon = KPI_ICONS[icon]
  const iconStyle = KPI_ICON_STYLES[icon]
  const trendUp = trend !== undefined && trend > 0
  const trendDown = trend !== undefined && trend < 0
  const showComparison = trend !== undefined

  const content = (
    <motion.div
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      className={cn(
        "group relative overflow-hidden rounded-[14px] border border-border bg-card p-4 shadow-[0_1px_3px_oklch(0.21_0.03_256/0.06),0_6px_20px_oklch(0.21_0.03_256/0.06)] backdrop-blur-sm transition-all duration-300 ease-out",
        href &&
          "hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[0_8px_24px_oklch(0.21_0.03_256/0.12),0_2px_6px_oklch(0.21_0.03_256/0.06)]",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-[10px] border shadow-sm",
            iconStyle.bg,
            iconStyle.text,
            iconStyle.border,
          )}
        >
          <Icon className="size-4" strokeWidth={2} />
        </div>

        {trend !== undefined ? (
          <div
            className={cn(
              "flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium leading-none",
              trendUp && "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
              trendDown && "bg-rose-500/10 text-rose-700 dark:text-rose-400",
              !trendUp && !trendDown && "bg-muted/80 text-muted-foreground",
            )}
          >
            {trendUp ? (
              <TrendingUp className="size-3" />
            ) : trendDown ? (
              <TrendingDown className="size-3" />
            ) : (
              <Minus className="size-3" />
            )}
            {Number.isFinite(trend) ? Math.abs(trend) : 0}%
          </div>
        ) : null}
      </div>

      <p className="mt-3 text-[13px] font-medium leading-tight text-muted-foreground">{label}</p>

      <div className="mt-1.5 flex items-end justify-between gap-3">
        <p className="text-[1.75rem] font-semibold leading-none tracking-tight text-foreground">
          {formatKpiValue(value)}
        </p>
        {sparkline && sparkline.length > 0 ? (
          <InlineSparkline data={sparkline} gradientId={gradientId} color={iconStyle.spark} />
        ) : null}
      </div>

      {showComparison ? (
        <p className="mt-2 text-[11px] leading-tight text-muted-foreground/90">
          {formatTrendComparison(trend, trendLabel)}
        </p>
      ) : null}
    </motion.div>
  )

  return href ? (
    <Link href={href} className="block">
      {content}
    </Link>
  ) : (
    content
  )
}
