"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { isBillingStaff } from "@/lib/constants"
import {
  BILLING_FINANCE_ALLOWED,
  PROJECT_FINANCE_BASE,
  OFFICE_FINANCE_BASE,
} from "@/lib/finance/constants"

const PROJECT_NAV = [
  { href: `${PROJECT_FINANCE_BASE}`, label: "Dashboard", exact: true },
  { href: `${PROJECT_FINANCE_BASE}/income`, label: "Income" },
  { href: `${PROJECT_FINANCE_BASE}/expenses`, label: "Expenses" },
  { href: `${PROJECT_FINANCE_BASE}/budget`, label: "Budget" },
  { href: `${PROJECT_FINANCE_BASE}/ledger`, label: "Ledger" },
  { href: `${PROJECT_FINANCE_BASE}/profit`, label: "Profit" },
  { href: `${PROJECT_FINANCE_BASE}/reports`, label: "Reports" },
]

const OFFICE_NAV = [
  { href: `${OFFICE_FINANCE_BASE}`, label: "Dashboard", exact: true },
  { href: `${OFFICE_FINANCE_BASE}/income`, label: "Income" },
  { href: `${OFFICE_FINANCE_BASE}/expenses`, label: "Expenses" },
  { href: `${OFFICE_FINANCE_BASE}/cash-book`, label: "Cash Book" },
  { href: `${OFFICE_FINANCE_BASE}/accounts`, label: "Accounts" },
  { href: `${OFFICE_FINANCE_BASE}/vendors`, label: "Vendors" },
  { href: `${OFFICE_FINANCE_BASE}/claims`, label: "Claims" },
  { href: `${OFFICE_FINANCE_BASE}/salary`, label: "Salary" },
  { href: `${OFFICE_FINANCE_BASE}/reports`, label: "Reports" },
  { href: `${OFFICE_FINANCE_BASE}/settings`, label: "Settings" },
]

const HUB_LINKS = [
  { href: PROJECT_FINANCE_BASE, label: "Project Finance" },
  { href: OFFICE_FINANCE_BASE, label: "Office Finance" },
]

function filterBilling(items: { href: string; label: string; exact?: boolean }[]) {
  return items.filter((item) =>
    (BILLING_FINANCE_ALLOWED as readonly string[]).some(
      (prefix) => item.href === prefix || item.href.startsWith(`${prefix}/`),
    ),
  )
}

function NavPills({
  items,
}: {
  items: { href: string; label: string; exact?: boolean }[]
}) {
  const pathname = usePathname()

  return (
    <nav className="flex flex-wrap gap-2">
      {items.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(`${item.href}/`)
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              active
                ? "border-primary bg-primary/10 text-primary"
                : "border-border/60 text-muted-foreground hover:border-border hover:text-foreground",
            )}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}

export function FinanceSubNav({ role }: { role?: string }) {
  const pathname = usePathname()
  const billingLimited = role ? isBillingStaff(role) : false

  if (pathname.startsWith(`${PROJECT_FINANCE_BASE}`)) {
    const items = billingLimited ? filterBilling(PROJECT_NAV) : PROJECT_NAV
    return <NavPills items={items} />
  }

  if (pathname.startsWith(`${OFFICE_FINANCE_BASE}`)) {
    const items = billingLimited ? filterBilling(OFFICE_NAV) : OFFICE_NAV
    return <NavPills items={items} />
  }

  const hubItems = billingLimited
    ? HUB_LINKS.filter((item) =>
        (BILLING_FINANCE_ALLOWED as readonly string[]).includes(item.href),
      )
    : HUB_LINKS

  return (
    <nav className="flex flex-wrap gap-3">
      {hubItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "rounded-xl border px-5 py-2.5 text-sm font-medium transition-colors",
            pathname.startsWith(item.href)
              ? "border-primary bg-primary/10 text-primary"
              : "border-border/60 text-muted-foreground hover:border-border hover:text-foreground",
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  )
}
