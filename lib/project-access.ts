import "server-only"
import { sql } from "./db"
import { getProjectSiteAssignees } from "./queries"
import type { AppUser, Project } from "./types"
import {
  isBillingStaff,
  isOfficeAdmin,
  isSuperAdmin,
  rolesOf,
  userCanAccessBilling as canUserAccessBilling,
  userHasRole,
} from "./constants"
import { roleForSection } from "./departments"

export async function getProjectOrThrow(id: number): Promise<Project> {
  const rows = (await sql`
    SELECT p.*, c.name AS client_name, c.phone AS client_phone, u.name AS assignee_name
    FROM projects p
    JOIN clients c ON c.id = p.client_id
    LEFT JOIN app_users u ON u.id = p.assigned_to
    WHERE p.id = ${id} LIMIT 1
  `) as Project[]
  const project = rows[0]
  if (!project) throw new Error("Project not found")
  const assignees = await getProjectSiteAssignees(id)
  // Prefer current-step assignees when available (same logic as queries.attachSiteAssignees via stage)
  const stageAssignees = await (async () => {
    if (!project.current_workflow_step_id) return [] as Awaited<ReturnType<typeof getProjectSiteAssignees>>
    const steps = (await sql`
      SELECT service_key, step_key FROM workflow_steps
      WHERE id = ${project.current_workflow_step_id} LIMIT 1
    `) as { service_key: string | null; step_key: string }[]
    const step = steps[0]
    if (!step) return []
    const stageKey = step.service_key ?? step.step_key
    let list = await getProjectSiteAssignees(id, stageKey)
    if (!list.length && stageKey === "site_survey") {
      list = await getProjectSiteAssignees(id, "site_visit")
    }
    return list
  })()
  const effective = stageAssignees.length ? stageAssignees : assignees
  const seen = new Set<number>()
  const unique = effective.filter((a) => {
    if (seen.has(a.user_id)) return false
    seen.add(a.user_id)
    return true
  })
  return {
    ...project,
    site_assignee_ids: unique.map((a) => a.user_id),
    site_assignee_names: unique.map((a) => a.name),
  }
}

/** Super Admin or Admin — office management privileges */
export function isAdmin(user: AppUser): boolean {
  return isOfficeAdmin(user.role)
}

export function isBillingStaffUser(user: AppUser): boolean {
  return isBillingStaff(user.role) || userHasRole(user, "Billing Staff")
}

export function userCanAccessBilling(user: AppUser): boolean {
  return canUserAccessBilling(user)
}

export function staffOwnsProject(user: AppUser, project: Project): boolean {
  if (project.assigned_to === user.id) return true
  return project.site_assignee_ids?.includes(user.id) ?? false
}

export function staffCanEditProject(user: AppUser, project: Project): boolean {
  if (!staffOwnsProject(user, project)) return false
  if (project.status === "Closed" || project.status === "Completed" || project.status === "Cancelled") {
    return false
  }
  return [
    "Assigned",
    "In Progress",
    "Work Completed",
    "Correction Required",
    "Waiting for Documents",
    "New",
    "Awaiting Assignment",
  ].includes(project.status)
}

export async function staffSectionMatches(user: AppUser, project: Project): Promise<boolean> {
  const required = await roleForSection(project.section)
  if (!required) return false
  return userHasRole(user, required)
}

export async function staffContributedToProject(
  user: AppUser,
  projectId: number,
): Promise<boolean> {
  const rows = (await sql`
    SELECT 1 AS ok FROM DUAL WHERE (
      EXISTS (
        SELECT 1 FROM projects WHERE id = ${projectId} AND assigned_to = ${user.id}
      ) OR EXISTS (
        SELECT 1 FROM project_assignees pa
        WHERE pa.project_id = ${projectId}
          AND pa.user_id = ${user.id}
      ) OR EXISTS (
        SELECT 1 FROM status_history
        WHERE project_id = ${projectId} AND created_by = ${user.name}
      ) OR EXISTS (
        SELECT 1 FROM return_history
        WHERE project_id = ${projectId} AND created_by = ${user.name}
      )
    )
  `) as { ok: number }[]
  return rows.length > 0
}

export async function requireProjectAccess(
  user: AppUser,
  projectId: number,
): Promise<Project> {
  const project = await getProjectOrThrow(projectId)
  if (isAdmin(user)) return project
  if (staffOwnsProject(user, project)) return project
  if (await staffContributedToProject(user, projectId)) return project
  throw new Error("Unauthorized")
}

export async function requireStaffProjectAccess(
  user: AppUser,
  projectId: number,
): Promise<Project> {
  const project = await requireProjectAccess(user, projectId)
  if (isAdmin(user)) throw new Error("Unauthorized")
  if (!staffCanEditProject(user, project)) throw new Error("Unauthorized")
  return project
}

/** Closed projects are read-only except for Super Admin. */
export function closedProjectMutationError(
  user: AppUser,
  project: Pick<Project, "status">,
): string | null {
  if (project.status === "Closed" && !isSuperAdmin(user.role)) {
    return "Closed projects are read-only."
  }
  return null
}

export async function logAudit(
  userId: number,
  action: string,
  entityType: string,
  entityId: number,
  details?: Record<string, unknown>,
  options?: { role?: string; ipAddress?: string | null },
) {
  const payload = {
    ...(details ?? {}),
    ...(options?.role ? { actor_role: options.role } : {}),
    ...(options?.ipAddress ? { ip_address: options.ipAddress } : {}),
  }
  const hasPayload = Object.keys(payload).length > 0
  const detailsJson = hasPayload ? JSON.stringify(payload) : null

  try {
    await sql`
      INSERT INTO audit_logs (user_id, role, action, entity_type, entity_id, details, ip_address)
      VALUES (
        ${userId},
        ${options?.role ?? null},
        ${action},
        ${entityType},
        ${entityId},
        ${detailsJson},
        ${options?.ipAddress ?? null}
      )
    `
  } catch (error) {
    // Pre-migration databases may lack role / ip_address columns
    console.warn("[audit] Falling back to legacy audit_logs insert:", error)
    await sql`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
      VALUES (${userId}, ${action}, ${entityType}, ${entityId}, ${detailsJson})
    `
  }
}

export async function logAuditForUser(
  user: AppUser,
  action: string,
  entityType: string,
  entityId: number,
  details?: Record<string, unknown>,
  ipAddress?: string | null,
) {
  await logAudit(user.id, action, entityType, entityId, details, {
    role: rolesOf(user).join(", ") || user.role,
    ipAddress,
  })
}
