import "server-only"

import ExcelJS from "exceljs"
import { formatOfficeDate, formatOfficeTime } from "./datetime"
import type { AttendanceReportRow } from "./types"

function formatDate(value: string | null): string {
  if (!value) return ""
  const formatted = formatOfficeDate(value)
  return formatted === "—" ? "" : formatted
}

function formatTime(value: string | null): string {
  if (!value) return ""
  const formatted = formatOfficeTime(value)
  return formatted === "—" ? "" : formatted
}

function formatHours(value: number | null): string {
  if (value === null || value === undefined) return ""
  return value.toFixed(2)
}

const COLUMNS = [
  { header: "Date", key: "date" },
  { header: "Staff Name", key: "staff_name" },
  { header: "Department", key: "department" },
  { header: "Check In", key: "check_in" },
  { header: "Check Out", key: "check_out" },
  { header: "Working Hours", key: "working_hours" },
  { header: "Attendance Status", key: "attendance_status" },
  { header: "Location Verified", key: "location_verified" },
  { header: "Manual", key: "is_manual" },
  { header: "Distance", key: "distance" },
  { header: "Marked By", key: "marked_by" },
  { header: "Admin Note", key: "admin_note" },
] as const

function rowValues(row: AttendanceReportRow) {
  return {
    date: formatDate(row.date),
    staff_name: row.staff_name,
    department: row.department,
    check_in: formatTime(row.check_in),
    check_out: formatTime(row.check_out),
    working_hours: formatHours(row.working_hours),
    attendance_status: row.attendance_status,
    location_verified: row.location_verified ? "Yes" : "No",
    is_manual: row.is_manual ? "Yes" : "No",
    distance:
      row.distance_from_office == null ? "" : `${Math.round(row.distance_from_office)}m`,
    marked_by: row.marked_by_name ?? "",
    admin_note: row.admin_note ?? "",
  }
}

export function getAttendanceExportFileName(
  format: "xlsx" | "csv",
  date = new Date(),
): string {
  const iso = date.toISOString().slice(0, 10)
  return `Attendance_Report_${iso}.${format}`
}

export function buildAttendanceCsv(rows: AttendanceReportRow[]): string {
  const escape = (value: string) => {
    if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`
    return value
  }
  const lines = [COLUMNS.map((c) => c.header).join(",")]
  for (const row of rows) {
    const values = rowValues(row)
    lines.push(COLUMNS.map((c) => escape(String(values[c.key] ?? ""))).join(","))
  }
  return `\uFEFF${lines.join("\r\n")}`
}

export async function buildAttendanceExcelBuffer(
  rows: AttendanceReportRow[],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = "Acmmo Architects"
  workbook.created = new Date()

  const sheet = workbook.addWorksheet("Attendance", {
    views: [{ state: "frozen", ySplit: 1 }],
  })

  sheet.columns = COLUMNS.map((col) => ({
    header: col.header,
    key: col.key,
    width: 18,
  }))

  const headerRow = sheet.getRow(1)
  headerRow.font = { bold: true }
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE8EEF4" },
  }

  for (const row of rows) {
    sheet.addRow(rowValues(row))
  }

  for (const column of sheet.columns) {
    if (!column?.eachCell) continue
    let maxLength = column.header ? String(column.header).length : 10
    column.eachCell({ includeEmpty: false }, (cell) => {
      const length = cell.value != null ? String(cell.value).length : 0
      maxLength = Math.max(maxLength, length)
    })
    column.width = Math.min(Math.max(maxLength + 2, 10), 40)
  }

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}
