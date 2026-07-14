import type { LucideIcon } from "lucide-react"
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  Building2,
  CreditCard,
  FileText,
  BarChart3,
  Bell,
  Settings,
  UserCog,
  Shield,
  ScrollText,
  ShieldCheck,
  UserRoundCog,
} from "lucide-react"
import {
  isBillingStaff,
  isSuperAdmin,
  type Role,
} from "@/lib/constants"

export type AdminNavItem = {
  href: string
  label: string
  icon: LucideIcon
  exact?: boolean
}

/** Full Super Admin navigation */
export const SUPER_ADMIN_NAV: AdminNavItem[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/clients", label: "Clients", icon: Users },
  { href: "/admin/projects", label: "Projects", icon: FolderKanban },
  { href: "/admin/departments", label: "Departments", icon: Building2 },
  { href: "/admin/staff", label: "Staff", icon: UserCog },
  { href: "/admin/admins", label: "Admin Management", icon: Shield },
  { href: "/admin/billing", label: "Billing", icon: CreditCard },
  { href: "/admin/invoices", label: "Invoices", icon: FileText },
  { href: "/admin/reports", label: "Reports", icon: BarChart3 },
  { href: "/admin/notifications", label: "Notifications", icon: Bell },
  { href: "/admin/settings", label: "Settings", icon: Settings },
  { href: "/admin/security", label: "Security", icon: ShieldCheck },
  { href: "/admin/audit", label: "Audit Logs", icon: ScrollText },
  { href: "/admin/users", label: "User Management", icon: UserRoundCog },
]

/** Office Admin navigation — Staff + Projects only */
export const ADMIN_NAV: AdminNavItem[] = [
  { href: "/admin/projects", label: "Projects", icon: FolderKanban },
  { href: "/admin/staff", label: "Staff", icon: UserCog },
]

export const BILLING_STAFF_NAV: AdminNavItem[] = [
  { href: "/admin/billing", label: "Billing Dashboard", icon: CreditCard, exact: false },
  { href: "/admin/invoices", label: "Invoices", icon: FileText },
  { href: "/admin/projects", label: "Billing Projects", icon: FolderKanban },
  { href: "/admin/notifications", label: "Notifications", icon: Bell },
]

export function adminNavForRole(role: Role | string): AdminNavItem[] {
  if (isBillingStaff(role)) return BILLING_STAFF_NAV
  if (isSuperAdmin(role)) return SUPER_ADMIN_NAV
  return ADMIN_NAV
}
