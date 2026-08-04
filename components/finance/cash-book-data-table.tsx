"use client"

import { useMemo } from "react"
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
import type { CashBookEntry } from "@/lib/finance/types"

type CashBookResult = PaginatedResult<CashBookEntry> & {
  openingBalance: number
  closingBalance: number
}

interface CashBookDataTableProps {
  result: CashBookResult
  search: string
}

function formatEntryDate(value: string) {
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

function CashBookTableInner({ result, search }: CashBookDataTableProps) {
  const columns = useMemo<ColumnDef<CashBookEntry>[]>(
    () => [
      {
        accessorKey: "entry_date",
        header: "Date",
        cell: ({ getValue }) => (
          <span className="text-xs tabular-nums">{formatEntryDate(getValue() as string)}</span>
        ),
      },
      { accessorKey: "transaction_id", header: "Txn ID" },
      { accessorKey: "description", header: "Description", cell: ({ row }) => row.original.description ?? "—" },
      {
        accessorKey: "income_amount",
        header: "Income",
        cell: ({ getValue }) => {
          const v = Number(getValue())
          return v > 0 ? (
            <span className="tabular-nums text-emerald-600">{formatCurrency(v)}</span>
          ) : (
            "—"
          )
        },
      },
      {
        accessorKey: "expense_amount",
        header: "Expense",
        cell: ({ getValue }) => {
          const v = Number(getValue())
          return v > 0 ? (
            <span className="tabular-nums text-red-600">{formatCurrency(v)}</span>
          ) : (
            "—"
          )
        },
      },
      {
        accessorKey: "balance",
        header: "Balance",
        cell: ({ getValue }) => (
          <span className="tabular-nums font-medium">{formatCurrency(getValue() as string)}</span>
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
  const emptyMessage = hasSearch ? "No entries match your search." : "No cash book entries yet."

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-border/60 bg-card p-4 shadow-premium">
          <p className="text-xs text-muted-foreground">Opening Balance</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">{formatCurrency(result.openingBalance)}</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-4 shadow-premium">
          <p className="text-xs text-muted-foreground">Closing Balance</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">{formatCurrency(result.closingBalance)}</p>
        </div>
      </div>

      <DebouncedSearchInput placeholder="Search cash book..." />

      <TableLoadingOverlay>
        <div className="overflow-hidden rounded-lg border border-border/60">
          <table className="w-full text-sm">
            <thead className="border-b border-border/60 bg-muted/40">
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers.map((header) => (
                    <th
                      key={header.id}
                      className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground"
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
                  <tr key={row.id} className="border-b border-border/40 hover:bg-muted/20">
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-3 align-middle">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-12 text-center text-muted-foreground">
                    {emptyMessage}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </TableLoadingOverlay>
      <DataTablePagination
        total={result.total}
        page={result.page}
        pageSize={result.pageSize}
        totalPages={result.totalPages}
        entityLabel="entry"
        searchActive={hasSearch}
      />
    </div>
  )
}

export function CashBookDataTable(props: CashBookDataTableProps) {
  return (
    <TableQueryProvider>
      <CashBookTableInner {...props} />
    </TableQueryProvider>
  )
}
