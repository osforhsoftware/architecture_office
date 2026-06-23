"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Building2, FolderKanban, Home, User } from "lucide-react"
import { cn } from "@/lib/utils"

const NAV = [
  { href: "/staff", label: "Home", icon: Home, exact: true },
  { href: "/staff/projects", label: "My Projects", icon: FolderKanban, exact: false },
  { href: "/staff/profile", label: "Profile", icon: User, exact: true },
]

export function StaffSidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex">
      <div className="flex items-center gap-3 px-6 py-5">
        <div className="flex size-9 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
          <Building2 className="size-5" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold">ArchPermit</p>
          <p className="text-xs text-sidebar-foreground/60">Staff Portal</p>
        </div>
      </div>

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
