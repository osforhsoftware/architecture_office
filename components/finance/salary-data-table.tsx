"use client"

import { useMemo, useTransition } from "react"
import { Banknote, Trash2 } from "lucide-react"
import { toast } from "sonner"
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
import { SalaryDialog } from "@/components/finance/salary-dialog"
import { FinanceStatusBadge } from "@/components/finance/finance-status-badge"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/constants"
import { deleteSalary, paySalary } from "@/lib/finance/actions"
import type { FinanceSelectOption } from "@/components/finance/finance-options"
import type { PaginatedResult } from "@/lib/pagination"
import type { SalaryPayroll } from "@/lib/finance/types"

type SalaryDataTableProps = {
  result: PaginatedResult<SalaryPayroll>
  search: string
  dialogOptions: {
    staff: FinanceSelectOption[]
    accounts: FinanceSelectOption[]
  }
}

function SalaryTableInner({ result, search, dialogOptions }: SalaryDataTableProps) {
  const [pending, startTransition] = useTransition()

  function handlePay(row: SalaryPayroll) {
    const fd = new FormData()
    fd.set("id", String(row.id))
    startTransition(async () => {
      const res = await paySalary(fd)
      if (res?.error) {
        toast.error(res.error)
        return
      }
      toast.success("Salary marked as paid")
    })
  }

  function handleDelete(row: SalaryPayroll) {
    const fd = new FormData()
    fd.set("id", String(row.id))
    startTransition(async () => {
      const res = await deleteSalary(fd)
      if (res?.error) {
        toast.error(res.error)
        return
      }
      toast.success("Salary record removed")
    })
  }

  const columns = useMemo<ColumnDef<SalaryPayroll>[]>(
    () => [
      { accessorKey: "payslip_number", header: "Payslip #", cell: ({ row }) => <span className="font-medium">{row.original.payslip_number}</span> },
      { accessorKey: "staff_name", header: "Staff", cell: ({ row }) => row.original.staff_name ?? "—" },
      { accessorKey: "pay_period", header: "Period" },
      {
        accessorKey: "pay_date",
        header: "Pay date",
        cell: ({ getValue }) => new Date(getValue() as string).toLocaleDateString("en-IN"),
      },
      {
        accessorKey: "net_salary",
        header: "Net salary",
        cell: ({ getValue }) => (
          <span className="tabular-nums font-medium">{formatCurrency(getValue() as string)}</span>
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
          <div className="flex justify-end gap-2">
            {row.original.status === "Approved" ? (
              <Button size="sm" variant="outline" disabled={pending} onClick={() => handlePay(row.original)}>
                <Banknote className="size-4" /> Pay
              </Button>
            ) : null}
            {row.original.status !== "Paid" ? (
              <Button size="sm" variant="ghost" disabled={pending} onClick={() => handleDelete(row.original)}>
                <Trash2 className="size-4" />
              </Button>
            ) : null}
          </div>
        ),
      },
    ],
    [pending],
  )

  const table = useReactTable({
    data: result.rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount: result.totalPages,
  })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <DebouncedSearchInput placeholder="Search payslips, staff..." />
        <SalaryDialog {...dialogOptions} />
      </div>
      <TableLoadingOverlay>
        <div className="relative overflow-hidden rounded-lg border border-border/60">
          <table className="w-full text-sm">
            <thead className="border-b border-border/60 bg-muted/40">
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers.map((header) => (
                    <th key={header.id} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
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
                    {search.trim() ? "No salary records match your search." : "No salary records yet."}
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
        entityLabel="payslip"
        searchActive={Boolean(search.trim())}
      />
    </div>
  )
}

export function SalaryDataTable(props: SalaryDataTableProps) {
  return (
    <TableQueryProvider>
      <SalaryTableInner {...props} />
    </TableQueryProvider>
  )
}
