import { FinanceCharts } from "@/components/finance/finance-charts"
import { formatCurrency } from "@/lib/constants"
import { getProjectChartData, getProjectFinanceList } from "@/lib/finance/server"

export default async function ProjectReportsPage() {
  const [charts, projects] = await Promise.all([
    getProjectChartData(),
    getProjectFinanceList({ pageSize: "5" }),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">Project Finance</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">Project Reports</h2>
        <p className="text-sm text-muted-foreground">Income, expenses, and profit trends from project ledgers only</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {projects.rows.slice(0, 3).map((row) => (
          <div key={row.project_id} className="rounded-xl border border-border/60 bg-card p-4 shadow-premium">
            <p className="text-xs text-muted-foreground">{row.project_code ?? row.project_name}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">{formatCurrency(row.net_profit)}</p>
            <p className="text-xs text-muted-foreground">Net profit · {row.profit_percent}% margin</p>
          </div>
        ))}
      </div>

      <FinanceCharts charts={charts} />
    </div>
  )
}
