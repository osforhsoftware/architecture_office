"use client"

import { useMemo } from "react"
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table"
import { Wrench } from "lucide-react"
import { DebouncedSearchInput } from "@/components/debounced-search-input"
import { DataTablePagination } from "@/components/data-table-pagination"
import { ServiceDialog } from "@/components/service-dialog"
import { ServiceDeleteDialog } from "@/components/service-delete-dialog"
import { TableLoadingOverlay } from "@/components/table-loading-overlay"
import { TableQueryProvider } from "@/components/use-table-params"
import { Badge } from "@/components/ui/badge"
import type { PaginatedResult } from "@/lib/pagination"
import type { ServiceRow } from "@/lib/queries"

interface ServicesDataTableProps {
  result: PaginatedResult<ServiceRow>
  search: string
  departmentOptions: { value: string; label: string; role: string }[]
}

function ServicesTableInner({ result, search, departmentOptions }: ServicesDataTableProps) {
  const columns = useMemo<ColumnDef<ServiceRow>[]>(
    () => [
      {
        accessorKey: "label",
        header: "Service",
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Wrench className="size-4" />
            </div>
            <div className="flex flex-col">
              <span className="font-medium">{row.original.label}</span>
              <span className="font-mono text-xs text-muted-foreground">
                {row.original.service_key}
              </span>
            </div>
          </div>
        ),
      },
      {
        accessorKey: "section",
        header: "Department",
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span>{row.original.section}</span>
            <span className="text-xs text-muted-foreground">{row.original.role}</span>
          </div>
        ),
      },
      {
        accessorKey: "sort_order",
        header: "Order",
        cell: ({ getValue }) => (
          <span className="tabular-nums text-muted-foreground">{getValue() as number}</span>
        ),
      },
      {
        accessorKey: "project_count",
        header: "Projects",
        cell: ({ getValue }) => (
          <span className="font-semibold text-primary tabular-nums">{getValue() as number}</span>
        ),
      },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) =>
          row.original.active ? (
            <Badge variant="secondary">Active</Badge>
          ) : (
            <Badge variant="outline">Hidden</Badge>
          ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <ServiceDialog service={row.original} departmentOptions={departmentOptions} />
            <ServiceDeleteDialog service={row.original} />
          </div>
        ),
      },
    ],
    [departmentOptions],
  )

  const table = useReactTable({
    data: result.rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount: result.totalPages,
  })

  const hasSearch = Boolean(search.trim())
  const emptyMessage = hasSearch ? "No Results Found" : "No services found."

  return (
    <div className="flex flex-col gap-4">
      <DebouncedSearchInput placeholder="Search services..." />

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
            entityLabel="service"
            searchActive={hasSearch}
          />
        </div>
      </TableLoadingOverlay>
    </div>
  )
}

export function ServicesDataTable(props: ServicesDataTableProps) {
  return (
    <TableQueryProvider>
      <ServicesTableInner {...props} />
    </TableQueryProvider>
  )
}
