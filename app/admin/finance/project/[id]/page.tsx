import Link from "next/link"
import { notFound } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FinanceStatusBadge } from "@/components/finance/finance-status-badge"
import { FinanceKpiCards } from "@/components/finance/finance-kpi-cards"
import { formatCurrency } from "@/lib/constants"
import { getProjectDashboard, getProjectFinanceDetail } from "@/lib/finance/server"

export default async function ProjectFinanceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: idParam } = await params
  const projectId = Number(idParam)
  if (!projectId) notFound()

  const [{ summary, income, expenses, budget }, overview] = await Promise.all([
    getProjectFinanceDetail(projectId),
    getProjectDashboard(projectId),
  ])
  if (!summary) notFound()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin/finance/project" className="text-xs font-medium text-primary hover:underline">
          ← Project Finance
        </Link>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight">
          {summary.project_code ?? summary.project_name}
        </h2>
        <p className="text-sm text-muted-foreground">{summary.client_name ?? "No client"}</p>
      </div>

      <FinanceKpiCards overview={overview} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Project Value", value: formatCurrency(summary.project_value) },
          { label: "Total Budget", value: formatCurrency(summary.total_budget ?? 0) },
          { label: "Balance Due", value: formatCurrency(summary.balance_amount) },
          { label: "Budget Used", value: `${summary.budget_used_percent ?? 0}%` },
        ].map((card) => (
          <div key={card.label} className="rounded-xl border border-border/60 bg-card p-4 shadow-premium">
            <p className="text-xs text-muted-foreground">{card.label}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{card.value}</p>
          </div>
        ))}
      </div>

      <Tabs defaultValue="income">
        <TabsList>
          <TabsTrigger value="income">Income ({income.length})</TabsTrigger>
          <TabsTrigger value="expenses">Expenses ({expenses.length})</TabsTrigger>
          <TabsTrigger value="budget">Budget ({budget.length})</TabsTrigger>
          <TabsTrigger value="profit">Profit</TabsTrigger>
        </TabsList>

        <TabsContent value="income" className="mt-4">
          <div className="rounded-xl border border-border/60 bg-card shadow-premium">
            {income.length ? (
              <ul className="divide-y divide-border/50">
                {income.map((row) => (
                  <li key={row.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                    <div>
                      <p className="font-medium">{row.receipt_number}</p>
                      <p className="text-xs text-muted-foreground">
                        {row.category_name ?? "—"} · {new Date(row.income_date).toLocaleDateString("en-IN")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <FinanceStatusBadge status={row.status} />
                      <span className="tabular-nums font-medium">{formatCurrency(row.amount)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-4 py-12 text-center text-muted-foreground">No income for this project.</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="expenses" className="mt-4">
          <div className="rounded-xl border border-border/60 bg-card shadow-premium">
            {expenses.length ? (
              <ul className="divide-y divide-border/50">
                {expenses.map((row) => (
                  <li key={row.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                    <div>
                      <p className="font-medium">{row.expense_number}</p>
                      <p className="text-xs text-muted-foreground">
                        {row.vendor_name ?? row.category_name ?? "—"} ·{" "}
                        {new Date(row.expense_date).toLocaleDateString("en-IN")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <FinanceStatusBadge status={row.status} />
                      <span className="tabular-nums font-medium">
                        {formatCurrency(Number(row.amount) + Number(row.gst_amount))}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-4 py-12 text-center text-muted-foreground">No expenses for this project.</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="budget" className="mt-4">
          <div className="rounded-xl border border-border/60 bg-card shadow-premium">
            {budget.length ? (
              <ul className="divide-y divide-border/50">
                {budget.map((row) => (
                  <li key={row.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                    <div>
                      <p className="font-medium">{row.category}</p>
                      <p className="text-xs text-muted-foreground">
                        Spent {formatCurrency(row.spent_amount ?? 0)} of {formatCurrency(row.estimated_amount)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-4 py-12 text-center text-muted-foreground">No budget lines for this project.</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="profit" className="mt-4">
          <div className="rounded-xl border border-border/60 bg-card p-6 shadow-premium">
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs text-muted-foreground">Advance Received</dt>
                <dd className="text-lg font-semibold tabular-nums">{formatCurrency(summary.advance_received)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Balance Amount</dt>
                <dd className="text-lg font-semibold tabular-nums">{formatCurrency(summary.balance_amount)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Profit %</dt>
                <dd className="text-lg font-semibold tabular-nums">{summary.profit_percent}%</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Net Profit</dt>
                <dd className="text-lg font-semibold tabular-nums text-primary">
                  {formatCurrency(summary.net_profit)}
                </dd>
              </div>
            </dl>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
