import "server-only"

import { mysqlErrorCode, sql } from "./db"
import {
  formatProjectDeleteBlockedError,
  type ProjectDeleteBlocker,
} from "./project-utils"

type CountRow = { count: number }

async function countRelated(run: () => Promise<unknown>): Promise<number> {
  try {
    const rows = (await run()) as CountRow[]
    return Number(rows[0]?.count ?? 0)
  } catch (error) {
    const code = mysqlErrorCode(error)
    if (code === "ER_NO_SUCH_TABLE" || code === "ER_BAD_FIELD_ERROR") return 0
    throw error
  }
}

export async function getProjectDeleteBlockers(projectId: number): Promise<ProjectDeleteBlocker[]> {
  const [
    invoices,
    payments,
    files,
    reviews,
    returns,
    assignments,
    assignees,
    staffExpenses,
    financeIncome,
    financeExpenses,
    financeTransactions,
    cashBook,
    projectIncome,
    projectExpenses,
    projectBudget,
  ] = await Promise.all([
    countRelated(() => sql`SELECT COUNT(*) AS count FROM invoices WHERE project_id = ${projectId}`),
    countRelated(() => sql`SELECT COUNT(*) AS count FROM payments WHERE project_id = ${projectId}`),
    countRelated(() => sql`SELECT COUNT(*) AS count FROM project_files WHERE project_id = ${projectId}`),
    countRelated(() => sql`SELECT COUNT(*) AS count FROM workflow_reviews WHERE project_id = ${projectId}`),
    countRelated(() => sql`SELECT COUNT(*) AS count FROM return_history WHERE project_id = ${projectId}`),
    countRelated(() => sql`SELECT COUNT(*) AS count FROM workflow_assignments WHERE project_id = ${projectId}`),
    countRelated(() => sql`SELECT COUNT(*) AS count FROM project_assignees WHERE project_id = ${projectId}`),
    countRelated(
      () =>
        sql`SELECT COUNT(*) AS count FROM staff_expenses WHERE project_id = ${projectId} AND deleted_at IS NULL`,
    ),
    countRelated(
      () =>
        sql`SELECT COUNT(*) AS count FROM finance_income WHERE project_id = ${projectId} AND deleted_at IS NULL`,
    ),
    countRelated(
      () =>
        sql`SELECT COUNT(*) AS count FROM finance_expenses WHERE project_id = ${projectId} AND deleted_at IS NULL`,
    ),
    countRelated(
      () =>
        sql`SELECT COUNT(*) AS count FROM finance_transactions WHERE project_id = ${projectId} AND deleted_at IS NULL`,
    ),
    countRelated(() => sql`SELECT COUNT(*) AS count FROM cash_book WHERE project_id = ${projectId}`),
    countRelated(
      () =>
        sql`SELECT COUNT(*) AS count FROM project_income WHERE project_id = ${projectId} AND deleted_at IS NULL`,
    ),
    countRelated(
      () =>
        sql`SELECT COUNT(*) AS count FROM project_expenses WHERE project_id = ${projectId} AND deleted_at IS NULL`,
    ),
    countRelated(
      () =>
        sql`SELECT COUNT(*) AS count FROM project_budget WHERE project_id = ${projectId} AND deleted_at IS NULL`,
    ),
  ])

  return [
    { key: "invoices", singular: "invoice", plural: "invoices", count: invoices },
    { key: "payments", singular: "payment", plural: "payments", count: payments },
    { key: "files", singular: "uploaded file", plural: "uploaded files", count: files },
    { key: "reviews", singular: "review", plural: "reviews", count: reviews },
    { key: "returns", singular: "return record", plural: "return records", count: returns },
    {
      key: "assignments",
      singular: "staff assignment",
      plural: "staff assignments",
      count: assignments + assignees,
    },
    {
      key: "staff_expenses",
      singular: "staff expense claim",
      plural: "staff expense claims",
      count: staffExpenses,
    },
    {
      key: "income",
      singular: "income record",
      plural: "income records",
      count: financeIncome + projectIncome,
    },
    {
      key: "expenses",
      singular: "expense record",
      plural: "expense records",
      count: financeExpenses + projectExpenses,
    },
    {
      key: "transactions",
      singular: "finance transaction",
      plural: "finance transactions",
      count: financeTransactions,
    },
    { key: "cash_book", singular: "cash book entry", plural: "cash book entries", count: cashBook },
    { key: "budget", singular: "budget line", plural: "budget lines", count: projectBudget },
  ].filter((item) => item.count > 0)
}

async function deleteRelated(run: () => Promise<unknown>): Promise<void> {
  try {
    await run()
  } catch (error) {
    const code = mysqlErrorCode(error)
    if (code === "ER_NO_SUCH_TABLE" || code === "ER_BAD_FIELD_ERROR") return
    throw error
  }
}

/** Permanently remove a project and every related record we can reach. */
export async function deleteProjectAndRelatedData(projectId: number): Promise<void> {
  await deleteRelated(
    () => sql`UPDATE projects SET current_workflow_step_id = NULL WHERE id = ${projectId}`,
  )
  await deleteRelated(
    () =>
      sql`DELETE FROM invoice_payments WHERE invoice_id IN (SELECT id FROM invoices WHERE project_id = ${projectId})`,
  )
  await deleteRelated(
    () =>
      sql`DELETE FROM invoice_line_items WHERE invoice_id IN (SELECT id FROM invoices WHERE project_id = ${projectId})`,
  )
  await deleteRelated(() => sql`DELETE FROM invoices WHERE project_id = ${projectId}`)
  await deleteRelated(() => sql`DELETE FROM payments WHERE project_id = ${projectId}`)
  await deleteRelated(() => sql`DELETE FROM finance_income WHERE project_id = ${projectId}`)
  await deleteRelated(() => sql`DELETE FROM finance_expenses WHERE project_id = ${projectId}`)
  await deleteRelated(() => sql`DELETE FROM finance_transactions WHERE project_id = ${projectId}`)
  await deleteRelated(() => sql`DELETE FROM cash_book WHERE project_id = ${projectId}`)
  await deleteRelated(() => sql`DELETE FROM project_income WHERE project_id = ${projectId}`)
  await deleteRelated(() => sql`DELETE FROM project_expenses WHERE project_id = ${projectId}`)
  await deleteRelated(() => sql`DELETE FROM project_budget WHERE project_id = ${projectId}`)
  await deleteRelated(() => sql`DELETE FROM project_ledger WHERE project_id = ${projectId}`)
  await deleteRelated(() => sql`DELETE FROM project_finance WHERE project_id = ${projectId}`)
  await deleteRelated(() => sql`DELETE FROM staff_expenses WHERE project_id = ${projectId}`)
  await deleteRelated(() => sql`DELETE FROM workflow_assignments WHERE project_id = ${projectId}`)
  await deleteRelated(() => sql`DELETE FROM workflow_reviews WHERE project_id = ${projectId}`)
  await deleteRelated(() => sql`DELETE FROM checklist_items WHERE project_id = ${projectId}`)
  await deleteRelated(() => sql`DELETE FROM project_kmap_areas WHERE project_id = ${projectId}`)
  await deleteRelated(() => sql`DELETE FROM project_files WHERE project_id = ${projectId}`)
  await deleteRelated(() => sql`DELETE FROM project_services WHERE project_id = ${projectId}`)
  await deleteRelated(
    () => sql`DELETE FROM project_additional_requirements WHERE project_id = ${projectId}`,
  )
  await deleteRelated(() => sql`DELETE FROM project_assignees WHERE project_id = ${projectId}`)
  await deleteRelated(() => sql`DELETE FROM status_history WHERE project_id = ${projectId}`)
  await deleteRelated(() => sql`DELETE FROM return_history WHERE project_id = ${projectId}`)
  await deleteRelated(() => sql`DELETE FROM workflow_steps WHERE project_id = ${projectId}`)
  await sql`DELETE FROM projects WHERE id = ${projectId}`
}

export async function projectDeleteBlockedMessage(projectId: number): Promise<string | null> {
  const blockers = await getProjectDeleteBlockers(projectId)
  if (!blockers.length) return null
  return formatProjectDeleteBlockedError(blockers)
}
