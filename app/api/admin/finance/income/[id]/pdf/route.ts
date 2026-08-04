import { NextResponse } from "next/server"
import { apiOptionsResponse, withApiCors } from "@/lib/api-cors"
import { getCurrentUser } from "@/lib/auth"
import { logAudit } from "@/lib/project-access"
import { canOperateFinance } from "@/lib/finance/permissions"
import { getIncomeById } from "@/lib/finance/server"
import { getOfficeProfile } from "@/lib/queries"
import {
  buildIncomeReceiptPdfBuffer,
  getIncomeReceiptPdfFileName,
} from "@/lib/services/income-receipt-pdf"

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
    if (!user || !canOperateFinance(user)) {
      return withApiCors(NextResponse.json({ error: "Forbidden" }, { status: 403 }))
    }

    const { id } = await params
    const incomeId = Number(id)
    if (!incomeId) {
      return withApiCors(NextResponse.json({ error: "Invalid income." }, { status: 400 }))
    }

    const scopeParam = new URL(_request.url).searchParams.get("scope")
    const scope =
      scopeParam === "office" || scopeParam === "project" ? scopeParam : undefined

    const [income, profile] = await Promise.all([
      getIncomeById(incomeId, scope),
      getOfficeProfile(),
    ])

    if (!income) {
      return withApiCors(NextResponse.json({ error: "Income not found." }, { status: 404 }))
    }

    const buffer = buildIncomeReceiptPdfBuffer(income, profile)
    const fileName = getIncomeReceiptPdfFileName(income.receipt_number)

    await logAudit(user.id, "finance.income.pdf", "income", incomeId, {})

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
    console.error("[finance/income/pdf]", error)
    return withApiCors(
      NextResponse.json({ error: "Failed to generate PDF." }, { status: 500 }),
    )
  }
}
