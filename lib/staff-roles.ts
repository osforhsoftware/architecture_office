import "server-only"

import { isStaffRole, type Role } from "./constants"
import {
  getStaffRoleLabels,
  resolveRoleKey,
  resolveRoleLabel,
} from "./departments"
import { sql } from "./db"
import type { AppUser } from "./types"

export async function parseStaffRoles(formData: FormData): Promise<string[]> {
  const allowed = new Set(await getStaffRoleLabels(false))
  const roles: string[] = []
  for (const value of formData.getAll("roles")) {
    const role = String(value).trim()
    if (!allowed.has(role)) continue
    if (!roles.includes(role)) roles.push(role)
  }
  return roles
}

export async function getUserDepartmentRoles(userId: number): Promise<Role[]> {
  try {
    const rows = (await sql`
      SELECT role_key FROM staff_roles WHERE user_id = ${userId} ORDER BY role_key
    `) as { role_key: string }[]
    const roles: Role[] = []
    for (const row of rows) {
      const role = await resolveRoleLabel(row.role_key)
      if (role && isStaffRole(role) && !roles.includes(role)) roles.push(role)
    }
    return roles
  } catch (error) {
    // Pre-migration databases may lack staff_roles
    console.warn("[staff-roles] Falling back without staff_roles table:", error)
    return []
  }
}

export async function attachUserRoles<T extends AppUser>(user: T): Promise<T> {
  const fromJunction = await getUserDepartmentRoles(user.id)
  const roles =
    fromJunction.length > 0
      ? fromJunction
      : isStaffRole(user.role)
        ? [user.role]
        : []
  return { ...user, roles }
}

export async function attachUserRolesMany<T extends AppUser>(users: T[]): Promise<T[]> {
  if (!users.length) return users
  return Promise.all(users.map((user) => attachUserRoles(user)))
}

export async function syncStaffRoles(userId: number, roles: readonly string[]) {
  await sql`DELETE FROM staff_roles WHERE user_id = ${userId}`
  for (const role of roles) {
    const key = await resolveRoleKey(role)
    if (!key) continue
    await sql`
      INSERT INTO staff_roles (user_id, role_key)
      VALUES (${userId}, ${key})
    `
  }
}
