import "server-only"

import ExcelJS from "exceljs"
import type { InvoiceListRow } from "@/lib/queries"

export function getInvoicesExportFileName(date = new Date()): string {
  const iso = date.toISOString().slice(0, 10)
  return `Invoices_Report_${iso}.xlsx`
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

export async function buildInvoicesExcelBuffer(invoices: InvoiceListRow[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = "Architecture Office"
  workbook.created = new Date()

  const sheet = workbook.addWorksheet("Invoices")
  sheet.columns = [
    { header: "Invoice Number", key: "invoice_number", width: 18 },
    { header: "Project", key: "project_name", width: 24 },
    { header: "Project Code", key: "project_code", width: 14 },
    { header: "Client", key: "client_name", width: 22 },
    { header: "Invoice Date", key: "invoice_date", width: 14 },
    { header: "Due Date", key: "due_date", width: 14 },
    { header: "Status", key: "status", width: 14 },
    { header: "Subtotal", key: "subtotal", width: 12 },
    { header: "Tax", key: "tax_amount", width: 10 },
    { header: "Discount", key: "discount_amount", width: 10 },
    { header: "Total", key: "total", width: 12 },
    { header: "Amount Paid", key: "amount_paid", width: 12 },
    { header: "Balance", key: "balance", width: 12 },
  ]

  const headerRow = sheet.getRow(1)
  headerRow.font = { bold: true }
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF5F5F8" },
  }

  for (const inv of invoices) {
    sheet.addRow({
      invoice_number: inv.invoice_number,
      project_name: inv.project_name,
      project_code: inv.project_code,
      client_name: inv.client_name,
      invoice_date: formatDate(inv.invoice_date),
      due_date: formatDate(inv.due_date),
      status: inv.status,
      subtotal: Number(inv.subtotal),
      tax_amount: Number(inv.tax_amount),
      discount_amount: Number(inv.discount_amount),
      total: Number(inv.total),
      amount_paid: Number(inv.amount_paid),
      balance: Number(inv.balance),
    })
  }

  autoSizeColumns(sheet)
  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}
