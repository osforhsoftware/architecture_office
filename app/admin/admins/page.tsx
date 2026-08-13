import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import { canManageAdmins } from "@/lib/constants"
import { getAdminUsers } from "@/lib/queries"
import { AdminAccountDialog } from "@/components/admin-account-dialog"
import { AdminDeleteDialog } from "@/components/admin-delete-dialog"
import { Badge } from "@/components/ui/badge"

export default async function AdminManagementPage() {
  const user = await getCurrentUser()
  if (!user || !canManageAdmins(user.role)) redirect("/admin")

  const admins = await getAdminUsers()

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            Privileged Access
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">Admin Management</h2>
          <p className="text-sm text-muted-foreground">
            Create and manage office Admin accounts. Acmmo Admin only.
          </p>
        </div>
        <AdminAccountDialog />
      </div>

      <div className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-premium">
        <table className="w-full text-sm">
          <thead className="border-b border-border/60 bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Username</th>
              <th className="hidden px-4 py-3 font-medium sm:table-cell">Contact</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {admins.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  No Admin accounts yet. Create one to delegate office management.
                </td>
              </tr>
            ) : (
              admins.map((admin) => (
                <tr key={admin.id} className="border-b border-border/40 last:border-0">
                  <td className="px-4 py-3 font-medium">{admin.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {admin.username}
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">
                    {[admin.email, admin.phone].filter(Boolean).join(" · ") || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={admin.active ? "default" : "secondary"}>
                      {admin.active ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <AdminAccountDialog admin={admin} />
                      <AdminDeleteDialog admin={admin} />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
