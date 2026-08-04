"use client"

import { useMemo, useTransition } from "react"
import { Check, MoreHorizontal, X } from "lucide-react"
import { toast } from "sonner"
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
import { FinanceStatusBadge } from "@/components/finance/finance-status-badge"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/constants"
import { STAFF_CLAIM_STATUSES } from "@/lib/finance/constants"
import { transitionStaffClaim } from "@/lib/finance/actions"
import type { PaginatedResult } from "@/lib/pagination"
import type { StaffExpenseClaim } from "@/lib/finance/types"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

function formatClaimDate(value: string) {
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

function ClaimRowActions({ claim }: { claim: StaffExpenseClaim }) {
  const [pending, startTransition] = useTransition()

  function transition(status: string) {
    const fd = new FormData()
    fd.set("id", String(claim.id))
    fd.set("status", status)
    startTransition(async () => {
      const res = await transitionStaffClaim(fd)
      if (res?.error) {
        toast.error(res.error)
        return
      }
      toast.success(`Claim moved to ${status}`)
    })
  }

  const status = claim.status
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
        {status === "Submitted" && (
          <DropdownMenuItem disabled={pending} onClick={() => transition("Dept Review")}>
            Dept Review
          </DropdownMenuItem>
        )}
        {status === "Dept Review" && (
          <DropdownMenuItem disabled={pending} onClick={() => transition("Admin Approval")}>
            Admin Approval
          </DropdownMenuItem>
        )}
        {status === "Admin Approval" && (
          <DropdownMenuItem disabled={pending} onClick={() => transition("Finance Payment")}>
            Finance Payment
          </DropdownMenuItem>
        )}
        {status === "Finance Payment" && (
          <DropdownMenuItem disabled={pending} onClick={() => transition("Completed")}>
            <Check className="size-4" /> Mark Paid
          </DropdownMenuItem>
        )}
        {!["Completed", "Rejected"].includes(status) && (
          <DropdownMenuItem variant="destructive" disabled={pending} onClick={() => transition("Rejected")}>
            <X className="size-4" /> Reject
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

interface ClaimsDataTableProps {
  result: PaginatedResult<StaffExpenseClaim>
  search: string
  status: string
}

function ClaimsTableInner({ result, search, status }: ClaimsDataTableProps) {
  const columns = useMemo<ColumnDef<StaffExpenseClaim>[]>(
    () => [
      {
        accessorKey: "claim_number",
        header: "Claim #",
        cell: ({ row }) => <span className="font-medium">{row.original.claim_number}</span>,
      },
      {
        accessorKey: "claim_date",
        header: "Date",
        cell: ({ getValue }) => (
          <span className="text-xs tabular-nums">{formatClaimDate(getValue() as string)}</span>
        ),
      },
      { accessorKey: "staff_name", header: "Staff", cell: ({ row }) => row.original.staff_name ?? "—" },
      { accessorKey: "category", header: "Category" },
      {
        accessorKey: "amount",
        header: "Amount",
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
        cell: ({ row }) => <ClaimRowActions claim={row.original} />,
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
  const emptyMessage = hasSearch ? "No claims match your filters." : "No staff claims yet."

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <DebouncedSearchInput placeholder="Search claims..." />
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
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STAFF_CLAIM_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
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
        entityLabel="claim"
        searchActive={hasSearch}
      />
    </div>
  )
}

export function ClaimsDataTable(props: ClaimsDataTableProps) {
  return (
    <TableQueryProvider>
      <ClaimsTableInner {...props} />
    </TableQueryProvider>
  )
}
