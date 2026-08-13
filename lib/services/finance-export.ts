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
}

export function getFinanceExportFileName(type: string, date = new Date()): string {
  const iso = date.toISOString().slice(0, 10)
  return `Finance_${type}_${iso}.xlsx`
}

function formatDate(value: string | null): string {
  if (!value) return ""
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

function autoSizeColumns(sheet: ExcelJS.Worksheet): void {
  for (const column of sheet.columns) {
    if (!column?.eachCell) continue
    let maxLength = column.header ? String(column.header).length : 10
    column.eachCell({ includeEmpty: false }, (cell) => {
      const length = cell.value != null ? String(cell.value).length : 0
      maxLength = Math.max(maxLength, length)
    })
    column.width = Math.min(Math.max(maxLength + 2, 10), 50)
  }
}

function styleHeader(sheet: ExcelJS.Worksheet): void {
  const headerRow = sheet.getRow(1)
  headerRow.font = { bold: true }
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF5F5F8" },
  }
}

export async function buildFinanceExcelBuffer(
  income: FinanceIncome[],
  expenses: FinanceExpense[],
  options: FinanceExportOptions = {},
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = "Acmmo Architects"
  workbook.created = new Date()

  const totalIncome = income.reduce((sum, row) => sum + Number(row.amount || 0), 0)
  const totalExpense = expenses.reduce(
    (sum, row) => sum + Number(row.amount || 0) + Number(row.gst_amount || 0),
    0,
  )
  const summarySheet = workbook.addWorksheet("Summary")
  summarySheet.columns = [
    { header: "Metric", key: "metric", width: 24 },
    { header: "Value", key: "value", width: 28 },
  ]
  styleHeader(summarySheet)
  summarySheet.addRow({ metric: "Report", value: options.title ?? "Finance Report" })
  summarySheet.addRow({
    metric: "Generated",
    value: new Date().toLocaleString("en-IN"),
  })
  if (options.from || options.to) {
    summarySheet.addRow({
      metric: "Period",
      value: [options.from || "…", options.to || "…"].join(" to "),
    })
  }
  summarySheet.addRow({ metric: "Income records", value: income.length })
  summarySheet.addRow({ metric: "Expense records", value: expenses.length })
  summarySheet.addRow({ metric: "Total Income", value: totalIncome })
  summarySheet.addRow({ metric: "Total Expenses", value: totalExpense })
  summarySheet.addRow({ metric: "Net", value: totalIncome - totalExpense })
  autoSizeColumns(summarySheet)

  if (options.projects?.length) {
    const projectSheet = workbook.addWorksheet("Project Profit")
    projectSheet.columns = [
      { header: "Project", key: "project_name", width: 24 },
      { header: "Code", key: "project_code", width: 14 },
      { header: "Client", key: "client_name", width: 22 },
      { header: "Value", key: "project_value", width: 14 },
      { header: "Income", key: "total_income", width: 14 },
      { header: "Expense", key: "total_expense", width: 14 },
      { header: "Net Profit", key: "net_profit", width: 14 },
      { header: "Margin %", key: "profit_percent", width: 12 },
    ]
    styleHeader(projectSheet)
    for (const row of options.projects) {
      projectSheet.addRow({
        project_name: row.project_name,
        project_code: row.project_code,
        client_name: row.client_name,
        project_value: Number(row.project_value),
        total_income: Number(row.total_income),
        total_expense: Number(row.total_expense),
        net_profit: Number(row.net_profit),
        profit_percent: Number(row.profit_percent),
      })
    }
    autoSizeColumns(projectSheet)
  }

  if (income.length) {
    const incomeSheet = workbook.addWorksheet("Income")
    incomeSheet.columns = [
      { header: "Receipt #", key: "receipt_number", width: 16 },
      { header: "Date", key: "income_date", width: 14 },
      { header: "Client", key: "client_name", width: 22 },
      { header: "Project", key: "project_name", width: 22 },
      { header: "Category", key: "category_name", width: 18 },
      { header: "Account", key: "account_name", width: 16 },
      { header: "Method", key: "payment_method", width: 14 },
      { header: "Amount", key: "amount", width: 12 },
      { header: "Reference", key: "reference_number", width: 16 },
      { header: "Status", key: "status", width: 12 },
    ]
    styleHeader(incomeSheet)
    for (const row of income) {
      incomeSheet.addRow({
        receipt_number: row.receipt_number,
        income_date: formatDate(row.income_date),
        client_name: row.client_name,
        project_name: row.project_name,
        category_name: row.category_name,
        account_name: row.account_name,
        payment_method: row.payment_method,
        amount: Number(row.amount),
        reference_number: row.reference_number,
        status: row.status,
      })
    }
    autoSizeColumns(incomeSheet)
  }

  if (expenses.length) {
    const expenseSheet = workbook.addWorksheet("Expenses")
    expenseSheet.columns = [
      { header: "Expense #", key: "expense_number", width: 16 },
      { header: "Date", key: "expense_date", width: 14 },
      { header: "Vendor", key: "vendor_name", width: 22 },
      { header: "Project", key: "project_name", width: 22 },
      { header: "Category", key: "category_name", width: 18 },
      { header: "Amount", key: "amount", width: 12 },
      { header: "GST", key: "gst_amount", width: 10 },
      { header: "Total", key: "total", width: 12 },
      { header: "Method", key: "payment_method", width: 14 },
      { header: "Status", key: "status", width: 12 },
    ]
    styleHeader(expenseSheet)
    for (const row of expenses) {
      expenseSheet.addRow({
        expense_number: row.expense_number,
        expense_date: formatDate(row.expense_date),
        vendor_name: row.vendor_name,
        project_name: row.project_name,
        category_name: row.category_name,
        amount: Number(row.amount),
        gst_amount: Number(row.gst_amount),
        total: Number(row.amount) + Number(row.gst_amount),
        payment_method: row.payment_method,
        status: row.status,
      })
    }
    autoSizeColumns(expenseSheet)
  }

  if (!income.length && !expenses.length && !options.projects?.length) {
    const sheet = workbook.addWorksheet("Report")
    sheet.addRow(["No records found for the selected filters."])
  }

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}
