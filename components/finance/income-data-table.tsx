"use client"

import { useMemo, useState, useTransition } from "react"
import { Download, MoreHorizontal, Pencil, Trash2 } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { DebouncedSearchInput } from "@/components/debounced-search-input"
import { DataTablePagination } from "@/components/data-table-pagination"
import { TableLoadingOverlay } from "@/components/table-loading-overlay"
import { TableQueryProvider } from "@/components/use-table-params"
import { IncomeDialog, type IncomeDialogOptions } from "@/components/finance/income-dialog"
import { FinanceReportDownload } from "@/components/finance/finance-report-download"
import { FinanceStatusBadge } from "@/components/finance/finance-status-badge"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/constants"
import { FINANCE_INCOME_STATUSES, type LedgerScope } from "@/lib/finance/constants"
import { deleteIncome } from "@/lib/finance/actions"
import { apiUrl } from "@/lib/app-urls"
import type { PaginatedResult } from "@/lib/pagination"
import type { FinanceIncome } from "@/lib/finance/types"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

function formatIncomeDate(value: string) {
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

function IncomeRowActions({
  income,
  scope,
  onEdit,
}: {
  income: FinanceIncome
  scope: LedgerScope
  onEdit: () => void
}) {
  const [pending, startTransition] = useTransition()

  function handleDelete() {
    const fd = new FormData()
    fd.set("id", String(income.id))
    fd.set("ledger_scope", scope)
    startTransition(async () => {
      const res = await deleteIncome(fd)
      if (res?.error) {
        toast.error(res.error)
        return
      }
      toast.success("Income removed")
    })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon-sm">
            <MoreHorizontal className="size-4" />
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onEdit}>
          <Pencil className="size-4" /> Edit
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => window.open(apiUrl(`/api/admin/finance/income/${income.id}/pdf`), "_blank")}
        >
          <Download className="size-4" /> PDF Receipt
        </DropdownMenuItem>
        {income.status !== "Approved" ? (
          <DropdownMenuItem variant="destructive" disabled={pending} onClick={handleDelete}>
            <Trash2 className="size-4" /> Delete
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

interface IncomeDataTableProps {
  result: PaginatedResult<FinanceIncome>
  search: string
  status: string
  scope?: LedgerScope
  dialogOptions: IncomeDialogOptions
}

function IncomeTableInner({ result, search, status, scope = "project", dialogOptions }: IncomeDataTableProps) {
  const [editIncome, setEditIncome] = useState<FinanceIncome | null>(null)

  const columns = useMemo<ColumnDef<FinanceIncome>[]>(
    () => [
      {
        accessorKey: "receipt_number",
        header: "Receipt #",
        cell: ({ row }) => <span className="font-medium">{row.original.receipt_number}</span>,
      },
      {
        accessorKey: "income_date",
        header: "Date",
        cell: ({ getValue }) => (
          <span className="text-xs tabular-nums">{formatIncomeDate(getValue() as string)}</span>
        ),
      },
      ...(scope === "project"
        ? ([
            { accessorKey: "client_name", header: "Client", cell: ({ row }: { row: { original: FinanceIncome } }) => row.original.client_name ?? "—" },
            {
              accessorKey: "project_name",
              header: "Project",
              cell: ({ row }: { row: { original: FinanceIncome } }) =>
                row.original.project_id ? (
                  <Link
                    href={`/admin/projects/${row.original.project_id}`}
                    className="hover:text-primary hover:underline"
                  >
                    {row.original.project_code ?? row.original.project_name}
                  </Link>
                ) : (
                  "—"
                ),
            },
          ] as ColumnDef<FinanceIncome>[])
        : []),
      {
        accessorKey: "amount",
        header: "Amount",
        cell: ({ getValue }) => (
          <span className="tabular-nums font-medium">{formatCurrency(getValue() as string)}</span>
        ),
      },
      { accessorKey: "payment_method", header: "Method" },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ getValue }) => <FinanceStatusBadge status={getValue() as string} />,
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <IncomeRowActions
            income={row.original}
            scope={scope}
            onEdit={() => setEditIncome(row.original)}
          />
        ),
      },
    ],
    [dialogOptions, scope],
  )

  const table = useReactTable({
    data: result.rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount: result.totalPages,
  })

  const hasSearch = Boolean(search.trim()) || Boolean(status)
  const emptyMessage = hasSearch ? "No income matches your filters." : "No income recorded yet."

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          <DebouncedSearchInput placeholder="Search receipts, clients, projects..." />
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
              {FINANCE_INCOME_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap gap-2">
          <FinanceReportDownload scope={scope} type="income" compact />
          <IncomeDialog {...dialogOptions} scope={scope} requireProject={scope === "project"} />
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
        entityLabel="receipt"
        searchActive={hasSearch}
      />

      {editIncome ? (
        <IncomeDialog
          {...dialogOptions}
          scope={scope}
          requireProject={scope === "project"}
          income={editIncome}
          open={Boolean(editIncome)}
          onOpenChange={(next) => {
            if (!next) setEditIncome(null)
          }}
          trigger={null}
        />
      ) : null}
    </div>
  )
}

export function IncomeDataTable(props: IncomeDataTableProps) {
  return (
    <TableQueryProvider>
      <IncomeTableInner {...props} />
    </TableQueryProvider>
  )
}
