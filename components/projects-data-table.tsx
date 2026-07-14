"use client"

import { useMemo } from "react"
import Link from "next/link"
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { StatusBadge } from "@/components/status-badges"
import { DebouncedSearchInput } from "@/components/debounced-search-input"
import { DataTablePagination } from "@/components/data-table-pagination"
import { TableLoadingOverlay } from "@/components/table-loading-overlay"
import { TableQueryProvider, useTableParams } from "@/components/use-table-params"
import { formatCurrency, projectProgressPercent, WORKFLOW_STAGES } from "@/lib/constants"
import { cn } from "@/lib/utils"
import type { PaginatedResult } from "@/lib/pagination"
import type { Project } from "@/lib/types"

interface ProjectsDataTableProps {
  result: PaginatedResult<Project>
  search: string
  status: string
  section: string
  statusOptions: string[]
  sectionOptions: string[]
  hideSectionFilter?: boolean
}

function ProjectsTableInner({
  result,
  search,
  status,
  section,
  statusOptions,
  sectionOptions,
  hideSectionFilter = false,
}: ProjectsDataTableProps) {
  const { updateParams } = useTableParams()

  const columns = useMemo<ColumnDef<Project>[]>(
    () => [
      {
        accessorKey: "code",
        header: "Project ID",
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">{row.original.code}</span>
        ),
      },
      {
        accessorKey: "name",
        header: "Project Name",
        cell: ({ row }) => (
          <Link
            href={`/admin/projects/${row.original.id}`}
            className="font-medium hover:text-primary hover:underline"
          >
            {row.original.name}
          </Link>
        ),
      },
      {
        accessorKey: "client_name",
        header: "Client",
        cell: ({ getValue }) => <span className="text-sm">{getValue() as string}</span>,
      },
      {
        accessorKey: "section",
        header: "Department",
        cell: ({ getValue }) => (
          <span className="text-sm text-muted-foreground">{getValue() as string}</span>
        ),
      },
      {
        id: "stage",
        header: "Current Stage",
        accessorFn: (row) => WORKFLOW_STAGES[row.current_stage]?.label ?? "—",
        cell: ({ getValue }) => (
          <span className="max-w-[140px] truncate text-xs">{getValue() as string}</span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ getValue }) => <StatusBadge status={getValue() as string} />,
      },
      {
        accessorKey: "due_date",
        header: "Due Date",
        cell: ({ getValue }) => {
          const v = getValue() as string | null
          return (
            <span className="text-sm tabular-nums">
              {v ? new Date(v).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "—"}
            </span>
          )
        },
      },
      {
        id: "progress",
        header: "Progress",
        accessorFn: (row) => projectProgressPercent(row.current_stage),
        cell: ({ getValue }) => {
          const pct = getValue() as number
          return (
            <div className="flex min-w-[100px] items-center gap-2">
              <Progress value={pct} className="h-1.5 flex-1" />
              <span className="text-xs tabular-nums text-muted-foreground">{pct}%</span>
            </div>
          )
        },
      },
      {
        accessorKey: "project_amount",
        header: "Amount",
        cell: ({ getValue }) => (
          <span className="text-sm font-medium tabular-nums">
            {formatCurrency(getValue() as string)}
          </span>
        ),
      },
    ],
    [],
  )

  const table = useReactTable({
    data: result.rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount: result.totalPages,
  })

  const hasSearch = Boolean(search.trim())
  const emptyMessage = hasSearch ? "No Results Found" : "No projects match your filters."

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <DebouncedSearchInput placeholder="Search projects, clients, IDs, phone, email..." />
        <div className="flex flex-wrap gap-2">
          <Select
            value={status}
            onValueChange={(value) => {
              if (!value) return
              updateParams({ status: value === "all" ? null : value }, { resetPage: true })
            }}
          >
            <SelectTrigger className="w-full min-w-0 sm:w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {statusOptions.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!hideSectionFilter ? (
          <Select
            value={section}
            onValueChange={(value) => {
              if (!value) return
              updateParams({ section: value === "all" ? null : value }, { resetPage: true })
            }}
          >
            <SelectTrigger className="w-full min-w-0 sm:w-[180px]">
              <SelectValue placeholder="Department" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All departments</SelectItem>
              {sectionOptions.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          ) : null}
        </div>
      </div>

      <TableLoadingOverlay>
        <div className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-premium">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 border-b border-border bg-muted/50 backdrop-blur">
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id}>
                    {hg.headers.map((header) => (
                      <th
                        key={header.id}
                        className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.length ? (
                  table.getRowModel().rows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-border/50 transition-colors hover:bg-muted/40"
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td
                          key={cell.id}
                          className={cn(
                            "px-4 py-3 align-middle",
                            cell.column.id === "status" && "whitespace-nowrap",
                          )}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={columns.length} className="px-4 py-16 text-center text-muted-foreground">
                      {emptyMessage}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <DataTablePagination
            total={result.total}
            page={result.page}
            pageSize={result.pageSize}
            totalPages={result.totalPages}
            entityLabel="project"
            searchActive={hasSearch}
          />
        </div>
      </TableLoadingOverlay>
    </div>
  )
}

export function ProjectsDataTable(props: ProjectsDataTableProps) {
  return (
    <TableQueryProvider>
      <ProjectsTableInner {...props} />
    </TableQueryProvider>
  )
}
