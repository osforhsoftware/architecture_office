import { cn } from "@/lib/utils"

const STATUS_COLORS: Record<string, string> = {
  Draft: "border-border bg-muted/60 text-muted-foreground",
  Submitted: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300",
  Approved: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
  Rejected: "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300",
  Paid: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
  Cancelled: "border-border bg-muted/60 text-muted-foreground",
  "Dept Review": "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300",
  "Admin Approval": "border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-300",
  "Finance Payment": "border-primary/30 bg-primary/10 text-primary",
  Completed: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
}

export function FinanceStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-medium leading-none",
        STATUS_COLORS[status] ?? "border-border bg-muted/60 text-muted-foreground",
      )}
    >
      {status}
    </span>
  )
}
