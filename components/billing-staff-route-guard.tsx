"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import {
  isAdminRouteAllowed,
  isBillingStaff,
  isBillingStaffRouteAllowed,
  isSuperAdmin,
  ADMIN_ROLE,
} from "@/lib/constants"
import { isBillingFinanceRouteAllowed } from "@/lib/admin-nav"

/**
 * Client-side route guard for the admin shell.
 * - Billing Staff: allow-listed billing routes; finance limited to dashboard/income/expenses/reports
 * - Admin: Clients + Projects + Finance
 * - Super Admin: full access
 */
export function AdminRouteGuard({
  role,
  children,
}: {
  role: string
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    if (isBillingStaff(role)) {
      if (!isBillingStaffRouteAllowed(pathname)) {
        router.replace("/admin/billing")
        return
      }
      if (pathname.startsWith("/admin/finance") && !isBillingFinanceRouteAllowed(pathname)) {
        router.replace("/admin/finance")
      }
      return
    }

    if (role === ADMIN_ROLE && !isSuperAdmin(role)) {
      if (!isAdminRouteAllowed(pathname)) {
        router.replace("/admin/projects")
      }
    }
  }, [pathname, role, router])

  return <>{children}</>
}

/** @deprecated Use AdminRouteGuard */
export function BillingStaffRouteGuard({
  role,
  children,
}: {
  role: string
  children: React.ReactNode
}) {
  return <AdminRouteGuard role={role}>{children}</AdminRouteGuard>
}
