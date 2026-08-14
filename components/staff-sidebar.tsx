"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { motion } from "framer-motion"
import { ClipboardCheck, FolderKanban, Home, Receipt, User } from "lucide-react"
import { cn } from "@/lib/utils"
import { BrandLogo } from "@/components/brand-logo"
import { DashboardSidebarShell } from "@/components/dashboard-sidebar-shell"
import { SidebarNavTooltip } from "@/components/sidebar-nav-tooltip"
import { SidebarToggleButton } from "@/components/sidebar-toggle-button"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useSidebarCollapsed } from "@/hooks/use-sidebar-collapsed"

const NAV = [
  { href: "/staff", label: "Home", icon: Home, exact: true },
  { href: "/staff/projects", label: "My Projects", icon: FolderKanban, exact: false },
  { href: "/staff/attendance", label: "Attendance", icon: ClipboardCheck, exact: true },
  { href: "/staff/expenses", label: "Expenses", icon: Receipt, exact: true },
  { href: "/staff/profile", label: "Profile", icon: User, exact: true },
]

function SidebarHeader({
  collapsed,
  onToggle,
}: {
  collapsed: boolean
  onToggle: () => void
}) {
  return (
    <div
      className={cn(
        "flex border-b border-sidebar-border",
        collapsed ? "flex-col items-center gap-2 px-2 py-3" : "items-center justify-between px-4 py-4",
      )}
    >
      <Link
        href="/staff"
        className={cn("min-w-0", collapsed ? "mx-auto w-fit shrink-0" : "w-fit max-w-full shrink")}
      >
        <BrandLogo compact={collapsed} priority align="left" />
      </Link>
      <SidebarToggleButton collapsed={collapsed} onToggle={onToggle} />
    </div>
  )
}

export function StaffSidebar() {
  const pathname = usePathname()
  const { collapsed, toggleCollapsed } = useSidebarCollapsed()

  return (
    <DashboardSidebarShell
      collapsed={collapsed}
      header={<SidebarHeader collapsed={collapsed} onToggle={toggleCollapsed} />}
    >
      <TooltipProvider delay={0}>
        <nav className="flex-1 overflow-y-auto px-2 py-2">
          <ul className="flex flex-col gap-0.5">
            {NAV.map((item) => {
              const active = item.exact
                ? pathname === item.href
                : pathname.startsWith(item.href)

              const link = (
                <Link
                  href={item.href}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                    collapsed && "justify-center px-2",
                  )}
                >
                  {active ? (
                    <motion.span
                      layoutId="staff-sidebar-active"
                      className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-sidebar-primary"
                    />
                  ) : null}
                  <item.icon className="size-4 shrink-0" />
                  {!collapsed ? <span className="truncate">{item.label}</span> : null}
                </Link>
              )

              return (
                <li key={item.href}>
                  <SidebarNavTooltip label={item.label} collapsed={collapsed}>
                    {link}
                  </SidebarNavTooltip>
                </li>
              )
            })}
          </ul>
        </nav>
      </TooltipProvider>
    </DashboardSidebarShell>
  )
}
