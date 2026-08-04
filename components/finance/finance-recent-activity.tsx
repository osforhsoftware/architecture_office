import Link from "next/link"
import { formatCurrency } from "@/lib/constants"
import type { FinanceExpense, FinanceIncome, StaffExpenseClaim } from "@/lib/finance/types"
import { FinanceStatusBadge } from "@/components/finance/finance-status-badge"

type ActivityData = {
  latestIncome: FinanceIncome[]
  latestExpenses: FinanceExpense[]
  pendingApprovals: Array<FinanceExpense | StaffExpenseClaim>
  upcomingPayments: FinanceExpense[]
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

function ActivitySection({
  title,
  href,
  empty,
  children,
}: {
  title: string
  href: string
  empty: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-4 shadow-premium">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        <Link href={href} className="text-xs font-medium text-primary hover:underline">
          View all
        </Link>
      </div>
      {children ?? (
        <p className="py-4 text-center text-sm text-muted-foreground">{empty}</p>
      )}
    </div>
  )
}

function ActivityList({ items, empty }: { items: React.ReactNode[]; empty: string }) {
  if (!items.length) {
    return <p className="py-4 text-center text-sm text-muted-foreground">{empty}</p>
  }
  return <ul className="divide-y divide-border/50">{items}</ul>
}

export function FinanceRecentActivity({ activity }: { activity: ActivityData }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <ActivitySection title="Latest Income" href="/admin/finance/income" empty="No income recorded yet.">
        <ActivityList
          empty="No income recorded yet."
          items={activity.latestIncome.map((row) => (
            <li key={row.id} className="flex items-start justify-between gap-2 py-2.5">
              <div className="min-w-0">
                <Link
                  href="/admin/finance/income"
                  className="truncate text-sm font-medium hover:text-primary hover:underline"
                >
                  {row.receipt_number}
                </Link>
                <p className="truncate text-xs text-muted-foreground">
                  {row.client_name ?? row.category_name ?? "—"} · {formatDate(row.income_date)}
                </p>
              </div>
              <span className="shrink-0 text-sm font-medium tabular-nums">
                {formatCurrency(row.amount)}
              </span>
            </li>
          ))}
        />
      </ActivitySection>

      <ActivitySection title="Latest Expenses" href="/admin/finance/expenses" empty="No expenses yet.">
        <ActivityList
          empty="No expenses yet."
          items={activity.latestExpenses.map((row) => (
            <li key={row.id} className="flex items-start justify-between gap-2 py-2.5">
              <div className="min-w-0">
                <Link
                  href="/admin/finance/expenses"
                  className="truncate text-sm font-medium hover:text-primary hover:underline"
                >
                  {row.expense_number}
                </Link>
                <p className="truncate text-xs text-muted-foreground">
                  {row.vendor_name ?? row.category_name ?? "—"} · {formatDate(row.expense_date)}
                </p>
              </div>
              <span className="shrink-0 text-sm font-medium tabular-nums">
                {formatCurrency(Number(row.amount) + Number(row.gst_amount))}
              </span>
            </li>
          ))}
        />
      </ActivitySection>

      <ActivitySection
        title="Pending Approvals"
        href="/admin/finance/claims"
        empty="No pending approvals."
      >
        <ActivityList
          empty="No pending approvals."
          items={activity.pendingApprovals.map((row) => {
            const isClaim = "claim_number" in row
            const label = isClaim ? row.claim_number : row.expense_number
            const sub = isClaim
              ? `${row.staff_name ?? "Staff"} · ${row.category}`
              : `${row.vendor_name ?? "Vendor"} · ${row.category_name ?? "—"}`
            const href = isClaim ? "/admin/finance/claims" : "/admin/finance/expenses"
            return (
              <li key={`${isClaim ? "claim" : "expense"}-${row.id}`} className="py-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link href={href} className="truncate text-sm font-medium hover:text-primary hover:underline">
                      {label}
                    </Link>
                    <p className="truncate text-xs text-muted-foreground">{sub}</p>
                  </div>
                  <FinanceStatusBadge status={row.status} />
                </div>
              </li>
            )
          })}
        />
      </ActivitySection>

      <ActivitySection
        title="Upcoming Payments"
        href="/admin/finance/expenses?status=Approved"
        empty="No approved payments due."
      >
        <ActivityList
          empty="No approved payments due."
          items={activity.upcomingPayments.map((row) => (
            <li key={row.id} className="flex items-start justify-between gap-2 py-2.5">
              <div className="min-w-0">
                <Link
                  href="/admin/finance/expenses"
                  className="truncate text-sm font-medium hover:text-primary hover:underline"
                >
                  {row.expense_number}
                </Link>
                <p className="truncate text-xs text-muted-foreground">
                  {row.vendor_name ?? "—"} · due {formatDate(row.expense_date)}
                </p>
              </div>
              <span className="shrink-0 text-sm font-medium tabular-nums">
                {formatCurrency(Number(row.amount) + Number(row.gst_amount))}
              </span>
            </li>
          ))}
        />
      </ActivitySection>
    </div>
  )
}
