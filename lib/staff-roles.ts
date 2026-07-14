import "server-only"

import {
  STAFF_ROLES,
  keyToRole,
  roleToKey,
  type Role,
} from "./constants"
import { sql } from "./db"
import type { AppUser } from "./types"

export function parseStaffRoles(formData: FormData): Role[] {
  const raw = formData.getAll("roles")
  const roles: Role[] = []
  for (const value of raw) {
    const role = String(value).trim()
    if (!(STAFF_ROLES as readonly string[]).includes(role)) continue
    if (!roles.includes(role as Role)) roles.push(role as Role)
  }
  return roles
}

export async function getUserDepartmentRoles(userId: number): Promise<Role[]> {
  try {
    const rows = (await sql`
      SELECT role_key FROM staff_roles WHERE user_id = ${userId} ORDER BY role_key
    `) as { role_key: string }[]
    const roles = rows
      .map((row) => keyToRole(row.role_key))
      .filter((role): role is Role => role !== null && (STAFF_ROLES as readonly string[]).includes(role))
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
      : (STAFF_ROLES as readonly string[]).includes(user.role)
        ? [user.role]
        : []
  return { ...user, roles }
}

export async function attachUserRolesMany<T extends AppUser>(users: T[]): Promise<T[]> {
  if (!users.length) return users
  return Promise.all(users.map((user) => attachUserRoles(user)))
}

export async function syncStaffRoles(userId: number, roles: Role[]) {
  await sql`DELETE FROM staff_roles WHERE user_id = ${userId}`
  for (const role of roles) {
    const key = roleToKey(role)
    if (!key) continue
    await sql`
      INSERT INTO staff_roles (user_id, role_key)
      VALUES (${userId}, ${key})
    `
  }
}
