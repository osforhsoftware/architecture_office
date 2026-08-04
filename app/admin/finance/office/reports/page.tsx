import { FinanceCharts } from "@/components/finance/finance-charts"
import { formatCurrency } from "@/lib/constants"
import { getFinanceChartData, getOfficeDashboardOverview } from "@/lib/finance/server"

export default async function OfficeReportsPage() {
  const [overview, charts] = await Promise.all([
    getOfficeDashboardOverview(),
    getFinanceChartData("office"),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">Office Finance</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">Office Reports</h2>
        <p className="text-sm text-muted-foreground">Operating income, expenses, and cash flow from office ledgers only</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Monthly Income", value: formatCurrency(overview.monthlyIncome) },
          { label: "Monthly Expense", value: formatCurrency(overview.monthlyExpense) },
          { label: "Net Operating", value: formatCurrency(overview.netProfit) },
          { label: "Cash Balance", value: formatCurrency(overview.cashBalance) },
        ].map((card) => (
          <div key={card.label} className="rounded-xl border border-border/60 bg-card p-4 shadow-premium">
            <p className="text-xs text-muted-foreground">{card.label}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{card.value}</p>
          </div>
        ))}
      </div>

      <FinanceCharts charts={charts} />
    </div>
  )
}
