"use client"

import { useMemo } from "react"
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table"
import { FileText } from "lucide-react"
import { DebouncedSearchInput } from "@/components/debounced-search-input"
import { DataTablePagination } from "@/components/data-table-pagination"
import { DocumentDialog } from "@/components/document-dialog"
import { DocumentDeleteDialog } from "@/components/document-delete-dialog"
import { TableLoadingOverlay } from "@/components/table-loading-overlay"
import { TableQueryProvider } from "@/components/use-table-params"
import { Badge } from "@/components/ui/badge"
import type { PaginatedResult } from "@/lib/pagination"
import type { DocumentTemplateRow } from "@/lib/queries"

interface DocumentsDataTableProps {
  result: PaginatedResult<DocumentTemplateRow>
  search: string
  serviceOptions: { value: string; label: string }[]
}

function DocumentsTableInner({ result, search, serviceOptions }: DocumentsDataTableProps) {
  const columns = useMemo<ColumnDef<DocumentTemplateRow>[]>(
    () => [
      {
        accessorKey: "label",
        header: "Document",
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FileText className="size-4" />
            </div>
            <span className="font-medium">{row.original.label}</span>
          </div>
        ),
      },
      {
        accessorKey: "service_label",
        header: "Service",
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span>{row.original.service_label}</span>
            <span className="font-mono text-xs text-muted-foreground">
              {row.original.service_key}
            </span>
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
            <DocumentDialog document={row.original} serviceOptions={serviceOptions} />
            <DocumentDeleteDialog document={row.original} />
          </div>
        ),
      },
    ],
    [serviceOptions],
  )

  const table = useReactTable({
    data: result.rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount: result.totalPages,
  })

  const hasSearch = Boolean(search.trim())
  const emptyMessage = hasSearch ? "No Results Found" : "No documents found."

  return (
    <div className="flex flex-col gap-4">
      <DebouncedSearchInput placeholder="Search documents..." />

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
            entityLabel="document"
            searchActive={hasSearch}
          />
        </div>
      </TableLoadingOverlay>
    </div>
  )
}

export function DocumentsDataTable(props: DocumentsDataTableProps) {
  return (
    <TableQueryProvider>
      <DocumentsTableInner {...props} />
    </TableQueryProvider>
  )
}
