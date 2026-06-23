"use client"

import { useMemo } from "react"
import Link from "next/link"
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table"
import { DebouncedSearchInput } from "@/components/debounced-search-input"
import { DataTablePagination } from "@/components/data-table-pagination"
import { TableLoadingOverlay } from "@/components/table-loading-overlay"
import { TableQueryProvider } from "@/components/use-table-params"
import { formatCurrency } from "@/lib/constants"
import type { PaginatedResult } from "@/lib/pagination"
import type { PaymentWithProject } from "@/lib/queries"

interface PaymentsDataTableProps {
  result: PaginatedResult<PaymentWithProject>
  search: string
}

function PaymentsTableInner({ result, search }: PaymentsDataTableProps) {
  const columns = useMemo<ColumnDef<PaymentWithProject>[]>(
    () => [
      {
        accessorKey: "created_at",
        header: "Date",
        cell: ({ getValue }) => (
          <span className="text-xs tabular-nums">
            {new Date(getValue() as string).toLocaleDateString("en-IN")}
          </span>
        ),
      },
      {
        accessorKey: "project_code",
        header: "Project",
        cell: ({ row }) => (
          <div>
            <Link
              href={`/admin/projects/${row.original.project_id}`}
              className="font-medium hover:text-primary hover:underline"
            >
              {row.original.project_code}
            </Link>
            <p className="text-xs text-muted-foreground">{row.original.project_name}</p>
          </div>
        ),
      },
      {
        accessorKey: "client_name",
        header: "Client",
        cell: ({ getValue }) => (
          <span className="text-sm text-muted-foreground">{getValue() as string}</span>
        ),
      },
      {
        accessorKey: "method",
        header: "Method",
        cell: ({ getValue }) => <span className="text-sm">{getValue() as string}</span>,
      },
      {
        accessorKey: "note",
        header: "Note",
        cell: ({ getValue }) => {
          const note = getValue() as string | null
          return (
            <span className="max-w-[180px] truncate text-sm text-muted-foreground">
              {note ?? "—"}
            </span>
          )
        },
      },
      {
        accessorKey: "amount",
        header: "Amount",
        cell: ({ getValue }) => (
          <span className="text-right text-sm font-medium tabular-nums">
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
  const emptyMessage = hasSearch ? "No Results Found" : "No payments recorded yet."

  return (
    <div className="flex flex-col gap-4">
      <DebouncedSearchInput placeholder="Search by project, client, method, amount, or ID..." />

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
                        className={`whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground ${
                          header.id === "amount" ? "text-right" : ""
                        }`}
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
                          className={`px-4 py-3 ${cell.column.id === "amount" ? "text-right" : ""}`}
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
            entityLabel="record"
            searchActive={hasSearch}
          />
        </div>
      </TableLoadingOverlay>
    </div>
  )
}

export function PaymentsDataTable(props: PaymentsDataTableProps) {
  return (
    <TableQueryProvider>
      <PaymentsTableInner {...props} />
    </TableQueryProvider>
  )
}
