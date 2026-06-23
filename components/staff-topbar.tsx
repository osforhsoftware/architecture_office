"use client"

import { usePathname } from "next/navigation"
import { NotificationBell } from "@/components/notification-bell"
import { UserMenu } from "@/components/user-menu"
import type { AppUser, Notification } from "@/lib/types"

function pageTitle(pathname: string): string {
  if (pathname.startsWith("/staff/projects/")) return "Project Details"
  if (pathname === "/staff/projects") return "My Projects"
  if (pathname === "/staff/profile") return "Profile"
  return "Home"
}

export function StaffTopbar({
  user,
  notifications,
}: {
  user: AppUser
  notifications: Notification[]
}) {
  const pathname = usePathname()
  const title = pageTitle(pathname)

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-2 border-b border-border bg-background/95 px-4 backdrop-blur md:px-6">
      <div className="min-w-0">
        <h1 className="truncate text-base font-semibold md:text-lg">{title}</h1>
      </div>
      <div className="flex shrink-0 items-center gap-1 sm:gap-2">
        <NotificationBell notifications={notifications} />
        <div
          className="mx-0.5 hidden h-6 w-px shrink-0 bg-border sm:block"
          aria-hidden
        />
        <UserMenu user={user} />
      </div>
    </header>
  )
}
