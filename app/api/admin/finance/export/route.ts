import { NextResponse } from "next/server"
import { apiOptionsResponse, withApiCors } from "@/lib/api-cors"
import { getCurrentUser } from "@/lib/auth"
import { logAudit } from "@/lib/project-access"
import { canOperateFinance } from "@/lib/finance/permissions"
import { getExpensesPaginated, getIncomePaginated } from "@/lib/finance/server"
import type { LedgerScope } from "@/lib/finance/constants"
import {
  buildFinanceExcelBuffer,
  getFinanceExportFileName,
} from "@/lib/services/finance-export"

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
    const type = searchParams.get("type") ?? "all"
    const from = searchParams.get("from") ?? undefined
    const to = searchParams.get("to") ?? undefined
    const scopeParam = searchParams.get("scope")
    const scope: LedgerScope =
      scopeParam === "office" || scopeParam === "project" ? scopeParam : "project"
    const projectId = searchParams.get("projectId") ?? undefined

    const fetchParams = {
      from,
      to,
      pageSize: "all" as const,
      scope,
      projectId,
    }

    // For "all" without explicit scope, export both ledgers separately then merge
    if (!scopeParam && type !== "expense" && type !== "income") {
      const [projInc, projExp, offInc, offExp] = await Promise.all([
        getIncomePaginated({ ...fetchParams, scope: "project" }),
        getExpensesPaginated({ ...fetchParams, scope: "project" }),
        getIncomePaginated({ ...fetchParams, scope: "office" }),
        getExpensesPaginated({ ...fetchParams, scope: "office" }),
      ])
      const income = [...projInc.rows, ...offInc.rows]
      const expenses = [...projExp.rows, ...offExp.rows]
      const buffer = await buildFinanceExcelBuffer(income, expenses)
      const fileName = getFinanceExportFileName("all")
      await logAudit(user.id, "finance.export", "finance", 0, {
        type: "all",
        income: income.length,
        expenses: expenses.length,
      })
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
    }

    const [incomeResult, expenseResult] = await Promise.all([
      type === "expense" ? Promise.resolve({ rows: [] as never[] }) : getIncomePaginated(fetchParams),
      type === "income"
        ? Promise.resolve({ rows: [] as never[] })
        : getExpensesPaginated(fetchParams),
    ])

    const buffer = await buildFinanceExcelBuffer(incomeResult.rows, expenseResult.rows)
    const fileName = getFinanceExportFileName(`${scope}_${type}`)

    await logAudit(user.id, "finance.export", "finance", 0, {
      type,
      scope,
      income: incomeResult.rows.length,
      expenses: expenseResult.rows.length,
    })

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
    console.error("[finance/export]", error)
    return withApiCors(
      NextResponse.json({ error: "Failed to export finance data." }, { status: 500 }),
    )
  }
}
