import Link from "next/link"
import { Plus } from "lucide-react"
import { InvoicesDataTable } from "@/components/invoices-data-table"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/constants"
import { getInvoiceOverview, getInvoicesPaginated } from "@/lib/queries"

export default async function AdminInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string; pageSize?: string; status?: string }>
}) {
  const params = await searchParams
  const search = params.search ?? ""
  const status = params.status ?? ""

  const [overview, invoicesResult] = await Promise.all([
    getInvoiceOverview(),
    getInvoicesPaginated({ search, status, page: params.page, pageSize: params.pageSize }),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">Billing</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">Invoices</h2>
          <p className="text-sm text-muted-foreground">
            Create, manage, and export professional invoices
          </p>
        </div>
        <Link
          href="/admin/invoices/new"
          className={cn(buttonVariants())}
        >
          <Plus className="size-4" /> New Invoice
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Total Invoices", value: String(overview.totalInvoices) },
          { label: "Total Billed", value: formatCurrency(overview.totalBilled) },
          { label: "Collected", value: formatCurrency(overview.totalCollected) },
          { label: "Outstanding", value: formatCurrency(overview.outstanding) },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-border/60 bg-card p-5 shadow-premium"
          >
            <p className="text-sm text-muted-foreground">{card.label}</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border/60 bg-card p-5 shadow-premium">
        <InvoicesDataTable result={invoicesResult} search={search} status={status} />
      </div>
    </div>
  )
}
