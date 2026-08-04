import Link from "next/link"
import { notFound } from "next/navigation"
import { VendorDialog } from "@/components/finance/vendor-dialog"
import { formatCurrency } from "@/lib/constants"
import { getVendor, getVendorExpenses, getVendorPayments } from "@/lib/finance/server"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export default async function OfficeVendorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: idParam } = await params
  const id = Number(idParam)
  if (!id) notFound()

  const [vendor, expenses, payments] = await Promise.all([
    getVendor(id),
    getVendorExpenses(id),
    getVendorPayments(id),
  ])

  if (!vendor) notFound()

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/admin/finance/office/vendors" className="text-xs font-medium text-primary hover:underline">
            ← Vendors
          </Link>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">{vendor.name}</h2>
          <p className="text-sm text-muted-foreground">
            {[vendor.phone, vendor.email, vendor.gst].filter(Boolean).join(" · ") || "No contact details"}
          </p>
        </div>
        <VendorDialog vendor={vendor} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border/60 bg-card p-4 shadow-premium">
          <p className="text-xs text-muted-foreground">Outstanding</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">{formatCurrency(vendor.outstanding_balance)}</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-4 shadow-premium">
          <p className="text-xs text-muted-foreground">Bills</p>
          <p className="mt-1 text-xl font-semibold">{expenses.length}</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-4 shadow-premium">
          <p className="text-xs text-muted-foreground">Payments</p>
          <p className="mt-1 text-xl font-semibold">{payments.length}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-border/60 bg-card p-5 shadow-premium">
          <h3 className="text-sm font-semibold">Expenses</h3>
          {expenses.length ? (
            <ul className="mt-3 divide-y divide-border/50">
              {expenses.map((e) => (
                <li key={`${e.ledger_scope}-${e.id}`} className="flex justify-between gap-2 py-2.5 text-sm">
                  <div>
                    <p className="font-medium">{e.expense_number}</p>
                    <p className="text-xs text-muted-foreground">
                      {e.category_name ?? "—"} · {e.status} · {e.ledger_scope}
                    </p>
                  </div>
                  <span className="tabular-nums">{formatCurrency(Number(e.amount) + Number(e.gst_amount))}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">No expenses linked to this vendor.</p>
          )}
        </section>

        <section className="rounded-xl border border-border/60 bg-card p-5 shadow-premium">
          <h3 className="text-sm font-semibold">Payments</h3>
          {payments.length ? (
            <ul className="mt-3 divide-y divide-border/50">
              {payments.map((p) => (
                <li key={p.id} className="flex justify-between gap-2 py-2.5 text-sm">
                  <div>
                    <p className="font-medium">{p.payment_method}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(p.payment_date).toLocaleDateString("en-IN")} · {p.account_name ?? "—"}
                    </p>
                  </div>
                  <span className="tabular-nums">{formatCurrency(p.amount)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">No payments recorded yet.</p>
          )}
        </section>
      </div>

      <Link
        href="/admin/finance/office/expenses"
        className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-fit")}
      >
        View office expenses
      </Link>
    </div>
  )
}
