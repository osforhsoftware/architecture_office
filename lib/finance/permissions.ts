import "server-only"

import { requireUser, ForbiddenError } from "@/lib/permissions"
import {
  isSuperAdmin,
  isOfficeAdmin,
  userCanAccessBilling,
  userIsBillingStaff,
  userIsStaffRole,
} from "@/lib/constants"
import type { AppUser } from "@/lib/types"

export type FinanceUser = AppUser

/**
 * Finance access matrix:
 * - Super Admin: full control
 * - Admin: manage finance
 * - Billing Staff: income, expenses, reports (+ dashboard read)
 * - Staff: submit expense claims (+ optional read-only dashboard via staff portal)
 */
export async function requireFinanceAccess(): Promise<FinanceUser> {
  const user = await requireUser()
  if (isSuperAdmin(user.role) || isOfficeAdmin(user.role) || userCanAccessBilling(user)) {
    return user
  }
  throw new ForbiddenError("Forbidden")
}

/** Full finance management (CRUD accounts, vendors, categories, settings, transfers) */
export async function requireFinanceManage(): Promise<FinanceUser> {
  const user = await requireUser()
  if (isSuperAdmin(user.role) || isOfficeAdmin(user.role)) {
    return user
  }
  throw new ForbiddenError("Forbidden")
}

/** Income / expense / reports — Super Admin, Admin, Billing Staff */
export async function requireFinanceOperate(): Promise<FinanceUser> {
  return requireFinanceAccess()
}

/** Approvals — Super Admin or Admin */
export async function requireFinanceApprove(): Promise<FinanceUser> {
  const user = await requireUser()
  if (isSuperAdmin(user.role) || isOfficeAdmin(user.role)) {
    return user
  }
  throw new ForbiddenError("Forbidden")
}

/** Staff may submit / view own claims */
export async function requireStaffClaimAccess(): Promise<FinanceUser> {
  const user = await requireUser()
  if (
    userIsStaffRole(user) ||
    isSuperAdmin(user.role) ||
    isOfficeAdmin(user.role) ||
    userCanAccessBilling(user)
  ) {
    return user
  }
  throw new ForbiddenError("Forbidden")
}

export function canManageFinance(user: { role: string; roles?: readonly string[] }): boolean {
  return isSuperAdmin(user.role) || isOfficeAdmin(user.role)
}

export function canOperateFinance(user: { role: string; roles?: readonly string[] }): boolean {
  return canManageFinance(user) || userCanAccessBilling(user)
}

export function canViewFinanceDashboard(user: {
  role: string
  roles?: readonly string[]
}): boolean {
  return canOperateFinance(user) || userIsStaffRole(user)
}

export function isBillingFinanceLimited(user: {
  role: string
  roles?: readonly string[]
}): boolean {
  return userIsBillingStaff(user) && !isSuperAdmin(user.role) && !isOfficeAdmin(user.role)
}

export { ForbiddenError }
