import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { InvoiceEditor } from "@/components/invoice-editor"
import { invoiceServicePresets } from "@/lib/invoice-utils"
import { listProjectServiceDefs } from "@/lib/project-services"
import { getOfficeProfile, getProjectsForInvoiceSelect } from "@/lib/queries"
import { sql } from "@/lib/db"

async function nextSuggestedInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear()
  const pattern = `INV-${year}-%`
  const rows = (await sql`
    SELECT invoice_number FROM (
      SELECT invoice_number FROM projects WHERE invoice_number LIKE ${pattern}
      UNION ALL
      SELECT invoice_number FROM invoices WHERE invoice_number LIKE ${pattern}
    ) AS nums
    ORDER BY invoice_number DESC LIMIT 1
  `) as { invoice_number: string }[]
  let next = 1
  if (rows[0]?.invoice_number) {
    const parts = rows[0].invoice_number.split("-")
    next = Number.parseInt(parts[2], 10) + 1
  }
  return `INV-${year}-${String(next).padStart(4, "0")}`
}

export default async function AdminNewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string }>
}) {
  const params = await searchParams
  const initialProjectId = params.projectId ? Number(params.projectId) : undefined

  const [profile, suggestedNumber, projects, services] = await Promise.all([
    getOfficeProfile(),
    nextSuggestedInvoiceNumber(),
    getProjectsForInvoiceSelect(),
    listProjectServiceDefs({ activeOnly: true }),
  ])

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/admin/invoices"
        className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to invoices
      </Link>
      <InvoiceEditor
        profile={profile}
        suggestedInvoiceNumber={suggestedNumber}
        projects={projects}
        initialProjectId={
          initialProjectId && Number.isFinite(initialProjectId) ? initialProjectId : undefined
        }
        servicePresets={invoiceServicePresets(services)}
      />
    </div>
  )
}
