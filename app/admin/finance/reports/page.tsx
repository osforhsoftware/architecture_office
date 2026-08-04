import Link from "next/link"
import { FolderKanban, Building2 } from "lucide-react"
import { PROJECT_FINANCE_BASE, OFFICE_FINANCE_BASE } from "@/lib/finance/constants"

export default function LegacyFinanceReportsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">Finance</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">Reports</h2>
        <p className="text-sm text-muted-foreground">Choose which ledger to report on</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Link
          href={`${PROJECT_FINANCE_BASE}/reports`}
          className="rounded-xl border border-border/60 bg-card p-6 shadow-premium transition-colors hover:border-primary/40"
        >
          <FolderKanban className="size-8 text-primary" />
          <h3 className="mt-4 text-lg font-semibold">Project Reports</h3>
          <p className="mt-2 text-sm text-muted-foreground">Income, expenses, and profit by project</p>
        </Link>
        <Link
          href={`${OFFICE_FINANCE_BASE}/reports`}
          className="rounded-xl border border-border/60 bg-card p-6 shadow-premium transition-colors hover:border-primary/40"
        >
          <Building2 className="size-8 text-primary" />
          <h3 className="mt-4 text-lg font-semibold">Office Reports</h3>
          <p className="mt-2 text-sm text-muted-foreground">Operating cash flow and office expenses</p>
        </Link>
      </div>
    </div>
  )
}
