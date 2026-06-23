import { NextResponse } from "next/server"
import { apiOptionsResponse, withApiCors } from "@/lib/api-cors"
import { getCurrentUser } from "@/lib/auth"
import { canAccessBilling } from "@/lib/constants"
import { logAudit } from "@/lib/project-access"
import { getAllInvoicesForExport } from "@/lib/queries"
import {
  buildInvoicesExcelBuffer,
  getInvoicesExportFileName,
} from "@/lib/services/invoices-export"

export const dynamic = "force-dynamic"

export function OPTIONS() {
  return apiOptionsResponse()
}

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user || !canAccessBilling(user.role)) {
      return withApiCors(NextResponse.json({ error: "Unauthorized" }, { status: 401 }))
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search") ?? ""
    const status = searchParams.get("status") ?? ""

    const invoices = await getAllInvoicesForExport({ search, status })
    const buffer = await buildInvoicesExcelBuffer(invoices)
    const fileName = getInvoicesExportFileName()

    await logAudit(user.id, "invoice.export", "invoice", 0, { count: invoices.length })

    return withApiCors(
      new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${fileName}"`,
          "Cache-Control": "no-store",
        },
      }),
    )
  } catch (error) {
    console.error("[invoices/export]", error)
    return withApiCors(
      NextResponse.json({ error: "Failed to export invoices." }, { status: 500 }),
    )
  }
}
