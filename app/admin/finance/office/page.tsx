import { Suspense } from "react"
import { FinanceKpiCards } from "@/components/finance/finance-kpi-cards"
import { FinanceCharts } from "@/components/finance/finance-charts"
import { FinanceRecentActivity } from "@/components/finance/finance-recent-activity"
import {
  getOfficeDashboardOverview,
  getFinanceChartData,
  getFinanceRecentActivity,
} from "@/lib/finance/server"

export default async function OfficeFinanceDashboardPage() {
  const [overview, charts, activity] = await Promise.all([
    getOfficeDashboardOverview(),
    getFinanceChartData("office"),
    getFinanceRecentActivity("office"),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">Office Finance</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">Office Dashboard</h2>
        <p className="text-sm text-muted-foreground">
          Company cash flow, payables, and operating expenses — separate from project profit
        </p>
      </div>

      <FinanceKpiCards overview={overview} />
      <FinanceCharts charts={charts} />
      <FinanceRecentActivity activity={activity} />
    </div>
  )
}
