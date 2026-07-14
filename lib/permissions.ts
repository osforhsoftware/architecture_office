import "server-only"

import { getCurrentUser } from "./auth"
import {
  isOfficeAdmin,
  isSuperAdmin,
  userCanAccessBilling,
  userIsStaffRole,
} from "./constants"
import type { AppUser } from "./types"

export class ForbiddenError extends Error {
  status = 403 as const

  constructor(message = "Forbidden") {
    super(message)
    this.name = "ForbiddenError"
  }
}

export async function requireUser(): Promise<AppUser> {
  const user = await getCurrentUser()
  if (!user) throw new ForbiddenError("Unauthorized")
  return user
}

export async function requireSuperAdmin(): Promise<AppUser> {
  const user = await requireUser()
  if (!isSuperAdmin(user.role)) throw new ForbiddenError("Forbidden")
  return user
}

/** Office Admin or Super Admin — day-to-day management access */
export async function requireAdminOrSuperAdmin(): Promise<AppUser> {
  const user = await requireUser()
  if (!isOfficeAdmin(user.role)) throw new ForbiddenError("Forbidden")
  return user
}

export async function requireBillingAccess(): Promise<AppUser> {
  const user = await requireUser()
  if (!userCanAccessBilling(user)) throw new ForbiddenError("Forbidden")
  return user
}

export async function requireStaffAccess(): Promise<AppUser> {
  const user = await requireUser()
  if (!userIsStaffRole(user)) throw new ForbiddenError("Forbidden")
  return user
}

/** @deprecated Use requireAdminOrSuperAdmin — kept for gradual migration */
export async function requireAdmin(): Promise<AppUser> {
  return requireAdminOrSuperAdmin()
}
