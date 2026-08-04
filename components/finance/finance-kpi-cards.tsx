import { formatCurrency } from "@/lib/constants"
import type { FinanceDashboardOverview } from "@/lib/finance/types"
import { cn } from "@/lib/utils"

const KPI_ITEMS: {
  key: keyof FinanceDashboardOverview
  label: string
  variant?: "positive" | "negative" | "neutral"
}[] = [
  { key: "todayIncome", label: "Today's Income", variant: "positive" },
  { key: "todayExpense", label: "Today's Expense", variant: "negative" },
  { key: "monthlyIncome", label: "Monthly Income", variant: "positive" },
  { key: "monthlyExpense", label: "Monthly Expense", variant: "negative" },
  { key: "cashBalance", label: "Cash Balance" },
  { key: "bankBalance", label: "Bank Balance" },
  { key: "outstandingReceivables", label: "Outstanding Receivables" },
  { key: "outstandingPayables", label: "Outstanding Payables" },
  { key: "netProfit", label: "Net Profit", variant: "neutral" },
]

export function FinanceKpiCards({ overview }: { overview: FinanceDashboardOverview }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
      {KPI_ITEMS.map((item) => {
        const value = overview[item.key]
        const isCount = item.key === "pendingApprovals" || item.key === "upcomingPayments"
        const display = isCount ? String(value) : formatCurrency(value as number)
        return (
          <div
            key={item.key}
            className="rounded-xl border border-border/60 bg-card p-4 shadow-premium"
          >
            <p className="text-xs text-muted-foreground">{item.label}</p>
            <p
              className={cn(
                "mt-1 text-xl font-semibold tabular-nums tracking-tight",
                item.variant === "positive" && "text-emerald-600 dark:text-emerald-400",
                item.variant === "negative" && "text-red-600 dark:text-red-400",
                item.key === "netProfit" &&
                  (Number(value) >= 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-red-600 dark:text-red-400"),
              )}
            >
              {display}
            </p>
          </div>
        )
      })}
    </div>
  )
}
