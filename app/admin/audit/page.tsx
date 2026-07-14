import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import { canViewAuditLogs } from "@/lib/constants"
import { getAuditLogsPaginated } from "@/lib/queries"
import { Suspense } from "react"
import { DebouncedSearchInput } from "@/components/debounced-search-input"
import { DataTablePagination } from "@/components/data-table-pagination"
import { TableQueryProvider } from "@/components/use-table-params"

function formatDetails(details: Record<string, unknown> | null): string {
  if (!details) return "—"
  try {
    return JSON.stringify(details)
  } catch {
    return "—"
  }
}

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string; pageSize?: string }>
}) {
  const user = await getCurrentUser()
  if (!user || !canViewAuditLogs(user.role)) redirect("/admin")

  const params = await searchParams
  const search = params.search ?? ""
  const result = await getAuditLogsPaginated({
    search,
    page: params.page,
    pageSize: params.pageSize ?? "25",
  })

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">Security</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">Audit Logs</h2>
        <p className="text-sm text-muted-foreground">
          Important actions by Super Admin and Admin accounts.
        </p>
      </div>

      <Suspense>
        <TableQueryProvider>
          <div className="flex flex-col gap-4">
            <DebouncedSearchInput placeholder="Search action, entity, role, user..." />

            <div className="overflow-x-auto rounded-xl border border-border/60 bg-card shadow-premium">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="border-b border-border/60 bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">When</th>
                    <th className="px-4 py-3 font-medium">User</th>
                    <th className="px-4 py-3 font-medium">Role</th>
                    <th className="px-4 py-3 font-medium">Action</th>
                    <th className="px-4 py-3 font-medium">Entity</th>
                    <th className="px-4 py-3 font-medium">IP</th>
                    <th className="px-4 py-3 font-medium">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                        No audit events yet.
                      </td>
                    </tr>
                  ) : (
                    result.rows.map((row) => (
                      <tr key={row.id} className="border-b border-border/40 last:border-0 align-top">
                        <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                          {row.created_at}
                        </td>
                        <td className="px-4 py-3 font-medium">{row.user_name ?? "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground">{row.role ?? "—"}</td>
                        <td className="px-4 py-3 font-mono text-xs">{row.action}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {row.entity_type}
                          {row.entity_id != null ? ` #${row.entity_id}` : ""}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                          {row.ip_address ?? "—"}
                        </td>
                        <td className="max-w-[240px] truncate px-4 py-3 font-mono text-[11px] text-muted-foreground">
                          {formatDetails(row.details)}
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
              entityLabel="event"
              searchActive={Boolean(search)}
            />
          </div>
        </TableQueryProvider>
      </Suspense>
    </div>
  )
}
