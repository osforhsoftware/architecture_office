import { NextResponse } from "next/server"
import ExcelJS from "exceljs"
import { apiOptionsResponse, withApiCors } from "@/lib/api-cors"
import { getCurrentUser } from "@/lib/auth"
import { canOperateFinance } from "@/lib/finance/permissions"
import { financeDateRange } from "@/lib/finance/date-range"
import { sql } from "@/lib/db"

export const dynamic = "force-dynamic"

export function OPTIONS() {
  return apiOptionsResponse()
}

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user || !canOperateFinance(user)) {
      return withApiCors(NextResponse.json({ error: "Forbidden" }, { status: 403 }))
    }

    const { searchParams } = new URL(request.url)
    const { from, to } = financeDateRange(searchParams.get("from"), searchParams.get("to"))
    const clientId = searchParams.get("clientId") ? Number(searchParams.get("clientId")) : null
    const projectId = searchParams.get("projectId") ? Number(searchParams.get("projectId")) : null
    const rows = (await sql`
      SELECT pay.*, p.name AS project_name, p.code AS project_code, c.name AS client_name
      FROM payments pay
      JOIN projects p ON p.id = pay.project_id
      LEFT JOIN clients c ON c.id = p.client_id
      WHERE (${from} IS NULL OR pay.created_at >= ${from})
        AND (${to} IS NULL OR pay.created_at < DATE_ADD(${to}, INTERVAL 1 DAY))
        AND (${clientId} IS NULL OR p.client_id = ${clientId})
        AND (${projectId} IS NULL OR pay.project_id = ${projectId})
      ORDER BY pay.created_at DESC
    `) as {
      created_at: string
      project_code: string
      project_name: string
      client_name: string | null
      amount: string
      method: string | null
      note: string | null
    }[]

    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet("Payment History")
    sheet.columns = [
      { header: "Date", key: "date", width: 14 },
      { header: "Client", key: "client", width: 24 },
      { header: "Project Code", key: "code", width: 16 },
      { header: "Project", key: "project", width: 28 },
      { header: "Amount", key: "amount", width: 14 },
      { header: "Method", key: "method", width: 14 },
      { header: "Note", key: "note", width: 30 },
    ]

    for (const row of rows) {
      sheet.addRow({
        date: row.created_at?.slice(0, 10) ?? "",
        client: row.client_name ?? "",
        code: row.project_code ?? "",
        project: row.project_name ?? "",
        amount: Number(row.amount),
        method: row.method ?? "",
        note: row.note ?? "",
      })
    }

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer())
    const fileName = `Payment_History_${from ?? "all"}_${to ?? "all"}.xlsx`

    return withApiCors(
      new NextResponse(buffer, {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${fileName}"`,
        },
      }),
    )
  } catch (error) {
    console.error("[payments-export]", error)
    return withApiCors(NextResponse.json({ error: "Export failed" }, { status: 500 }))
  }
}
