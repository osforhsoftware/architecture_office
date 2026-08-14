export const SIDEBAR_COLLAPSED_KEY = "dashboard-sidebar-collapsed"

export const SIDEBAR_WIDTH_EXPANDED = 256
export const SIDEBAR_WIDTH_COLLAPSED = 72

export const SIDEBAR_INIT_STYLE_ID = "dashboard-sidebar-init"

export function readSidebarCollapsedFromStorage(): boolean {
  if (typeof window === "undefined") return false
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true"
  } catch {
    return false
  }
}

export function writeSidebarCollapsed(collapsed: boolean): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? "true" : "false")
  } catch {
    // ignore storage failures
  }
}

export function removeSidebarInitStyle(): void {
  if (typeof document === "undefined") return
  document.getElementById(SIDEBAR_INIT_STYLE_ID)?.remove()
}
