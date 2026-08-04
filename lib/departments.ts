import "server-only"

import { cache } from "react"
import {
  ROLE_SECTION,
  SECTION_ROLE,
  SECTIONS,
  keyToRole,
  roleToKey,
} from "./constants"
import { sql } from "./db"

export interface Department {
  id: number
  name: string
  role_label: string
  role_key: string
  sort_order: number
  active: boolean
}

const DEFAULT_DEPARTMENTS: Department[] = SECTIONS.map((name, index) => {
  const role_label = SECTION_ROLE[name]
  const role_key = roleToKey(role_label) ?? `${name.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}_STAFF`
  return {
    id: -(index + 1),
    name,
    role_label,
    role_key,
    sort_order: (index + 1) * 10,
    active: true,
  }
})

export function makeRoleKey(name: string): string {
  const base = name
    .normalize("NFKD")
    .replace(/[^\w\s&]/g, "")
    .replace(/&/g, " ")
    .trim()
    .replace(/\s+/g, "_")
    .toUpperCase()
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")

  // Preserve known built-in key for 3D department
  if (base === "3D_INTERIOR" || base === "3D") return "THREED_STAFF"

  const withStaff = base.endsWith("_STAFF") ? base : `${base}_STAFF`
  return withStaff.slice(0, 50)
}

export function defaultRoleLabel(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return ""
  if (/staff$/i.test(trimmed)) return trimmed
  return `${trimmed} Staff`
}

function normalizeDepartment(row: Record<string, unknown>): Department {
  return {
    id: Number(row.id),
    name: String(row.name),
    role_label: String(row.role_label),
    role_key: String(row.role_key),
    sort_order: Number(row.sort_order ?? 0),
    active: Boolean(row.active),
  }
}

export const listDepartments = cache(
  async (opts?: { activeOnly?: boolean; includeInactive?: boolean }): Promise<Department[]> => {
    const activeOnly = opts?.includeInactive ? false : opts?.activeOnly !== false
    try {
      const rows = activeOnly
        ? ((await sql`
            SELECT id, name, role_label, role_key, sort_order, active
            FROM departments
            WHERE active = 1
            ORDER BY sort_order ASC, name ASC
          `) as Record<string, unknown>[])
        : ((await sql`
            SELECT id, name, role_label, role_key, sort_order, active
            FROM departments
            ORDER BY sort_order ASC, name ASC
          `) as Record<string, unknown>[])

      if (!rows.length) return DEFAULT_DEPARTMENTS.filter((d) => (activeOnly ? d.active : true))
      return rows.map(normalizeDepartment)
    } catch (error) {
      console.warn("[departments] Falling back to hardcoded sections:", error)
      return DEFAULT_DEPARTMENTS.filter((d) => (activeOnly ? d.active : true))
    }
  },
)

export async function getDepartmentById(id: number): Promise<Department | null> {
  try {
    const rows = (await sql`
      SELECT id, name, role_label, role_key, sort_order, active
      FROM departments
      WHERE id = ${id}
      LIMIT 1
    `) as Record<string, unknown>[]
    return rows[0] ? normalizeDepartment(rows[0]) : null
  } catch {
    return null
  }
}

export async function getDepartmentNames(activeOnly = true): Promise<string[]> {
  const depts = await listDepartments({ activeOnly })
  return depts.map((d) => d.name)
}

export async function getStaffRoleLabels(activeOnly = true): Promise<string[]> {
  const depts = await listDepartments({ activeOnly })
  return depts.map((d) => d.role_label)
}

export async function getSectionRoleMap(): Promise<Record<string, string>> {
  const depts = await listDepartments({ includeInactive: true })
  const map: Record<string, string> = { ...SECTION_ROLE }
  for (const dept of depts) {
    map[dept.name] = dept.role_label
  }
  return map
}

export async function getRoleSectionMap(): Promise<Record<string, string>> {
  const depts = await listDepartments({ includeInactive: true })
  const map: Record<string, string> = { ...ROLE_SECTION }
  for (const dept of depts) {
    map[dept.role_label] = dept.name
  }
  return map
}

export async function resolveRoleKey(roleLabel: string): Promise<string | null> {
  const builtIn = roleToKey(roleLabel)
  if (builtIn) return builtIn
  const depts = await listDepartments({ includeInactive: true })
  return depts.find((d) => d.role_label === roleLabel)?.role_key ?? null
}

export async function resolveRoleLabel(roleKey: string): Promise<string | null> {
  const builtIn = keyToRole(roleKey)
  if (builtIn) return builtIn
  const depts = await listDepartments({ includeInactive: true })
  return depts.find((d) => d.role_key === roleKey)?.role_label ?? null
}

export async function departmentForRoleLabel(role: string): Promise<string | null> {
  const map = await getRoleSectionMap()
  return map[role] ?? null
}

export async function roleForSection(section: string): Promise<string | null> {
  const map = await getSectionRoleMap()
  return map[section] ?? null
}
