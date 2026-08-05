/** Dual-ledger finance constants */

export type LedgerScope = "project" | "office"

export const LEDGER_SCOPES = ["project", "office"] as const

export const FINANCE_INCOME_STATUSES = ["Draft", "Approved", "Cancelled"] as const
export type FinanceIncomeStatus = (typeof FINANCE_INCOME_STATUSES)[number]

export const FINANCE_EXPENSE_STATUSES = [
  "Draft",
  "Submitted",
  "Approved",
  "Rejected",
  "Paid",
] as const
export type FinanceExpenseStatus = (typeof FINANCE_EXPENSE_STATUSES)[number]

export const STAFF_CLAIM_STATUSES = [
  "Submitted",
  "Dept Review",
  "Admin Approval",
  "Finance Payment",
  "Completed",
  "Rejected",
] as const
export type StaffClaimStatus = (typeof STAFF_CLAIM_STATUSES)[number]

export const STAFF_CLAIM_CATEGORIES = [
  "Fuel",
  "Travel",
  "Food",
  "Accommodation",
  "Site Visit",
  "Office Purchase",
] as const

export const SALARY_STATUSES = ["Draft", "Approved", "Paid", "Cancelled"] as const
export type SalaryStatus = (typeof SALARY_STATUSES)[number]

export const ACCOUNT_TYPES = ["cash", "petty", "bank", "upi"] as const
export type AccountType = (typeof ACCOUNT_TYPES)[number]

export const PROJECT_INCOME_TYPES = [
  "Advance Payment",
  "Stage Payment",
  "Final Payment",
  "Consultation Fee",
  "Drawing Fee",
  "Permit Fee",
  "Other Income",
] as const

export const FINANCE_PAYMENT_METHODS = [
  "Cash",
  "Bank Transfer",
  "UPI",
  "Cheque",
  "Card",
] as const

export const PROJECT_FINANCE_BASE = "/admin/finance/project"
export const OFFICE_FINANCE_BASE = "/admin/finance/office"

/** Billing staff: project income/expenses/reports + office income/expenses/reports */
export const BILLING_FINANCE_ALLOWED = [
  "/admin/finance",
  "/admin/finance/project",
  "/admin/finance/project/income",
  "/admin/finance/project/expenses",
  "/admin/finance/project/reports",
  "/admin/finance/office",
  "/admin/finance/office/income",
  "/admin/finance/office/expenses",
  "/admin/finance/office/reports",
] as const

export function isCashAccountType(type: string): boolean {
  return type === "cash" || type === "petty"
}

export function isBankAccountType(type: string): boolean {
  return type === "bank" || type === "upi"
}

/** Seeded default accounts that must not be deleted. */
export const PROTECTED_DEFAULT_ACCOUNT_NAMES = ["Cash", "Petty Cash"] as const

export function isProtectedDefaultAccount(account: {
  name?: string | null
}): boolean {
  const name = String(account.name ?? "").trim()
  return (PROTECTED_DEFAULT_ACCOUNT_NAMES as readonly string[]).includes(name)
}

export function isBillingFinanceRouteAllowed(pathname: string): boolean {
  if (pathname === "/admin/finance") return true
  // Exact allow-list only — do not use startsWith on /project or /office roots
  // (those would unintentionally open budget/salary/settings).
  if ((BILLING_FINANCE_ALLOWED as readonly string[]).includes(pathname)) {
    return true
  }
  // Project finance detail: /admin/finance/project/123
  if (/^\/admin\/finance\/project\/\d+$/.test(pathname)) {
    return true
  }
  return false
}
