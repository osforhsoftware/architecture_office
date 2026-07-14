import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import { userCanAccessAdminPortal } from "@/lib/constants"
import { getNotifications, getUnreadCount } from "@/lib/queries"
import { AdminSidebar } from "@/components/admin-sidebar"
import { AdminTopbar } from "@/components/admin-topbar"
import { AdminBottomNav } from "@/components/admin-bottom-nav"
import { AdminRouteGuard } from "@/components/billing-staff-route-guard"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()
  if (!user) redirect("/login")
  if (!userCanAccessAdminPortal(user)) redirect("/staff")

  const [notifications, unreadCount] = await Promise.all([
    getNotifications(user.id),
    getUnreadCount(user.id),
  ])

  return (
    <AdminRouteGuard role={user.role}>
      <div className="flex min-h-screen overflow-x-hidden bg-background">
        <AdminSidebar role={user.role} unreadCount={unreadCount} />
        <div className="flex min-w-0 flex-1 flex-col">
          <AdminTopbar user={user} notifications={notifications} />
          <main className="flex-1 p-4 pb-24 md:p-6 md:pb-6 lg:p-8">{children}</main>
        </div>
        <AdminBottomNav role={user.role} />
      </div>
    </AdminRouteGuard>
  )
}
