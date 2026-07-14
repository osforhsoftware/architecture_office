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

/**
 * Client-side route guard for the admin shell.
 * - Billing Staff: allow-listed billing routes only
 * - Admin: Staff + Projects only
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
