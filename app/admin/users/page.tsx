import { Suspense } from "react"
import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import { canManageUsers, isSuperAdmin } from "@/lib/constants"
import { getAllUsersPaginated } from "@/lib/queries"
import { DebouncedSearchInput } from "@/components/debounced-search-input"
import { DataTablePagination } from "@/components/data-table-pagination"
import { TableQueryProvider } from "@/components/use-table-params"
import { Badge } from "@/components/ui/badge"
import { UserActiveToggle } from "@/components/user-active-toggle"

export default async function UserManagementPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string; pageSize?: string }>
}) {
  const user = await getCurrentUser()
  if (!user || !canManageUsers(user.role)) redirect("/admin")

  const params = await searchParams
  const search = params.search ?? ""
  const result = await getAllUsersPaginated({
    search,
    page: params.page,
    pageSize: params.pageSize,
  })

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">Access Control</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">User Management</h2>
        <p className="text-sm text-muted-foreground">
          View all accounts and activate or deactivate users. Acmmo Admin only.
        </p>
      </div>

      <Suspense>
        <TableQueryProvider>
          <div className="flex flex-col gap-4">
            <DebouncedSearchInput placeholder="Search name, username, role..." />

            <div className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-premium">
              <table className="w-full text-sm">
                <thead className="border-b border-border/60 bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Username</th>
                    <th className="px-4 py-3 font-medium">Role</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                        No users found.
                      </td>
                    </tr>
                  ) : (
                    result.rows.map((row) => (
                      <tr key={row.id} className="border-b border-border/40 last:border-0">
                        <td className="px-4 py-3 font-medium">{row.name}</td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                          {row.username}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={isSuperAdmin(row.role) ? "default" : "secondary"}>
                            {row.role}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={row.active ? "default" : "outline"}>
                            {row.active ? "Active" : "Inactive"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {isSuperAdmin(row.role) ? (
                            <span className="text-xs text-muted-foreground">Protected</span>
                          ) : (
                            <UserActiveToggle user={row} />
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <DataTablePagination
              total={result.total}
              page={result.page}
              pageSize={result.pageSize}
              totalPages={result.totalPages}
              entityLabel="user"
              searchActive={Boolean(search)}
            />
          </div>
        </TableQueryProvider>
      </Suspense>
    </div>
  )
}
