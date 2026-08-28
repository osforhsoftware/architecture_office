import "server-only"

import ExcelJS from "exceljs"
import type {
  FinanceExpense,
  FinanceIncome,
  ProjectFinanceSummary,
} from "@/lib/finance/types"

type FinanceExportOptions = {
  title?: string
  from?: string
  to?: string
  projects?: ProjectFinanceSummary[]
  dateFiltered?: boolean
}

type SheetColumn = {
  header: string
  key: string
  width?: number
  numFmt?: string
}

const MONEY_FMT = "#,##0.00"

export function getFinanceExportFileName(type: string, date = new Date()): string {
  const iso = date.toISOString().slice(0, 10)
  return `Finance_${type}_${iso}.xlsx`
}

function text(value: string | number | null | undefined): string {
  if (value == null) return ""
  return String(value).trim()
}

function money(value: string | number | null | undefined): number {
  const n = Number(value || 0)
  return Number.isFinite(n) ? n : 0
}

function expenseTotal(row: FinanceExpense): number {
  return money(row.amount) + money(row.gst_amount)
}

function formatDate(value: string | null | undefined): string {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return text(value)
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return text(value)
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function parseSortTime(value: string | null | undefined): number {
  if (!value) return 0
  const time = new Date(value).getTime()
  return Number.isNaN(time) ? 0 : time
}

function autoSizeColumns(sheet: ExcelJS.Worksheet): void {
  for (const column of sheet.columns) {
    if (!column?.eachCell) continue
    let maxLength = column.header ? String(column.header).length : 10
    column.eachCell({ includeEmpty: false }, (cell) => {
      const length = cell.value != null ? String(cell.value).length : 0
      maxLength = Math.max(maxLength, length)
    })
    column.width = Math.min(Math.max(maxLength + 2, 12), 60)
  }
}

function styleHeader(sheet: ExcelJS.Worksheet): void {
  const headerRow = sheet.getRow(1)
  headerRow.font = { bold: true }
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE8EEF4" },
  }
}

function addDataSheet(
  workbook: ExcelJS.Workbook,
  name: string,
  columns: SheetColumn[],
  rows: Record<string, string | number>[],
): ExcelJS.Worksheet {
  const sheet = workbook.addWorksheet(name, {
    views: [{ state: "frozen", ySplit: 1 }],
  })
  sheet.columns = columns.map((col) => ({
    header: col.header,
    key: col.key,
    width: col.width ?? 14,
  }))
  styleHeader(sheet)
  for (const row of rows) {
    const added = sheet.addRow(row)
    columns.forEach((col, index) => {
      if (col.numFmt) added.getCell(index + 1).numFmt = col.numFmt
    })
  }
  autoSizeColumns(sheet)
  return sheet
}

function addTotalsRow(
  sheet: ExcelJS.Worksheet,
  values: Record<string, string | number>,
): void {
  const row = sheet.addRow(values)
  row.font = { bold: true }
}

function customerName(row: { client_name?: string | null; vendor_name?: string | null }): string {
  return text(row.client_name) || text(row.vendor_name)
}

function customerPhone(row: {
  client_phone?: string | null
  vendor_phone?: string | null
}): string {
  return text(row.client_phone) || text(row.vendor_phone)
}

function customerEmail(row: {
  client_email?: string | null
  vendor_email?: string | null
}): string {
  return text(row.client_email) || text(row.vendor_email)
}

function customerAddress(row: { client_address?: string | null }): string {
  return text(row.client_address)
}

function buildProjectRows(
  projects: ProjectFinanceSummary[],
  income: FinanceIncome[],
  expenses: FinanceExpense[],
  dateFiltered: boolean,
) {
  if (!dateFiltered) {
    return projects.map((row) => ({
      project_name: text(row.project_name),
      project_code: text(row.project_code),
      customer_name: text(row.client_name),
      customer_phone: text(row.client_phone),
      customer_email: text(row.client_email),
      customer_address: text(row.client_address),
      customer_street: text(row.client_street),
      customer_district: text(row.client_district),
      project_value: money(row.project_value),
      total_income: money(row.total_income),
      total_expense: money(row.total_expense),
      net_profit: money(row.net_profit),
      profit_percent: money(row.profit_percent),
      advance_received: money(row.advance_received),
      balance_amount: money(row.balance_amount),
      total_budget: money(row.total_budget),
    }))
  }

  const incomeByProject = new Map<number, number>()
  const expenseByProject = new Map<number, number>()
  for (const row of income) {
    if (!row.project_id) continue
    incomeByProject.set(row.project_id, (incomeByProject.get(row.project_id) ?? 0) + money(row.amount))
  }
  for (const row of expenses) {
    if (!row.project_id) continue
    expenseByProject.set(
      row.project_id,
      (expenseByProject.get(row.project_id) ?? 0) + expenseTotal(row),
    )
  }

  return projects
    .filter((row) => incomeByProject.has(row.project_id) || expenseByProject.has(row.project_id))
    .map((row) => {
      const total_income = incomeByProject.get(row.project_id) ?? 0
      const total_expense = expenseByProject.get(row.project_id) ?? 0
      const project_value = money(row.project_value)
      const net_profit = total_income - total_expense
      return {
        project_name: text(row.project_name),
        project_code: text(row.project_code),
        customer_name: text(row.client_name),
        customer_phone: text(row.client_phone),
        customer_email: text(row.client_email),
        customer_address: text(row.client_address),
        customer_street: text(row.client_street),
        customer_district: text(row.client_district),
        project_value,
        total_income,
        total_expense,
        net_profit,
        profit_percent: project_value > 0 ? (net_profit / project_value) * 100 : 0,
        advance_received: money(row.advance_received),
        balance_amount: money(row.balance_amount),
        total_budget: money(row.total_budget),
      }
    })
}

function buildTransactionRows(income: FinanceIncome[], expenses: FinanceExpense[]) {
  const rows = [
    ...income.map((row) => {
      const amount = money(row.amount)
      return {
        date: formatDate(row.income_date),
        sortTime: parseSortTime(row.income_date),
        type: "Income",
        number: text(row.receipt_number),
        customer_name: customerName(row),
        customer_phone: customerPhone(row),
        customer_email: customerEmail(row),
        customer_address: customerAddress(row),
        vendor_name: "",
        project_name: text(row.project_name),
        project_code: text(row.project_code),
        category_name: text(row.category_name),
        account_name: text(row.account_name),
        payment_method: text(row.payment_method),
        reference_number: text(row.reference_number),
        notes: text(row.notes),
        status: text(row.status),
        ledger_scope: text(row.ledger_scope),
        value: amount,
        income: amount,
        expense: 0,
        net_profit: amount,
      }
    }),
    ...expenses.map((row) => {
      const amount = expenseTotal(row)
      return {
        date: formatDate(row.expense_date),
        sortTime: parseSortTime(row.expense_date),
        type: "Expense",
        number: text(row.expense_number),
        customer_name: customerName(row),
        customer_phone: customerPhone(row),
        customer_email: customerEmail(row),
        customer_address: customerAddress(row),
        vendor_name: text(row.vendor_name),
        project_name: text(row.project_name),
        project_code: text(row.project_code),
        category_name: text(row.category_name),
        account_name: text(row.account_name),
        payment_method: text(row.payment_method),
        reference_number: text(row.reference_number),
        notes: text(row.notes),
        status: text(row.status),
        ledger_scope: text(row.ledger_scope),
        value: amount,
        income: 0,
        expense: amount,
        net_profit: -amount,
      }
    }),
  ]

  rows.sort((a, b) => b.sortTime - a.sortTime || a.number.localeCompare(b.number))
  return rows.map(({ sortTime: _sortTime, ...row }) => row)
}

function buildIncomeRows(income: FinanceIncome[]) {
  return income.map((row) => ({
    receipt_number: text(row.receipt_number),
    income_date: formatDate(row.income_date),
    ledger_scope: text(row.ledger_scope),
    customer_name: text(row.client_name),
    customer_phone: text(row.client_phone),
    customer_email: text(row.client_email),
    customer_address: text(row.client_address),
    project_name: text(row.project_name),
    project_code: text(row.project_code),
    category_name: text(row.category_name),
    account_name: text(row.account_name),
    payment_method: text(row.payment_method),
    amount: money(row.amount),
    reference_number: text(row.reference_number),
    notes: text(row.notes),
    status: text(row.status),
    creator_name: text(row.creator_name),
    approver_name: text(row.approver_name),
    approved_at: formatDateTime(row.approved_at),
    created_at: formatDateTime(row.created_at),
  }))
}

function buildExpenseRows(expenses: FinanceExpense[]) {
  return expenses.map((row) => ({
    expense_number: text(row.expense_number),
    expense_date: formatDate(row.expense_date),
    ledger_scope: text(row.ledger_scope),
    customer_name: text(row.client_name),
    customer_phone: text(row.client_phone),
    customer_email: text(row.client_email),
    customer_address: text(row.client_address),
    vendor_name: text(row.vendor_name),
    vendor_phone: text(row.vendor_phone),
    vendor_email: text(row.vendor_email),
    project_name: text(row.project_name),
    project_code: text(row.project_code),
    category_name: text(row.category_name),
    account_name: text(row.account_name),
    amount: money(row.amount),
    gst_amount: money(row.gst_amount),
    total: expenseTotal(row),
    payment_method: text(row.payment_method),
    reference_number: text(row.reference_number),
    notes: text(row.notes),
    status: text(row.status),
    creator_name: text(row.creator_name),
    approver_name: text(row.approver_name),
    approved_at: formatDateTime(row.approved_at),
    paid_at: formatDateTime(row.paid_at),
    created_at: formatDateTime(row.created_at),
  }))
}

const PROJECT_COLUMNS: SheetColumn[] = [
  { header: "Project", key: "project_name", width: 24 },
  { header: "Code", key: "project_code", width: 14 },
  { header: "Customer", key: "customer_name", width: 22 },
  { header: "Customer Phone", key: "customer_phone", width: 16 },
  { header: "Customer Email", key: "customer_email", width: 22 },
  { header: "Customer Address", key: "customer_address", width: 28 },
  { header: "Street", key: "customer_street", width: 18 },
  { header: "District", key: "customer_district", width: 16 },
  { header: "Value", key: "project_value", width: 14, numFmt: MONEY_FMT },
  { header: "Income", key: "total_income", width: 14, numFmt: MONEY_FMT },
  { header: "Expense", key: "total_expense", width: 14, numFmt: MONEY_FMT },
  { header: "Net Profit", key: "net_profit", width: 14, numFmt: MONEY_FMT },
  { header: "Margin %", key: "profit_percent", width: 12, numFmt: MONEY_FMT },
  { header: "Advance Received", key: "advance_received", width: 16, numFmt: MONEY_FMT },
  { header: "Balance", key: "balance_amount", width: 14, numFmt: MONEY_FMT },
  { header: "Budget", key: "total_budget", width: 14, numFmt: MONEY_FMT },
]

const TRANSACTION_COLUMNS: SheetColumn[] = [
  { header: "Date", key: "date", width: 14 },
  { header: "Type", key: "type", width: 12 },
  { header: "Number", key: "number", width: 16 },
  { header: "Customer", key: "customer_name", width: 22 },
  { header: "Customer Phone", key: "customer_phone", width: 16 },
  { header: "Customer Email", key: "customer_email", width: 22 },
  { header: "Customer Address", key: "customer_address", width: 28 },
  { header: "Vendor", key: "vendor_name", width: 22 },
  { header: "Project", key: "project_name", width: 22 },
  { header: "Project Code", key: "project_code", width: 14 },
  { header: "Category", key: "category_name", width: 18 },
  { header: "Account", key: "account_name", width: 16 },
  { header: "Method", key: "payment_method", width: 14 },
  { header: "Reference", key: "reference_number", width: 16 },
  { header: "Notes", key: "notes", width: 28 },
  { header: "Status", key: "status", width: 12 },
  { header: "Ledger", key: "ledger_scope", width: 12 },
  { header: "Value", key: "value", width: 14, numFmt: MONEY_FMT },
  { header: "Income", key: "income", width: 14, numFmt: MONEY_FMT },
  { header: "Expense", key: "expense", width: 14, numFmt: MONEY_FMT },
  { header: "Net Profit", key: "net_profit", width: 14, numFmt: MONEY_FMT },
]

const INCOME_COLUMNS: SheetColumn[] = [
  { header: "Receipt #", key: "receipt_number", width: 16 },
  { header: "Date", key: "income_date", width: 14 },
  { header: "Ledger", key: "ledger_scope", width: 12 },
  { header: "Customer", key: "customer_name", width: 22 },
  { header: "Customer Phone", key: "customer_phone", width: 16 },
  { header: "Customer Email", key: "customer_email", width: 22 },
  { header: "Customer Address", key: "customer_address", width: 28 },
  { header: "Project", key: "project_name", width: 22 },
  { header: "Project Code", key: "project_code", width: 14 },
  { header: "Category", key: "category_name", width: 18 },
  { header: "Account", key: "account_name", width: 16 },
  { header: "Method", key: "payment_method", width: 14 },
  { header: "Value / Amount", key: "amount", width: 14, numFmt: MONEY_FMT },
  { header: "Reference", key: "reference_number", width: 16 },
  { header: "Notes", key: "notes", width: 28 },
  { header: "Status", key: "status", width: 12 },
  { header: "Created By", key: "creator_name", width: 16 },
  { header: "Approved By", key: "approver_name", width: 16 },
  { header: "Approved At", key: "approved_at", width: 18 },
  { header: "Created At", key: "created_at", width: 18 },
]

const EXPENSE_COLUMNS: SheetColumn[] = [
  { header: "Expense #", key: "expense_number", width: 16 },
  { header: "Date", key: "expense_date", width: 14 },
  { header: "Ledger", key: "ledger_scope", width: 12 },
  { header: "Customer", key: "customer_name", width: 22 },
  { header: "Customer Phone", key: "customer_phone", width: 16 },
  { header: "Customer Email", key: "customer_email", width: 22 },
  { header: "Customer Address", key: "customer_address", width: 28 },
  { header: "Vendor", key: "vendor_name", width: 22 },
  { header: "Vendor Phone", key: "vendor_phone", width: 16 },
  { header: "Vendor Email", key: "vendor_email", width: 22 },
  { header: "Project", key: "project_name", width: 22 },
  { header: "Project Code", key: "project_code", width: 14 },
  { header: "Category", key: "category_name", width: 18 },
  { header: "Account", key: "account_name", width: 16 },
  { header: "Amount", key: "amount", width: 12, numFmt: MONEY_FMT },
  { header: "GST", key: "gst_amount", width: 10, numFmt: MONEY_FMT },
  { header: "Value / Total", key: "total", width: 14, numFmt: MONEY_FMT },
  { header: "Method", key: "payment_method", width: 14 },
  { header: "Reference", key: "reference_number", width: 16 },
  { header: "Notes", key: "notes", width: 28 },
  { header: "Status", key: "status", width: 12 },
  { header: "Created By", key: "creator_name", width: 16 },
  { header: "Approved By", key: "approver_name", width: 16 },
  { header: "Approved At", key: "approved_at", width: 18 },
  { header: "Paid At", key: "paid_at", width: 18 },
  { header: "Created At", key: "created_at", width: 18 },
]

export async function buildFinanceExcelBuffer(
  income: FinanceIncome[],
  expenses: FinanceExpense[],
  options: FinanceExportOptions = {},
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = "Acmmo Architects"
  workbook.title = options.title ?? "Finance Report"
  workbook.created = new Date()
  if (options.from || options.to) {
    workbook.description = `Period: ${[options.from || "…", options.to || "…"].join(" to ")}`
  }

  const projects = options.projects ?? []
  const dateFiltered = Boolean(options.dateFiltered)
  const projectRows = buildProjectRows(projects, income, expenses, dateFiltered)
  const includeProjects = projectRows.length > 0
  const txnRows = buildTransactionRows(income, expenses)

  if (includeProjects) {
    const sheet = addDataSheet(workbook, "Projects", PROJECT_COLUMNS, projectRows)
    addTotalsRow(sheet, {
      project_name: "TOTAL",
      project_value: projectRows.reduce((sum, row) => sum + row.project_value, 0),
      total_income: projectRows.reduce((sum, row) => sum + row.total_income, 0),
      total_expense: projectRows.reduce((sum, row) => sum + row.total_expense, 0),
      net_profit: projectRows.reduce((sum, row) => sum + row.net_profit, 0),
    })
    for (const key of ["project_value", "total_income", "total_expense", "net_profit"] as const) {
      const col = sheet.getColumn(key)
      col.numFmt = MONEY_FMT
    }
  }

  const txnSheet = addDataSheet(workbook, "Transaction History", TRANSACTION_COLUMNS, txnRows)
  if (txnRows.length) {
    const totalIncome = txnRows.reduce((sum, row) => sum + row.income, 0)
    const totalExpense = txnRows.reduce((sum, row) => sum + row.expense, 0)
    addTotalsRow(txnSheet, {
      date: "TOTAL",
      value: totalIncome + totalExpense,
      income: totalIncome,
      expense: totalExpense,
      net_profit: totalIncome - totalExpense,
    })
  } else {
    addTotalsRow(txnSheet, {
      date: options.from || options.to
        ? "No records found for the selected period."
        : "No records found.",
    })
  }
  for (const key of ["value", "income", "expense", "net_profit"] as const) {
    const col = txnSheet.getColumn(key)
    col.numFmt = MONEY_FMT
  }

  if (income.length) {
    const incomeRows = buildIncomeRows(income)
    const sheet = addDataSheet(workbook, "Income", INCOME_COLUMNS, incomeRows)
    addTotalsRow(sheet, {
      receipt_number: "TOTAL",
      amount: incomeRows.reduce((sum, row) => sum + row.amount, 0),
    })
    sheet.getColumn("amount").numFmt = MONEY_FMT
  }

  if (expenses.length) {
    const expenseRows = buildExpenseRows(expenses)
    const sheet = addDataSheet(workbook, "Expenses", EXPENSE_COLUMNS, expenseRows)
    addTotalsRow(sheet, {
      expense_number: "TOTAL",
      amount: expenseRows.reduce((sum, row) => sum + row.amount, 0),
      gst_amount: expenseRows.reduce((sum, row) => sum + row.gst_amount, 0),
      total: expenseRows.reduce((sum, row) => sum + row.total, 0),
    })
    for (const key of ["amount", "gst_amount", "total"] as const) {
      sheet.getColumn(key).numFmt = MONEY_FMT
    }
  }

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}
