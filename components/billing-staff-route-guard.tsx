"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { isBillingStaffRouteAllowed } from "@/lib/constants"

export function BillingStaffRouteGuard({
  role,
  children,
}: {
  role: string
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    if (role !== "Billing Staff") return
    if (!isBillingStaffRouteAllowed(pathname)) {
      router.replace("/admin/billing")
    }
  }, [pathname, role, router])

  return <>{children}</>
}
