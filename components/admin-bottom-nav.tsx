"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  CreditCard,
  FileText,
  FolderKanban,
  LayoutDashboard,
  Users,
  Bell,
  Wallet,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { isBillingStaff, isSuperAdmin, type Role } from "@/lib/constants"

const OFFICE_ADMIN_NAV = [
  { href: "/admin/clients", label: "Clients", icon: Users, exact: false },
  { href: "/admin/projects", label: "Projects", icon: FolderKanban, exact: false },
  { href: "/admin/finance", label: "Finance", icon: Wallet, exact: false },
]

const BILLING_STAFF_NAV = [
  { href: "/admin/billing", label: "Billing", icon: CreditCard, exact: false },
  { href: "/admin/invoices", label: "Invoices", icon: FileText, exact: false },
  { href: "/admin/finance", label: "Finance", icon: Wallet, exact: false },
  { href: "/admin/notifications", label: "Alerts", icon: Bell, exact: false },
]

const SUPER_ADMIN_NAV = [
  { href: "/admin", label: "Home", icon: LayoutDashboard, exact: true },
  { href: "/admin/projects", label: "Projects", icon: FolderKanban, exact: false },
  { href: "/admin/finance", label: "Finance", icon: Wallet, exact: false },
  { href: "/admin/billing", label: "Billing", icon: CreditCard, exact: false },
]

function bottomNavForRole(role: Role) {
  if (isBillingStaff(role)) return BILLING_STAFF_NAV
  if (isSuperAdmin(role)) return SUPER_ADMIN_NAV
  return OFFICE_ADMIN_NAV
}

export function AdminBottomNav({ role = "Admin" }: { role?: Role }) {
  const pathname = usePathname()
  const nav = bottomNavForRole(role)

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <ul className="mx-auto flex max-w-lg items-stretch justify-around">
        {nav.map((item) => {
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
