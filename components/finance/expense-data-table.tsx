"use client"

import { useMemo, useState, useTransition } from "react"
import { Check, MoreHorizontal, Pencil, Send, Trash2, X } from "lucide-react"
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { DebouncedSearchInput } from "@/components/debounced-search-input"
import { DataTablePagination } from "@/components/data-table-pagination"
import { TableLoadingOverlay } from "@/components/table-loading-overlay"
import { TableQueryProvider } from "@/components/use-table-params"
import { ExpenseDialog, type ExpenseDialogOptions } from "@/components/finance/expense-dialog"
import { FinanceReportDownload } from "@/components/finance/finance-report-download"
import { FinanceStatusBadge } from "@/components/finance/finance-status-badge"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/constants"
import { FINANCE_EXPENSE_STATUSES, type LedgerScope } from "@/lib/finance/constants"
import { deleteExpense, transitionExpenseStatus } from "@/lib/finance/actions"
import type { PaginatedResult } from "@/lib/pagination"
import type { FinanceExpense } from "@/lib/finance/types"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

function formatExpenseDate(value: string) {
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

function expenseTotal(row: FinanceExpense) {
  return Number(row.amount) + Number(row.gst_amount)
}

function ExpenseStatusActions({ expense, scope }: { expense: FinanceExpense; scope: LedgerScope }) {
  const [pending, startTransition] = useTransition()

  function transition(status: string) {
    const fd = new FormData()
    fd.set("id", String(expense.id))
    fd.set("ledger_scope", scope)
    fd.set("status", status)
    startTransition(async () => {
      const res = await transitionExpenseStatus(fd)
      if (res?.error) {
        toast.error(res.error)
        return
      }
      toast.success(`Expense ${status.toLowerCase()}`)
    })
  }

  const status = expense.status
  return (
    <>
      {(status === "Draft" || status === "Rejected") && (
        <DropdownMenuItem disabled={pending} onClick={() => transition("Submitted")}>
          <Send className="size-4" /> Submit
        </DropdownMenuItem>
      )}
      {status === "Submitted" && (
        <>
          <DropdownMenuItem disabled={pending} onClick={() => transition("Approved")}>
            <Check className="size-4" /> Approve
          </DropdownMenuItem>
          <DropdownMenuItem disabled={pending} onClick={() => transition("Rejected")}>
            <X className="size-4" /> Reject
          </DropdownMenuItem>
        </>
      )}
      {status === "Approved" && (
        <DropdownMenuItem disabled={pending} onClick={() => transition("Paid")}>
          <Check className="size-4" /> Mark Paid
        </DropdownMenuItem>
      )}
    </>
  )
}

function ExpenseRowActions({
  expense,
  scope,
  onEdit,
}: {
  expense: FinanceExpense
  scope: LedgerScope
  onEdit: () => void
}) {
  const [pending, startTransition] = useTransition()

  function handleDelete() {
    const fd = new FormData()
    fd.set("id", String(expense.id))
    fd.set("ledger_scope", scope)
    startTransition(async () => {
      const res = await deleteExpense(fd)
      if (res?.error) {
        toast.error(res.error)
        return
      }
      toast.success("Expense removed")
    })
  }

  const canEdit = !["Paid", "Approved"].includes(expense.status)
  const canDelete = expense.status !== "Paid"

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
        {canEdit ? (
          <DropdownMenuItem onClick={onEdit}>
            <Pencil className="size-4" /> Edit
          </DropdownMenuItem>
        ) : null}
        <ExpenseStatusActions expense={expense} scope={scope} />
        {canDelete ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" disabled={pending} onClick={handleDelete}>
              <Trash2 className="size-4" /> Delete
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

interface ExpenseDataTableProps {
  result: PaginatedResult<FinanceExpense>
  search: string
  status: string
  scope?: LedgerScope
  dialogOptions: ExpenseDialogOptions
}

function ExpenseTableInner({ result, search, status, scope = "project", dialogOptions }: ExpenseDataTableProps) {
  const [editExpense, setEditExpense] = useState<FinanceExpense | null>(null)

  const columns = useMemo<ColumnDef<FinanceExpense>[]>(
    () => [
      {
        accessorKey: "expense_number",
        header: "Expense #",
        cell: ({ row }) => <span className="font-medium">{row.original.expense_number}</span>,
      },
      {
        accessorKey: "expense_date",
        header: "Date",
        cell: ({ getValue }) => (
          <span className="text-xs tabular-nums">{formatExpenseDate(getValue() as string)}</span>
        ),
      },
      { accessorKey: "vendor_name", header: "Vendor", cell: ({ row }) => row.original.vendor_name ?? "—" },
      ...(scope === "project"
        ? ([
            {
              accessorKey: "project_name",
              header: "Project",
              cell: ({ row }: { row: { original: FinanceExpense } }) =>
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
          ] as ColumnDef<FinanceExpense>[])
        : []),
      {
        id: "total",
        header: "Total",
        cell: ({ row }) => (
          <span className="tabular-nums font-medium">{formatCurrency(expenseTotal(row.original))}</span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ getValue }) => <FinanceStatusBadge status={getValue() as string} />,
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <ExpenseRowActions expense={row.original} scope={scope} onEdit={() => setEditExpense(row.original)} />
        ),
      },
    ],
    [scope],
  )

  const table = useReactTable({
    data: result.rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount: result.totalPages,
  })

  const hasSearch = Boolean(search.trim()) || Boolean(status)
  const emptyMessage = hasSearch ? "No expenses match your filters." : "No expenses yet."

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          <DebouncedSearchInput placeholder="Search expenses, vendors, projects..." />
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
              {FINANCE_EXPENSE_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap gap-2">
          <FinanceReportDownload scope={scope} type="expense" compact />
          <ExpenseDialog {...dialogOptions} scope={scope} requireProject={scope === "project"} />
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
        entityLabel="expense"
        searchActive={hasSearch}
      />

      {editExpense ? (
        <ExpenseDialog
          {...dialogOptions}
          scope={scope}
          requireProject={scope === "project"}
          expense={editExpense}
          open={Boolean(editExpense)}
          onOpenChange={(next) => {
            if (!next) setEditExpense(null)
          }}
          trigger={null}
        />
      ) : null}
    </div>
  )
}

export function ExpenseDataTable(props: ExpenseDataTableProps) {
  return (
    <TableQueryProvider>
      <ExpenseTableInner {...props} />
    </TableQueryProvider>
  )
}
