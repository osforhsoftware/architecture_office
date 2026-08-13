import "server-only"

import { sql } from "@/lib/db"
import { nextTxnNumber } from "./numbers"
import { isCashAccountType, type LedgerScope } from "./constants"

/** Adjust shared account balance */
export async function adjustAccountBalance(accountId: number, delta: number): Promise<void> {
  await sql`
    UPDATE finance_accounts
    SET current_balance = current_balance + ${delta}
    WHERE id = ${accountId} AND deleted_at IS NULL
  `
}

async function getLatestOfficeCashBalance(accountId?: number | null): Promise<number> {
  if (accountId) {
    const rows = (await sql`
      SELECT balance FROM cash_book
      WHERE account_id = ${accountId} AND ledger_scope = 'office'
      ORDER BY id DESC LIMIT 1
    `) as { balance: number }[]
    return Number(rows[0]?.balance ?? 0)
  }
  const rows = (await sql`
    SELECT balance FROM cash_book
    WHERE ledger_scope = 'office'
    ORDER BY id DESC LIMIT 1
  `) as { balance: number }[]
  return Number(rows[0]?.balance ?? 0)
}

async function getLatestProjectLedgerBalance(projectId: number): Promise<number> {
  const rows = (await sql`
    SELECT balance FROM project_ledger
    WHERE project_id = ${projectId}
    ORDER BY id DESC LIMIT 1
  `) as { balance: number }[]
  return Number(rows[0]?.balance ?? 0)
}

export type EngineEntry = {
  scope: LedgerScope
  date: string
  amount: number
  direction: "in" | "out"
  accountId: number | null
  paymentMethod: string | null
  projectId: number | null
  description: string
  refType: string
  refId: number
  createdBy: number | null
  txnType: string
}

/**
 * Unified double-entry engine.
 * - Office scope → cash_book + finance_transactions (ledger_scope=office) + account balance
 * - Project scope → project_ledger + finance_transactions (ledger_scope=project) + account balance
 * Project entries NEVER appear in office cash book / office reports.
 */
export async function recordLedgerEntry(
  params: EngineEntry,
): Promise<{ txnId: number; txnNumber: string }> {
  const txnNumber = await nextTxnNumber()
  const incomeAmt = params.direction === "in" ? params.amount : 0
  const expenseAmt = params.direction === "out" ? params.amount : 0

  const txnRows = (await sql`
    INSERT INTO finance_transactions (
      transaction_number, transaction_date, txn_type, account_id, amount,
      direction, payment_method, project_id, description, ref_type, ref_id,
      created_by, ledger_scope
    ) VALUES (
      ${txnNumber}, ${params.date}, ${params.txnType}, ${params.accountId}, ${params.amount},
      ${params.direction}, ${params.paymentMethod}, ${params.projectId}, ${params.description},
      ${params.refType}, ${params.refId}, ${params.createdBy}, ${params.scope}
    )
  `) as { id: number }[]
  const txnId = Number(txnRows[0]?.id ?? 0)

  if (params.scope === "project") {
    if (!params.projectId) throw new Error("Project ledger entry requires projectId")
    const prev = await getLatestProjectLedgerBalance(params.projectId)
    const balance =
      params.direction === "in" ? prev + params.amount : prev - params.amount

    await sql`
      INSERT INTO project_ledger (
        project_id, entry_date, transaction_id, income_amount, expense_amount,
        balance, payment_method, description, entry_type, ref_type, ref_id
      ) VALUES (
        ${params.projectId}, ${params.date}, ${txnNumber}, ${incomeAmt}, ${expenseAmt},
        ${balance}, ${params.paymentMethod}, ${params.description},
        ${params.txnType}, ${params.refType}, ${params.refId}
      )
    `
  } else {
    const prev = await getLatestOfficeCashBalance(params.accountId)
    const balance =
      params.direction === "in" ? prev + params.amount : prev - params.amount

    await sql`
      INSERT INTO cash_book (
        entry_date, transaction_id, income_amount, expense_amount, balance,
        account_id, payment_method, project_id, description, entry_type,
        ref_type, ref_id, ledger_scope
      ) VALUES (
        ${params.date}, ${txnNumber}, ${incomeAmt}, ${expenseAmt}, ${balance},
        ${params.accountId}, ${params.paymentMethod}, NULL,
        ${params.description}, ${params.txnType}, ${params.refType}, ${params.refId},
        'office'
      )
    `
  }

  if (params.accountId) {
    const delta = params.direction === "in" ? params.amount : -params.amount
    await adjustAccountBalance(params.accountId, delta)
  }

  return { txnId, txnNumber }
}

export async function logApproval(params: {
  entityType: string
  entityId: number
  action: string
  fromStatus: string | null
  toStatus: string | null
  userId: number
  comment?: string | null
}): Promise<void> {
  await sql`
    INSERT INTO approval_logs (entity_type, entity_id, action, from_status, to_status, user_id, comment)
    VALUES (
      ${params.entityType}, ${params.entityId}, ${params.action},
      ${params.fromStatus}, ${params.toStatus}, ${params.userId}, ${params.comment ?? null}
    )
  `
}

export async function createFinanceNotification(params: {
  userId: number
  type: string
  title: string
  message?: string | null
  entityType?: string | null
  entityId?: number | null
}): Promise<void> {
  await sql`
    INSERT INTO finance_notifications (user_id, type, title, message, entity_type, entity_id)
    VALUES (
      ${params.userId}, ${params.type}, ${params.title},
      ${params.message ?? null}, ${params.entityType ?? null}, ${params.entityId ?? null}
    )
  `
  await sql`
    INSERT INTO notifications (user_id, type, title, message)
    VALUES (${params.userId}, ${params.type}, ${params.title}, ${params.message ?? null})
  `
}

export async function notifyFinanceManagers(params: {
  type: string
  title: string
  message?: string | null
  entityType?: string | null
  entityId?: number | null
}): Promise<void> {
  const managers = (await sql`
    SELECT id FROM app_users
    WHERE active = 1 AND role IN ('Acmmo Admin', 'Super Admin', 'Admin', 'Billing Staff')
  `) as { id: number }[]
  for (const row of managers) {
    await createFinanceNotification({
      userId: Number(row.id),
      type: params.type,
      title: params.title,
      message: params.message,
      entityType: params.entityType,
      entityId: params.entityId,
    })
  }
}

/** Recompute project_finance from project_income / project_expenses / project_budget only */
export async function syncProjectFinance(projectId: number): Promise<void> {
  const projectRows = (await sql`
    SELECT project_amount, advance_received FROM projects WHERE id = ${projectId}
  `) as { project_amount: unknown; advance_received: unknown }[]
  if (!projectRows[0]) return

  const projectValue = Number(projectRows[0].project_amount ?? 0)

  const incomeRows = (await sql`
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM project_income
    WHERE project_id = ${projectId} AND deleted_at IS NULL AND status = 'Approved'
  `) as { total: unknown }[]
  const expenseRows = (await sql`
    SELECT COALESCE(SUM(amount + gst_amount), 0) AS total
    FROM project_expenses
    WHERE project_id = ${projectId} AND deleted_at IS NULL AND status IN ('Approved', 'Paid')
  `) as { total: unknown }[]
  const budgetRows = (await sql`
    SELECT COALESCE(SUM(estimated_amount), 0) AS total
    FROM project_budget
    WHERE project_id = ${projectId} AND deleted_at IS NULL
  `) as { total: unknown }[]

  const totalIncome = Number(incomeRows[0]?.total ?? 0)
  const totalExpense = Number(expenseRows[0]?.total ?? 0)
  const totalBudget = Number(budgetRows[0]?.total ?? 0)
  const netProfit = totalIncome - totalExpense
  const balanceAmount = projectValue - totalIncome
  const profitPercent = projectValue > 0 ? (netProfit / projectValue) * 100 : 0
  const budgetUsedPercent = totalBudget > 0 ? (totalExpense / totalBudget) * 100 : 0

  await sql`
    INSERT INTO project_finance (
      project_id, project_value, total_income, total_expense,
      advance_received, balance_amount, net_profit, profit_percent,
      total_budget, budget_used_percent
    ) VALUES (
      ${projectId}, ${projectValue}, ${totalIncome}, ${totalExpense},
      ${totalIncome}, ${balanceAmount}, ${netProfit}, ${profitPercent},
      ${totalBudget}, ${budgetUsedPercent}
    )
    ON DUPLICATE KEY UPDATE
      project_value = VALUES(project_value),
      total_income = VALUES(total_income),
      total_expense = VALUES(total_expense),
      advance_received = VALUES(advance_received),
      balance_amount = VALUES(balance_amount),
      net_profit = VALUES(net_profit),
      profit_percent = VALUES(profit_percent),
      total_budget = VALUES(total_budget),
      budget_used_percent = VALUES(budget_used_percent)
  `

  if (totalBudget > 0 && totalExpense > totalBudget) {
    await notifyFinanceManagers({
      type: "finance.budget_exceeded",
      title: "Project budget exceeded",
      message: `Project #${projectId} expenses exceed budget.`,
      entityType: "project",
      entityId: projectId,
    })
  }
}

export async function checkLowCashBalance(): Promise<void> {
  const settings = (await sql`
    SELECT value FROM finance_settings WHERE \`key\` = 'low_cash_threshold'
  `) as { value: unknown }[]
  const threshold = Number(settings[0]?.value ?? 5000)
  const cashAccounts = (await sql`
    SELECT id, name, current_balance, account_type FROM finance_accounts
    WHERE deleted_at IS NULL AND active = 1
  `) as { id: number; name: string; current_balance: unknown; account_type: string }[]
  for (const acc of cashAccounts) {
    if (!isCashAccountType(String(acc.account_type))) continue
    const bal = Number(acc.current_balance ?? 0)
    if (bal < threshold) {
      await notifyFinanceManagers({
        type: "finance.low_cash",
        title: "Low cash balance",
        message: `${acc.name} balance is ₹${bal.toFixed(2)} (threshold ₹${threshold}).`,
        entityType: "account",
        entityId: Number(acc.id),
      })
    }
  }
}

/** @deprecated use getLatestOfficeCashBalance via cash book queries */
export async function getLatestCashBalance(accountId?: number | null): Promise<number> {
  return getLatestOfficeCashBalance(accountId)
}
