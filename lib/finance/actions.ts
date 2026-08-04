"use server"

import { revalidatePath } from "next/cache"
import { sql } from "@/lib/db"
import { logAudit } from "@/lib/project-access"
import {
  requireFinanceAccess,
  requireFinanceManage,
  requireFinanceOperate,
  requireFinanceApprove,
  requireStaffClaimAccess,
} from "./permissions"
import {
  nextReceiptNumber,
  nextExpenseNumber,
  nextClaimNumber,
  nextTransferNumber,
  nextPayslipNumber,
} from "./numbers"
import {
  recordLedgerEntry,
  logApproval,
  notifyFinanceManagers,
  createFinanceNotification,
  syncProjectFinance,
  checkLowCashBalance,
} from "./ledger"
import type { LedgerScope } from "./constants"
import type { FinanceIncome, FinanceExpense, FinanceAccount, StaffExpenseClaim } from "./types"

const REVALIDATE_PATHS = [
  "/admin/finance",
  "/admin/finance/project",
  "/admin/finance/project/income",
  "/admin/finance/project/expenses",
  "/admin/finance/project/budget",
  "/admin/finance/project/ledger",
  "/admin/finance/project/profit",
  "/admin/finance/project/reports",
  "/admin/finance/office",
  "/admin/finance/office/income",
  "/admin/finance/office/expenses",
  "/admin/finance/office/cash-book",
  "/admin/finance/office/accounts",
  "/admin/finance/office/vendors",
  "/admin/finance/office/claims",
  "/admin/finance/office/salary",
  "/admin/finance/office/reports",
  "/admin/finance/office/settings",
  "/staff/expenses",
  "/admin",
  "/admin/billing",
]

function revalidateFinance(extra?: string[]) {
  for (const p of REVALIDATE_PATHS) revalidatePath(p)
  for (const p of extra ?? []) revalidatePath(p)
}

function num(v: FormDataEntryValue | null, fallback = 0): number {
  if (v == null || v === "") return fallback
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

function str(v: FormDataEntryValue | null): string {
  return String(v ?? "").trim()
}

function optId(v: FormDataEntryValue | null): number | null {
  const s = str(v)
  if (!s) return null
  const n = Number(s)
  return Number.isFinite(n) && n > 0 ? n : null
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function resolveScope(formData: FormData, projectId: number | null): LedgerScope {
  const explicit = str(formData.get("ledger_scope") || formData.get("scope"))
  if (explicit === "project" || explicit === "office") return explicit
  return projectId ? "project" : "office"
}

async function detectIncomeScope(id: number): Promise<LedgerScope | null> {
  const project = (await sql`
    SELECT id FROM project_income WHERE id = ${id} AND deleted_at IS NULL LIMIT 1
  `) as { id: number }[]
  if (project[0]) return "project"
  const office = (await sql`
    SELECT id FROM office_income WHERE id = ${id} AND deleted_at IS NULL LIMIT 1
  `) as { id: number }[]
  if (office[0]) return "office"
  return null
}

async function detectExpenseScope(id: number): Promise<LedgerScope | null> {
  const project = (await sql`
    SELECT id FROM project_expenses WHERE id = ${id} AND deleted_at IS NULL LIMIT 1
  `) as { id: number }[]
  if (project[0]) return "project"
  const office = (await sql`
    SELECT id FROM office_expenses WHERE id = ${id} AND deleted_at IS NULL LIMIT 1
  `) as { id: number }[]
  if (office[0]) return "office"
  return null
}

// ---------------------------------------------------------------------------
// Project income
// ---------------------------------------------------------------------------

export async function createProjectIncome(formData: FormData) {
  const user = await requireFinanceOperate()
  const amount = num(formData.get("amount"))
  if (amount <= 0) return { error: "Amount must be greater than zero" }

  const projectId = optId(formData.get("project_id"))
  if (!projectId) return { error: "Project is required for project income" }

  const incomeDate = str(formData.get("income_date")) || today()
  const paymentMethod = str(formData.get("payment_method")) || "Cash"
  const clientId = optId(formData.get("client_id"))
  const invoiceId = optId(formData.get("invoice_id"))
  const categoryId = optId(formData.get("category_id"))
  const accountId = optId(formData.get("account_id"))
  const reference = str(formData.get("reference_number")) || null
  const notes = str(formData.get("notes")) || null
  const attachment = str(formData.get("attachment_path")) || null
  const status = str(formData.get("status")) || "Approved"
  const receiptNumber = await nextReceiptNumber()

  if (reference) {
    const dup = (await sql`
      SELECT id FROM project_income
      WHERE deleted_at IS NULL AND reference_number = ${reference}
        AND income_date = ${incomeDate} AND amount = ${amount}
        AND project_id = ${projectId}
      LIMIT 1
    `) as { id: number }[]
    if (dup[0]) return { error: "Possible duplicate income with same reference/amount/date" }
  }

  const rows = (await sql`
    INSERT INTO project_income (
      receipt_number, income_date, client_id, project_id, invoice_id, category_id,
      account_id, payment_method, amount, reference_number, notes, attachment_path,
      status, created_by, approved_by, approved_at
    ) VALUES (
      ${receiptNumber}, ${incomeDate}, ${clientId}, ${projectId}, ${invoiceId}, ${categoryId},
      ${accountId}, ${paymentMethod}, ${amount}, ${reference}, ${notes}, ${attachment},
      ${status}, ${user.id},
      ${status === "Approved" ? user.id : null},
      ${status === "Approved" ? new Date().toISOString().slice(0, 19).replace("T", " ") : null}
    )
  `) as { id: number }[]
  const id = Number(rows[0]?.id)

  if (status === "Approved") {
    await recordLedgerEntry({
      scope: "project",
      date: incomeDate,
      amount,
      direction: "in",
      accountId,
      paymentMethod,
      projectId,
      description: `Income ${receiptNumber}`,
      refType: "income",
      refId: id,
      createdBy: user.id,
      txnType: "income",
    })
    await syncProjectFinance(projectId)
    await notifyFinanceManagers({
      type: "finance.payment_received",
      title: "Project payment received",
      message: `${receiptNumber}: ₹${amount.toFixed(2)} via ${paymentMethod}`,
      entityType: "income",
      entityId: id,
    })
    await checkLowCashBalance()
  }

  await logAudit(user.id, "finance.income.create", "project_income", id, { receiptNumber, amount, status })
  revalidateFinance([`/admin/finance/project/${projectId}`, `/admin/projects/${projectId}`])
  return { success: true, id, receiptNumber, scope: "project" as const }
}

export async function createOfficeIncome(formData: FormData) {
  const user = await requireFinanceOperate()
  const amount = num(formData.get("amount"))
  if (amount <= 0) return { error: "Amount must be greater than zero" }

  const incomeDate = str(formData.get("income_date")) || today()
  const paymentMethod = str(formData.get("payment_method")) || "Cash"
  const categoryId = optId(formData.get("category_id"))
  const accountId = optId(formData.get("account_id"))
  const reference = str(formData.get("reference_number")) || null
  const notes = str(formData.get("notes")) || null
  const attachment = str(formData.get("attachment_path")) || null
  const status = str(formData.get("status")) || "Approved"
  const receiptNumber = await nextReceiptNumber()

  if (reference) {
    const dup = (await sql`
      SELECT id FROM office_income
      WHERE deleted_at IS NULL AND reference_number = ${reference}
        AND income_date = ${incomeDate} AND amount = ${amount}
      LIMIT 1
    `) as { id: number }[]
    if (dup[0]) return { error: "Possible duplicate income with same reference/amount/date" }
  }

  const rows = (await sql`
    INSERT INTO office_income (
      receipt_number, income_date, category_id, account_id, payment_method, amount,
      reference_number, notes, attachment_path, status, created_by, approved_by, approved_at
    ) VALUES (
      ${receiptNumber}, ${incomeDate}, ${categoryId}, ${accountId}, ${paymentMethod}, ${amount},
      ${reference}, ${notes}, ${attachment}, ${status}, ${user.id},
      ${status === "Approved" ? user.id : null},
      ${status === "Approved" ? new Date().toISOString().slice(0, 19).replace("T", " ") : null}
    )
  `) as { id: number }[]
  const id = Number(rows[0]?.id)

  if (status === "Approved") {
    await recordLedgerEntry({
      scope: "office",
      date: incomeDate,
      amount,
      direction: "in",
      accountId,
      paymentMethod,
      projectId: null,
      description: `Office income ${receiptNumber}`,
      refType: "income",
      refId: id,
      createdBy: user.id,
      txnType: "income",
    })
    await notifyFinanceManagers({
      type: "finance.payment_received",
      title: "Office payment received",
      message: `${receiptNumber}: ₹${amount.toFixed(2)} via ${paymentMethod}`,
      entityType: "income",
      entityId: id,
    })
    await checkLowCashBalance()
  }

  await logAudit(user.id, "finance.income.create", "office_income", id, { receiptNumber, amount, status })
  revalidateFinance()
  return { success: true, id, receiptNumber, scope: "office" as const }
}

export async function createIncome(formData: FormData) {
  const projectId = optId(formData.get("project_id"))
  const scope = resolveScope(formData, projectId)
  if (scope === "project") return createProjectIncome(formData)
  return createOfficeIncome(formData)
}

async function updateProjectIncome(formData: FormData) {
  const user = await requireFinanceOperate()
  const id = optId(formData.get("id"))
  if (!id) return { error: "Invalid income" }

  const existing = (await sql`
    SELECT * FROM project_income WHERE id = ${id} AND deleted_at IS NULL
  `) as FinanceIncome[]
  if (!existing[0]) return { error: "Income not found" }
  if (existing[0].status === "Approved") {
    return { error: "Approved income cannot be edited — cancel and recreate if needed" }
  }

  const amount = num(formData.get("amount"))
  if (amount <= 0) return { error: "Amount must be greater than zero" }

  const projectId = optId(formData.get("project_id"))
  if (!projectId) return { error: "Project is required" }

  const incomeDate = str(formData.get("income_date")) || today()
  const paymentMethod = str(formData.get("payment_method")) || "Cash"
  const clientId = optId(formData.get("client_id"))
  const invoiceId = optId(formData.get("invoice_id"))
  const categoryId = optId(formData.get("category_id"))
  const accountId = optId(formData.get("account_id"))
  const reference = str(formData.get("reference_number")) || null
  const notes = str(formData.get("notes")) || null
  const attachment = str(formData.get("attachment_path")) || null
  const status = str(formData.get("status")) || String(existing[0].status)

  await sql`
    UPDATE project_income SET
      income_date = ${incomeDate},
      client_id = ${clientId},
      project_id = ${projectId},
      invoice_id = ${invoiceId},
      category_id = ${categoryId},
      account_id = ${accountId},
      payment_method = ${paymentMethod},
      amount = ${amount},
      reference_number = ${reference},
      notes = ${notes},
      attachment_path = ${attachment},
      status = ${status},
      approved_by = ${status === "Approved" ? user.id : null},
      approved_at = ${status === "Approved" ? new Date().toISOString().slice(0, 19).replace("T", " ") : null}
    WHERE id = ${id}
  `

  if (status === "Approved" && existing[0].status !== "Approved") {
    await recordLedgerEntry({
      scope: "project",
      date: incomeDate,
      amount,
      direction: "in",
      accountId,
      paymentMethod,
      projectId,
      description: `Income ${existing[0].receipt_number}`,
      refType: "income",
      refId: id,
      createdBy: user.id,
      txnType: "income",
    })
    await syncProjectFinance(projectId)
  }

  await logAudit(user.id, "finance.income.update", "project_income", id, { amount, status })
  revalidateFinance([`/admin/finance/project/${projectId}`])
  return { success: true }
}

async function updateOfficeIncome(formData: FormData) {
  const user = await requireFinanceOperate()
  const id = optId(formData.get("id"))
  if (!id) return { error: "Invalid income" }

  const existing = (await sql`
    SELECT * FROM office_income WHERE id = ${id} AND deleted_at IS NULL
  `) as FinanceIncome[]
  if (!existing[0]) return { error: "Income not found" }
  if (existing[0].status === "Approved") {
    return { error: "Approved income cannot be edited — cancel and recreate if needed" }
  }

  const amount = num(formData.get("amount"))
  if (amount <= 0) return { error: "Amount must be greater than zero" }

  const incomeDate = str(formData.get("income_date")) || today()
  const paymentMethod = str(formData.get("payment_method")) || "Cash"
  const categoryId = optId(formData.get("category_id"))
  const accountId = optId(formData.get("account_id"))
  const reference = str(formData.get("reference_number")) || null
  const notes = str(formData.get("notes")) || null
  const attachment = str(formData.get("attachment_path")) || null
  const status = str(formData.get("status")) || String(existing[0].status)

  await sql`
    UPDATE office_income SET
      income_date = ${incomeDate},
      category_id = ${categoryId},
      account_id = ${accountId},
      payment_method = ${paymentMethod},
      amount = ${amount},
      reference_number = ${reference},
      notes = ${notes},
      attachment_path = ${attachment},
      status = ${status},
      approved_by = ${status === "Approved" ? user.id : null},
      approved_at = ${status === "Approved" ? new Date().toISOString().slice(0, 19).replace("T", " ") : null}
    WHERE id = ${id}
  `

  if (status === "Approved" && existing[0].status !== "Approved") {
    await recordLedgerEntry({
      scope: "office",
      date: incomeDate,
      amount,
      direction: "in",
      accountId,
      paymentMethod,
      projectId: null,
      description: `Office income ${existing[0].receipt_number}`,
      refType: "income",
      refId: id,
      createdBy: user.id,
      txnType: "income",
    })
  }

  await logAudit(user.id, "finance.income.update", "office_income", id, { amount, status })
  revalidateFinance()
  return { success: true }
}

export async function updateIncome(formData: FormData) {
  const id = optId(formData.get("id"))
  if (!id) return { error: "Invalid income" }
  const explicit = str(formData.get("ledger_scope") || formData.get("scope"))
  const scope =
    explicit === "project" || explicit === "office"
      ? explicit
      : await detectIncomeScope(id)
  if (scope === "project") return updateProjectIncome(formData)
  if (scope === "office") return updateOfficeIncome(formData)
  return { error: "Income not found" }
}

async function deleteProjectIncome(formData: FormData) {
  const user = await requireFinanceOperate()
  const id = optId(formData.get("id"))
  if (!id) return { error: "Invalid income" }

  const rows = (await sql`
    SELECT * FROM project_income WHERE id = ${id} AND deleted_at IS NULL
  `) as FinanceIncome[]
  if (!rows[0]) return { error: "Not found" }

  await sql`UPDATE project_income SET deleted_at = NOW() WHERE id = ${id}`
  await sql`
    UPDATE finance_transactions SET deleted_at = NOW()
    WHERE ref_type = 'income' AND ref_id = ${id} AND ledger_scope = 'project' AND deleted_at IS NULL
  `

  if (rows[0].project_id) await syncProjectFinance(Number(rows[0].project_id))
  await logAudit(user.id, "finance.income.delete", "project_income", id, { receipt: rows[0].receipt_number })
  revalidateFinance()
  return { success: true }
}

async function deleteOfficeIncome(formData: FormData) {
  const user = await requireFinanceOperate()
  const id = optId(formData.get("id"))
  if (!id) return { error: "Invalid income" }

  const rows = (await sql`
    SELECT * FROM office_income WHERE id = ${id} AND deleted_at IS NULL
  `) as FinanceIncome[]
  if (!rows[0]) return { error: "Not found" }

  await sql`UPDATE office_income SET deleted_at = NOW() WHERE id = ${id}`
  await sql`
    UPDATE finance_transactions SET deleted_at = NOW()
    WHERE ref_type = 'income' AND ref_id = ${id} AND ledger_scope = 'office' AND deleted_at IS NULL
  `

  await logAudit(user.id, "finance.income.delete", "office_income", id, { receipt: rows[0].receipt_number })
  revalidateFinance()
  return { success: true }
}

export async function deleteIncome(formData: FormData) {
  const id = optId(formData.get("id"))
  if (!id) return { error: "Invalid income" }
  const explicit = str(formData.get("ledger_scope") || formData.get("scope"))
  const scope =
    explicit === "project" || explicit === "office"
      ? explicit
      : await detectIncomeScope(id)
  if (scope === "project") return deleteProjectIncome(formData)
  if (scope === "office") return deleteOfficeIncome(formData)
  return { error: "Not found" }
}

// ---------------------------------------------------------------------------
// Project expenses
// ---------------------------------------------------------------------------

export async function createProjectExpense(formData: FormData) {
  const user = await requireFinanceOperate()
  const amount = num(formData.get("amount"))
  if (amount <= 0) return { error: "Amount must be greater than zero" }

  const projectId = optId(formData.get("project_id"))
  if (!projectId) return { error: "Project is required for project expenses" }

  const expenseDate = str(formData.get("expense_date")) || today()
  const paymentMethod = str(formData.get("payment_method")) || "Cash"
  const vendorId = optId(formData.get("vendor_id"))
  const categoryId = optId(formData.get("category_id"))
  const accountId = optId(formData.get("account_id"))
  const gstAmount = num(formData.get("gst_amount"))
  const reference = str(formData.get("reference_number")) || null
  const notes = str(formData.get("notes")) || null
  const billPath = str(formData.get("bill_path")) || null
  const status = str(formData.get("status")) || "Draft"
  const expenseNumber = await nextExpenseNumber()

  const rows = (await sql`
    INSERT INTO project_expenses (
      expense_number, expense_date, vendor_id, project_id, category_id, account_id,
      amount, gst_amount, payment_method, reference_number, notes, bill_path,
      status, created_by
    ) VALUES (
      ${expenseNumber}, ${expenseDate}, ${vendorId}, ${projectId}, ${categoryId}, ${accountId},
      ${amount}, ${gstAmount}, ${paymentMethod}, ${reference}, ${notes}, ${billPath},
      ${status}, ${user.id}
    )
  `) as { id: number }[]
  const id = Number(rows[0]?.id)

  await logApproval({
    entityType: "expense",
    entityId: id,
    action: "create",
    fromStatus: null,
    toStatus: status,
    userId: user.id,
  })

  if (status === "Submitted") {
    await notifyFinanceManagers({
      type: "finance.expense_submitted",
      title: "Project expense submitted",
      message: `${expenseNumber}: ₹${(amount + gstAmount).toFixed(2)} awaiting approval`,
      entityType: "expense",
      entityId: id,
    })
  }

  await logAudit(user.id, "finance.expense.create", "project_expense", id, { expenseNumber, amount, status })
  revalidateFinance([`/admin/finance/project/${projectId}`])
  return { success: true, id, expenseNumber, scope: "project" as const }
}

export async function createOfficeExpense(formData: FormData) {
  const user = await requireFinanceOperate()
  const amount = num(formData.get("amount"))
  if (amount <= 0) return { error: "Amount must be greater than zero" }

  const expenseDate = str(formData.get("expense_date")) || today()
  const paymentMethod = str(formData.get("payment_method")) || "Cash"
  const vendorId = optId(formData.get("vendor_id"))
  const categoryId = optId(formData.get("category_id"))
  const accountId = optId(formData.get("account_id"))
  const gstAmount = num(formData.get("gst_amount"))
  const reference = str(formData.get("reference_number")) || null
  const notes = str(formData.get("notes")) || null
  const billPath = str(formData.get("bill_path")) || null
  const status = str(formData.get("status")) || "Draft"
  const expenseNumber = await nextExpenseNumber()

  const rows = (await sql`
    INSERT INTO office_expenses (
      expense_number, expense_date, vendor_id, category_id, account_id,
      amount, gst_amount, payment_method, reference_number, notes, bill_path,
      status, created_by
    ) VALUES (
      ${expenseNumber}, ${expenseDate}, ${vendorId}, ${categoryId}, ${accountId},
      ${amount}, ${gstAmount}, ${paymentMethod}, ${reference}, ${notes}, ${billPath},
      ${status}, ${user.id}
    )
  `) as { id: number }[]
  const id = Number(rows[0]?.id)

  await logApproval({
    entityType: "expense",
    entityId: id,
    action: "create",
    fromStatus: null,
    toStatus: status,
    userId: user.id,
  })

  if (status === "Submitted") {
    await notifyFinanceManagers({
      type: "finance.expense_submitted",
      title: "Office expense submitted",
      message: `${expenseNumber}: ₹${(amount + gstAmount).toFixed(2)} awaiting approval`,
      entityType: "expense",
      entityId: id,
    })
  }

  await logAudit(user.id, "finance.expense.create", "office_expense", id, { expenseNumber, amount, status })
  revalidateFinance()
  return { success: true, id, expenseNumber, scope: "office" as const }
}

export async function createExpense(formData: FormData) {
  const projectId = optId(formData.get("project_id"))
  const scope = resolveScope(formData, projectId)
  if (scope === "project") return createProjectExpense(formData)
  return createOfficeExpense(formData)
}

async function updateProjectExpense(formData: FormData) {
  const user = await requireFinanceOperate()
  const id = optId(formData.get("id"))
  if (!id) return { error: "Invalid expense" }

  const existing = (await sql`
    SELECT * FROM project_expenses WHERE id = ${id} AND deleted_at IS NULL
  `) as FinanceExpense[]
  if (!existing[0]) return { error: "Expense not found" }
  if (["Paid", "Approved"].includes(String(existing[0].status))) {
    return { error: "Cannot edit approved/paid expenses" }
  }

  const amount = num(formData.get("amount"))
  if (amount <= 0) return { error: "Amount must be greater than zero" }

  const projectId = optId(formData.get("project_id"))
  if (!projectId) return { error: "Project is required" }

  const expenseDate = str(formData.get("expense_date")) || today()
  const paymentMethod = str(formData.get("payment_method")) || "Cash"
  const vendorId = optId(formData.get("vendor_id"))
  const categoryId = optId(formData.get("category_id"))
  const accountId = optId(formData.get("account_id"))
  const gstAmount = num(formData.get("gst_amount"))
  const reference = str(formData.get("reference_number")) || null
  const notes = str(formData.get("notes")) || null
  const billPath = str(formData.get("bill_path")) || null
  const status = str(formData.get("status")) || String(existing[0].status)

  await sql`
    UPDATE project_expenses SET
      expense_date = ${expenseDate},
      vendor_id = ${vendorId},
      project_id = ${projectId},
      category_id = ${categoryId},
      account_id = ${accountId},
      amount = ${amount},
      gst_amount = ${gstAmount},
      payment_method = ${paymentMethod},
      reference_number = ${reference},
      notes = ${notes},
      bill_path = ${billPath},
      status = ${status}
    WHERE id = ${id}
  `

  await logApproval({
    entityType: "expense",
    entityId: id,
    action: "update",
    fromStatus: String(existing[0].status),
    toStatus: status,
    userId: user.id,
  })

  await logAudit(user.id, "finance.expense.update", "project_expense", id, { amount, status })
  revalidateFinance()
  return { success: true }
}

async function updateOfficeExpense(formData: FormData) {
  const user = await requireFinanceOperate()
  const id = optId(formData.get("id"))
  if (!id) return { error: "Invalid expense" }

  const existing = (await sql`
    SELECT * FROM office_expenses WHERE id = ${id} AND deleted_at IS NULL
  `) as FinanceExpense[]
  if (!existing[0]) return { error: "Expense not found" }
  if (["Paid", "Approved"].includes(String(existing[0].status))) {
    return { error: "Cannot edit approved/paid expenses" }
  }

  const amount = num(formData.get("amount"))
  if (amount <= 0) return { error: "Amount must be greater than zero" }

  const expenseDate = str(formData.get("expense_date")) || today()
  const paymentMethod = str(formData.get("payment_method")) || "Cash"
  const vendorId = optId(formData.get("vendor_id"))
  const categoryId = optId(formData.get("category_id"))
  const accountId = optId(formData.get("account_id"))
  const gstAmount = num(formData.get("gst_amount"))
  const reference = str(formData.get("reference_number")) || null
  const notes = str(formData.get("notes")) || null
  const billPath = str(formData.get("bill_path")) || null
  const status = str(formData.get("status")) || String(existing[0].status)

  await sql`
    UPDATE office_expenses SET
      expense_date = ${expenseDate},
      vendor_id = ${vendorId},
      category_id = ${categoryId},
      account_id = ${accountId},
      amount = ${amount},
      gst_amount = ${gstAmount},
      payment_method = ${paymentMethod},
      reference_number = ${reference},
      notes = ${notes},
      bill_path = ${billPath},
      status = ${status}
    WHERE id = ${id}
  `

  await logApproval({
    entityType: "expense",
    entityId: id,
    action: "update",
    fromStatus: String(existing[0].status),
    toStatus: status,
    userId: user.id,
  })

  await logAudit(user.id, "finance.expense.update", "office_expense", id, { amount, status })
  revalidateFinance()
  return { success: true }
}

export async function updateExpense(formData: FormData) {
  const id = optId(formData.get("id"))
  if (!id) return { error: "Invalid expense" }
  const explicit = str(formData.get("ledger_scope") || formData.get("scope"))
  const scope =
    explicit === "project" || explicit === "office"
      ? explicit
      : await detectExpenseScope(id)
  if (scope === "project") return updateProjectExpense(formData)
  if (scope === "office") return updateOfficeExpense(formData)
  return { error: "Expense not found" }
}

async function transitionProjectExpenseStatus(formData: FormData) {
  const id = optId(formData.get("id"))
  const toStatus = str(formData.get("status"))
  const comment = str(formData.get("comment")) || null
  if (!id || !toStatus) return { error: "Invalid request" }

  const existing = (await sql`
    SELECT * FROM project_expenses WHERE id = ${id} AND deleted_at IS NULL
  `) as FinanceExpense[]
  if (!existing[0]) return { error: "Not found" }
  const fromStatus = String(existing[0].status)

  if (["Approved", "Rejected", "Paid"].includes(toStatus)) {
    await requireFinanceApprove()
  } else {
    await requireFinanceOperate()
  }
  const user = await requireFinanceAccess()

  await sql`
    UPDATE project_expenses SET
      status = ${toStatus},
      approved_by = ${toStatus === "Approved" || toStatus === "Paid" ? user.id : existing[0].approved_by},
      approved_at = ${toStatus === "Approved" || toStatus === "Paid" ? new Date().toISOString().slice(0, 19).replace("T", " ") : existing[0].approved_at},
      paid_at = ${toStatus === "Paid" ? new Date().toISOString().slice(0, 19).replace("T", " ") : existing[0].paid_at}
    WHERE id = ${id}
  `

  await logApproval({
    entityType: "expense",
    entityId: id,
    action: `status.${toStatus.toLowerCase()}`,
    fromStatus,
    toStatus,
    userId: user.id,
    comment,
  })

  if (toStatus === "Paid") {
    const total = Number(existing[0].amount) + Number(existing[0].gst_amount)
    const projectId = Number(existing[0].project_id)
    await recordLedgerEntry({
      scope: "project",
      date: String(existing[0].expense_date).slice(0, 10),
      amount: total,
      direction: "out",
      accountId: existing[0].account_id ? Number(existing[0].account_id) : null,
      paymentMethod: String(existing[0].payment_method),
      projectId,
      description: `Expense ${existing[0].expense_number}`,
      refType: "expense",
      refId: id,
      createdBy: user.id,
      txnType: "expense",
    })

    if (existing[0].vendor_id) {
      await sql`
        INSERT INTO vendor_payments (
          vendor_id, expense_id, amount, payment_date, payment_method, account_id, created_by
        ) VALUES (
          ${existing[0].vendor_id}, ${id}, ${total},
          ${String(existing[0].expense_date).slice(0, 10)},
          ${existing[0].payment_method}, ${existing[0].account_id}, ${user.id}
        )
      `
      await sql`
        UPDATE vendors SET outstanding_balance = GREATEST(outstanding_balance - ${total}, 0)
        WHERE id = ${existing[0].vendor_id}
      `
    }

    await syncProjectFinance(projectId)
    await checkLowCashBalance()
  }

  await logAudit(user.id, "finance.expense.status", "project_expense", id, { fromStatus, toStatus })
  revalidateFinance()
  return { success: true }
}

async function transitionOfficeExpenseStatus(formData: FormData) {
  const id = optId(formData.get("id"))
  const toStatus = str(formData.get("status"))
  const comment = str(formData.get("comment")) || null
  if (!id || !toStatus) return { error: "Invalid request" }

  const existing = (await sql`
    SELECT * FROM office_expenses WHERE id = ${id} AND deleted_at IS NULL
  `) as FinanceExpense[]
  if (!existing[0]) return { error: "Not found" }
  const fromStatus = String(existing[0].status)

  if (["Approved", "Rejected", "Paid"].includes(toStatus)) {
    await requireFinanceApprove()
  } else {
    await requireFinanceOperate()
  }
  const user = await requireFinanceAccess()

  await sql`
    UPDATE office_expenses SET
      status = ${toStatus},
      approved_by = ${toStatus === "Approved" || toStatus === "Paid" ? user.id : existing[0].approved_by},
      approved_at = ${toStatus === "Approved" || toStatus === "Paid" ? new Date().toISOString().slice(0, 19).replace("T", " ") : existing[0].approved_at},
      paid_at = ${toStatus === "Paid" ? new Date().toISOString().slice(0, 19).replace("T", " ") : existing[0].paid_at}
    WHERE id = ${id}
  `

  await logApproval({
    entityType: "expense",
    entityId: id,
    action: `status.${toStatus.toLowerCase()}`,
    fromStatus,
    toStatus,
    userId: user.id,
    comment,
  })

  if (toStatus === "Paid") {
    const total = Number(existing[0].amount) + Number(existing[0].gst_amount)
    await recordLedgerEntry({
      scope: "office",
      date: String(existing[0].expense_date).slice(0, 10),
      amount: total,
      direction: "out",
      accountId: existing[0].account_id ? Number(existing[0].account_id) : null,
      paymentMethod: String(existing[0].payment_method),
      projectId: null,
      description: `Expense ${existing[0].expense_number}`,
      refType: "expense",
      refId: id,
      createdBy: user.id,
      txnType: "expense",
    })

    if (existing[0].vendor_id) {
      await sql`
        INSERT INTO vendor_payments (
          vendor_id, expense_id, amount, payment_date, payment_method, account_id, created_by
        ) VALUES (
          ${existing[0].vendor_id}, ${id}, ${total},
          ${String(existing[0].expense_date).slice(0, 10)},
          ${existing[0].payment_method}, ${existing[0].account_id}, ${user.id}
        )
      `
      await sql`
        UPDATE vendors SET outstanding_balance = GREATEST(outstanding_balance - ${total}, 0)
        WHERE id = ${existing[0].vendor_id}
      `
    }

    await checkLowCashBalance()
  }

  await logAudit(user.id, "finance.expense.status", "office_expense", id, { fromStatus, toStatus })
  revalidateFinance()
  return { success: true }
}

export async function transitionExpenseStatus(formData: FormData) {
  const id = optId(formData.get("id"))
  if (!id) return { error: "Invalid request" }
  const explicit = str(formData.get("ledger_scope") || formData.get("scope"))
  const scope =
    explicit === "project" || explicit === "office"
      ? explicit
      : await detectExpenseScope(id)
  if (scope === "project") return transitionProjectExpenseStatus(formData)
  if (scope === "office") return transitionOfficeExpenseStatus(formData)
  return { error: "Not found" }
}

async function deleteProjectExpense(formData: FormData) {
  const user = await requireFinanceOperate()
  const id = optId(formData.get("id"))
  if (!id) return { error: "Invalid expense" }

  const rows = (await sql`
    SELECT * FROM project_expenses WHERE id = ${id} AND deleted_at IS NULL
  `) as FinanceExpense[]
  if (!rows[0]) return { error: "Not found" }
  if (rows[0].status === "Paid") return { error: "Cannot delete paid expenses" }

  await sql`UPDATE project_expenses SET deleted_at = NOW() WHERE id = ${id}`
  await logAudit(user.id, "finance.expense.delete", "project_expense", id, { number: rows[0].expense_number })
  if (rows[0].project_id) await syncProjectFinance(Number(rows[0].project_id))
  revalidateFinance()
  return { success: true }
}

async function deleteOfficeExpense(formData: FormData) {
  const user = await requireFinanceOperate()
  const id = optId(formData.get("id"))
  if (!id) return { error: "Invalid expense" }

  const rows = (await sql`
    SELECT * FROM office_expenses WHERE id = ${id} AND deleted_at IS NULL
  `) as FinanceExpense[]
  if (!rows[0]) return { error: "Not found" }
  if (rows[0].status === "Paid") return { error: "Cannot delete paid expenses" }

  await sql`UPDATE office_expenses SET deleted_at = NOW() WHERE id = ${id}`
  await logAudit(user.id, "finance.expense.delete", "office_expense", id, { number: rows[0].expense_number })
  revalidateFinance()
  return { success: true }
}

export async function deleteExpense(formData: FormData) {
  const id = optId(formData.get("id"))
  if (!id) return { error: "Invalid expense" }
  const explicit = str(formData.get("ledger_scope") || formData.get("scope"))
  const scope =
    explicit === "project" || explicit === "office"
      ? explicit
      : await detectExpenseScope(id)
  if (scope === "project") return deleteProjectExpense(formData)
  if (scope === "office") return deleteOfficeExpense(formData)
  return { error: "Not found" }
}

// ---------------------------------------------------------------------------
// Project budget
// ---------------------------------------------------------------------------

export async function saveProjectBudget(formData: FormData) {
  const user = await requireFinanceManage()
  const projectId = optId(formData.get("project_id"))
  const category = str(formData.get("category"))
  const estimated = num(formData.get("estimated_amount"))
  const notes = str(formData.get("notes")) || null
  const id = optId(formData.get("id"))

  if (!projectId) return { error: "Project is required" }
  if (!category) return { error: "Category is required" }
  if (estimated < 0) return { error: "Amount must be zero or greater" }

  if (id) {
    await sql`
      UPDATE project_budget SET
        category = ${category},
        estimated_amount = ${estimated},
        notes = ${notes}
      WHERE id = ${id} AND project_id = ${projectId} AND deleted_at IS NULL
    `
    await logAudit(user.id, "finance.budget.update", "project_budget", id, { projectId, category })
  } else {
    const rows = (await sql`
      INSERT INTO project_budget (project_id, category, estimated_amount, notes, created_by)
      VALUES (${projectId}, ${category}, ${estimated}, ${notes}, ${user.id})
      ON DUPLICATE KEY UPDATE
        estimated_amount = VALUES(estimated_amount),
        notes = VALUES(notes),
        deleted_at = NULL,
        updated_at = CURRENT_TIMESTAMP
    `) as { id: number }[]
    await logAudit(user.id, "finance.budget.create", "project_budget", Number(rows[0]?.id ?? 0), {
      projectId,
      category,
    })
  }

  await syncProjectFinance(projectId)
  revalidateFinance([`/admin/finance/project/${projectId}`, `/admin/finance/project/budget`])
  return { success: true }
}

export async function deleteProjectBudget(formData: FormData) {
  const user = await requireFinanceManage()
  const id = optId(formData.get("id"))
  if (!id) return { error: "Invalid budget line" }

  const rows = (await sql`
    SELECT project_id FROM project_budget WHERE id = ${id} AND deleted_at IS NULL
  `) as { project_id: number }[]
  if (!rows[0]) return { error: "Not found" }

  await sql`UPDATE project_budget SET deleted_at = NOW() WHERE id = ${id}`
  await syncProjectFinance(Number(rows[0].project_id))
  await logAudit(user.id, "finance.budget.delete", "project_budget", id, {})
  revalidateFinance([`/admin/finance/project/${rows[0].project_id}`])
  return { success: true }
}

// ---------------------------------------------------------------------------
// Salary payroll (office only)
// ---------------------------------------------------------------------------

function calcNetSalary(formData: FormData): number {
  const basic = num(formData.get("basic_salary"))
  const allowances = num(formData.get("allowances"))
  const bonus = num(formData.get("bonus"))
  const overtime = num(formData.get("overtime"))
  const deductions = num(formData.get("deductions"))
  return basic + allowances + bonus + overtime - deductions
}

export async function createSalary(formData: FormData) {
  const user = await requireFinanceManage()
  const staffId = optId(formData.get("staff_id"))
  const payPeriod = str(formData.get("pay_period"))
  const payDate = str(formData.get("pay_date")) || today()
  if (!staffId || !payPeriod) return { error: "Staff and pay period are required" }

  const netSalary = calcNetSalary(formData)
  if (netSalary <= 0) return { error: "Net salary must be greater than zero" }

  const payslipNumber = await nextPayslipNumber()
  const rows = (await sql`
    INSERT INTO salary_payroll (
      payslip_number, staff_id, pay_period, pay_date,
      basic_salary, allowances, bonus, overtime, deductions, net_salary,
      payment_method, account_id, status, notes, created_by
    ) VALUES (
      ${payslipNumber}, ${staffId}, ${payPeriod}, ${payDate},
      ${num(formData.get("basic_salary"))}, ${num(formData.get("allowances"))},
      ${num(formData.get("bonus"))}, ${num(formData.get("overtime"))},
      ${num(formData.get("deductions"))}, ${netSalary},
      ${str(formData.get("payment_method")) || null},
      ${optId(formData.get("account_id"))},
      ${str(formData.get("status")) || "Draft"},
      ${str(formData.get("notes")) || null},
      ${user.id}
    )
  `) as { id: number }[]
  const id = Number(rows[0]?.id)

  await logAudit(user.id, "finance.salary.create", "salary_payroll", id, { payslipNumber, netSalary })
  revalidateFinance()
  return { success: true, id, payslipNumber }
}

export async function updateSalary(formData: FormData) {
  const user = await requireFinanceManage()
  const id = optId(formData.get("id"))
  if (!id) return { error: "Invalid salary record" }

  const existing = (await sql`
    SELECT * FROM salary_payroll WHERE id = ${id} AND deleted_at IS NULL
  `) as { status: string }[]
  if (!existing[0]) return { error: "Not found" }
  if (existing[0].status === "Paid") return { error: "Paid salary cannot be edited" }

  const netSalary = calcNetSalary(formData)
  if (netSalary <= 0) return { error: "Net salary must be greater than zero" }

  await sql`
    UPDATE salary_payroll SET
      staff_id = ${optId(formData.get("staff_id"))},
      pay_period = ${str(formData.get("pay_period"))},
      pay_date = ${str(formData.get("pay_date")) || today()},
      basic_salary = ${num(formData.get("basic_salary"))},
      allowances = ${num(formData.get("allowances"))},
      bonus = ${num(formData.get("bonus"))},
      overtime = ${num(formData.get("overtime"))},
      deductions = ${num(formData.get("deductions"))},
      net_salary = ${netSalary},
      payment_method = ${str(formData.get("payment_method")) || null},
      account_id = ${optId(formData.get("account_id"))},
      status = ${str(formData.get("status")) || "Draft"},
      notes = ${str(formData.get("notes")) || null}
    WHERE id = ${id}
  `

  await logAudit(user.id, "finance.salary.update", "salary_payroll", id, { netSalary })
  revalidateFinance()
  return { success: true }
}

export async function paySalary(formData: FormData) {
  const user = await requireFinanceApprove()
  const id = optId(formData.get("id"))
  if (!id) return { error: "Invalid salary record" }

  const existing = (await sql`
    SELECT * FROM salary_payroll WHERE id = ${id} AND deleted_at IS NULL
  `) as {
    payslip_number: string
    net_salary: unknown
    pay_date: string
    payment_method: string | null
    account_id: number | null
    status: string
  }[]
  if (!existing[0]) return { error: "Not found" }
  if (existing[0].status === "Paid") return { error: "Already paid" }

  const accountId = optId(formData.get("account_id")) ?? existing[0].account_id
  const paymentMethod = str(formData.get("payment_method")) || existing[0].payment_method || "Bank Transfer"
  const amount = Number(existing[0].net_salary)

  await sql`
    UPDATE salary_payroll SET
      status = 'Paid',
      paid_at = NOW(),
      account_id = ${accountId},
      payment_method = ${paymentMethod}
    WHERE id = ${id}
  `

  await recordLedgerEntry({
    scope: "office",
    date: String(existing[0].pay_date).slice(0, 10),
    amount,
    direction: "out",
    accountId: accountId ? Number(accountId) : null,
    paymentMethod,
    projectId: null,
    description: `Salary ${existing[0].payslip_number}`,
    refType: "salary",
    refId: id,
    createdBy: user.id,
    txnType: "salary",
  })

  await checkLowCashBalance()
  await logAudit(user.id, "finance.salary.pay", "salary_payroll", id, { amount })
  revalidateFinance()
  return { success: true }
}

export async function deleteSalary(formData: FormData) {
  const user = await requireFinanceManage()
  const id = optId(formData.get("id"))
  if (!id) return { error: "Invalid salary record" }

  const rows = (await sql`
    SELECT status FROM salary_payroll WHERE id = ${id} AND deleted_at IS NULL
  `) as { status: string }[]
  if (!rows[0]) return { error: "Not found" }
  if (rows[0].status === "Paid") return { error: "Cannot delete paid salary" }

  await sql`UPDATE salary_payroll SET deleted_at = NOW() WHERE id = ${id}`
  await logAudit(user.id, "finance.salary.delete", "salary_payroll", id, {})
  revalidateFinance()
  return { success: true }
}

// ---------------------------------------------------------------------------
// Accounts (office)
// ---------------------------------------------------------------------------

export async function createAccount(formData: FormData) {
  const user = await requireFinanceManage()
  const name = str(formData.get("name"))
  if (!name) return { error: "Name is required" }
  const accountType = str(formData.get("account_type")) || "bank"
  const opening = num(formData.get("opening_balance"))
  const bankName = str(formData.get("bank_name")) || null
  const accountNumber = str(formData.get("account_number")) || null
  const notes = str(formData.get("notes")) || null

  const dup = (await sql`
    SELECT id FROM finance_accounts WHERE name = ${name} AND deleted_at IS NULL LIMIT 1
  `) as { id: number }[]
  if (dup[0]) return { error: "Account with this name already exists" }

  const rows = (await sql`
    INSERT INTO finance_accounts (
      name, account_type, bank_name, account_number, opening_balance, current_balance, notes
    ) VALUES (
      ${name}, ${accountType}, ${bankName}, ${accountNumber}, ${opening}, 0, ${notes}
    )
  `) as { id: number }[]
  const id = Number(rows[0]?.id)

  if (opening !== 0) {
    await recordLedgerEntry({
      scope: "office",
      date: today(),
      amount: Math.abs(opening),
      direction: opening >= 0 ? "in" : "out",
      accountId: id,
      paymentMethod: null,
      projectId: null,
      description: `Opening balance for ${name}`,
      refType: "account",
      refId: id,
      createdBy: user.id,
      txnType: "opening",
    })
  }

  await logAudit(user.id, "finance.account.create", "account", id, { name })
  revalidateFinance()
  return { success: true, id }
}

export async function updateAccount(formData: FormData) {
  const user = await requireFinanceManage()
  const id = optId(formData.get("id"))
  if (!id) return { error: "Invalid account" }
  const name = str(formData.get("name"))
  if (!name) return { error: "Name is required" }

  await sql`
    UPDATE finance_accounts SET
      name = ${name},
      account_type = ${str(formData.get("account_type")) || "bank"},
      bank_name = ${str(formData.get("bank_name")) || null},
      account_number = ${str(formData.get("account_number")) || null},
      notes = ${str(formData.get("notes")) || null},
      active = ${formData.get("active") === "0" ? 0 : 1}
    WHERE id = ${id} AND deleted_at IS NULL
  `
  await logAudit(user.id, "finance.account.update", "account", id, { name })
  revalidateFinance()
  return { success: true }
}

export async function transferBetweenAccounts(formData: FormData) {
  const user = await requireFinanceManage()
  const fromId = optId(formData.get("from_account_id"))
  const toId = optId(formData.get("to_account_id"))
  const amount = num(formData.get("amount"))
  const transferDate = str(formData.get("transfer_date")) || today()
  const reference = str(formData.get("reference")) || null
  const notes = str(formData.get("notes")) || null

  if (!fromId || !toId) return { error: "Select both accounts" }
  if (fromId === toId) return { error: "Cannot transfer to the same account" }
  if (amount <= 0) return { error: "Amount must be greater than zero" }

  const from = (await sql`
    SELECT * FROM finance_accounts WHERE id = ${fromId} AND deleted_at IS NULL
  `) as FinanceAccount[]
  if (!from[0]) return { error: "Source account not found" }
  if (Number(from[0].current_balance) < amount) return { error: "Insufficient balance" }

  const transferNumber = await nextTransferNumber()
  const rows = (await sql`
    INSERT INTO bank_transfers (
      transfer_number, from_account_id, to_account_id, amount, transfer_date, reference, notes, created_by
    ) VALUES (
      ${transferNumber}, ${fromId}, ${toId}, ${amount}, ${transferDate}, ${reference}, ${notes}, ${user.id}
    )
  `) as { id: number }[]
  const id = Number(rows[0]?.id)

  await recordLedgerEntry({
    scope: "office",
    date: transferDate,
    amount,
    direction: "out",
    accountId: fromId,
    paymentMethod: "Bank Transfer",
    projectId: null,
    description: `Transfer out ${transferNumber}`,
    refType: "transfer",
    refId: id,
    createdBy: user.id,
    txnType: "transfer_out",
  })
  await recordLedgerEntry({
    scope: "office",
    date: transferDate,
    amount,
    direction: "in",
    accountId: toId,
    paymentMethod: "Bank Transfer",
    projectId: null,
    description: `Transfer in ${transferNumber}`,
    refType: "transfer",
    refId: id,
    createdBy: user.id,
    txnType: "transfer_in",
  })

  await logAudit(user.id, "finance.transfer", "transfer", id, { fromId, toId, amount })
  revalidateFinance()
  return { success: true, id, transferNumber }
}

// ---------------------------------------------------------------------------
// Vendors (office)
// ---------------------------------------------------------------------------

export async function createVendor(formData: FormData) {
  const user = await requireFinanceManage()
  const name = str(formData.get("name"))
  if (!name) return { error: "Vendor name is required" }

  const rows = (await sql`
    INSERT INTO vendors (name, phone, email, gst, address, notes)
    VALUES (
      ${name},
      ${str(formData.get("phone")) || null},
      ${str(formData.get("email")) || null},
      ${str(formData.get("gst")) || null},
      ${str(formData.get("address")) || null},
      ${str(formData.get("notes")) || null}
    )
  `) as { id: number }[]
  const id = Number(rows[0]?.id)
  await logAudit(user.id, "finance.vendor.create", "vendor", id, { name })
  revalidateFinance([`/admin/finance/office/vendors/${id}`])
  return { success: true, id }
}

export async function updateVendor(formData: FormData) {
  const user = await requireFinanceManage()
  const id = optId(formData.get("id"))
  if (!id) return { error: "Invalid vendor" }
  const name = str(formData.get("name"))
  if (!name) return { error: "Vendor name is required" }

  await sql`
    UPDATE vendors SET
      name = ${name},
      phone = ${str(formData.get("phone")) || null},
      email = ${str(formData.get("email")) || null},
      gst = ${str(formData.get("gst")) || null},
      address = ${str(formData.get("address")) || null},
      notes = ${str(formData.get("notes")) || null},
      active = ${formData.get("active") === "0" ? 0 : 1}
    WHERE id = ${id} AND deleted_at IS NULL
  `
  await logAudit(user.id, "finance.vendor.update", "vendor", id, { name })
  revalidateFinance([`/admin/finance/office/vendors/${id}`])
  return { success: true }
}

export async function deleteVendor(formData: FormData) {
  const user = await requireFinanceManage()
  const id = optId(formData.get("id"))
  if (!id) return { error: "Invalid vendor" }
  await sql`UPDATE vendors SET deleted_at = NOW(), active = 0 WHERE id = ${id}`
  await logAudit(user.id, "finance.vendor.delete", "vendor", id, {})
  revalidateFinance()
  return { success: true }
}

export async function recordVendorPayment(formData: FormData) {
  const user = await requireFinanceOperate()
  const vendorId = optId(formData.get("vendor_id"))
  const amount = num(formData.get("amount"))
  if (!vendorId || amount <= 0) return { error: "Vendor and amount required" }

  const paymentDate = str(formData.get("payment_date")) || today()
  const paymentMethod = str(formData.get("payment_method")) || "Cash"
  const accountId = optId(formData.get("account_id"))
  const reference = str(formData.get("reference")) || null
  const notes = str(formData.get("notes")) || null
  const expenseId = optId(formData.get("expense_id"))

  const rows = (await sql`
    INSERT INTO vendor_payments (
      vendor_id, expense_id, amount, payment_date, payment_method, account_id, reference, notes, created_by
    ) VALUES (
      ${vendorId}, ${expenseId}, ${amount}, ${paymentDate}, ${paymentMethod},
      ${accountId}, ${reference}, ${notes}, ${user.id}
    )
  `) as { id: number }[]
  const id = Number(rows[0]?.id)

  await recordLedgerEntry({
    scope: "office",
    date: paymentDate,
    amount,
    direction: "out",
    accountId,
    paymentMethod,
    projectId: null,
    description: `Vendor payment #${id}`,
    refType: "vendor_payment",
    refId: id,
    createdBy: user.id,
    txnType: "vendor_payment",
  })

  await sql`
    UPDATE vendors SET outstanding_balance = GREATEST(outstanding_balance - ${amount}, 0)
    WHERE id = ${vendorId}
  `

  await notifyFinanceManagers({
    type: "finance.vendor_payment",
    title: "Vendor payment recorded",
    message: `₹${amount.toFixed(2)} paid to vendor #${vendorId}`,
    entityType: "vendor",
    entityId: vendorId,
  })

  await logAudit(user.id, "finance.vendor.payment", "vendor", vendorId, { amount, id })
  revalidateFinance([`/admin/finance/office/vendors/${vendorId}`])
  return { success: true, id }
}

// ---------------------------------------------------------------------------
// Staff claims
// ---------------------------------------------------------------------------

export async function submitStaffClaim(formData: FormData) {
  const user = await requireStaffClaimAccess()
  const amount = num(formData.get("amount"))
  if (amount <= 0) return { error: "Amount must be greater than zero" }

  const category = str(formData.get("category"))
  if (!category) return { error: "Category is required" }

  const claimDate = str(formData.get("claim_date")) || today()
  const projectId = optId(formData.get("project_id"))
  const notes = str(formData.get("notes")) || null
  const receiptPath = str(formData.get("receipt_path")) || null
  const gpsLat = str(formData.get("gps_lat")) || null
  const gpsLng = str(formData.get("gps_lng")) || null
  const staffId = optId(formData.get("staff_id")) ?? user.id

  const claimNumber = await nextClaimNumber()
  const rows = (await sql`
    INSERT INTO staff_expenses (
      claim_number, staff_id, project_id, category, amount, claim_date,
      receipt_path, gps_lat, gps_lng, notes, status
    ) VALUES (
      ${claimNumber}, ${staffId}, ${projectId}, ${category}, ${amount}, ${claimDate},
      ${receiptPath}, ${gpsLat}, ${gpsLng}, ${notes}, 'Submitted'
    )
  `) as { id: number }[]
  const id = Number(rows[0]?.id)

  await logApproval({
    entityType: "staff_claim",
    entityId: id,
    action: "submit",
    fromStatus: null,
    toStatus: "Submitted",
    userId: user.id,
  })

  await notifyFinanceManagers({
    type: "finance.claim_submitted",
    title: "Staff expense claim submitted",
    message: `${claimNumber}: ₹${amount.toFixed(2)} (${category})`,
    entityType: "staff_claim",
    entityId: id,
  })

  await logAudit(user.id, "finance.claim.submit", "staff_claim", id, { claimNumber, amount })
  revalidateFinance()
  return { success: true, id, claimNumber }
}

export async function transitionStaffClaim(formData: FormData) {
  const user = await requireFinanceApprove()
  const id = optId(formData.get("id"))
  const toStatus = str(formData.get("status"))
  const comment = str(formData.get("comment")) || null
  const accountId = optId(formData.get("account_id"))
  if (!id || !toStatus) return { error: "Invalid request" }

  const existing = (await sql`
    SELECT * FROM staff_expenses WHERE id = ${id} AND deleted_at IS NULL
  `) as StaffExpenseClaim[]
  if (!existing[0]) return { error: "Not found" }
  const fromStatus = String(existing[0].status)

  if (toStatus === "Dept Review") {
    await sql`
      UPDATE staff_expenses SET status = ${toStatus},
        dept_reviewed_by = ${user.id}, dept_reviewed_at = NOW()
      WHERE id = ${id}
    `
  } else if (toStatus === "Admin Approval" || toStatus === "Finance Payment") {
    await sql`
      UPDATE staff_expenses SET status = ${toStatus},
        admin_approved_by = ${user.id}, admin_approved_at = NOW()
      WHERE id = ${id}
    `
  } else if (toStatus === "Completed") {
    const payAccount = accountId ?? (existing[0].account_id ? Number(existing[0].account_id) : null)
    await sql`
      UPDATE staff_expenses SET status = ${toStatus},
        paid_by = ${user.id}, paid_at = NOW(), account_id = ${payAccount}
      WHERE id = ${id}
    `
    const projectId = existing[0].project_id ? Number(existing[0].project_id) : null
    await recordLedgerEntry({
      scope: projectId ? "project" : "office",
      date: today(),
      amount: Number(existing[0].amount),
      direction: "out",
      accountId: payAccount,
      paymentMethod: "Cash",
      projectId,
      description: `Staff claim ${existing[0].claim_number}`,
      refType: "staff_claim",
      refId: id,
      createdBy: user.id,
      txnType: "staff_claim",
    })
    if (projectId) await syncProjectFinance(projectId)
    else await checkLowCashBalance()
  } else if (toStatus === "Rejected") {
    await sql`
      UPDATE staff_expenses SET status = ${toStatus}, rejection_reason = ${comment}
      WHERE id = ${id}
    `
  } else {
    await sql`UPDATE staff_expenses SET status = ${toStatus} WHERE id = ${id}`
  }

  await logApproval({
    entityType: "staff_claim",
    entityId: id,
    action: `status.${toStatus}`,
    fromStatus,
    toStatus,
    userId: user.id,
    comment,
  })

  await createFinanceNotification({
    userId: Number(existing[0].staff_id),
    type: "finance.claim_update",
    title: `Claim ${toStatus}`,
    message: `${existing[0].claim_number} is now ${toStatus}`,
    entityType: "staff_claim",
    entityId: id,
  })

  await logAudit(user.id, "finance.claim.status", "staff_claim", id, { fromStatus, toStatus })
  revalidateFinance()
  return { success: true }
}

// ---------------------------------------------------------------------------
// Categories (scoped)
// ---------------------------------------------------------------------------

export async function saveIncomeCategory(formData: FormData) {
  const user = await requireFinanceManage()
  const id = optId(formData.get("id"))
  const name = str(formData.get("name"))
  if (!name) return { error: "Name is required" }
  const icon = str(formData.get("icon")) || "CircleDollarSign"
  const color = str(formData.get("color")) || "#16a34a"
  const active = formData.get("active") === "0" ? 0 : 1
  const sortOrder = num(formData.get("sort_order"))
  const scope = str(formData.get("scope")) || "both"

  if (id) {
    await sql`
      UPDATE income_categories SET name=${name}, icon=${icon}, color=${color},
        active=${active}, sort_order=${sortOrder}, scope=${scope}
      WHERE id = ${id}
    `
    await logAudit(user.id, "finance.income_category.update", "income_category", id, { name, scope })
  } else {
    const rows = (await sql`
      INSERT INTO income_categories (name, icon, color, active, sort_order, scope)
      VALUES (${name}, ${icon}, ${color}, ${active}, ${sortOrder}, ${scope})
    `) as { id: number }[]
    await logAudit(user.id, "finance.income_category.create", "income_category", Number(rows[0]?.id), {
      name,
      scope,
    })
  }
  revalidateFinance()
  return { success: true }
}

export async function saveExpenseCategory(formData: FormData) {
  const user = await requireFinanceManage()
  const id = optId(formData.get("id"))
  const name = str(formData.get("name"))
  if (!name) return { error: "Name is required" }
  const icon = str(formData.get("icon")) || "Receipt"
  const color = str(formData.get("color")) || "#dc2626"
  const active = formData.get("active") === "0" ? 0 : 1
  const sortOrder = num(formData.get("sort_order"))
  const scope = str(formData.get("scope")) || "both"

  if (id) {
    await sql`
      UPDATE expense_categories SET name=${name}, icon=${icon}, color=${color},
        active=${active}, sort_order=${sortOrder}, scope=${scope}
      WHERE id = ${id}
    `
    await logAudit(user.id, "finance.expense_category.update", "expense_category", id, { name, scope })
  } else {
    const rows = (await sql`
      INSERT INTO expense_categories (name, icon, color, active, sort_order, scope)
      VALUES (${name}, ${icon}, ${color}, ${active}, ${sortOrder}, ${scope})
    `) as { id: number }[]
    await logAudit(user.id, "finance.expense_category.create", "expense_category", Number(rows[0]?.id), {
      name,
      scope,
    })
  }
  revalidateFinance()
  return { success: true }
}

export async function saveFinanceSettings(formData: FormData) {
  const user = await requireFinanceManage()
  const threshold = num(formData.get("low_cash_threshold"), 5000)
  await sql`
    INSERT INTO finance_settings (\`key\`, value)
    VALUES ('low_cash_threshold', ${sql.json(threshold)})
    ON DUPLICATE KEY UPDATE value = VALUES(value)
  `
  await logAudit(user.id, "finance.settings.update", "finance_settings", 0, { threshold })
  revalidateFinance()
  return { success: true }
}

export async function rebuildProjectFinance() {
  const user = await requireFinanceManage()
  const projects = (await sql`SELECT id FROM projects`) as { id: number }[]
  for (const p of projects) {
    await syncProjectFinance(Number(p.id))
  }
  await logAudit(user.id, "finance.project_finance.rebuild", "project_finance", 0, {
    count: projects.length,
  })
  revalidateFinance()
  return { success: true, count: projects.length }
}
