import "server-only"

import { cache } from "react"
import { sql } from "./db"
import {
  PROJECT_SERVICES as DEFAULT_PROJECT_SERVICES,
  type ProjectServiceDef,
} from "./workflow"

export interface ProjectService {
  id: number
  service_key: string
  label: string
  section: string
  role: string
  sort_order: number
  active: boolean
}

export type { ProjectServiceDef }

/** Slug used as immutable `service_key` (workflow / project_services FK). */
export function makeServiceKey(label: string): string {
  const base = label
    .normalize("NFKD")
    .replace(/[^\w\s/-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[/\s]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")

  return (base || "service").slice(0, 100)
}

function normalizeService(row: Record<string, unknown>): ProjectService {
  return {
    id: Number(row.id),
    service_key: String(row.service_key),
    label: String(row.label),
    section: String(row.section),
    role: String(row.role),
    sort_order: Number(row.sort_order ?? 0),
    active: Boolean(row.active),
  }
}

function toServiceDef(service: ProjectService): ProjectServiceDef {
  return {
    key: service.service_key,
    label: service.label,
    section: service.section,
    role: service.role,
    allowsMultiAssignee: true,
    sortOrder: service.sort_order,
    active: service.active,
  }
}

function defaultAsProjectServices(): ProjectService[] {
  return DEFAULT_PROJECT_SERVICES.map((s, index) => ({
    id: -(index + 1),
    service_key: s.key,
    label: s.label,
    section: s.section,
    role: s.role,
    sort_order: s.sortOrder ?? index + 1,
    active: s.active !== false,
  }))
}

async function ensureDefaultServicesSeeded(): Promise<void> {
  try {
    const countRows = (await sql`SELECT COUNT(*) AS count FROM services`) as { count: number }[]
    if (Number(countRows[0]?.count ?? 0) > 0) return

    for (const [index, service] of DEFAULT_PROJECT_SERVICES.entries()) {
      await sql`
        INSERT IGNORE INTO services (service_key, label, section, role, sort_order, active)
        VALUES (
          ${service.key},
          ${service.label},
          ${service.section},
          ${service.role},
          ${service.sortOrder ?? index + 1},
          1
        )
      `
    }
  } catch (error) {
    console.warn("[project-services] Could not seed defaults:", error)
  }
}

export const listProjectServices = cache(
  async (opts?: { activeOnly?: boolean; includeInactive?: boolean }): Promise<ProjectService[]> => {
    const activeOnly = opts?.includeInactive ? false : opts?.activeOnly !== false
    try {
      await ensureDefaultServicesSeeded()

      const rows = activeOnly
        ? ((await sql`
            SELECT id, service_key, label, section, role, sort_order, active
            FROM services
            WHERE active = 1
            ORDER BY sort_order ASC, label ASC
          `) as Record<string, unknown>[])
        : ((await sql`
            SELECT id, service_key, label, section, role, sort_order, active
            FROM services
            ORDER BY sort_order ASC, label ASC
          `) as Record<string, unknown>[])

      if (!rows.length) {
        return defaultAsProjectServices().filter((s) => (activeOnly ? s.active : true))
      }
      return rows.map(normalizeService)
    } catch (error) {
      console.warn("[project-services] Falling back to hardcoded catalog:", error)
      return defaultAsProjectServices().filter((s) => (activeOnly ? s.active : true))
    }
  },
)

export async function listProjectServiceDefs(opts?: {
  activeOnly?: boolean
  includeInactive?: boolean
}): Promise<ProjectServiceDef[]> {
  const rows = await listProjectServices(opts)
  return rows.map(toServiceDef)
}

export async function getProjectServiceById(id: number): Promise<ProjectService | null> {
  try {
    const rows = (await sql`
      SELECT id, service_key, label, section, role, sort_order, active
      FROM services
      WHERE id = ${id}
      LIMIT 1
    `) as Record<string, unknown>[]
    return rows[0] ? normalizeService(rows[0]) : null
  } catch {
    return null
  }
}

export async function getProjectServiceByKey(key: string): Promise<ProjectService | null> {
  try {
    const rows = (await sql`
      SELECT id, service_key, label, section, role, sort_order, active
      FROM services
      WHERE service_key = ${key}
      LIMIT 1
    `) as Record<string, unknown>[]
    return rows[0] ? normalizeService(rows[0]) : null
  } catch {
    const fallback = defaultAsProjectServices().find((s) => s.service_key === key)
    return fallback ?? null
  }
}
