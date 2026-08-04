import "server-only"

import ExcelJS from "exceljs"
import type { FinanceExpense, FinanceIncome } from "@/lib/finance/types"

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
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = "Acmmo Architects"
  workbook.created = new Date()

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

  if (!income.length && !expenses.length) {
    const sheet = workbook.addWorksheet("Report")
    sheet.addRow(["No records found for the selected filters."])
  }

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}
