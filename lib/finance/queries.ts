import "server-only"

import { sql } from "@/lib/db"
import {
  buildSearchPattern,
  clampPage,
  pageOffset,
  parsePage,
  parsePageSize,
  toPaginatedResult,
  type PaginatedResult,
  type PaginationParams,
} from "@/lib/pagination"
import { isCashAccountType, isBankAccountType, type LedgerScope } from "./constants"
import type {
  FinanceAccount,
  IncomeCategory,
  ExpenseCategory,
  Vendor,
  FinanceIncome,
  FinanceExpense,
  StaffExpenseClaim,
  VendorPayment,
  BankTransfer,
  CashBookEntry,
  ProjectLedgerEntry,
  ProjectBudget,
  SalaryPayroll,
  ProjectFinanceSummary,
  ApprovalLog,
  FinanceDashboardOverview,
  FinanceChartPoint,
  FinanceTransaction,
} from "./types"

function toNum(v: unknown): number {
  const n = Number(v ?? 0)
  return Number.isFinite(n) ? n : 0
}

function categoryScopeFilter(scope?: LedgerScope): string | null {
  if (!scope) return null
  return scope
}

// ---------------------------------------------------------------------------
// Categories & accounts
// ---------------------------------------------------------------------------

export async function getIncomeCategories(
  activeOnly = false,
  scope?: LedgerScope,
): Promise<IncomeCategory[]> {
  const scopeVal = categoryScopeFilter(scope)
  if (activeOnly && scopeVal) {
    return (await sql`
      SELECT * FROM income_categories
      WHERE active = 1 AND (scope = ${scopeVal} OR scope = 'both')
      ORDER BY sort_order, name
    `) as IncomeCategory[]
  }
  if (activeOnly) {
    return (await sql`
      SELECT * FROM income_categories WHERE active = 1 ORDER BY sort_order, name
    `) as IncomeCategory[]
  }
  if (scopeVal) {
    return (await sql`
      SELECT * FROM income_categories
      WHERE scope = ${scopeVal} OR scope = 'both'
      ORDER BY sort_order, name
    `) as IncomeCategory[]
  }
  return (await sql`
    SELECT * FROM income_categories ORDER BY sort_order, name
  `) as IncomeCategory[]
}

export async function getExpenseCategories(
  activeOnly = false,
  scope?: LedgerScope,
): Promise<ExpenseCategory[]> {
  const scopeVal = categoryScopeFilter(scope)
  if (activeOnly && scopeVal) {
    return (await sql`
      SELECT * FROM expense_categories
      WHERE active = 1 AND (scope = ${scopeVal} OR scope = 'both')
      ORDER BY sort_order, name
    `) as ExpenseCategory[]
  }
  if (activeOnly) {
    return (await sql`
      SELECT * FROM expense_categories WHERE active = 1 ORDER BY sort_order, name
    `) as ExpenseCategory[]
  }
  if (scopeVal) {
    return (await sql`
      SELECT * FROM expense_categories
      WHERE scope = ${scopeVal} OR scope = 'both'
      ORDER BY sort_order, name
    `) as ExpenseCategory[]
  }
  return (await sql`
    SELECT * FROM expense_categories ORDER BY sort_order, name
  `) as ExpenseCategory[]
}

export async function getFinanceAccounts(activeOnly = true): Promise<FinanceAccount[]> {
  if (activeOnly) {
    return (await sql`
      SELECT * FROM finance_accounts
      WHERE deleted_at IS NULL AND active = 1
      ORDER BY account_type, name
    `) as FinanceAccount[]
  }
  return (await sql`
    SELECT * FROM finance_accounts WHERE deleted_at IS NULL ORDER BY account_type, name
  `) as FinanceAccount[]
}

export async function getFinanceAccount(id: number): Promise<FinanceAccount | null> {
  const rows = (await sql`
    SELECT * FROM finance_accounts WHERE id = ${id} AND deleted_at IS NULL
  `) as FinanceAccount[]
  return rows[0] ?? null
}

export async function getAccountTransactions(
  accountId: number,
  params: PaginationParams = {},
): Promise<PaginatedResult<FinanceTransaction>> {
  const requestedPage = parsePage(params.page)
  const pageSize = parsePageSize(params.pageSize)
  const countRows = (await sql`
    SELECT COUNT(*) AS count FROM finance_transactions
    WHERE account_id = ${accountId} AND deleted_at IS NULL AND ledger_scope = 'office'
  `) as { count: number }[]
  const total = toNum(countRows[0]?.count)
  const page = clampPage(requestedPage, total, pageSize)
  const offset = pageOffset(page, pageSize)
  const rows = (await sql`
    SELECT t.*, p.name AS project_name
    FROM finance_transactions t
    LEFT JOIN projects p ON p.id = t.project_id
    WHERE t.account_id = ${accountId} AND t.deleted_at IS NULL AND t.ledger_scope = 'office'
    ORDER BY t.transaction_date DESC, t.id DESC
    LIMIT ${pageSize === -1 ? 10000 : pageSize} OFFSET ${offset}
  `) as FinanceTransaction[]
  return toPaginatedResult(rows, total, page, pageSize === -1 ? total || 1 : pageSize)
}

// ---------------------------------------------------------------------------
// Vendors
// ---------------------------------------------------------------------------

export async function getVendorsPaginated(
  params: PaginationParams = {},
): Promise<PaginatedResult<Vendor>> {
  const requestedPage = parsePage(params.page)
  const pageSize = parsePageSize(params.pageSize)
  const search = buildSearchPattern(params.search)

  const countRows = (await sql`
    SELECT COUNT(*) AS count FROM vendors v
    WHERE v.deleted_at IS NULL
    AND (${search} IS NULL OR
      v.name LIKE ${search} OR v.phone LIKE ${search} OR
      v.email LIKE ${search} OR v.gst LIKE ${search})
  `) as { count: number }[]
  const total = toNum(countRows[0]?.count)
  const page = clampPage(requestedPage, total, pageSize)
  const offset = pageOffset(page, pageSize)

  const rows = (await sql`
    SELECT v.*,
      (SELECT COUNT(*) FROM office_expenses e WHERE e.vendor_id = v.id AND e.deleted_at IS NULL) +
      (SELECT COUNT(*) FROM project_expenses pe WHERE pe.vendor_id = v.id AND pe.deleted_at IS NULL) AS bill_count,
      (SELECT COUNT(*) FROM vendor_payments p WHERE p.vendor_id = v.id AND p.deleted_at IS NULL) AS payment_count
    FROM vendors v
    WHERE v.deleted_at IS NULL
    AND (${search} IS NULL OR
      v.name LIKE ${search} OR v.phone LIKE ${search} OR
      v.email LIKE ${search} OR v.gst LIKE ${search})
    ORDER BY v.name ASC
    LIMIT ${pageSize === -1 ? 10000 : pageSize} OFFSET ${offset}
  `) as Vendor[]

  return toPaginatedResult(rows, total, page, pageSize === -1 ? total || 1 : pageSize)
}

export async function getVendor(id: number): Promise<Vendor | null> {
  const rows = (await sql`
    SELECT * FROM vendors WHERE id = ${id} AND deleted_at IS NULL
  `) as Vendor[]
  return rows[0] ?? null
}

export async function getVendorPayments(vendorId: number): Promise<VendorPayment[]> {
  return (await sql`
    SELECT vp.*, a.name AS account_name, u.name AS creator_name
    FROM vendor_payments vp
    LEFT JOIN finance_accounts a ON a.id = vp.account_id
    LEFT JOIN app_users u ON u.id = vp.created_by
    WHERE vp.vendor_id = ${vendorId} AND vp.deleted_at IS NULL
    ORDER BY vp.payment_date DESC, vp.id DESC
  `) as VendorPayment[]
}

export async function getVendorExpenses(vendorId: number): Promise<FinanceExpense[]> {
  return (await sql`
    SELECT e.*, c.name AS category_name, 'office' AS ledger_scope
    FROM office_expenses e
    LEFT JOIN expense_categories c ON c.id = e.category_id
    WHERE e.vendor_id = ${vendorId} AND e.deleted_at IS NULL
    UNION ALL
    SELECT pe.*, c.name AS category_name, 'project' AS ledger_scope
    FROM project_expenses pe
    LEFT JOIN expense_categories c ON c.id = pe.category_id
    WHERE pe.vendor_id = ${vendorId} AND pe.deleted_at IS NULL
    ORDER BY expense_date DESC
  `) as FinanceExpense[]
}

export async function getAllVendors(): Promise<Vendor[]> {
  return (await sql`
    SELECT * FROM vendors WHERE deleted_at IS NULL AND active = 1 ORDER BY name
  `) as Vendor[]
}

// ---------------------------------------------------------------------------
// Income (scoped)
// ---------------------------------------------------------------------------

type IncomeQueryParams = PaginationParams & {
  scope?: LedgerScope
  status?: string
  categoryId?: string
  clientId?: string
  projectId?: string
  method?: string
  from?: string
  to?: string
}

export async function getIncomePaginated(
  params: IncomeQueryParams = {},
): Promise<PaginatedResult<FinanceIncome>> {
  const scope = params.scope ?? "project"
  if (scope === "office") return getOfficeIncomePaginated(params)
  return getProjectIncomePaginated(params)
}

async function getProjectIncomePaginated(
  params: IncomeQueryParams,
): Promise<PaginatedResult<FinanceIncome>> {
  const requestedPage = parsePage(params.page)
  const pageSize = parsePageSize(params.pageSize)
  const search = buildSearchPattern(params.search)
  const status = params.status?.trim() || null
  const categoryId = params.categoryId ? Number(params.categoryId) : null
  const clientId = params.clientId ? Number(params.clientId) : null
  const projectId = params.projectId ? Number(params.projectId) : null
  const method = params.method?.trim() || null
  const from = params.from?.trim() || null
  const to = params.to?.trim() || null

  const countRows = (await sql`
    SELECT COUNT(*) AS count
    FROM project_income i
    LEFT JOIN clients c ON c.id = i.client_id
    LEFT JOIN projects p ON p.id = i.project_id
    WHERE i.deleted_at IS NULL
    AND (${search} IS NULL OR
      i.receipt_number LIKE ${search} OR c.name LIKE ${search} OR
      p.name LIKE ${search} OR p.code LIKE ${search} OR
      i.reference_number LIKE ${search} OR CAST(i.amount AS CHAR) LIKE ${search})
    AND (${status} IS NULL OR i.status = ${status})
    AND (${categoryId} IS NULL OR i.category_id = ${categoryId})
    AND (${clientId} IS NULL OR i.client_id = ${clientId})
    AND (${projectId} IS NULL OR i.project_id = ${projectId})
    AND (${method} IS NULL OR i.payment_method = ${method})
    AND (${from} IS NULL OR i.income_date >= ${from})
    AND (${to} IS NULL OR i.income_date <= ${to})
  `) as { count: number }[]

  const total = toNum(countRows[0]?.count)
  const page = clampPage(requestedPage, total, pageSize)
  const offset = pageOffset(page, pageSize)

  const rows = (await sql`
    SELECT i.*,
      c.name AS client_name,
      p.name AS project_name, p.code AS project_code,
      cat.name AS category_name, cat.color AS category_color,
      a.name AS account_name,
      cu.name AS creator_name,
      au.name AS approver_name,
      'project' AS ledger_scope
    FROM project_income i
    LEFT JOIN clients c ON c.id = i.client_id
    LEFT JOIN projects p ON p.id = i.project_id
    LEFT JOIN income_categories cat ON cat.id = i.category_id
    LEFT JOIN finance_accounts a ON a.id = i.account_id
    LEFT JOIN app_users cu ON cu.id = i.created_by
    LEFT JOIN app_users au ON au.id = i.approved_by
    WHERE i.deleted_at IS NULL
    AND (${search} IS NULL OR
      i.receipt_number LIKE ${search} OR c.name LIKE ${search} OR
      p.name LIKE ${search} OR p.code LIKE ${search} OR
      i.reference_number LIKE ${search} OR CAST(i.amount AS CHAR) LIKE ${search})
    AND (${status} IS NULL OR i.status = ${status})
    AND (${categoryId} IS NULL OR i.category_id = ${categoryId})
    AND (${clientId} IS NULL OR i.client_id = ${clientId})
    AND (${projectId} IS NULL OR i.project_id = ${projectId})
    AND (${method} IS NULL OR i.payment_method = ${method})
    AND (${from} IS NULL OR i.income_date >= ${from})
    AND (${to} IS NULL OR i.income_date <= ${to})
    ORDER BY i.income_date DESC, i.id DESC
    LIMIT ${pageSize === -1 ? 10000 : pageSize} OFFSET ${offset}
  `) as FinanceIncome[]

  return toPaginatedResult(rows, total, page, pageSize === -1 ? total || 1 : pageSize)
}

async function getOfficeIncomePaginated(
  params: IncomeQueryParams,
): Promise<PaginatedResult<FinanceIncome>> {
  const requestedPage = parsePage(params.page)
  const pageSize = parsePageSize(params.pageSize)
  const search = buildSearchPattern(params.search)
  const status = params.status?.trim() || null
  const categoryId = params.categoryId ? Number(params.categoryId) : null
  const method = params.method?.trim() || null
  const from = params.from?.trim() || null
  const to = params.to?.trim() || null

  const countRows = (await sql`
    SELECT COUNT(*) AS count
    FROM office_income i
    WHERE i.deleted_at IS NULL
    AND (${search} IS NULL OR
      i.receipt_number LIKE ${search} OR i.reference_number LIKE ${search} OR
      CAST(i.amount AS CHAR) LIKE ${search})
    AND (${status} IS NULL OR i.status = ${status})
    AND (${categoryId} IS NULL OR i.category_id = ${categoryId})
    AND (${method} IS NULL OR i.payment_method = ${method})
    AND (${from} IS NULL OR i.income_date >= ${from})
    AND (${to} IS NULL OR i.income_date <= ${to})
  `) as { count: number }[]

  const total = toNum(countRows[0]?.count)
  const page = clampPage(requestedPage, total, pageSize)
  const offset = pageOffset(page, pageSize)

  const rows = (await sql`
    SELECT i.*,
      cat.name AS category_name, cat.color AS category_color,
      a.name AS account_name,
      cu.name AS creator_name,
      au.name AS approver_name,
      'office' AS ledger_scope
    FROM office_income i
    LEFT JOIN income_categories cat ON cat.id = i.category_id
    LEFT JOIN finance_accounts a ON a.id = i.account_id
    LEFT JOIN app_users cu ON cu.id = i.created_by
    LEFT JOIN app_users au ON au.id = i.approved_by
    WHERE i.deleted_at IS NULL
    AND (${search} IS NULL OR
      i.receipt_number LIKE ${search} OR i.reference_number LIKE ${search} OR
      CAST(i.amount AS CHAR) LIKE ${search})
    AND (${status} IS NULL OR i.status = ${status})
    AND (${categoryId} IS NULL OR i.category_id = ${categoryId})
    AND (${method} IS NULL OR i.payment_method = ${method})
    AND (${from} IS NULL OR i.income_date >= ${from})
    AND (${to} IS NULL OR i.income_date <= ${to})
    ORDER BY i.income_date DESC, i.id DESC
    LIMIT ${pageSize === -1 ? 10000 : pageSize} OFFSET ${offset}
  `) as FinanceIncome[]

  return toPaginatedResult(rows, total, page, pageSize === -1 ? total || 1 : pageSize)
}

export async function getIncomeById(
  id: number,
  scope?: LedgerScope,
): Promise<FinanceIncome | null> {
  if (scope === "office") {
    const rows = (await sql`
      SELECT i.*, cat.name AS category_name, cat.color AS category_color,
        a.name AS account_name, 'office' AS ledger_scope
      FROM office_income i
      LEFT JOIN income_categories cat ON cat.id = i.category_id
      LEFT JOIN finance_accounts a ON a.id = i.account_id
      WHERE i.id = ${id} AND i.deleted_at IS NULL
    `) as FinanceIncome[]
    return rows[0] ?? null
  }
  if (scope === "project") {
    const rows = (await sql`
      SELECT i.*, c.name AS client_name, p.name AS project_name, p.code AS project_code,
        cat.name AS category_name, cat.color AS category_color,
        a.name AS account_name, 'project' AS ledger_scope
      FROM project_income i
      LEFT JOIN clients c ON c.id = i.client_id
      LEFT JOIN projects p ON p.id = i.project_id
      LEFT JOIN income_categories cat ON cat.id = i.category_id
      LEFT JOIN finance_accounts a ON a.id = i.account_id
      WHERE i.id = ${id} AND i.deleted_at IS NULL
    `) as FinanceIncome[]
    return rows[0] ?? null
  }
  return (await getIncomeById(id, "project")) ?? (await getIncomeById(id, "office"))
}

// ---------------------------------------------------------------------------
// Expenses (scoped)
// ---------------------------------------------------------------------------

type ExpenseQueryParams = PaginationParams & {
  scope?: LedgerScope
  status?: string
  categoryId?: string
  vendorId?: string
  projectId?: string
  method?: string
  from?: string
  to?: string
}

export async function getExpensesPaginated(
  params: ExpenseQueryParams = {},
): Promise<PaginatedResult<FinanceExpense>> {
  const scope = params.scope ?? "project"
  if (scope === "office") return getOfficeExpensesPaginated(params)
  return getProjectExpensesPaginated(params)
}

async function getProjectExpensesPaginated(
  params: ExpenseQueryParams,
): Promise<PaginatedResult<FinanceExpense>> {
  const requestedPage = parsePage(params.page)
  const pageSize = parsePageSize(params.pageSize)
  const search = buildSearchPattern(params.search)
  const status = params.status?.trim() || null
  const categoryId = params.categoryId ? Number(params.categoryId) : null
  const vendorId = params.vendorId ? Number(params.vendorId) : null
  const projectId = params.projectId ? Number(params.projectId) : null
  const method = params.method?.trim() || null
  const from = params.from?.trim() || null
  const to = params.to?.trim() || null

  const countRows = (await sql`
    SELECT COUNT(*) AS count
    FROM project_expenses e
    LEFT JOIN vendors v ON v.id = e.vendor_id
    LEFT JOIN projects p ON p.id = e.project_id
    WHERE e.deleted_at IS NULL
    AND (${search} IS NULL OR
      e.expense_number LIKE ${search} OR v.name LIKE ${search} OR
      p.name LIKE ${search} OR p.code LIKE ${search} OR
      e.reference_number LIKE ${search} OR CAST(e.amount AS CHAR) LIKE ${search})
    AND (${status} IS NULL OR e.status = ${status})
    AND (${categoryId} IS NULL OR e.category_id = ${categoryId})
    AND (${vendorId} IS NULL OR e.vendor_id = ${vendorId})
    AND (${projectId} IS NULL OR e.project_id = ${projectId})
    AND (${method} IS NULL OR e.payment_method = ${method})
    AND (${from} IS NULL OR e.expense_date >= ${from})
    AND (${to} IS NULL OR e.expense_date <= ${to})
  `) as { count: number }[]

  const total = toNum(countRows[0]?.count)
  const page = clampPage(requestedPage, total, pageSize)
  const offset = pageOffset(page, pageSize)

  const rows = (await sql`
    SELECT e.*,
      v.name AS vendor_name,
      p.name AS project_name, p.code AS project_code,
      cat.name AS category_name, cat.color AS category_color,
      a.name AS account_name,
      cu.name AS creator_name,
      au.name AS approver_name,
      'project' AS ledger_scope
    FROM project_expenses e
    LEFT JOIN vendors v ON v.id = e.vendor_id
    LEFT JOIN projects p ON p.id = e.project_id
    LEFT JOIN expense_categories cat ON cat.id = e.category_id
    LEFT JOIN finance_accounts a ON a.id = e.account_id
    LEFT JOIN app_users cu ON cu.id = e.created_by
    LEFT JOIN app_users au ON au.id = e.approved_by
    WHERE e.deleted_at IS NULL
    AND (${search} IS NULL OR
      e.expense_number LIKE ${search} OR v.name LIKE ${search} OR
      p.name LIKE ${search} OR p.code LIKE ${search} OR
      e.reference_number LIKE ${search} OR CAST(e.amount AS CHAR) LIKE ${search})
    AND (${status} IS NULL OR e.status = ${status})
    AND (${categoryId} IS NULL OR e.category_id = ${categoryId})
    AND (${vendorId} IS NULL OR e.vendor_id = ${vendorId})
    AND (${projectId} IS NULL OR e.project_id = ${projectId})
    AND (${method} IS NULL OR e.payment_method = ${method})
    AND (${from} IS NULL OR e.expense_date >= ${from})
    AND (${to} IS NULL OR e.expense_date <= ${to})
    ORDER BY e.expense_date DESC, e.id DESC
    LIMIT ${pageSize === -1 ? 10000 : pageSize} OFFSET ${offset}
  `) as FinanceExpense[]

  return toPaginatedResult(rows, total, page, pageSize === -1 ? total || 1 : pageSize)
}

async function getOfficeExpensesPaginated(
  params: ExpenseQueryParams,
): Promise<PaginatedResult<FinanceExpense>> {
  const requestedPage = parsePage(params.page)
  const pageSize = parsePageSize(params.pageSize)
  const search = buildSearchPattern(params.search)
  const status = params.status?.trim() || null
  const categoryId = params.categoryId ? Number(params.categoryId) : null
  const vendorId = params.vendorId ? Number(params.vendorId) : null
  const method = params.method?.trim() || null
  const from = params.from?.trim() || null
  const to = params.to?.trim() || null

  const countRows = (await sql`
    SELECT COUNT(*) AS count
    FROM office_expenses e
    LEFT JOIN vendors v ON v.id = e.vendor_id
    WHERE e.deleted_at IS NULL
    AND (${search} IS NULL OR
      e.expense_number LIKE ${search} OR v.name LIKE ${search} OR
      e.reference_number LIKE ${search} OR CAST(e.amount AS CHAR) LIKE ${search})
    AND (${status} IS NULL OR e.status = ${status})
    AND (${categoryId} IS NULL OR e.category_id = ${categoryId})
    AND (${vendorId} IS NULL OR e.vendor_id = ${vendorId})
    AND (${method} IS NULL OR e.payment_method = ${method})
    AND (${from} IS NULL OR e.expense_date >= ${from})
    AND (${to} IS NULL OR e.expense_date <= ${to})
  `) as { count: number }[]

  const total = toNum(countRows[0]?.count)
  const page = clampPage(requestedPage, total, pageSize)
  const offset = pageOffset(page, pageSize)

  const rows = (await sql`
    SELECT e.*,
      v.name AS vendor_name,
      cat.name AS category_name, cat.color AS category_color,
      a.name AS account_name,
      cu.name AS creator_name,
      au.name AS approver_name,
      'office' AS ledger_scope
    FROM office_expenses e
    LEFT JOIN vendors v ON v.id = e.vendor_id
    LEFT JOIN expense_categories cat ON cat.id = e.category_id
    LEFT JOIN finance_accounts a ON a.id = e.account_id
    LEFT JOIN app_users cu ON cu.id = e.created_by
    LEFT JOIN app_users au ON au.id = e.approved_by
    WHERE e.deleted_at IS NULL
    AND (${search} IS NULL OR
      e.expense_number LIKE ${search} OR v.name LIKE ${search} OR
      e.reference_number LIKE ${search} OR CAST(e.amount AS CHAR) LIKE ${search})
    AND (${status} IS NULL OR e.status = ${status})
    AND (${categoryId} IS NULL OR e.category_id = ${categoryId})
    AND (${vendorId} IS NULL OR e.vendor_id = ${vendorId})
    AND (${method} IS NULL OR e.payment_method = ${method})
    AND (${from} IS NULL OR e.expense_date >= ${from})
    AND (${to} IS NULL OR e.expense_date <= ${to})
    ORDER BY e.expense_date DESC, e.id DESC
    LIMIT ${pageSize === -1 ? 10000 : pageSize} OFFSET ${offset}
  `) as FinanceExpense[]

  return toPaginatedResult(rows, total, page, pageSize === -1 ? total || 1 : pageSize)
}

export async function getExpenseById(
  id: number,
  scope?: LedgerScope,
): Promise<FinanceExpense | null> {
  if (scope === "office") {
    const rows = (await sql`
      SELECT e.*, v.name AS vendor_name, cat.name AS category_name,
        a.name AS account_name, 'office' AS ledger_scope
      FROM office_expenses e
      LEFT JOIN vendors v ON v.id = e.vendor_id
      LEFT JOIN expense_categories cat ON cat.id = e.category_id
      LEFT JOIN finance_accounts a ON a.id = e.account_id
      WHERE e.id = ${id} AND e.deleted_at IS NULL
    `) as FinanceExpense[]
    return rows[0] ?? null
  }
  if (scope === "project") {
    const rows = (await sql`
      SELECT e.*, v.name AS vendor_name, p.name AS project_name, p.code AS project_code,
        cat.name AS category_name, a.name AS account_name, 'project' AS ledger_scope
      FROM project_expenses e
      LEFT JOIN vendors v ON v.id = e.vendor_id
      LEFT JOIN projects p ON p.id = e.project_id
      LEFT JOIN expense_categories cat ON cat.id = e.category_id
      LEFT JOIN finance_accounts a ON a.id = e.account_id
      WHERE e.id = ${id} AND e.deleted_at IS NULL
    `) as FinanceExpense[]
    return rows[0] ?? null
  }
  return (await getExpenseById(id, "project")) ?? (await getExpenseById(id, "office"))
}

// ---------------------------------------------------------------------------
// Cash book (office only)
// ---------------------------------------------------------------------------

export async function getCashBookPaginated(
  params: PaginationParams & { accountId?: string; from?: string; to?: string } = {},
): Promise<PaginatedResult<CashBookEntry> & { openingBalance: number; closingBalance: number }> {
  const requestedPage = parsePage(params.page)
  const pageSize = parsePageSize(params.pageSize)
  const search = buildSearchPattern(params.search)
  const accountId = params.accountId ? Number(params.accountId) : null
  const from = params.from?.trim() || null
  const to = params.to?.trim() || null

  const countRows = (await sql`
    SELECT COUNT(*) AS count FROM cash_book cb
    WHERE cb.ledger_scope = 'office'
    AND (${accountId} IS NULL OR cb.account_id = ${accountId})
    AND (${from} IS NULL OR cb.entry_date >= ${from})
    AND (${to} IS NULL OR cb.entry_date <= ${to})
    AND (${search} IS NULL OR
      cb.transaction_id LIKE ${search} OR cb.description LIKE ${search})
  `) as { count: number }[]

  const total = toNum(countRows[0]?.count)
  const page = clampPage(requestedPage, total, pageSize)
  const offset = pageOffset(page, pageSize)

  const rows = (await sql`
    SELECT cb.*, a.name AS account_name
    FROM cash_book cb
    LEFT JOIN finance_accounts a ON a.id = cb.account_id
    WHERE cb.ledger_scope = 'office'
    AND (${accountId} IS NULL OR cb.account_id = ${accountId})
    AND (${from} IS NULL OR cb.entry_date >= ${from})
    AND (${to} IS NULL OR cb.entry_date <= ${to})
    AND (${search} IS NULL OR
      cb.transaction_id LIKE ${search} OR cb.description LIKE ${search})
    ORDER BY cb.entry_date DESC, cb.id DESC
    LIMIT ${pageSize === -1 ? 10000 : pageSize} OFFSET ${offset}
  `) as CashBookEntry[]

  const first = (await sql`
    SELECT balance FROM cash_book
    WHERE ledger_scope = 'office'
    AND (${accountId} IS NULL OR account_id = ${accountId})
    ORDER BY id ASC LIMIT 1
  `) as { balance: number }[]
  const last = (await sql`
    SELECT balance FROM cash_book
    WHERE ledger_scope = 'office'
    AND (${accountId} IS NULL OR account_id = ${accountId})
    ORDER BY id DESC LIMIT 1
  `) as { balance: number }[]

  return {
    ...toPaginatedResult(rows, total, page, pageSize === -1 ? total || 1 : pageSize),
    openingBalance: toNum(first[0]?.balance),
    closingBalance: toNum(last[0]?.balance),
  }
}

export async function getProjectLedgerPaginated(
  projectId: number,
  params: PaginationParams = {},
): Promise<PaginatedResult<ProjectLedgerEntry>> {
  const requestedPage = parsePage(params.page)
  const pageSize = parsePageSize(params.pageSize)
  const search = buildSearchPattern(params.search)

  const countRows = (await sql`
    SELECT COUNT(*) AS count FROM project_ledger pl
    WHERE pl.project_id = ${projectId}
    AND (${search} IS NULL OR
      pl.transaction_id LIKE ${search} OR pl.description LIKE ${search})
  `) as { count: number }[]
  const total = toNum(countRows[0]?.count)
  const page = clampPage(requestedPage, total, pageSize)
  const offset = pageOffset(page, pageSize)

  const rows = (await sql`
    SELECT pl.*, p.name AS project_name, p.code AS project_code
    FROM project_ledger pl
    JOIN projects p ON p.id = pl.project_id
    WHERE pl.project_id = ${projectId}
    AND (${search} IS NULL OR
      pl.transaction_id LIKE ${search} OR pl.description LIKE ${search})
    ORDER BY pl.entry_date DESC, pl.id DESC
    LIMIT ${pageSize === -1 ? 10000 : pageSize} OFFSET ${offset}
  `) as ProjectLedgerEntry[]

  return toPaginatedResult(rows, total, page, pageSize === -1 ? total || 1 : pageSize)
}

export async function getProjectBudget(projectId: number): Promise<ProjectBudget[]> {
  return (await sql`
    SELECT pb.*,
      COALESCE((
        SELECT SUM(pe.amount + pe.gst_amount)
        FROM project_expenses pe
        LEFT JOIN expense_categories ec ON ec.id = pe.category_id
        WHERE pe.project_id = pb.project_id AND pe.deleted_at IS NULL
          AND pe.status IN ('Approved', 'Paid')
          AND (
            ec.name = pb.category
            OR (pb.category = 'Miscellaneous' AND pe.category_id IS NULL)
          )
      ), 0) AS spent_amount
    FROM project_budget pb
    WHERE pb.project_id = ${projectId} AND pb.deleted_at IS NULL
    ORDER BY pb.category ASC
  `) as ProjectBudget[]
}

// ---------------------------------------------------------------------------
// Salary
// ---------------------------------------------------------------------------

export async function getSalaryPaginated(
  params: PaginationParams & { status?: string; staffId?: string } = {},
): Promise<PaginatedResult<SalaryPayroll>> {
  const requestedPage = parsePage(params.page)
  const pageSize = parsePageSize(params.pageSize)
  const search = buildSearchPattern(params.search)
  const status = params.status?.trim() || null
  const staffId = params.staffId ? Number(params.staffId) : null

  const countRows = (await sql`
    SELECT COUNT(*) AS count
    FROM salary_payroll s
    LEFT JOIN app_users u ON u.id = s.staff_id
    WHERE s.deleted_at IS NULL
    AND (${search} IS NULL OR
      s.payslip_number LIKE ${search} OR u.name LIKE ${search} OR s.pay_period LIKE ${search})
    AND (${status} IS NULL OR s.status = ${status})
    AND (${staffId} IS NULL OR s.staff_id = ${staffId})
  `) as { count: number }[]

  const total = toNum(countRows[0]?.count)
  const page = clampPage(requestedPage, total, pageSize)
  const offset = pageOffset(page, pageSize)

  const rows = (await sql`
    SELECT s.*, u.name AS staff_name, a.name AS account_name
    FROM salary_payroll s
    LEFT JOIN app_users u ON u.id = s.staff_id
    LEFT JOIN finance_accounts a ON a.id = s.account_id
    WHERE s.deleted_at IS NULL
    AND (${search} IS NULL OR
      s.payslip_number LIKE ${search} OR u.name LIKE ${search} OR s.pay_period LIKE ${search})
    AND (${status} IS NULL OR s.status = ${status})
    AND (${staffId} IS NULL OR s.staff_id = ${staffId})
    ORDER BY s.pay_date DESC, s.id DESC
    LIMIT ${pageSize === -1 ? 10000 : pageSize} OFFSET ${offset}
  `) as SalaryPayroll[]

  return toPaginatedResult(rows, total, page, pageSize === -1 ? total || 1 : pageSize)
}

export async function getSalaryById(id: number): Promise<SalaryPayroll | null> {
  const rows = (await sql`
    SELECT s.*, u.name AS staff_name, a.name AS account_name
    FROM salary_payroll s
    LEFT JOIN app_users u ON u.id = s.staff_id
    LEFT JOIN finance_accounts a ON a.id = s.account_id
    WHERE s.id = ${id} AND s.deleted_at IS NULL
  `) as SalaryPayroll[]
  return rows[0] ?? null
}

// ---------------------------------------------------------------------------
// Transfers
// ---------------------------------------------------------------------------

export async function getTransfersPaginated(
  params: PaginationParams = {},
): Promise<PaginatedResult<BankTransfer>> {
  const requestedPage = parsePage(params.page)
  const pageSize = parsePageSize(params.pageSize)
  const search = buildSearchPattern(params.search)

  const countRows = (await sql`
    SELECT COUNT(*) AS count FROM bank_transfers t
    LEFT JOIN finance_accounts fa ON fa.id = t.from_account_id
    LEFT JOIN finance_accounts ta ON ta.id = t.to_account_id
    WHERE t.deleted_at IS NULL
    AND (${search} IS NULL OR
      t.transfer_number LIKE ${search} OR fa.name LIKE ${search} OR
      ta.name LIKE ${search} OR t.reference LIKE ${search})
  `) as { count: number }[]
  const total = toNum(countRows[0]?.count)
  const page = clampPage(requestedPage, total, pageSize)
  const offset = pageOffset(page, pageSize)

  const rows = (await sql`
    SELECT t.*,
      fa.name AS from_account_name,
      ta.name AS to_account_name,
      u.name AS creator_name
    FROM bank_transfers t
    LEFT JOIN finance_accounts fa ON fa.id = t.from_account_id
    LEFT JOIN finance_accounts ta ON ta.id = t.to_account_id
    LEFT JOIN app_users u ON u.id = t.created_by
    WHERE t.deleted_at IS NULL
    AND (${search} IS NULL OR
      t.transfer_number LIKE ${search} OR fa.name LIKE ${search} OR
      ta.name LIKE ${search} OR t.reference LIKE ${search})
    ORDER BY t.transfer_date DESC, t.id DESC
    LIMIT ${pageSize === -1 ? 10000 : pageSize} OFFSET ${offset}
  `) as BankTransfer[]

  return toPaginatedResult(rows, total, page, pageSize === -1 ? total || 1 : pageSize)
}

// ---------------------------------------------------------------------------
// Staff claims
// ---------------------------------------------------------------------------

export async function getStaffClaimsPaginated(
  params: PaginationParams & { status?: string; staffId?: string } = {},
): Promise<PaginatedResult<StaffExpenseClaim>> {
  const requestedPage = parsePage(params.page)
  const pageSize = parsePageSize(params.pageSize)
  const search = buildSearchPattern(params.search)
  const status = params.status?.trim() || null
  const staffId = params.staffId ? Number(params.staffId) : null

  const countRows = (await sql`
    SELECT COUNT(*) AS count
    FROM staff_expenses s
    LEFT JOIN app_users u ON u.id = s.staff_id
    LEFT JOIN projects p ON p.id = s.project_id
    WHERE s.deleted_at IS NULL
    AND (${search} IS NULL OR
      s.claim_number LIKE ${search} OR u.name LIKE ${search} OR
      s.category LIKE ${search} OR p.name LIKE ${search} OR p.code LIKE ${search})
    AND (${status} IS NULL OR s.status = ${status})
    AND (${staffId} IS NULL OR s.staff_id = ${staffId})
  `) as { count: number }[]

  const total = toNum(countRows[0]?.count)
  const page = clampPage(requestedPage, total, pageSize)
  const offset = pageOffset(page, pageSize)

  const rows = (await sql`
    SELECT s.*,
      u.name AS staff_name,
      p.name AS project_name, p.code AS project_code,
      a.name AS account_name
    FROM staff_expenses s
    LEFT JOIN app_users u ON u.id = s.staff_id
    LEFT JOIN projects p ON p.id = s.project_id
    LEFT JOIN finance_accounts a ON a.id = s.account_id
    WHERE s.deleted_at IS NULL
    AND (${search} IS NULL OR
      s.claim_number LIKE ${search} OR u.name LIKE ${search} OR
      s.category LIKE ${search} OR p.name LIKE ${search} OR p.code LIKE ${search})
    AND (${status} IS NULL OR s.status = ${status})
    AND (${staffId} IS NULL OR s.staff_id = ${staffId})
    ORDER BY s.claim_date DESC, s.id DESC
    LIMIT ${pageSize === -1 ? 10000 : pageSize} OFFSET ${offset}
  `) as StaffExpenseClaim[]

  return toPaginatedResult(rows, total, page, pageSize === -1 ? total || 1 : pageSize)
}

export async function getStaffClaimById(id: number): Promise<StaffExpenseClaim | null> {
  const rows = (await sql`
    SELECT s.*,
      u.name AS staff_name,
      p.name AS project_name, p.code AS project_code,
      a.name AS account_name
    FROM staff_expenses s
    LEFT JOIN app_users u ON u.id = s.staff_id
    LEFT JOIN projects p ON p.id = s.project_id
    LEFT JOIN finance_accounts a ON a.id = s.account_id
    WHERE s.id = ${id} AND s.deleted_at IS NULL
  `) as StaffExpenseClaim[]
  return rows[0] ?? null
}

export async function getApprovalLogs(
  entityType: string,
  entityId: number,
): Promise<ApprovalLog[]> {
  return (await sql`
    SELECT al.*, u.name AS user_name
    FROM approval_logs al
    LEFT JOIN app_users u ON u.id = al.user_id
    WHERE al.entity_type = ${entityType} AND al.entity_id = ${entityId}
    ORDER BY al.created_at ASC, al.id ASC
  `) as ApprovalLog[]
}

// ---------------------------------------------------------------------------
// Project finance
// ---------------------------------------------------------------------------

export async function getProjectFinanceList(
  params: PaginationParams = {},
): Promise<PaginatedResult<ProjectFinanceSummary>> {
  const requestedPage = parsePage(params.page)
  const pageSize = parsePageSize(params.pageSize)
  const search = buildSearchPattern(params.search)

  const countRows = (await sql`
    SELECT COUNT(*) AS count FROM projects p
    LEFT JOIN clients c ON c.id = p.client_id
    WHERE (${search} IS NULL OR
      p.name LIKE ${search} OR p.code LIKE ${search} OR c.name LIKE ${search})
  `) as { count: number }[]
  const total = toNum(countRows[0]?.count)
  const page = clampPage(requestedPage, total, pageSize)
  const offset = pageOffset(page, pageSize)

  const rows = (await sql`
    SELECT
      p.id AS project_id,
      p.name AS project_name,
      p.code AS project_code,
      c.name AS client_name,
      COALESCE(pf.project_value, p.project_amount, 0) AS project_value,
      COALESCE(pf.total_income, 0) AS total_income,
      COALESCE(pf.total_expense, 0) AS total_expense,
      COALESCE(pf.total_budget, 0) AS total_budget,
      COALESCE(pf.advance_received, p.advance_received, 0) AS advance_received,
      COALESCE(pf.balance_amount, p.project_amount - p.advance_received, 0) AS balance_amount,
      COALESCE(pf.net_profit, 0) AS net_profit,
      COALESCE(pf.profit_percent, 0) AS profit_percent,
      COALESCE(pf.budget_used_percent, 0) AS budget_used_percent,
      pf.updated_at
    FROM projects p
    LEFT JOIN clients c ON c.id = p.client_id
    LEFT JOIN project_finance pf ON pf.project_id = p.id
    WHERE (${search} IS NULL OR
      p.name LIKE ${search} OR p.code LIKE ${search} OR c.name LIKE ${search})
    ORDER BY p.updated_at DESC
    LIMIT ${pageSize === -1 ? 10000 : pageSize} OFFSET ${offset}
  `) as ProjectFinanceSummary[]

  return toPaginatedResult(rows, total, page, pageSize === -1 ? total || 1 : pageSize)
}

export async function getProjectFinanceDetail(projectId: number): Promise<{
  summary: ProjectFinanceSummary | null
  income: FinanceIncome[]
  expenses: FinanceExpense[]
  budget: ProjectBudget[]
}> {
  const summaryRows = (await sql`
    SELECT
      p.id AS project_id,
      p.name AS project_name,
      p.code AS project_code,
      c.name AS client_name,
      COALESCE(pf.project_value, p.project_amount, 0) AS project_value,
      COALESCE(pf.total_income, 0) AS total_income,
      COALESCE(pf.total_expense, 0) AS total_expense,
      COALESCE(pf.total_budget, 0) AS total_budget,
      COALESCE(pf.advance_received, p.advance_received, 0) AS advance_received,
      COALESCE(pf.balance_amount, p.project_amount - p.advance_received, 0) AS balance_amount,
      COALESCE(pf.net_profit, 0) AS net_profit,
      COALESCE(pf.profit_percent, 0) AS profit_percent,
      COALESCE(pf.budget_used_percent, 0) AS budget_used_percent,
      pf.updated_at
    FROM projects p
    LEFT JOIN clients c ON c.id = p.client_id
    LEFT JOIN project_finance pf ON pf.project_id = p.id
    WHERE p.id = ${projectId}
  `) as ProjectFinanceSummary[]

  const income = (await sql`
    SELECT i.*, cat.name AS category_name, cat.color AS category_color, 'project' AS ledger_scope
    FROM project_income i
    LEFT JOIN income_categories cat ON cat.id = i.category_id
    WHERE i.project_id = ${projectId} AND i.deleted_at IS NULL
    ORDER BY i.income_date DESC
  `) as FinanceIncome[]

  const expenses = (await sql`
    SELECT e.*, cat.name AS category_name, cat.color AS category_color,
      v.name AS vendor_name, 'project' AS ledger_scope
    FROM project_expenses e
    LEFT JOIN expense_categories cat ON cat.id = e.category_id
    LEFT JOIN vendors v ON v.id = e.vendor_id
    WHERE e.project_id = ${projectId} AND e.deleted_at IS NULL
    ORDER BY e.expense_date DESC
  `) as FinanceExpense[]

  const budget = await getProjectBudget(projectId)

  return { summary: summaryRows[0] ?? null, income, expenses, budget }
}

export async function getProjectDashboard(projectId: number): Promise<FinanceDashboardOverview & {
  projectValue: number
  totalBudget: number
  budgetUsedPercent: number
}> {
  const detail = await getProjectFinanceDetail(projectId)
  const summary = detail.summary
  const today = new Date().toISOString().slice(0, 10)
  const monthStart = `${today.slice(0, 7)}-01`

  const [todayInc, todayExp, monthInc, monthExp] = await Promise.all([
    sql`SELECT COALESCE(SUM(amount),0) AS t FROM project_income WHERE deleted_at IS NULL AND status='Approved' AND project_id=${projectId} AND income_date=${today}`,
    sql`SELECT COALESCE(SUM(amount+gst_amount),0) AS t FROM project_expenses WHERE deleted_at IS NULL AND status IN ('Approved','Paid') AND project_id=${projectId} AND expense_date=${today}`,
    sql`SELECT COALESCE(SUM(amount),0) AS t FROM project_income WHERE deleted_at IS NULL AND status='Approved' AND project_id=${projectId} AND income_date>=${monthStart}`,
    sql`SELECT COALESCE(SUM(amount+gst_amount),0) AS t FROM project_expenses WHERE deleted_at IS NULL AND status IN ('Approved','Paid') AND project_id=${projectId} AND expense_date>=${monthStart}`,
  ]) as [{ t: unknown }[], { t: unknown }[], { t: unknown }[], { t: unknown }[]]

  const monthlyIncome = toNum(monthInc[0]?.t)
  const monthlyExpense = toNum(monthExp[0]?.t)

  return {
    todayIncome: toNum(todayInc[0]?.t),
    todayExpense: toNum(todayExp[0]?.t),
    monthlyIncome,
    monthlyExpense,
    cashBalance: 0,
    bankBalance: 0,
    outstandingReceivables: toNum(summary?.balance_amount ?? 0),
    outstandingPayables: 0,
    netProfit: toNum(summary?.net_profit ?? monthlyIncome - monthlyExpense),
    pendingApprovals: 0,
    upcomingPayments: 0,
    projectValue: toNum(summary?.project_value ?? 0),
    totalBudget: toNum(summary?.total_budget ?? 0),
    budgetUsedPercent: toNum(summary?.budget_used_percent ?? 0),
  }
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export async function getOfficeDashboardOverview(): Promise<FinanceDashboardOverview> {
  const today = new Date().toISOString().slice(0, 10)
  const monthStart = `${today.slice(0, 7)}-01`

  const [todayInc, todayExp, monthInc, monthExp, accounts, payables, pending, upcoming] =
    await Promise.all([
      sql`SELECT COALESCE(SUM(amount),0) AS t FROM office_income WHERE deleted_at IS NULL AND status='Approved' AND income_date=${today}`,
      sql`SELECT COALESCE(SUM(amount+gst_amount),0) AS t FROM office_expenses WHERE deleted_at IS NULL AND status IN ('Approved','Paid') AND expense_date=${today}`,
      sql`SELECT COALESCE(SUM(amount),0) AS t FROM office_income WHERE deleted_at IS NULL AND status='Approved' AND income_date>=${monthStart}`,
      sql`SELECT COALESCE(SUM(amount+gst_amount),0) AS t FROM office_expenses WHERE deleted_at IS NULL AND status IN ('Approved','Paid') AND expense_date>=${monthStart}`,
      sql`SELECT account_type, current_balance FROM finance_accounts WHERE deleted_at IS NULL AND active=1`,
      sql`SELECT COALESCE(SUM(outstanding_balance),0) AS t FROM vendors WHERE deleted_at IS NULL`,
      sql`SELECT (
        (SELECT COUNT(*) FROM office_expenses WHERE deleted_at IS NULL AND status IN ('Submitted','Draft')) +
        (SELECT COUNT(*) FROM staff_expenses WHERE deleted_at IS NULL AND status IN ('Submitted','Dept Review','Admin Approval'))
      ) AS t`,
      sql`SELECT COUNT(*) AS t FROM office_expenses WHERE deleted_at IS NULL AND status='Approved' AND paid_at IS NULL`,
    ]) as [
      { t: unknown }[],
      { t: unknown }[],
      { t: unknown }[],
      { t: unknown }[],
      { account_type: string; current_balance: unknown }[],
      { t: unknown }[],
      { t: unknown }[],
      { t: unknown }[],
    ]

  let cashBalance = 0
  let bankBalance = 0
  for (const a of accounts) {
    const bal = toNum(a.current_balance)
    const type = String(a.account_type)
    if (isCashAccountType(type)) cashBalance += bal
    else if (isBankAccountType(type)) bankBalance += bal
    else bankBalance += bal
  }

  const monthlyIncome = toNum(monthInc[0]?.t)
  const monthlyExpense = toNum(monthExp[0]?.t)

  return {
    todayIncome: toNum(todayInc[0]?.t),
    todayExpense: toNum(todayExp[0]?.t),
    monthlyIncome,
    monthlyExpense,
    cashBalance,
    bankBalance,
    outstandingReceivables: 0,
    outstandingPayables: toNum(payables[0]?.t),
    netProfit: monthlyIncome - monthlyExpense,
    pendingApprovals: toNum(pending[0]?.t),
    upcomingPayments: toNum(upcoming[0]?.t),
  }
}

export async function getFinanceDashboardOverview(): Promise<FinanceDashboardOverview> {
  return getOfficeDashboardOverview()
}

export async function getFinanceChartData(scope: LedgerScope = "office"): Promise<{
  monthlyIncomeExpense: FinanceChartPoint[]
  expenseByCategory: FinanceChartPoint[]
  incomeByCategory: FinanceChartPoint[]
  projectProfit: FinanceChartPoint[]
  cashFlow: FinanceChartPoint[]
  paymentMethods: FinanceChartPoint[]
}> {
  if (scope === "project") return getProjectChartData()

  const monthly = (await sql`
    SELECT m.label,
      COALESCE(i.total, 0) AS income,
      COALESCE(e.total, 0) AS expense
    FROM (
      SELECT DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL n MONTH), '%Y-%m') AS ym,
             DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL n MONTH), '%b %Y') AS label
      FROM (
        SELECT 0 AS n UNION SELECT 1 UNION SELECT 2 UNION SELECT 3
        UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7
        UNION SELECT 8 UNION SELECT 9 UNION SELECT 10 UNION SELECT 11
      ) months
    ) m
    LEFT JOIN (
      SELECT DATE_FORMAT(income_date, '%Y-%m') AS ym, SUM(amount) AS total
      FROM office_income WHERE deleted_at IS NULL AND status='Approved'
      GROUP BY ym
    ) i ON i.ym = m.ym
    LEFT JOIN (
      SELECT DATE_FORMAT(expense_date, '%Y-%m') AS ym, SUM(amount+gst_amount) AS total
      FROM office_expenses WHERE deleted_at IS NULL AND status IN ('Approved','Paid')
      GROUP BY ym
    ) e ON e.ym = m.ym
    ORDER BY m.ym ASC
  `) as { label: string; income: number; expense: number }[]

  const expenseByCategory = (await sql`
    SELECT cat.name, cat.color, COALESCE(SUM(e.amount + e.gst_amount), 0) AS value
    FROM expense_categories cat
    LEFT JOIN office_expenses e ON e.category_id = cat.id
      AND e.deleted_at IS NULL AND e.status IN ('Approved','Paid')
    GROUP BY cat.id
    HAVING value > 0
    ORDER BY value DESC
    LIMIT 10
  `) as { name: string; color: string; value: number }[]

  const incomeByCategory = (await sql`
    SELECT cat.name, cat.color, COALESCE(SUM(i.amount), 0) AS value
    FROM income_categories cat
    LEFT JOIN office_income i ON i.category_id = cat.id
      AND i.deleted_at IS NULL AND i.status='Approved'
    GROUP BY cat.id
    HAVING value > 0
    ORDER BY value DESC
    LIMIT 10
  `) as { name: string; color: string; value: number }[]

  const projectProfit = (await sql`
    SELECT p.name, COALESCE(pf.net_profit, 0) AS profit
    FROM project_finance pf
    JOIN projects p ON p.id = pf.project_id
    ORDER BY pf.net_profit DESC
    LIMIT 8
  `) as { name: string; profit: number }[]

  const cashFlow = monthly.map((m) => ({
    label: m.label,
    amount: toNum(m.income) - toNum(m.expense),
  }))

  const paymentMethods = (await sql`
    SELECT payment_method AS name, SUM(amount) AS value FROM (
      SELECT payment_method, amount FROM office_income
      WHERE deleted_at IS NULL AND status='Approved'
      UNION ALL
      SELECT payment_method, amount + gst_amount FROM office_expenses
      WHERE deleted_at IS NULL AND status IN ('Approved','Paid')
    ) t
    GROUP BY payment_method
    ORDER BY value DESC
  `) as { name: string; value: number }[]

  return {
    monthlyIncomeExpense: monthly.map((m) => ({
      label: m.label,
      income: toNum(m.income),
      expense: toNum(m.expense),
    })),
    expenseByCategory: expenseByCategory.map((r) => ({
      name: r.name,
      value: toNum(r.value),
      color: r.color,
      label: r.name,
      amount: toNum(r.value),
    })),
    incomeByCategory: incomeByCategory.map((r) => ({
      name: r.name,
      value: toNum(r.value),
      color: r.color,
      label: r.name,
      amount: toNum(r.value),
    })),
    projectProfit: projectProfit.map((r) => ({
      label: r.name,
      name: r.name,
      profit: toNum(r.profit),
      amount: toNum(r.profit),
    })),
    cashFlow,
    paymentMethods: paymentMethods.map((r) => ({
      name: r.name,
      label: r.name,
      value: toNum(r.value),
      amount: toNum(r.value),
    })),
  }
}

export async function getProjectChartData(): Promise<{
  monthlyIncomeExpense: FinanceChartPoint[]
  expenseByCategory: FinanceChartPoint[]
  incomeByCategory: FinanceChartPoint[]
  projectProfit: FinanceChartPoint[]
  cashFlow: FinanceChartPoint[]
  paymentMethods: FinanceChartPoint[]
}> {
  const monthly = (await sql`
    SELECT m.label,
      COALESCE(i.total, 0) AS income,
      COALESCE(e.total, 0) AS expense
    FROM (
      SELECT DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL n MONTH), '%Y-%m') AS ym,
             DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL n MONTH), '%b %Y') AS label
      FROM (
        SELECT 0 AS n UNION SELECT 1 UNION SELECT 2 UNION SELECT 3
        UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7
        UNION SELECT 8 UNION SELECT 9 UNION SELECT 10 UNION SELECT 11
      ) months
    ) m
    LEFT JOIN (
      SELECT DATE_FORMAT(income_date, '%Y-%m') AS ym, SUM(amount) AS total
      FROM project_income WHERE deleted_at IS NULL AND status='Approved'
      GROUP BY ym
    ) i ON i.ym = m.ym
    LEFT JOIN (
      SELECT DATE_FORMAT(expense_date, '%Y-%m') AS ym, SUM(amount+gst_amount) AS total
      FROM project_expenses WHERE deleted_at IS NULL AND status IN ('Approved','Paid')
      GROUP BY ym
    ) e ON e.ym = m.ym
    ORDER BY m.ym ASC
  `) as { label: string; income: number; expense: number }[]

  const expenseByCategory = (await sql`
    SELECT cat.name, cat.color, COALESCE(SUM(e.amount + e.gst_amount), 0) AS value
    FROM expense_categories cat
    LEFT JOIN project_expenses e ON e.category_id = cat.id
      AND e.deleted_at IS NULL AND e.status IN ('Approved','Paid')
    GROUP BY cat.id
    HAVING value > 0
    ORDER BY value DESC
    LIMIT 10
  `) as { name: string; color: string; value: number }[]

  const incomeByCategory = (await sql`
    SELECT cat.name, cat.color, COALESCE(SUM(i.amount), 0) AS value
    FROM income_categories cat
    LEFT JOIN project_income i ON i.category_id = cat.id
      AND i.deleted_at IS NULL AND i.status='Approved'
    GROUP BY cat.id
    HAVING value > 0
    ORDER BY value DESC
    LIMIT 10
  `) as { name: string; color: string; value: number }[]

  const projectProfit = (await sql`
    SELECT p.name, COALESCE(pf.net_profit, 0) AS profit
    FROM project_finance pf
    JOIN projects p ON p.id = pf.project_id
    ORDER BY pf.net_profit DESC
    LIMIT 8
  `) as { name: string; profit: number }[]

  const cashFlow = monthly.map((m) => ({
    label: m.label,
    amount: toNum(m.income) - toNum(m.expense),
  }))

  const paymentMethods = (await sql`
    SELECT payment_method AS name, SUM(amount) AS value FROM (
      SELECT payment_method, amount FROM project_income
      WHERE deleted_at IS NULL AND status='Approved'
      UNION ALL
      SELECT payment_method, amount + gst_amount FROM project_expenses
      WHERE deleted_at IS NULL AND status IN ('Approved','Paid')
    ) t
    GROUP BY payment_method
    ORDER BY value DESC
  `) as { name: string; value: number }[]

  return {
    monthlyIncomeExpense: monthly.map((m) => ({
      label: m.label,
      income: toNum(m.income),
      expense: toNum(m.expense),
    })),
    expenseByCategory: expenseByCategory.map((r) => ({
      name: r.name,
      value: toNum(r.value),
      color: r.color,
      label: r.name,
      amount: toNum(r.value),
    })),
    incomeByCategory: incomeByCategory.map((r) => ({
      name: r.name,
      value: toNum(r.value),
      color: r.color,
      label: r.name,
      amount: toNum(r.value),
    })),
    projectProfit: projectProfit.map((r) => ({
      label: r.name,
      name: r.name,
      profit: toNum(r.profit),
      amount: toNum(r.profit),
    })),
    cashFlow,
    paymentMethods: paymentMethods.map((r) => ({
      name: r.name,
      label: r.name,
      value: toNum(r.value),
      amount: toNum(r.value),
    })),
  }
}

export async function getFinanceRecentActivity(scope: LedgerScope = "office"): Promise<{
  latestIncome: FinanceIncome[]
  latestExpenses: FinanceExpense[]
  pendingApprovals: Array<FinanceExpense | StaffExpenseClaim>
  upcomingPayments: FinanceExpense[]
}> {
  const incomeTable = scope === "project" ? "project_income" : "office_income"
  const expenseTable = scope === "project" ? "project_expenses" : "office_expenses"

  const latestIncome =
    scope === "project"
      ? ((await sql`
          SELECT i.*, c.name AS client_name, cat.name AS category_name, p.name AS project_name
          FROM project_income i
          LEFT JOIN clients c ON c.id = i.client_id
          LEFT JOIN income_categories cat ON cat.id = i.category_id
          LEFT JOIN projects p ON p.id = i.project_id
          WHERE i.deleted_at IS NULL
          ORDER BY i.created_at DESC LIMIT 5
        `) as FinanceIncome[])
      : ((await sql`
          SELECT i.*, cat.name AS category_name
          FROM office_income i
          LEFT JOIN income_categories cat ON cat.id = i.category_id
          WHERE i.deleted_at IS NULL
          ORDER BY i.created_at DESC LIMIT 5
        `) as FinanceIncome[])

  void incomeTable

  const latestExpenses =
    scope === "project"
      ? ((await sql`
          SELECT e.*, v.name AS vendor_name, cat.name AS category_name, p.name AS project_name
          FROM project_expenses e
          LEFT JOIN vendors v ON v.id = e.vendor_id
          LEFT JOIN expense_categories cat ON cat.id = e.category_id
          LEFT JOIN projects p ON p.id = e.project_id
          WHERE e.deleted_at IS NULL
          ORDER BY e.created_at DESC LIMIT 5
        `) as FinanceExpense[])
      : ((await sql`
          SELECT e.*, v.name AS vendor_name, cat.name AS category_name
          FROM office_expenses e
          LEFT JOIN vendors v ON v.id = e.vendor_id
          LEFT JOIN expense_categories cat ON cat.id = e.category_id
          WHERE e.deleted_at IS NULL
          ORDER BY e.created_at DESC LIMIT 5
        `) as FinanceExpense[])

  void expenseTable

  const pendingExpenses =
    scope === "project"
      ? ((await sql`
          SELECT e.*, v.name AS vendor_name, cat.name AS category_name
          FROM project_expenses e
          LEFT JOIN vendors v ON v.id = e.vendor_id
          LEFT JOIN expense_categories cat ON cat.id = e.category_id
          WHERE e.deleted_at IS NULL AND e.status IN ('Submitted','Draft')
          ORDER BY e.created_at DESC LIMIT 5
        `) as FinanceExpense[])
      : ((await sql`
          SELECT e.*, v.name AS vendor_name, cat.name AS category_name
          FROM office_expenses e
          LEFT JOIN vendors v ON v.id = e.vendor_id
          LEFT JOIN expense_categories cat ON cat.id = e.category_id
          WHERE e.deleted_at IS NULL AND e.status IN ('Submitted','Draft')
          ORDER BY e.created_at DESC LIMIT 5
        `) as FinanceExpense[])

  const pendingClaims =
    scope === "office"
      ? ((await sql`
          SELECT s.*, u.name AS staff_name
          FROM staff_expenses s
          LEFT JOIN app_users u ON u.id = s.staff_id
          WHERE s.deleted_at IS NULL AND s.status IN ('Submitted','Dept Review','Admin Approval')
          ORDER BY s.created_at DESC LIMIT 5
        `) as StaffExpenseClaim[])
      : []

  const upcomingPayments =
    scope === "project"
      ? ((await sql`
          SELECT e.*, v.name AS vendor_name, cat.name AS category_name
          FROM project_expenses e
          LEFT JOIN vendors v ON v.id = e.vendor_id
          LEFT JOIN expense_categories cat ON cat.id = e.category_id
          WHERE e.deleted_at IS NULL AND e.status = 'Approved'
          ORDER BY e.expense_date ASC LIMIT 5
        `) as FinanceExpense[])
      : ((await sql`
          SELECT e.*, v.name AS vendor_name, cat.name AS category_name
          FROM office_expenses e
          LEFT JOIN vendors v ON v.id = e.vendor_id
          LEFT JOIN expense_categories cat ON cat.id = e.category_id
          WHERE e.deleted_at IS NULL AND e.status = 'Approved'
          ORDER BY e.expense_date ASC LIMIT 5
        `) as FinanceExpense[])

  return {
    latestIncome,
    latestExpenses,
    pendingApprovals: [...pendingExpenses, ...pendingClaims],
    upcomingPayments,
  }
}

export async function getFinanceWidgets(scope: LedgerScope = "office") {
  const overview = await getOfficeDashboardOverview()

  const topExpense =
    scope === "project"
      ? ((await sql`
          SELECT cat.name, COALESCE(SUM(e.amount+e.gst_amount),0) AS total
          FROM expense_categories cat
          JOIN project_expenses e ON e.category_id = cat.id
            AND e.deleted_at IS NULL AND e.status IN ('Approved','Paid')
          GROUP BY cat.id ORDER BY total DESC LIMIT 5
        `) as { name: string; total: number }[])
      : ((await sql`
          SELECT cat.name, COALESCE(SUM(e.amount+e.gst_amount),0) AS total
          FROM expense_categories cat
          JOIN office_expenses e ON e.category_id = cat.id
            AND e.deleted_at IS NULL AND e.status IN ('Approved','Paid')
          GROUP BY cat.id ORDER BY total DESC LIMIT 5
        `) as { name: string; total: number }[])

  const topClients =
    scope === "project"
      ? ((await sql`
          SELECT c.name, COALESCE(SUM(i.amount),0) AS total
          FROM clients c
          JOIN project_income i ON i.client_id = c.id AND i.deleted_at IS NULL AND i.status='Approved'
          GROUP BY c.id ORDER BY total DESC LIMIT 5
        `) as { name: string; total: number }[])
      : []

  const recentTxns = (await sql`
    SELECT * FROM finance_transactions
    WHERE deleted_at IS NULL AND ledger_scope = ${scope}
    ORDER BY created_at DESC LIMIT 8
  `) as FinanceTransaction[]

  return { overview, topExpense, topClients, recentTxns }
}

export async function searchFinanceGlobal(q: string, limit = 20) {
  const search = buildSearchPattern(q)
  if (!search) return []

  const projectIncome = (await sql`
    SELECT 'income' AS kind, i.id, i.receipt_number AS code, i.amount,
           COALESCE(c.name, p.name, '') AS label, i.income_date AS entry_date,
           'project' AS ledger_scope
    FROM project_income i
    LEFT JOIN clients c ON c.id = i.client_id
    LEFT JOIN projects p ON p.id = i.project_id
    WHERE i.deleted_at IS NULL AND (
      i.receipt_number LIKE ${search} OR c.name LIKE ${search} OR p.name LIKE ${search}
      OR CAST(i.amount AS CHAR) LIKE ${search}
    )
    ORDER BY i.income_date DESC LIMIT ${limit}
  `) as Array<Record<string, unknown>>

  const officeIncome = (await sql`
    SELECT 'income' AS kind, i.id, i.receipt_number AS code, i.amount,
           COALESCE(cat.name, 'Office') AS label, i.income_date AS entry_date,
           'office' AS ledger_scope
    FROM office_income i
    LEFT JOIN income_categories cat ON cat.id = i.category_id
    WHERE i.deleted_at IS NULL AND (
      i.receipt_number LIKE ${search} OR cat.name LIKE ${search}
      OR CAST(i.amount AS CHAR) LIKE ${search}
    )
    ORDER BY i.income_date DESC LIMIT ${limit}
  `) as Array<Record<string, unknown>>

  const projectExpenses = (await sql`
    SELECT 'expense' AS kind, e.id, e.expense_number AS code, e.amount,
           COALESCE(v.name, p.name, '') AS label, e.expense_date AS entry_date,
           'project' AS ledger_scope
    FROM project_expenses e
    LEFT JOIN vendors v ON v.id = e.vendor_id
    LEFT JOIN projects p ON p.id = e.project_id
    WHERE e.deleted_at IS NULL AND (
      e.expense_number LIKE ${search} OR v.name LIKE ${search} OR p.name LIKE ${search}
      OR CAST(e.amount AS CHAR) LIKE ${search}
    )
    ORDER BY e.expense_date DESC LIMIT ${limit}
  `) as Array<Record<string, unknown>>

  const officeExpenses = (await sql`
    SELECT 'expense' AS kind, e.id, e.expense_number AS code, e.amount,
           COALESCE(v.name, '') AS label, e.expense_date AS entry_date,
           'office' AS ledger_scope
    FROM office_expenses e
    LEFT JOIN vendors v ON v.id = e.vendor_id
    WHERE e.deleted_at IS NULL AND (
      e.expense_number LIKE ${search} OR v.name LIKE ${search}
      OR CAST(e.amount AS CHAR) LIKE ${search}
    )
    ORDER BY e.expense_date DESC LIMIT ${limit}
  `) as Array<Record<string, unknown>>

  const vendors = (await sql`
    SELECT 'vendor' AS kind, id, name AS code, outstanding_balance AS amount,
           name AS label, created_at AS entry_date, 'office' AS ledger_scope
    FROM vendors
    WHERE deleted_at IS NULL AND (name LIKE ${search} OR phone LIKE ${search} OR gst LIKE ${search})
    LIMIT ${limit}
  `) as Array<Record<string, unknown>>

  return [...projectIncome, ...officeIncome, ...projectExpenses, ...officeExpenses, ...vendors].slice(
    0,
    limit,
  )
}

export async function getFinanceSettings(): Promise<Record<string, unknown>> {
  const rows = (await sql`SELECT \`key\`, value FROM finance_settings`) as {
    key: string
    value: unknown
  }[]
  const out: Record<string, unknown> = {}
  for (const r of rows) {
    out[String(r.key)] = r.value
  }
  return out
}
