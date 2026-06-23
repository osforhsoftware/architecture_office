import { NextResponse } from "next/server"
import { apiOptionsResponse, withApiCors } from "@/lib/api-cors"
import { getCurrentUser } from "@/lib/auth"
import { canAccessBilling } from "@/lib/constants"
import { logAudit } from "@/lib/project-access"
import { getInvoice, getOfficeProfile } from "@/lib/queries"
import { resolveOfficeLogoForPdf } from "@/lib/logo-utils"
import {
  buildInvoicePdfBuffer,
  getInvoicePdfFileName,
} from "@/lib/services/invoice-pdf"

export const dynamic = "force-dynamic"

export function OPTIONS() {
  return apiOptionsResponse()
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser()
    if (!user || !canAccessBilling(user.role)) {
      return withApiCors(NextResponse.json({ error: "Unauthorized" }, { status: 401 }))
    }

    const { id } = await params
    const invoiceId = Number(id)
    if (!invoiceId) {
      return withApiCors(NextResponse.json({ error: "Invalid invoice." }, { status: 400 }))
    }

    const [invoice, profile] = await Promise.all([
      getInvoice(invoiceId),
      getOfficeProfile(),
    ])

    if (!invoice) {
      return withApiCors(NextResponse.json({ error: "Invoice not found." }, { status: 404 }))
    }

    const profileWithLogo = await resolveOfficeLogoForPdf(profile)
    const buffer = buildInvoicePdfBuffer(invoice, profileWithLogo)
    const fileName = getInvoicePdfFileName(invoice.invoice_number)

    await logAudit(user.id, "invoice.pdf_export", "invoice", invoiceId, {})

    return withApiCors(
      new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="${fileName}"`,
          "Cache-Control": "no-store",
        },
      }),
    )
  } catch (error) {
    console.error("[invoices/pdf]", error)
    return withApiCors(
      NextResponse.json({ error: "Failed to generate PDF." }, { status: 500 }),
    )
  }
}
