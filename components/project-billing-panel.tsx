"use client"

import { useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { FileText, Plus } from "lucide-react"
import { toast } from "sonner"
import { ProjectPaymentsPanel } from "@/components/project-payments-panel"
import { InvoiceStatusBadge } from "@/components/status-badges"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { createInvoiceFromProject } from "@/lib/actions"
import { formatCurrency } from "@/lib/constants"
import { formatInvoiceDate } from "@/lib/invoice-utils"
import type { Payment, Project } from "@/lib/types"
import type { InvoiceListRow } from "@/lib/queries"

export function ProjectBillingPanel({
  project,
  payments,
  invoices,
}: {
  project: Project
  payments: Payment[]
  invoices: InvoiceListRow[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function handleGenerateInvoice() {
    startTransition(async () => {
      const res = await createInvoiceFromProject(project.id)
      if (res?.error) toast.error(res.error)
      else if (res.invoiceId) {
        toast.success("Invoice draft created")
        router.push(`/admin/invoices/${res.invoiceId}`)
      }
    })
  }

  return (
    <Tabs defaultValue="invoices">
      <TabsList className="mb-4">
        <TabsTrigger value="invoices">Invoices</TabsTrigger>
        <TabsTrigger value="payments">Payments</TabsTrigger>
      </TabsList>

      <TabsContent value="invoices" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Project Invoices</p>
            <p className="text-xs text-muted-foreground">
              Generate and manage invoices for this project
            </p>
          </div>
          <Button onClick={handleGenerateInvoice} disabled={pending} size="sm">
            <Plus className="size-4" />
            {pending ? "Creating..." : "Generate Invoice"}
          </Button>
        </div>

        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Invoice #</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Date</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Total</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Paid</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} className="border-b border-border/50 hover:bg-muted/20">
                  <td className="px-3 py-2.5">
                    <Link
                      href={`/admin/invoices/${inv.id}`}
                      className="flex items-center gap-1.5 font-medium hover:text-primary hover:underline"
                    >
                      <FileText className="size-3.5 text-muted-foreground" />
                      {inv.invoice_number}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 text-xs tabular-nums text-muted-foreground">
                    {formatInvoiceDate(inv.invoice_date)}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums">{formatCurrency(inv.total)}</td>
                  <td className="px-3 py-2.5 tabular-nums">{formatCurrency(inv.amount_paid)}</td>
                  <td className="px-3 py-2.5">
                    <InvoiceStatusBadge status={inv.status} />
                  </td>
                </tr>
              ))}
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-sm text-muted-foreground">
                    No invoices yet. Click &quot;Generate Invoice&quot; to create one.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </TabsContent>

      <TabsContent value="payments">
        <ProjectPaymentsPanel project={project} payments={payments} />
      </TabsContent>
    </Tabs>
  )
}
