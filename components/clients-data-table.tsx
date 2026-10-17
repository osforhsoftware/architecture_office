"use client"

import { useMemo } from "react"
import Link from "next/link"
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table"
import { Mail, Phone, Plus } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ClientDialog } from "@/components/client-dialog"
import { DebouncedSearchInput } from "@/components/debounced-search-input"
import { DataTablePagination } from "@/components/data-table-pagination"
import { TableLoadingOverlay } from "@/components/table-loading-overlay"
import { TableQueryProvider, useTableParams } from "@/components/use-table-params"
import { KERALA_DISTRICTS } from "@/lib/constants"
import type { PaginatedResult } from "@/lib/pagination"
import type { Client } from "@/lib/types"

interface ClientsDataTableProps {
  result: PaginatedResult<Client>
  search: string
  district?: string
  hasProjects?: string
}

function ClientsTableInner({
  result,
  search,
  district = "all",
  hasProjects = "all",
}: ClientsDataTableProps) {
  const { updateParams } = useTableParams()
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
            title={row.original.name}
            className="block whitespace-normal break-words font-medium leading-snug hover:text-primary hover:underline"
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
        cell: ({ getValue }) => {
          const address = getValue() as string | null
          return (
            <span
              className="block min-w-0 truncate text-sm text-muted-foreground"
              title={address ?? undefined}
            >
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
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1">
            <Link
              href={`/admin/invoices/new?fromClient=${row.original.id}`}
              title="Add invoice for this client"
              className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }))}
            >
              <Plus className="size-4" />
            </Link>
            <ClientDialog client={row.original} />
          </div>
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
  const emptyMessage = hasSearch
    ? "No Results Found"
    : "No clients found. Add your first client to get started."

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <DebouncedSearchInput
          placeholder="Search by name, phone, email, address, or ID..."
          className="w-full min-w-0 lg:max-w-sm"
        />
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Select
            value={district}
            onValueChange={(value) => {
              if (!value) return
              updateParams({ district: value === "all" ? null : value }, { resetPage: true })
            }}
          >
            <SelectTrigger className="w-full min-w-0 sm:w-[160px]">
              <SelectValue placeholder="District" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All districts</SelectItem>
              {KERALA_DISTRICTS.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={hasProjects}
            onValueChange={(value) => {
              if (!value) return
              updateParams({ hasProjects: value === "all" ? null : value }, { resetPage: true })
            }}
          >
            <SelectTrigger className="w-full min-w-0 sm:w-[150px]">
              <SelectValue placeholder="Projects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All clients</SelectItem>
              <SelectItem value="with">With projects</SelectItem>
              <SelectItem value="without">No projects</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <TableLoadingOverlay>
        <div className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-premium">
          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[56rem] table-fixed text-sm">
              <colgroup>
                <col className="w-[4.5rem]" />
                <col />
                <col className="w-[11rem]" />
                <col />
                <col />
                <col className="w-[6.75rem]" />
                <col className="w-[7.5rem]" />
              </colgroup>
              <thead className="sticky top-0 z-10 border-b border-border bg-muted/50 backdrop-blur">
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id}>
                    {hg.headers.map((header) => (
                      <th
                        key={header.id}
                        className="overflow-hidden whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
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

export function ClientsDataTable(props: ClientsDataTableProps) {
  return (
    <TableQueryProvider>
      <ClientsTableInner {...props} />
    </TableQueryProvider>
  )
}
