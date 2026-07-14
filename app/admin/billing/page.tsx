import { Suspense } from "react"
import Link from "next/link"
import { FileText, Plus } from "lucide-react"
import { getCurrentUser } from "@/lib/auth"
import { BillingDashboard } from "@/components/billing-dashboard"
import { InvoicesDataTable } from "@/components/invoices-data-table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { formatCurrency, userIsBillingStaff } from "@/lib/constants"
import {
  getBillingOverview,
  getInvoiceOverview,
  getInvoicesPaginated,
  getPaymentsPaginated,
  getRecentPayments,
} from "@/lib/queries"

export default async function AdminBillingPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string
    page?: string
    pageSize?: string
    status?: string
    tab?: string
  }>
}) {
  const user = await getCurrentUser()
  const billingStaff = user ? userIsBillingStaff(user) : false

  const params = await searchParams
  const search = params.search ?? ""
  const status = params.status ?? ""
  const tab = params.tab ?? "overview"

  const [overview, paymentsResult, recentPayments, invoiceOverview, invoicesResult] =
    await Promise.all([
      getBillingOverview(),
      getPaymentsPaginated({ search, page: params.page, pageSize: params.pageSize }),
      getRecentPayments(8),
      getInvoiceOverview(),
      getInvoicesPaginated({ search, status, page: params.page, pageSize: params.pageSize }),
    ])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">Finance</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">
            {billingStaff ? "Billing Staff Dashboard" : "Project Billing"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {billingStaff
              ? `Welcome, ${user?.name ?? "Billing Staff"}. Manage invoices, payments, and collections.`
              : "Payments, invoices, and revenue across all projects"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/admin/invoices/new"
            className={cn(buttonVariants({ variant: "default", size: "sm" }))}
          >
            <Plus className="size-4" /> New Invoice
          </Link>
          <Link
            href="/admin/invoices"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            <FileText className="size-4" /> Manage Invoices
          </Link>
        </div>
      </div>

      <Tabs defaultValue={tab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <Suspense>
            <BillingDashboard
              overview={overview}
              paymentsResult={paymentsResult}
              recentPayments={recentPayments}
              search={search}
              invoiceOverview={invoiceOverview}
            />
          </Suspense>
        </TabsContent>

        <TabsContent value="invoices" className="mt-4">
          <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "Total Invoices", value: String(invoiceOverview.totalInvoices) },
              { label: "Total Billed", value: formatCurrency(invoiceOverview.totalBilled) },
              { label: "Collected", value: formatCurrency(invoiceOverview.totalCollected) },
              { label: "Overdue", value: String(invoiceOverview.overdueCount) },
            ].map((card) => (
              <div
                key={card.label}
                className="rounded-xl border border-border/60 bg-card p-4 shadow-premium"
              >
                <p className="text-xs text-muted-foreground">{card.label}</p>
                <p className="mt-1 text-xl font-semibold">{card.value}</p>
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-border/60 bg-card p-5 shadow-premium">
            <InvoicesDataTable result={invoicesResult} search={search} status={status} />
          </div>
        </TabsContent>

        <TabsContent value="payments" className="mt-4">
          <Suspense>
            <BillingDashboard
              overview={overview}
              paymentsResult={paymentsResult}
              recentPayments={recentPayments}
              search={search}
              paymentsOnly
            />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  )
}
