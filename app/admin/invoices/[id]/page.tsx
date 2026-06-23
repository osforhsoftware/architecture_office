import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { InvoiceEditor } from "@/components/invoice-editor"
import { getInvoice, getOfficeProfile, getProjectsForInvoiceSelect } from "@/lib/queries"

export default async function AdminInvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const invoiceId = Number(id)
  if (!invoiceId) notFound()

  const [invoice, profile, projects] = await Promise.all([
    getInvoice(invoiceId),
    getOfficeProfile(),
    getProjectsForInvoiceSelect(),
  ])

  if (!invoice) notFound()

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/admin/invoices"
        className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to invoices
      </Link>
      <InvoiceEditor invoice={invoice} profile={profile} projects={projects} />
    </div>
  )
}
