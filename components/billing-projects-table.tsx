"use client"

import { useMemo } from "react"
import Link from "next/link"
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
import { TableLoadingOverlay } from "@/components/table-loading-overlay"
import { TableQueryProvider, useTableParams } from "@/components/use-table-params"
import { PaymentBadge } from "@/components/status-badges"
import { formatCurrency, PAYMENT_STATUSES } from "@/lib/constants"
import type { PaginatedResult } from "@/lib/pagination"
import type { Project } from "@/lib/types"

function BillingProjectsInner({
  result,
  search,
  paymentStatus,
}: {
  result: PaginatedResult<Project>
  search: string
  paymentStatus: string
}) {
  const { updateParams } = useTableParams()

  const columns = useMemo<ColumnDef<Project>[]>(
    () => [
      {
        accessorKey: "code",
        header: "Project ID",
        cell: ({ row }) => (
          <Link
            href={`/admin/projects/${row.original.id}`}
            className="font-mono text-xs font-medium hover:text-primary hover:underline"
          >
            {row.original.code}
          </Link>
        ),
      },
      {
        accessorKey: "client_name",
        header: "Client",
        cell: ({ getValue }) => (
          <span className="text-sm font-medium">{(getValue() as string) || "—"}</span>
        ),
      },
      {
        accessorKey: "name",
        header: "Project",
        cell: ({ row }) => (
          <Link
            href={`/admin/projects/${row.original.id}`}
            className="text-sm hover:text-primary hover:underline"
          >
            {row.original.name}
          </Link>
        ),
      },
      {
        accessorKey: "project_amount",
        header: "Amount",
        cell: ({ getValue }) => (
          <span className="tabular-nums">{formatCurrency(getValue() as string)}</span>
        ),
      },
      {
        accessorKey: "advance_received",
        header: "Received",
        cell: ({ getValue }) => (
          <span className="tabular-nums">{formatCurrency(getValue() as string)}</span>
        ),
      },
      {
        id: "balance",
        header: "Balance",
        accessorFn: (row) => Number(row.project_amount) - Number(row.advance_received),
        cell: ({ getValue }) => (
          <span className="tabular-nums font-medium">{formatCurrency(getValue() as number)}</span>
        ),
      },
      {
        accessorKey: "payment_status",
        header: "Payment",
        cell: ({ getValue }) => <PaymentBadge status={(getValue() as string) || "Unpaid"} />,
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

  const hasSearch = Boolean(search.trim()) || (paymentStatus && paymentStatus !== "all")
  const emptyMessage = hasSearch ? "No projects match your filters." : "No billing projects yet."

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <DebouncedSearchInput placeholder="Search projects, clients, IDs..." />
        <Select
          value={paymentStatus || "all"}
          onValueChange={(value) => {
            if (!value) return
            updateParams(
              { payment: value === "all" ? null : value, tab: "overview" },
              { resetPage: true },
            )
          }}
        >
          <SelectTrigger className="w-full min-w-0 sm:w-[190px]">
            <SelectValue placeholder="Payment status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All payment statuses</SelectItem>
            <SelectItem value="pending">Payments pending</SelectItem>
            {PAYMENT_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

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
                  <tr
                    key={row.id}
                    className="border-b border-border/40 transition-colors hover:bg-muted/20"
                  >
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
        entityLabel="project"
        searchActive={Boolean(hasSearch)}
      />
    </div>
  )
}

export function BillingProjectsTable(props: {
  result: PaginatedResult<Project>
  search: string
  paymentStatus: string
}) {
  return (
    <TableQueryProvider>
      <BillingProjectsInner {...props} />
    </TableQueryProvider>
  )
}
