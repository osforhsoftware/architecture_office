import { getCurrentUser } from "@/lib/auth"
import { getNotifications } from "@/lib/queries"
import { NotificationCenter } from "@/components/notification-center"
import { redirect } from "next/navigation"
import { markAllNotificationsRead } from "@/lib/actions"
import { Check } from "lucide-react"

export default async function AdminNotificationsPage() {
  const user = await getCurrentUser()
  if (!user) redirect("/login")

  const notifications = await getNotifications(user.id)
  const unread = notifications.filter((n) => !n.read).length

  return (
    <div className="flex flex-col gap-4">
      {unread > 0 ? (
        <div className="flex justify-end">
          <form action={markAllNotificationsRead}>
            <button
              type="submit"
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/5"
            >
              <Check className="size-3.5" /> Mark all read
            </button>
          </form>
        </div>
      ) : null}
      <NotificationCenter notifications={notifications} />
    </div>
  )
}
