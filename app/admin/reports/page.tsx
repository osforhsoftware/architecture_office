import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import { canAccessReports, formatCurrency } from "@/lib/constants"
import { getDashboardStats, getMonthlyRevenueTrend } from "@/lib/queries"
import { toSafeNumber } from "@/lib/utils"
import { RevenueTrendChart } from "@/components/dashboard/analytics-charts"
import { StatusDonutChart } from "@/components/dashboard/analytics-charts"

export default async function AdminReportsPage() {
  const user = await getCurrentUser()
  if (!user || !canAccessReports(user.role)) redirect("/admin")

  const [stats, revenueTrend] = await Promise.all([
    getDashboardStats(),
    getMonthlyRevenueTrend(12),
  ])

  const currentMonth = toSafeNumber(revenueTrend[revenueTrend.length - 1]?.revenue)
  const previousMonth = toSafeNumber(revenueTrend[revenueTrend.length - 2]?.revenue)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">Analytics</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">Reports</h2>
        <p className="text-sm text-muted-foreground">
          Office performance metrics and revenue analytics.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total Projects", value: toSafeNumber(stats.total) },
          { label: "Active", value: toSafeNumber(stats.active) },
          { label: "Revenue Collected", value: formatCurrency(stats.totalRevenue) },
          { label: "Outstanding", value: formatCurrency(stats.outstanding) },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-border/60 bg-card p-5 shadow-premium">
            <p className="text-sm text-muted-foreground">{item.label}</p>
            <p className="mt-1 text-2xl font-semibold">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <RevenueTrendChart
          data={revenueTrend}
          currentMonth={currentMonth}
          previousMonth={previousMonth}
        />
        <StatusDonutChart data={stats.byStatus} />
      </div>
    </div>
  )
}
