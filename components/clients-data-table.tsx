"use client"

import { useMemo } from "react"
import Link from "next/link"
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table"
import { Mail, Phone } from "lucide-react"
import { ClientDialog } from "@/components/client-dialog"
import { DebouncedSearchInput } from "@/components/debounced-search-input"
import { DataTablePagination } from "@/components/data-table-pagination"
import { TableLoadingOverlay } from "@/components/table-loading-overlay"
import { TableQueryProvider } from "@/components/use-table-params"
import type { PaginatedResult } from "@/lib/pagination"
import type { Client } from "@/lib/types"

interface ClientsDataTableProps {
  result: PaginatedResult<Client>
  search: string
}

function ClientsTableInner({ result, search }: ClientsDataTableProps) {
  const columns = useMemo<ColumnDef<Client>[]>(
    () => [
      {
        accessorKey: "id",
        header: "ID",
        cell: ({ getValue }) => (
          <span className="font-mono text-xs text-muted-foreground">#{getValue() as number}</span>
        ),
      },
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => (
          <Link
            href={`/admin/clients/${row.original.id}`}
            className="font-medium hover:text-primary hover:underline"
          >
            {row.original.name}
          </Link>
        ),
      },
      {
        accessorKey: "phone",
        header: "Phone",
        cell: ({ getValue }) => {
          const phone = getValue() as string | null
          return phone ? (
            <span className="inline-flex items-center gap-1.5 text-sm">
              <Phone className="size-3.5 text-muted-foreground" />
              {phone}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )
        },
      },
      {
        accessorKey: "email",
        header: "Email",
        cell: ({ getValue }) => {
          const email = getValue() as string | null
          return email ? (
            <span className="inline-flex max-w-[200px] items-center gap-1.5 truncate text-sm">
              <Mail className="size-3.5 shrink-0 text-muted-foreground" />
              {email}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )
        },
      },
      {
        accessorKey: "address",
        header: "Address",
        cell: ({ getValue }) => {
          const address = getValue() as string | null
          return (
            <span className="max-w-[220px] truncate text-sm text-muted-foreground">
              {address ?? "—"}
            </span>
          )
        },
      },
      {
        accessorKey: "project_count",
        header: "Projects",
        cell: ({ getValue }) => (
          <span className="text-sm tabular-nums">{getValue() as number}</span>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => <ClientDialog client={row.original} />,
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
  const emptyMessage = hasSearch
    ? "No Results Found"
    : "No clients found. Add your first client to get started."

  return (
    <div className="flex flex-col gap-4">
      <DebouncedSearchInput placeholder="Search by name, phone, email, address, or ID..." />

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
                        className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
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
                        <td key={cell.id} className="px-4 py-3">
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
            entityLabel="client"
            searchActive={hasSearch}
          />
        </div>
      </TableLoadingOverlay>
    </div>
  )
}

export function ClientsDataTable(props: ClientsDataTableProps) {
  return (
    <TableQueryProvider>
      <ClientsTableInner {...props} />
    </TableQueryProvider>
  )
}
