"use client"

import { useMemo } from "react"
import Link from "next/link"
import { Printer } from "lucide-react"
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DebouncedSearchInput } from "@/components/debounced-search-input"
import { DataTablePagination } from "@/components/data-table-pagination"
import { HorizontalScrollArea } from "@/components/horizontal-scroll-area"
import { TableLoadingOverlay } from "@/components/table-loading-overlay"
import { TableQueryProvider, useTableParams } from "@/components/use-table-params"
import { StatusBadge } from "@/components/status-badges"
import { buttonVariants } from "@/components/ui/button"
import { projectPrintUrl } from "@/components/project-print-button"
import { isOverdueDueDate, PROJECT_LIST_FILTERS } from "@/lib/project-list-filters"
import { cn } from "@/lib/utils"
import type { PaginatedResult } from "@/lib/pagination"
import type { Project } from "@/lib/types"

interface ProjectsDataTableProps {
  result: PaginatedResult<Project>
  search: string
  status: string
  section: string
  filter?: string
  statusOptions: string[]
  sectionOptions: string[]
  hideSectionFilter?: boolean
}

const FILTER_LABELS: Record<string, string> = {
  attention: "Needs attention",
  active: "Active projects",
  delayed: "Delayed",
  site_visit_pending: "Site visit pending",
  under_construction: "Under construction",
  plinth_inspection: "Plinth level Inspection",
}

const COLUMN_CLASS: Record<string, string> = {
  code: "w-[9rem] min-w-[8.5rem]",
  client_name: "min-w-[12rem] w-[22%]",
  name: "min-w-[10rem] w-[20%]",
  section: "min-w-[8rem] w-[14%]",
  assignee: "min-w-[10rem] w-[16%]",
  status: "min-w-[8.25rem] w-[8.5rem]",
  due_date: "min-w-[5.25rem] w-[5.5rem]",
  actions: "w-10 min-w-10",
}

function cellPad(columnId: string) {
  return columnId === "actions"
    ? "px-1 py-2.5 text-center"
    : "px-2 py-2.5 lg:px-3"
}

function wrapNameClass() {
  return "block whitespace-normal break-words [overflow-wrap:anywhere] leading-snug"
}

function assignedStaffLabel(project: Project) {
  const names = [project.assignee_name, ...(project.site_assignee_names ?? [])]
    .map((name) => name?.trim())
    .filter((name): name is string => Boolean(name))
  return [...new Set(names)]
}

function ProjectsTableInner({
  result,
  search,
  status,
  section,
  filter = "all",
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
          <span className="whitespace-nowrap font-mono text-xs text-muted-foreground">
            {row.original.code}
          </span>
        ),
      },
      {
        accessorKey: "client_name",
        header: "Client",
        cell: ({ getValue }) => {
          const name = (getValue() as string) || "—"
          return (
            <span className={cn(wrapNameClass(), "text-sm font-semibold")}>
              {name}
            </span>
          )
        },
      },
      {
        accessorKey: "name",
        header: "Project",
        cell: ({ row }) => (
          <Link
            href={`/admin/projects/${row.original.id}`}
            className={cn(wrapNameClass(), "text-sm hover:text-primary hover:underline")}
          >
            {row.original.name}
          </Link>
        ),
      },
      {
        accessorKey: "section",
        header: "Department",
        cell: ({ getValue }) => (
          <span className={cn(wrapNameClass(), "text-sm text-muted-foreground")}>
            {getValue() as string}
          </span>
        ),
      },
      {
        id: "assignee",
        header: "Assigned Staff",
        accessorFn: (row) => assignedStaffLabel(row).join(", "),
        cell: ({ row }) => {
          const names = assignedStaffLabel(row.original)
          if (!names.length) {
            return (
              <span className="text-sm text-muted-foreground">Unassigned</span>
            )
          }
          return (
            <span className={cn(wrapNameClass(), "text-sm")}>
              {names.join(", ")}
            </span>
          )
        },
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ getValue }) => {
          const value = getValue() as string
          return (
            <div className="min-w-0 max-w-full" title={value}>
              <StatusBadge
                status={value}
                className="max-w-full min-w-0 shrink truncate"
              />
            </div>
          )
        },
      },
      {
        accessorKey: "due_date",
        header: "Due Date",
        cell: ({ row, getValue }) => {
          const v = getValue() as string | null
          const overdue = isOverdueDueDate(v, row.original.status)
          return (
            <span
              className={cn(
                "whitespace-nowrap text-sm tabular-nums",
                overdue && "font-medium text-red-600",
              )}
            >
              {v ? new Date(v).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "—"}
            </span>
          )
        },
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <a
            href={projectPrintUrl(row.original.id)}
            target="_blank"
            rel="noreferrer"
            className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }), "mx-auto")}
            title="Print project & client details"
            onClick={(e) => e.stopPropagation()}
          >
            <Printer className="size-4" />
          </a>
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
            value={filter}
            onValueChange={(value) => {
              if (!value) return
              updateParams({ filter: value === "all" ? null : value }, { resetPage: true })
            }}
          >
            <SelectTrigger className="w-full min-w-0 sm:w-[170px]">
              <SelectValue placeholder="Dashboard filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All projects</SelectItem>
              {PROJECT_LIST_FILTERS.map((f) => (
                <SelectItem key={f} value={f}>
                  {FILTER_LABELS[f] ?? f}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
          <HorizontalScrollArea showScrollbar>
            <table className="w-full min-w-[52rem] table-fixed text-sm sm:min-w-[56rem]">
              <colgroup>
                <col className="w-[9rem]" />
                <col className="w-[22%]" />
                <col className="w-[20%]" />
                <col className="w-[14%]" />
                <col className="w-[16%]" />
                <col className="w-[8.5rem]" />
                <col className="w-[5.5rem]" />
                <col className="w-10" />
              </colgroup>
              <thead className="sticky top-0 z-10 border-b border-border bg-muted/50 backdrop-blur">
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id}>
                    {hg.headers.map((header) => (
                      <th
                        key={header.id}
                        className={cn(
                          "text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground",
                          header.column.id !== "actions" && "whitespace-nowrap",
                          cellPad(header.column.id),
                          COLUMN_CLASS[header.column.id],
                        )}
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
                      className={cn(
                        "border-b border-border/50 transition-colors hover:bg-muted/40",
                        row.original.priority === "High" && "bg-red-50/80",
                      )}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td
                          key={cell.id}
                          className={cn(
                            "align-top",
                            cellPad(cell.column.id),
                            COLUMN_CLASS[cell.column.id],
                          )}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={columns.length} className="px-3 py-16 text-center text-muted-foreground">
                      {emptyMessage}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </HorizontalScrollArea>

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
