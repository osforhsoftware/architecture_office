import type { LucideIcon } from "lucide-react"
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  Building2,
  CreditCard,
  FileText,
  Files,
  BarChart3,
  Bell,
  Settings,
  UserCog,
  Shield,
  ScrollText,
  ShieldCheck,
  UserRoundCog,
  Wrench,
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  BookOpen,
  Landmark,
  Truck,
  Receipt,
  PieChart,
  Tags,
  SlidersHorizontal,
  Building,
  Calculator,
  LineChart,
  Banknote,
} from "lucide-react"
import {
  isBillingStaff,
  isSuperAdmin,
  isOfficeAdmin,
  type Role,
} from "@/lib/constants"
import { BILLING_FINANCE_ALLOWED } from "@/lib/finance/constants"

export type AdminNavItem = {
  href: string
  label: string
  icon: LucideIcon
  exact?: boolean
  children?: AdminNavItem[]
}

const PROJECT_FINANCE_CHILDREN: AdminNavItem[] = [
  { href: "/admin/finance/project", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/finance/project/income", label: "Income", icon: ArrowDownLeft },
  { href: "/admin/finance/project/expenses", label: "Expenses", icon: ArrowUpRight },
  { href: "/admin/finance/project/budget", label: "Budget", icon: Calculator },
  { href: "/admin/finance/project/ledger", label: "Ledger", icon: BookOpen },
  { href: "/admin/finance/project/profit", label: "Profit Analysis", icon: LineChart },
  { href: "/admin/finance/project/reports", label: "Reports", icon: BarChart3 },
]

const OFFICE_FINANCE_CHILDREN: AdminNavItem[] = [
  { href: "/admin/finance/office", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/finance/office/income", label: "Income", icon: ArrowDownLeft },
  { href: "/admin/finance/office/expenses", label: "Expenses", icon: ArrowUpRight },
  { href: "/admin/finance/office/cash-book", label: "Cash Book", icon: BookOpen },
  { href: "/admin/finance/office/accounts", label: "Accounts", icon: Landmark },
  { href: "/admin/finance/office/vendors", label: "Vendors", icon: Truck },
  { href: "/admin/finance/office/claims", label: "Staff Claims", icon: Receipt },
  { href: "/admin/finance/office/salary", label: "Salary", icon: Banknote },
  { href: "/admin/finance/office/reports", label: "Reports", icon: PieChart },
  { href: "/admin/finance/office/settings", label: "Settings", icon: SlidersHorizontal },
]

const FULL_FINANCE_NAV: AdminNavItem = {
  href: "/admin/finance",
  label: "Finance",
  icon: Wallet,
  children: [
    {
      href: "/admin/finance/project",
      label: "Project Finance",
      icon: FolderKanban,
      children: PROJECT_FINANCE_CHILDREN,
    },
    {
      href: "/admin/finance/office",
      label: "Office Finance",
      icon: Building,
      children: OFFICE_FINANCE_CHILDREN,
    },
  ],
}

const BILLING_FINANCE_NAV: AdminNavItem = {
  href: "/admin/finance",
  label: "Finance",
  icon: Wallet,
  children: [
    {
      href: "/admin/finance/project",
      label: "Project Finance",
      icon: FolderKanban,
      children: [
        { href: "/admin/finance/project", label: "Dashboard", icon: LayoutDashboard, exact: true },
        { href: "/admin/finance/project/income", label: "Income", icon: ArrowDownLeft },
        { href: "/admin/finance/project/expenses", label: "Expenses", icon: ArrowUpRight },
        { href: "/admin/finance/project/reports", label: "Reports", icon: BarChart3 },
      ],
    },
    {
      href: "/admin/finance/office",
      label: "Office Finance",
      icon: Building,
      children: [
        { href: "/admin/finance/office", label: "Dashboard", icon: LayoutDashboard, exact: true },
        { href: "/admin/finance/office/income", label: "Income", icon: ArrowDownLeft },
        { href: "/admin/finance/office/expenses", label: "Expenses", icon: ArrowUpRight },
        { href: "/admin/finance/office/reports", label: "Reports", icon: PieChart },
      ],
    },
  ],
}

/** Full Super Admin navigation */
export const SUPER_ADMIN_NAV: AdminNavItem[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/clients", label: "Clients", icon: Users },
  { href: "/admin/projects", label: "Projects", icon: FolderKanban },
  { href: "/admin/departments", label: "Departments", icon: Building2 },
  { href: "/admin/services", label: "Services", icon: Wrench },
  { href: "/admin/documents", label: "Documents", icon: Files },
  { href: "/admin/staff", label: "Staff", icon: UserCog },
  { href: "/admin/admins", label: "Admin Management", icon: Shield },
  { href: "/admin/billing", label: "Billing", icon: CreditCard },
  { href: "/admin/invoices", label: "Invoices", icon: FileText },
  FULL_FINANCE_NAV,
  { href: "/admin/reports", label: "Reports", icon: BarChart3 },
  { href: "/admin/notifications", label: "Notifications", icon: Bell },
  { href: "/admin/settings", label: "Settings", icon: Settings },
  { href: "/admin/security", label: "Security", icon: ShieldCheck },
  { href: "/admin/audit", label: "Audit Logs", icon: ScrollText },
  { href: "/admin/users", label: "User Management", icon: UserRoundCog },
]

/** Office Admin — Clients, Projects, Finance */
export const ADMIN_NAV: AdminNavItem[] = [
  { href: "/admin/clients", label: "Clients", icon: Users },
  { href: "/admin/projects", label: "Projects", icon: FolderKanban },
  FULL_FINANCE_NAV,
]

/** Billing Staff — billing + limited finance */
export const BILLING_STAFF_NAV: AdminNavItem[] = [
  { href: "/admin/billing", label: "Billing Dashboard", icon: CreditCard, exact: false },
  { href: "/admin/invoices", label: "Invoices", icon: FileText },
  { href: "/admin/projects", label: "Billing Projects", icon: FolderKanban },
  BILLING_FINANCE_NAV,
  { href: "/admin/notifications", label: "Notifications", icon: Bell },
]

export function adminNavForRole(role: Role | string): AdminNavItem[] {
  if (isBillingStaff(role)) return BILLING_STAFF_NAV
  if (isSuperAdmin(role)) return SUPER_ADMIN_NAV
  if (isOfficeAdmin(role)) return ADMIN_NAV
  return ADMIN_NAV
}

export { BILLING_FINANCE_ALLOWED }

export function isBillingFinanceRouteAllowed(pathname: string): boolean {
  if (pathname === "/admin/finance") return true
  if ((BILLING_FINANCE_ALLOWED as readonly string[]).includes(pathname)) {
    return true
  }
  if (/^\/admin\/finance\/project\/\d+$/.test(pathname)) {
    return true
  }
  return false
}

void Tags
