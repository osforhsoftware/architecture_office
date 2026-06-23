"use client"

import { useMemo } from "react"
import Link from "next/link"
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table"
import { ArrowRight, Building2 } from "lucide-react"
import { DebouncedSearchInput } from "@/components/debounced-search-input"
import { DataTablePagination } from "@/components/data-table-pagination"
import { TableLoadingOverlay } from "@/components/table-loading-overlay"
import { TableQueryProvider } from "@/components/use-table-params"
import type { PaginatedResult } from "@/lib/pagination"
import type { DepartmentRow } from "@/lib/queries"

interface DepartmentsDataTableProps {
  result: PaginatedResult<DepartmentRow>
  search: string
}

function DepartmentsTableInner({ result, search }: DepartmentsDataTableProps) {
  const columns = useMemo<ColumnDef<DepartmentRow>[]>(
    () => [
      {
        accessorKey: "section",
        header: "Department",
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Building2 className="size-4" />
            </div>
            <span className="font-medium">{row.original.section}</span>
          </div>
        ),
      },
      {
        accessorKey: "active",
        header: "Active Projects",
        cell: ({ getValue }) => (
          <span className="font-semibold text-primary tabular-nums">{getValue() as number}</span>
        ),
      },
      {
        accessorKey: "completed",
        header: "Completed",
        cell: ({ getValue }) => (
          <span className="tabular-nums">{getValue() as number}</span>
        ),
      },
      {
        accessorKey: "staff",
        header: "Staff",
        cell: ({ getValue }) => (
          <span className="tabular-nums text-muted-foreground">{getValue() as number}</span>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <Link
            href={`/admin/projects?section=${encodeURIComponent(row.original.section)}`}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            View projects <ArrowRight className="size-3" />
          </Link>
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
  const emptyMessage = hasSearch ? "No Results Found" : "No departments found."

  return (
    <div className="flex flex-col gap-4">
      <DebouncedSearchInput placeholder="Search departments..." />

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
                        <td key={cell.id} className="px-4 py-3">
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
            entityLabel="department"
            searchActive={hasSearch}
          />
        </div>
      </TableLoadingOverlay>
    </div>
  )
}

export function DepartmentsDataTable(props: DepartmentsDataTableProps) {
  return (
    <TableQueryProvider>
      <DepartmentsTableInner {...props} />
    </TableQueryProvider>
  )
}
