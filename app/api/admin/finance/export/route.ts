import { NextResponse } from "next/server"
import { apiOptionsResponse, withApiCors } from "@/lib/api-cors"
import { getCurrentUser } from "@/lib/auth"
import { logAudit } from "@/lib/project-access"
import { canOperateFinance } from "@/lib/finance/permissions"
import { financeDateRange } from "@/lib/finance/date-range"
import {
  getExpensesPaginated,
  getIncomePaginated,
  getProjectFinanceList,
} from "@/lib/finance/server"
import type { LedgerScope } from "@/lib/finance/constants"
import {
  buildFinanceExcelBuffer,
  getFinanceExportFileName,
} from "@/lib/services/finance-export"

export const dynamic = "force-dynamic"

export function OPTIONS() {
  return apiOptionsResponse()
}

function reportTitle(scope: string | undefined, type: string) {
  if (!scope) return type === "all" ? "Finance Report" : `Finance ${type} Report`
  const scopeLabel = scope === "office" ? "Office" : "Project"
  if (type === "income") return `${scopeLabel} Income Report`
  if (type === "expense") return `${scopeLabel} Expenses Report`
  return `${scopeLabel} Finance Report`
}

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user || !canOperateFinance(user)) {
      return withApiCors(NextResponse.json({ error: "Forbidden" }, { status: 403 }))
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get("type") ?? "all"
    const { from, to } = financeDateRange(searchParams.get("from"), searchParams.get("to"))
    const scopeParam = searchParams.get("scope")
    const scope: LedgerScope =
      scopeParam === "office" || scopeParam === "project" ? scopeParam : "project"
    const projectId = searchParams.get("projectId") ?? undefined
    const dateFiltered = Boolean(from || to)
    const isFullReport = type !== "income" && type !== "expense"

    const fetchParams = {
      from: from ?? undefined,
      to: to ?? undefined,
      pageSize: "all" as const,
      projectId,
    }

    // Full report always includes both ledgers so a date range is not limited
    // to an empty office/project table when the other ledger has activity.
    if (isFullReport) {
      const [projInc, projExp, offInc, offExp, projects] = await Promise.all([
        getIncomePaginated({ ...fetchParams, scope: "project" }),
        getExpensesPaginated({ ...fetchParams, scope: "project" }),
        getIncomePaginated({ ...fetchParams, scope: "office" }),
        getExpensesPaginated({ ...fetchParams, scope: "office" }),
        getProjectFinanceList({ pageSize: "all" }).then((result) => result.rows),
      ])
      const income = [...projInc.rows, ...offInc.rows]
      const expenses = [...projExp.rows, ...offExp.rows]
      const buffer = await buildFinanceExcelBuffer(income, expenses, {
        title: reportTitle(scopeParam ?? undefined, "all"),
        from: from ?? undefined,
        to: to ?? undefined,
        projects,
        dateFiltered,
      })
      const fileName = getFinanceExportFileName(scopeParam ? `${scopeParam}_all` : "all")
      await logAudit(user.id, "finance.export", "finance", 0, {
        type: "all",
        scope: scopeParam,
        from,
        to,
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
      type === "expense"
        ? Promise.resolve({ rows: [] as never[] })
        : getIncomePaginated({ ...fetchParams, scope }),
      type === "income"
        ? Promise.resolve({ rows: [] as never[] })
        : getExpensesPaginated({ ...fetchParams, scope }),
    ])

    const buffer = await buildFinanceExcelBuffer(incomeResult.rows, expenseResult.rows, {
      title: reportTitle(scope, type),
      from: from ?? undefined,
      to: to ?? undefined,
      dateFiltered,
    })
    const fileName = getFinanceExportFileName(`${scope}_${type}`)

    await logAudit(user.id, "finance.export", "finance", 0, {
      type,
      scope,
      from,
      to,
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
