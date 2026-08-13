import { NextResponse } from "next/server"
import { apiOptionsResponse, withApiCors } from "@/lib/api-cors"
import { getCurrentUser } from "@/lib/auth"
import { logAudit } from "@/lib/project-access"
import { canOperateFinance } from "@/lib/finance/permissions"
import {
  getExpensesPaginated,
  getIncomePaginated,
  getProjectFinanceList,
} from "@/lib/finance/server"
import type { LedgerScope } from "@/lib/finance/constants"
import type { ProjectFinanceSummary } from "@/lib/finance/types"
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

    const includeProjects = type !== "income" && type !== "expense" && scope !== "office"
    const projectsPromise: Promise<ProjectFinanceSummary[]> = includeProjects
      ? getProjectFinanceList({ pageSize: "all" }).then((result) => result.rows)
      : Promise.resolve([])

    // For "all" without explicit scope, export both ledgers separately then merge
    if (!scopeParam && type !== "expense" && type !== "income") {
      const [projInc, projExp, offInc, offExp, projects] = await Promise.all([
        getIncomePaginated({ ...fetchParams, scope: "project" }),
        getExpensesPaginated({ ...fetchParams, scope: "project" }),
        getIncomePaginated({ ...fetchParams, scope: "office" }),
        getExpensesPaginated({ ...fetchParams, scope: "office" }),
        projectsPromise,
      ])
      const income = [...projInc.rows, ...offInc.rows]
      const expenses = [...projExp.rows, ...offExp.rows]
      const buffer = await buildFinanceExcelBuffer(income, expenses, {
        title: reportTitle(undefined, "all"),
        from,
        to,
        projects,
      })
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

    const [incomeResult, expenseResult, projects] = await Promise.all([
      type === "expense" ? Promise.resolve({ rows: [] as never[] }) : getIncomePaginated(fetchParams),
      type === "income"
        ? Promise.resolve({ rows: [] as never[] })
        : getExpensesPaginated(fetchParams),
      projectsPromise,
    ])

    const buffer = await buildFinanceExcelBuffer(incomeResult.rows, expenseResult.rows, {
      title: reportTitle(scope, type),
      from,
      to,
      projects: includeProjects ? projects : undefined,
    })
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
