"use client"

import { useMemo, useState } from "react"
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table"
import { FileDown, FileSpreadsheet, Loader2, Printer } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DebouncedSearchInput } from "@/components/debounced-search-input"
import { DataTablePagination } from "@/components/data-table-pagination"
import { TableLoadingOverlay } from "@/components/table-loading-overlay"
import { TableQueryProvider, useTableParams } from "@/components/use-table-params"
import { HorizontalScrollArea } from "@/components/horizontal-scroll-area"
import { apiFetch } from "@/lib/app-urls"
import type { PaginatedResult } from "@/lib/pagination"
import type { AttendanceReportRow } from "@/lib/attendance/types"
import { todayInOfficeTzClient } from "@/lib/attendance/client-utils"
import { formatOfficeDate, formatOfficeTime } from "@/lib/attendance/datetime"

function Filters({
  staffOptions,
  departments,
  date,
  month,
  staffId,
  department,
}: {
  staffOptions: { id: number; name: string }[]
  departments: string[]
  date: string
  month: string
  staffId: string
  department: string
}) {
  const { updateParams, isPending } = useTableParams()

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="w-full max-w-sm">
          <DebouncedSearchInput placeholder="Search staff…" />
        </div>
        <div className="flex flex-wrap gap-2">
          <ExportButtons />
          <Button type="button" variant="outline" size="sm" onClick={() => window.print()}>
            <Printer />
            Print Report
          </Button>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="mb-1 text-xs text-muted-foreground">Date</p>
          <Input
            type="date"
            value={date}
            disabled={isPending}
            onChange={(e) =>
              updateParams(
                { date: e.target.value || null, month: null, from: null, to: null },
                { resetPage: true },
              )
            }
          />
        </div>
        <div>
          <p className="mb-1 text-xs text-muted-foreground">Month</p>
          <Input
            type="month"
            value={month}
            disabled={isPending}
            onChange={(e) =>
              updateParams(
                { month: e.target.value || null, date: null, from: null, to: null },
                { resetPage: true },
              )
            }
          />
        </div>
        <div>
          <p className="mb-1 text-xs text-muted-foreground">Staff</p>
          <Select
            value={staffId || "all"}
            disabled={isPending}
            onValueChange={(value) => {
              if (!value) return
              updateParams(
                { staffId: value === "all" ? null : value },
                { resetPage: true },
              )
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="All staff" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All staff</SelectItem>
              {staffOptions.map((s) => (
                <SelectItem key={s.id} value={String(s.id)}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <p className="mb-1 text-xs text-muted-foreground">Department</p>
          <Select
            value={department || "all"}
            disabled={isPending}
            onValueChange={(value) => {
              if (!value) return
              updateParams(
                { department: value === "all" ? null : value },
                { resetPage: true },
              )
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="All departments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All departments</SelectItem>
              {departments.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={isPending}
          onClick={() =>
            updateParams(
              {
                date: todayInOfficeTzClient(),
                month: null,
                from: null,
                to: null,
                staffId: null,
                department: null,
                search: null,
              },
              { resetPage: true },
            )
          }
        >
          Today
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={isPending}
          onClick={() =>
            updateParams(
              {
                date: null,
                month: null,
                from: null,
                to: null,
                staffId: null,
                department: null,
                search: null,
              },
              { resetPage: true },
            )
          }
        >
          Clear filters
        </Button>
      </div>
    </div>
  )
}

function ExportButtons() {
  const { searchParams } = useTableParams()
  const [loading, setLoading] = useState<"csv" | "xlsx" | null>(null)

  async function exportFile(format: "csv" | "xlsx") {
    setLoading(format)
    try {
      const qs = new URLSearchParams(searchParams.toString())
      qs.set("format", format)
      const response = await apiFetch(`/api/admin/attendance/export?${qs.toString()}`)
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null
        throw new Error(data?.error ?? "Export failed")
      }
      const blob = await response.blob()
      const disposition = response.headers.get("Content-Disposition")
      const fileNameMatch = disposition?.match(/filename="(.+)"/)
      const fileName =
        fileNameMatch?.[1] ??
        `Attendance_Report_${new Date().toISOString().slice(0, 10)}.${format}`
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = fileName
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to export")
    } finally {
      setLoading(null)
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={loading !== null}
        onClick={() => exportFile("csv")}
      >
        {loading === "csv" ? <Loader2 className="animate-spin" /> : <FileDown />}
        Export CSV
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={loading !== null}
        onClick={() => exportFile("xlsx")}
      >
        {loading === "xlsx" ? <Loader2 className="animate-spin" /> : <FileSpreadsheet />}
        Export Excel
      </Button>
    </>
  )
}

function AttendanceTable({ result }: { result: PaginatedResult<AttendanceReportRow> }) {
  const columns = useMemo<ColumnDef<AttendanceReportRow>[]>(
    () => [
      {
        accessorKey: "date",
        header: "Date",
        cell: ({ row }) => formatOfficeDate(row.original.date),
      },
      {
        accessorKey: "staff_name",
        header: "Staff Name",
      },
      {
        accessorKey: "department",
        header: "Department",
      },
      {
        accessorKey: "check_in",
        header: "Check In",
        cell: ({ row }) => formatOfficeTime(row.original.check_in),
      },
      {
        accessorKey: "check_out",
        header: "Check Out",
        cell: ({ row }) => formatOfficeTime(row.original.check_out),
      },
      {
        accessorKey: "working_hours",
        header: "Working Hours",
        cell: ({ row }) =>
          row.original.working_hours == null ? "—" : row.original.working_hours.toFixed(2),
      },
      {
        accessorKey: "attendance_status",
        header: "Attendance Status",
        cell: ({ row }) => {
          const status = row.original.attendance_status
          return (
            <Badge
              variant={
                status === "Late Coming"
                  ? "destructive"
                  : status === "Present"
                    ? "default"
                    : "secondary"
              }
            >
              {status}
              {row.original.is_manual ? " · Manual" : ""}
            </Badge>
          )
        },
      },
      {
        accessorKey: "location_verified",
        header: "Location Verified",
        cell: ({ row }) => (row.original.location_verified ? "Yes" : "No"),
      },
    ],
    [],
  )

  const table = useReactTable({
    data: result.rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <TableLoadingOverlay>
      <HorizontalScrollArea>
        <table className="w-full min-w-[900px] text-left text-sm" id="attendance-print-table">
          <thead className="border-b border-border/60 text-xs uppercase tracking-wide text-muted-foreground">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => (
                  <th key={header.id} className="px-3 py-2.5 font-medium">
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-3 py-10 text-center text-muted-foreground">
                  No attendance records found.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="border-b border-border/40 last:border-0">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-3 py-2.5 align-middle">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </HorizontalScrollArea>
      <div className="mt-4 print:hidden">
        <DataTablePagination
          total={result.total}
          page={result.page}
          pageSize={result.pageSize}
          totalPages={result.totalPages}
          entityLabel="record"
        />
      </div>
    </TableLoadingOverlay>
  )
}

export function AttendanceDataTable({
  result,
  staffOptions,
  departments,
  date,
  month,
  staffId,
  department,
}: {
  result: PaginatedResult<AttendanceReportRow>
  staffOptions: { id: number; name: string }[]
  departments: string[]
  date: string
  month: string
  staffId: string
  department: string
}) {
  return (
    <TableQueryProvider>
      <div className="flex flex-col gap-4">
        <div className="print:hidden">
          <Filters
            staffOptions={staffOptions}
            departments={departments}
            date={date}
            month={month}
            staffId={staffId}
            department={department}
          />
        </div>
        <div className="print:block">
          <p className="mb-3 hidden text-lg font-semibold print:block">Attendance Report</p>
          <AttendanceTable result={result} />
        </div>
      </div>
    </TableQueryProvider>
  )
}
