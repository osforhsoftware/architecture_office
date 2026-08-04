"use client"

import { useMemo } from "react"
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table"
import { FinanceStatusBadge } from "@/components/finance/finance-status-badge"
import { formatCurrency } from "@/lib/constants"
import type { StaffExpenseClaim } from "@/lib/finance/types"

export function StaffClaimsList({ claims }: { claims: StaffExpenseClaim[] }) {
  const columns = useMemo<ColumnDef<StaffExpenseClaim>[]>(
    () => [
      { accessorKey: "claim_number", header: "Claim #", cell: ({ row }) => <span className="font-medium">{row.original.claim_number}</span> },
      {
        accessorKey: "claim_date",
        header: "Date",
        cell: ({ getValue }) => (
          <span className="text-xs tabular-nums">
            {new Date(getValue() as string).toLocaleDateString("en-IN")}
          </span>
        ),
      },
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
    ],
    [],
  )

  const table = useReactTable({
    data: claims,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  if (!claims.length) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        You have not submitted any expense claims yet.
      </p>
    )
  }

  return (
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
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id} className="border-b border-border/40">
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="px-4 py-3 align-middle">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
