"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { FolderKanban, Home, User } from "lucide-react"
import { cn } from "@/lib/utils"

const NAV = [
  { href: "/staff", label: "Home", icon: Home, exact: true },
  { href: "/staff/projects", label: "My Projects", icon: FolderKanban, exact: false },
  { href: "/staff/profile", label: "Profile", icon: User, exact: true },
]

export function StaffBottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <ul className="mx-auto flex max-w-lg items-stretch justify-around">
        {NAV.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`)
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-0.5 px-2 py-2.5 text-[10px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <item.icon className={cn("size-5", active && "stroke-[2.5]")} />
                {item.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
