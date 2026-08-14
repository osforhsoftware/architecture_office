"use client"

import { useCallback, useLayoutEffect, useState } from "react"
import {
  readSidebarCollapsedFromStorage,
  removeSidebarInitStyle,
  writeSidebarCollapsed,
} from "@/lib/sidebar-storage"

export function useSidebarCollapsed() {
  const [collapsed, setCollapsedState] = useState(false)

  useLayoutEffect(() => {
    setCollapsedState(readSidebarCollapsedFromStorage())
    removeSidebarInitStyle()
  }, [])

  const setCollapsed = useCallback((value: boolean | ((prev: boolean) => boolean)) => {
    setCollapsedState((prev) => {
      const next = typeof value === "function" ? value(prev) : value
      writeSidebarCollapsed(next)
      return next
    })
  }, [])

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => !prev)
  }, [setCollapsed])

  return { collapsed, setCollapsed, toggleCollapsed }
}
