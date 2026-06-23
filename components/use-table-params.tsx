"use client"

import {
  createContext,
  useCallback,
  useContext,
  useTransition,
  type ReactNode,
} from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

interface TableParamsContextValue {
  updateParams: (
    updates: Record<string, string | null>,
    options?: { resetPage?: boolean },
  ) => void
  isPending: boolean
  searchParams: URLSearchParams
}

const TableParamsContext = createContext<TableParamsContextValue | null>(null)

export function TableQueryProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const updateParams = useCallback(
    (updates: Record<string, string | null>, options?: { resetPage?: boolean }) => {
      const next = new URLSearchParams(searchParams.toString())

      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "") next.delete(key)
        else next.set(key, value)
      }

      if (options?.resetPage) next.set("page", "1")

      const query = next.toString()
      startTransition(() => {
        router.replace(query ? `${pathname}?${query}` : pathname)
      })
    },
    [pathname, router, searchParams],
  )

  return (
    <TableParamsContext.Provider value={{ updateParams, isPending, searchParams }}>
      {children}
    </TableParamsContext.Provider>
  )
}

export function useTableParams() {
  const context = useContext(TableParamsContext)
  if (!context) {
    throw new Error("useTableParams must be used within TableQueryProvider")
  }
  return context
}
