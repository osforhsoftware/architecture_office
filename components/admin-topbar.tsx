"use client"

import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { Menu } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { NotificationBell } from "@/components/notification-bell"
import { AdminMobileNav } from "@/components/admin-mobile-nav"
import { UserMenu } from "@/components/user-menu"
import type { AppUser, Notification } from "@/lib/types"

const TITLES: Record<string, string> = {
  "/admin": "Dashboard",
  "/admin/clients": "Clients",
  "/admin/projects": "Projects",
  "/admin/departments": "Departments",
  "/admin/staff": "Staff",
  "/admin/billing": "Billing",
  "/admin/invoices": "Invoices",
  "/admin/reports": "Reports",
  "/admin/notifications": "Notifications",
  "/admin/settings": "Settings",
}

function titleForPath(pathname: string): string {
  if (pathname.startsWith("/admin/projects/")) return "Project Details"
  if (pathname.startsWith("/admin/clients/")) return "Client Details"
  if (pathname.startsWith("/admin/invoices/")) return "Invoice"
  for (const [path, title] of Object.entries(TITLES)) {
    if (path === "/admin" ? pathname === path : pathname.startsWith(path)) return title
  }
  return "Dashboard"
}

export function AdminTopbar({
  user,
  notifications,
}: {
  user: AppUser
  notifications: Notification[]
}) {
  const pathname = usePathname()
  const title = titleForPath(pathname)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  useEffect(() => {
    setMobileNavOpen(false)
  }, [pathname])

  return (
    <>
      <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between gap-2 overflow-hidden border-b border-border/60 bg-background/95 px-4 backdrop-blur-xl md:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            className={cn(
              buttonVariants({ variant: "ghost", size: "icon" }),
              "shrink-0 md:hidden",
            )}
            aria-label="Open menu"
            aria-expanded={mobileNavOpen}
            onClick={() => setMobileNavOpen(true)}
          >
            <Menu className="size-5" />
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold tracking-tight md:text-lg">
              {title}
            </h1>
          </div>
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

      <AdminMobileNav
        open={mobileNavOpen}
        onOpenChange={setMobileNavOpen}
        pathname={pathname}
        role={user.role}
      />
    </>
  )
}
