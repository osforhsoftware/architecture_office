import "server-only"
import { sql } from "./db"
import type { AppUser, Project } from "./types"
import { SECTION_ROLE, canAccessBilling, isBillingStaff } from "./constants"

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
  return project
}

export function isAdmin(user: AppUser): boolean {
  return user.role === "Admin"
}

export function isBillingStaffUser(user: AppUser): boolean {
  return isBillingStaff(user.role)
}

export function userCanAccessBilling(user: AppUser): boolean {
  return canAccessBilling(user.role)
}

export function staffOwnsProject(user: AppUser, project: Project): boolean {
  return project.assigned_to === user.id
}

export function staffCanEditProject(user: AppUser, project: Project): boolean {
  if (!staffOwnsProject(user, project)) return false
  return ["Assigned", "In Progress", "Correction Required", "Waiting For Documents", "New"].includes(
    project.status,
  )
}

export function staffSectionMatches(user: AppUser, project: Project): boolean {
  return SECTION_ROLE[project.section] === user.role
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

export async function logAudit(
  userId: number,
  action: string,
  entityType: string,
  entityId: number,
  details?: Record<string, unknown>,
) {
  await sql`
    INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
    VALUES (${userId}, ${action}, ${entityType}, ${entityId}, ${details ? JSON.stringify(details) : null})
  `
}
