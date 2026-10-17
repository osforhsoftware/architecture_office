"use client"

import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { Tabs } from "@/components/ui/tabs"

export function BillingTabs({
  defaultTab,
  children,
}: {
  defaultTab: string
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const tab = searchParams.get("tab") ?? defaultTab

  return (
    <Tabs
      value={tab}
      onValueChange={(value) => {
        const next = new URLSearchParams(searchParams.toString())
        next.set("tab", value)
        next.delete("page")
        const query = next.toString()
        router.replace(query ? `${pathname}?${query}` : pathname)
      }}
    >
      {children}
    </Tabs>
  )
}
