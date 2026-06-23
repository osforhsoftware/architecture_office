import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { ProjectBillingPanel } from "@/components/project-billing-panel"
import { PaymentBadge, StatusBadge } from "@/components/status-badges"
import { formatCurrency } from "@/lib/constants"
import type { Payment, Project } from "@/lib/types"
import type { InvoiceListRow } from "@/lib/queries"

export function BillingStaffProjectView({
  project,
  payments,
  invoices,
}: {
  project: Project
  payments: Payment[]
  invoices: InvoiceListRow[]
}) {
  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/admin/projects"
        className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to billing projects
      </Link>

      <div className="rounded-xl border border-border/60 bg-card p-6 shadow-premium">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
              <StatusBadge status={project.status} />
              <PaymentBadge status={project.payment_status} />
            </div>
            <p className="mt-1 font-mono text-sm text-muted-foreground">{project.code}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Client: {project.client_name}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Project amount</p>
              <p className="font-semibold">{formatCurrency(project.project_amount)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Advance received</p>
              <p className="font-semibold">{formatCurrency(project.advance_received)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-card p-5 shadow-premium">
        <ProjectBillingPanel project={project} payments={payments} invoices={invoices} />
      </div>
    </div>
  )
}
