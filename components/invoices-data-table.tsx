"use client"

import { useMemo } from "react"
import Link from "next/link"
import { Download, FileSpreadsheet } from "lucide-react"
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
import { InvoiceStatusBadge } from "@/components/status-badges"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatCurrency, INVOICE_STATUSES } from "@/lib/constants"
import { apiUrl } from "@/lib/app-urls"
import { formatInvoiceDate } from "@/lib/invoice-utils"
import type { PaginatedResult } from "@/lib/pagination"
import type { InvoiceListRow } from "@/lib/queries"

interface InvoicesDataTableProps {
  result: PaginatedResult<InvoiceListRow>
  search: string
  status: string
}

function buildExportUrl(search: string, status: string, type: "excel" | "pdf") {
  const params = new URLSearchParams()
  if (search.trim()) params.set("search", search.trim())
  if (status) params.set("status", status)
  const qs = params.toString()
  if (type === "excel") return apiUrl(`/api/admin/invoices/export${qs ? `?${qs}` : ""}`)
  return qs ? `?${qs}` : ""
}

function InvoicesTableInner({ result, search, status }: InvoicesDataTableProps) {
  const columns = useMemo<ColumnDef<InvoiceListRow>[]>(
    () => [
      {
        accessorKey: "invoice_number",
        header: "Invoice #",
        cell: ({ row }) => (
          <Link
            href={`/admin/invoices/${row.original.id}`}
            className="font-medium hover:text-primary hover:underline"
          >
            {row.original.invoice_number}
          </Link>
        ),
      },
      {
        accessorKey: "project_name",
        header: "Project",
        cell: ({ row }) => (
          <div>
            {row.original.project_id ? (
              <Link
                href={`/admin/projects/${row.original.project_id}`}
                className="text-sm font-medium hover:text-primary hover:underline"
              >
                {row.original.project_name ?? row.original.project_code ?? "—"}
              </Link>
            ) : (
              <p className="text-sm">{row.original.project_name ?? "—"}</p>
            )}
            {row.original.project_code ? (
              <p className="text-xs text-muted-foreground">{row.original.project_code}</p>
            ) : null}
          </div>
        ),
      },
      {
        accessorKey: "client_name",
        header: "Client",
      },
      {
        accessorKey: "invoice_date",
        header: "Date",
        cell: ({ getValue }) => (
          <span className="text-xs tabular-nums">
            {formatInvoiceDate(getValue() as string)}
          </span>
        ),
      },
      {
        accessorKey: "amount_paid",
        header: "Paid",
        cell: ({ getValue }) => (
          <span className="tabular-nums">{formatCurrency(getValue() as string)}</span>
        ),
      },
      {
        accessorKey: "total",
        header: "Total",
        cell: ({ getValue }) => (
          <span className="tabular-nums font-medium">{formatCurrency(getValue() as string)}</span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ getValue }) => <InvoiceStatusBadge status={getValue() as string} />,
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <a
            href={apiUrl(`/api/admin/invoices/${row.original.id}/pdf`)}
            target="_blank"
            rel="noopener noreferrer"
            title="Download PDF"
            className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }))}
          >
            <Download className="size-4" />
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

  const hasSearch = Boolean(search.trim()) || Boolean(status)
  const emptyMessage = hasSearch ? "No invoices match your filters." : "No invoices yet."

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          <DebouncedSearchInput placeholder="Search invoices, clients, projects..." />
          <Select
            value={status || "all"}
            onValueChange={(v) => {
              if (!v) return
              const url = new URL(window.location.href)
              if (v === "all") url.searchParams.delete("status")
              else url.searchParams.set("status", v)
              url.searchParams.delete("page")
              window.location.href = url.toString()
            }}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {INVOICE_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <a
            href={buildExportUrl(search, status, "excel")}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            <FileSpreadsheet className="size-4" /> Export Excel
          </a>
        </div>
      </div>

      <TableLoadingOverlay>
        <div className="relative overflow-hidden rounded-lg border border-border/60">
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
                  <tr key={row.id} className="border-b border-border/40 transition-colors hover:bg-muted/20">
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
        entityLabel="invoice"
        searchActive={hasSearch}
      />
    </div>
  )
}

export function InvoicesDataTable(props: InvoicesDataTableProps) {
  return (
    <TableQueryProvider>
      <InvoicesTableInner {...props} />
    </TableQueryProvider>
  )
}
