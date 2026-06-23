"use client"

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

function formatKpiValue(value: string | number): string | number {
  if (typeof value === "number" && !Number.isFinite(value)) return 0
  return value
}

export function KpiCard({
  label,
  value,
  icon,
  trend,
  trendLabel,
  sparkline,
  href,
  accent = "from-primary/10 to-primary/5",
  delay = 0,
}: {
  label: string
  value: string | number
  icon: KpiIconName
  trend?: number
  trendLabel?: string
  sparkline?: number[]
  href?: string
  accent?: string
  delay?: number
}) {
  const Icon = KPI_ICONS[icon]
  const chartData = (sparkline ?? [3, 5, 4, 7, 6, 8, 9]).map((v, i) => ({ v, i }))
  const trendUp = trend !== undefined && trend > 0
  const trendDown = trend !== undefined && trend < 0

  const content = (
    <motion.div
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className={cn(
        "group relative overflow-hidden rounded-xl border border-border/60 bg-card p-5 shadow-premium transition-all duration-300",
        href && "hover:border-primary/20 hover:shadow-premium-lg",
      )}
    >
      <div
        className={cn(
          "pointer-events-none absolute -right-6 -top-6 size-28 rounded-full bg-gradient-to-br opacity-60 blur-2xl transition-opacity group-hover:opacity-80",
          accent,
        )}
      />
      <div className="relative flex items-start justify-between gap-3">
        <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/10">
          <Icon className="size-5" />
        </div>
        {trend !== undefined ? (
          <div
            className={cn(
              "flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
              trendUp && "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
              trendDown && "bg-rose-500/10 text-rose-700 dark:text-rose-400",
              !trendUp && !trendDown && "bg-muted text-muted-foreground",
            )}
          >
            {trendUp ? <TrendingUp className="size-3" /> : trendDown ? <TrendingDown className="size-3" /> : <Minus className="size-3" />}
            {Number.isFinite(trend) ? Math.abs(trend) : 0}%
          </div>
        ) : null}
      </div>
      <div className="relative mt-4">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <p className="mt-1 text-3xl font-semibold tracking-tight">{formatKpiValue(value)}</p>
        {trendLabel ? (
          <p className="mt-1 text-xs text-muted-foreground">{trendLabel}</p>
        ) : null}
      </div>
      {sparkline ? (
        <div className="relative mt-4 h-12 w-full opacity-70">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id={`spark-${label}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="v"
                stroke="var(--primary)"
                strokeWidth={1.5}
                fill={`url(#spark-${label})`}
                dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : null}
    </motion.div>
  )

  return href ? <Link href={href} className="block">{content}</Link> : content
}
