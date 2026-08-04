"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { FolderKanban, Home, Receipt, User } from "lucide-react"
import { cn } from "@/lib/utils"
import { BrandLogoHeader } from "@/components/brand-logo"

const NAV = [
  { href: "/staff", label: "Home", icon: Home, exact: true },
  { href: "/staff/projects", label: "My Projects", icon: FolderKanban, exact: false },
  { href: "/staff/expenses", label: "Expenses", icon: Receipt, exact: true },
  { href: "/staff/profile", label: "Profile", icon: User, exact: true },
]

export function StaffSidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex">
      <BrandLogoHeader href="/staff" className="border-sidebar-border" />

      <nav className="flex-1 px-3 py-2">
        <ul className="flex flex-col gap-1">
          {NAV.map((item) => {
            const active = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href)
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                  )}
                >
                  <item.icon className="size-4" />
                  {item.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </aside>
  )
}
