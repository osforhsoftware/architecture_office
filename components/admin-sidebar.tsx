"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { motion } from "framer-motion"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { useState } from "react"
import { cn } from "@/lib/utils"
import { adminNavForRole } from "@/lib/admin-nav"
import { isSuperAdmin, type Role } from "@/lib/constants"
import { BrandLogoHeader } from "@/components/brand-logo"

export function AdminSidebar({
  role = "Admin",
  unreadCount = 0,
}: {
  role?: Role
  unreadCount?: number
}) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const nav = adminNavForRole(role)

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 72 : 256 }}
      transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
      className="hidden shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex"
    >
      <BrandLogoHeader
        href={isSuperAdmin(role) ? "/admin" : "/admin/projects"}
        compact={collapsed}
        className="border-sidebar-border"
      />

      <nav className="flex-1 overflow-y-auto px-2 py-2">
        <ul className="flex flex-col gap-0.5">
          {nav.map((item) => {
            const active = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href)
            const showBadge = item.href === "/admin/notifications" && unreadCount > 0

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                    collapsed && "justify-center px-2",
                  )}
                >
                  {active ? (
                    <motion.span
                      layoutId="sidebar-active"
                      className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-sidebar-primary"
                    />
                  ) : null}
                  <item.icon className="size-4 shrink-0" />
                  {!collapsed ? (
                    <>
                      <span className="flex-1">{item.label}</span>
                      {showBadge ? (
                        <span className="flex size-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
                          {unreadCount > 9 ? "9+" : unreadCount}
                        </span>
                      ) : null}
                    </>
                  ) : null}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="border-t border-sidebar-border p-2">
        <button
          type="button"
          suppressHydrationWarning
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
            collapsed && "justify-center px-2",
          )}
        >
          {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
          {!collapsed ? <span>Collapse</span> : null}
        </button>
      </div>
    </motion.aside>
  )
}
