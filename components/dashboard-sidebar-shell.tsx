"use client"

import { motion } from "framer-motion"
import {
  SIDEBAR_WIDTH_COLLAPSED,
  SIDEBAR_WIDTH_EXPANDED,
} from "@/lib/sidebar-storage"

export function DashboardSidebarShell({
  collapsed,
  header,
  children,
}: {
  collapsed: boolean
  header: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <motion.aside
      data-dashboard-sidebar
      initial={false}
      animate={{ width: collapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED }}
      transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
      suppressHydrationWarning
      className="hidden shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex"
    >
      {header}
      {children}
    </motion.aside>
  )
}
