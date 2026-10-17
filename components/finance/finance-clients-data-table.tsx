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
import { Badge } from "@/components/ui/badge"
import type { PaginatedResult } from "@/lib/pagination"
import type { Client } from "@/lib/types"

interface FinanceClientsDataTableProps {
  result: PaginatedResult<Client>
  search: string
}

function FinanceClientsTableInner({ result, search }: FinanceClientsDataTableProps) {
  const columns = useMemo<ColumnDef<Client>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => {
          const client = row.original
          if (client.source === "finance") {
            return (
              <span
                title={client.name}
                className="block whitespace-normal break-words font-medium leading-snug"
              >
                {client.name}
              </span>
            )
          }
          return (
            <Link
              href={`/admin/clients/${client.id}`}
              title={client.name}
              className="block whitespace-normal break-words font-medium leading-snug hover:text-primary hover:underline"
            >
              {client.name}
            </Link>
          )
        },
      },
      {
        id: "origin",
        header: "Source",
        cell: ({ row }) => {
          const createdInFinance = row.original.source === "finance"
          return (
            <Badge variant={createdInFinance ? "secondary" : "outline"}>
              {createdInFinance ? "Finance" : "Linked"}
            </Badge>
          )
        },
      },
      {
        accessorKey: "phone",
        header: "Phone",
        cell: ({ getValue }) => {
          const phone = getValue() as string | null
          return phone ? (
            <span className="flex min-w-0 items-center gap-1.5 text-sm" title={phone}>
              <Phone className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 truncate">{phone}</span>
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
            <span className="flex min-w-0 items-center gap-1.5 text-sm" title={email}>
              <Mail className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">{email}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )
        },
      },
      {
        accessorKey: "address",
        header: "Address",
        cell: ({ getValue }) => (
          <span
            className="block min-w-0 truncate text-sm text-muted-foreground"
            title={(getValue() as string | null) ?? undefined}
          >
            {(getValue() as string | null) ?? "—"}
          </span>
        ),
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
    ? "No finance clients match that search."
    : "No finance clients yet. Add a new client or link an existing one."

  return (
    <div className="flex flex-col gap-4">
      <DebouncedSearchInput
        placeholder="Search finance clients by name, phone, email, or ID..."
        className="w-full min-w-0"
      />

      <TableLoadingOverlay>
        <div className="overflow-hidden rounded-lg border border-border/60">
          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[56rem] table-fixed text-sm">
              <colgroup>
                <col />
                <col className="w-[8.5rem]" />
                <col className="w-[11rem]" />
                <col />
                <col />
                <col className="w-[6.75rem]" />
                <col className="w-[7.5rem]" />
              </colgroup>
              <thead className="border-b border-border/60 bg-muted/40">
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id}>
                    {hg.headers.map((header) => (
                      <th
                        key={header.id}
                        className="overflow-hidden whitespace-nowrap px-4 py-3 text-left text-xs font-semibold text-muted-foreground"
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
                        <td key={cell.id} className="overflow-hidden px-4 py-3 align-middle">
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

export function FinanceClientsDataTable(props: FinanceClientsDataTableProps) {
  return (
    <TableQueryProvider>
      <FinanceClientsTableInner {...props} />
    </TableQueryProvider>
  )
}
