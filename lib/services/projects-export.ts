import "server-only"

import ExcelJS from "exceljs"
import type { Project } from "@/lib/types"

type ExportCellValue = string | number | null

interface ProjectExportColumn {
  header: string
  key: string
  getValue: (project: Project) => ExportCellValue
}

const PROJECT_EXPORT_COLUMNS: ProjectExportColumn[] = [
  { header: "ID", key: "id", getValue: (p) => p.id },
  { header: "Project Code", key: "code", getValue: (p) => p.code },
  { header: "Project Name", key: "name", getValue: (p) => p.name },
  { header: "Client ID", key: "client_id", getValue: (p) => p.client_id },
  { header: "Client Name", key: "client_name", getValue: (p) => p.client_name ?? null },
  { header: "Client Phone", key: "client_phone", getValue: (p) => p.client_phone ?? null },
  { header: "Location", key: "location", getValue: (p) => p.location },
  { header: "Type", key: "type", getValue: (p) => p.type },
  { header: "Priority", key: "priority", getValue: (p) => p.priority },
  { header: "Status", key: "status", getValue: (p) => p.status },
  { header: "Department", key: "section", getValue: (p) => p.section },
  { header: "Current Stage", key: "current_stage", getValue: (p) => p.current_stage },
  { header: "Assigned To ID", key: "assigned_to", getValue: (p) => p.assigned_to },
  { header: "Assignee Name", key: "assignee_name", getValue: (p) => p.assignee_name ?? null },
  { header: "Due Date", key: "due_date", getValue: (p) => formatDate(p.due_date) },
  { header: "Project Amount", key: "project_amount", getValue: (p) => p.project_amount },
  { header: "Advance Received", key: "advance_received", getValue: (p) => p.advance_received },
  { header: "Invoice Number", key: "invoice_number", getValue: (p) => p.invoice_number },
  { header: "Payment Status", key: "payment_status", getValue: (p) => p.payment_status },
  { header: "Review Note", key: "review_note", getValue: (p) => p.review_note },
  { header: "Created At", key: "created_at", getValue: (p) => formatDateTime(p.created_at) },
  { header: "Updated At", key: "updated_at", getValue: (p) => formatDateTime(p.updated_at) },
]

export function getProjectsExportFileName(date = new Date()): string {
  const iso = date.toISOString().slice(0, 10)
  return `Projects_Report_${iso}.xlsx`
}

function formatDate(value: string | null): string | null {
  if (!value) return null
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
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
    column.width = Math.min(Math.max(maxLength + 2, 10), 60)
  }
}

export async function buildProjectsExcelBuffer(projects: Project[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = "Architecture Office"
  workbook.created = new Date()

  const sheet = workbook.addWorksheet("Projects", {
    views: [{ state: "frozen", ySplit: 1 }],
  })

  sheet.columns = PROJECT_EXPORT_COLUMNS.map((col) => ({
    header: col.header,
    key: col.key,
  }))

  const headerRow = sheet.getRow(1)
  headerRow.font = { bold: true }
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE8EEF4" },
  }

  for (const project of projects) {
    const row: Record<string, ExportCellValue> = {}
    for (const col of PROJECT_EXPORT_COLUMNS) {
      row[col.key] = col.getValue(project)
    }
    sheet.addRow(row)
  }

  autoSizeColumns(sheet)

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}
