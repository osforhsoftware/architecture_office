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
import { DebouncedSearchInput } from "@/components/debounced-search-input"
import { DataTablePagination } from "@/components/data-table-pagination"
import { StaffDialog } from "@/components/staff-dialog"
import { StaffDeleteDialog } from "@/components/staff-delete-dialog"
import { TableLoadingOverlay } from "@/components/table-loading-overlay"
import { TableQueryProvider } from "@/components/use-table-params"
import { UserAvatar } from "@/components/user-avatar"
import { Badge } from "@/components/ui/badge"
import type { PaginatedResult } from "@/lib/pagination"
import { formatRolesLabel } from "@/lib/constants"
import type { AppUser } from "@/lib/types"

interface StaffDataTableProps {
  result: PaginatedResult<AppUser>
  search: string
  /** When false, hide edit/delete (Admin add-only mode) */
  canManageStaff?: boolean
  roleOptions?: string[]
  selectedStaffId?: number | null
}

function StaffTableInner({
  result,
  search,
  canManageStaff = true,
  roleOptions,
  selectedStaffId = null,
}: StaffDataTableProps) {
  const columns = useMemo<ColumnDef<AppUser>[]>(
    () => {
      const cols: ColumnDef<AppUser>[] = [
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => (
          <div className="flex min-w-0 items-center gap-2.5">
            <UserAvatar
              name={row.original.name}
              avatarUrl={row.original.avatar_url}
              className="size-8 shrink-0"
            />
            <span className="min-w-0 whitespace-normal break-words font-medium leading-snug" title={row.original.name}>
              {row.original.name}
            </span>
          </div>
        ),
      },
      {
        accessorKey: "username",
        header: "Username",
        cell: ({ getValue }) => {
          const username = getValue() as string
          return (
            <span className="block min-w-0 truncate font-mono text-xs text-muted-foreground" title={username}>
              {username}
            </span>
          )
        },
      },
      {
        accessorKey: "role",
        header: "Department Roles",
        cell: ({ row }) => {
          const roles = formatRolesLabel(row.original)
          return (
            <span className="block whitespace-normal break-words text-sm leading-snug" title={roles}>
              {roles}
            </span>
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
        accessorKey: "active",
        header: "Status",
        cell: ({ getValue }) => {
          const isActive = getValue() as boolean
          return (
            <Badge variant={isActive ? "default" : "secondary"}>
              {isActive ? "Active" : "Inactive"}
            </Badge>
          )
        },
      },
      ]

      cols.push({
        id: "activity",
        header: "",
        cell: ({ row }) => (
          <Link
            href={`/admin/staff?staff=${row.original.id}`}
            className="text-xs font-medium text-primary hover:underline"
          >
            Activity
          </Link>
        ),
      })

      if (canManageStaff) {
        cols.push({
          id: "actions",
          header: "",
          cell: ({ row }) => (
            <div className="flex items-center justify-end gap-2">
              <StaffDialog staff={row.original} roleOptions={roleOptions} />
              <StaffDeleteDialog staff={row.original} />
            </div>
          ),
        })
      }

      return cols
    },
    [canManageStaff, roleOptions],
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
    : "No staff found. Add your first staff member to get started."

  return (
    <div className="flex flex-col gap-4">
      <DebouncedSearchInput placeholder="Search by name, username, role, phone, or email..." />

      <TableLoadingOverlay>
        <div className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-premium">
          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[72rem] table-fixed text-sm">
              <colgroup>
                <col />
                <col className="w-[8rem]" />
                <col />
                <col className="w-[11rem]" />
                <col />
                <col className="w-[7.25rem]" />
                <col className="w-[6.5rem]" />
                {canManageStaff ? <col className="w-[13rem]" /> : null}
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
                      className={
                        selectedStaffId === row.original.id
                          ? "border-b border-primary/30 bg-primary/5"
                          : "border-b border-border/50 transition-colors hover:bg-muted/40"
                      }
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
            entityLabel="staff member"
            searchActive={hasSearch}
          />
        </div>
      </TableLoadingOverlay>
    </div>
  )
}

export function StaffDataTable(props: StaffDataTableProps) {
  return (
    <TableQueryProvider>
      <StaffTableInner {...props} />
    </TableQueryProvider>
  )
}
