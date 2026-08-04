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
import type { ProjectFinanceSummary } from "@/lib/finance/types"

interface ProjectFinanceDataTableProps {
  result: PaginatedResult<ProjectFinanceSummary>
  search: string
}

function ProjectFinanceTableInner({ result, search }: ProjectFinanceDataTableProps) {
  const columns = useMemo<ColumnDef<ProjectFinanceSummary>[]>(
    () => [
      {
        accessorKey: "project_name",
        header: "Project",
        cell: ({ row }) => (
          <Link
            href={`/admin/finance/project/${row.original.project_id}`}
            className="font-medium hover:text-primary hover:underline"
          >
            {row.original.project_code ?? row.original.project_name}
          </Link>
        ),
      },
      { accessorKey: "client_name", header: "Client", cell: ({ row }) => row.original.client_name ?? "—" },
      {
        accessorKey: "project_value",
        header: "Value",
        cell: ({ getValue }) => <span className="tabular-nums">{formatCurrency(getValue() as string)}</span>,
      },
      {
        accessorKey: "total_income",
        header: "Income",
        cell: ({ getValue }) => (
          <span className="tabular-nums text-emerald-600">{formatCurrency(getValue() as string)}</span>
        ),
      },
      {
        accessorKey: "total_expense",
        header: "Expense",
        cell: ({ getValue }) => (
          <span className="tabular-nums text-red-600">{formatCurrency(getValue() as string)}</span>
        ),
      },
      {
        accessorKey: "net_profit",
        header: "Net Profit",
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
  const emptyMessage = hasSearch ? "No projects match your search." : "No project finance data yet."

  return (
    <div className="flex flex-col gap-4">
      <DebouncedSearchInput placeholder="Search projects..." />
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
        entityLabel="project"
        searchActive={hasSearch}
      />
    </div>
  )
}

export function ProjectFinanceDataTable(props: ProjectFinanceDataTableProps) {
  return (
    <TableQueryProvider>
      <ProjectFinanceTableInner {...props} />
    </TableQueryProvider>
  )
}
