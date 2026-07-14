import "server-only"
import { sql } from "./db"
import { toSafeNumber } from "./utils"
import {
  buildSearchPattern,
  clampPage,
  pageOffset,
  parsePage,
  parsePageSize,
  toPaginatedResult,
  type PaginatedResult,
  type PaginationParams,
} from "./pagination"
import type {
  AppUser,
  AuditLog,
  ChecklistItem,
  Client,
  Invoice,
  InvoiceLineItem,
  InvoicePayment,
  InvoiceWithDetails,
  Notification,
  OfficeProfile,
  Payment,
  Project,
  ProjectAssignee,
  ProjectFile,
  ProjectKmapArea,
  ReturnHistory,
  StatusHistory,
} from "./types"
import { DEFAULT_INVOICE_TERMS, ROLE_SECTION, roleToKey } from "./constants"
import { deriveInvoiceStatus, normalizeDateField } from "./invoice-utils"
import { attachUserRoles, attachUserRolesMany } from "./staff-roles"

export type { PaginatedResult } from "./pagination"

function parseAadhaarNumbers(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && item.trim() !== "")
  }
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value) as unknown
      return Array.isArray(parsed)
        ? parsed.filter((item): item is string => typeof item === "string" && item.trim() !== "")
        : []
    } catch {
      return []
    }
  }
  return []
}

function normalizeClient(client: Client): Client {
  return {
    ...client,
    street: client.street ?? null,
    district: client.district ?? null,
    aadhaar_numbers: parseAadhaarNumbers(client.aadhaar_numbers),
    project_count: toSafeNumber(client.project_count),
  }
}

function normalizeClients(clients: Client[]): Client[] {
  return clients.map(normalizeClient)
}

export interface ProjectListFilters extends PaginationParams {
  status?: string
  section?: string
  priority?: string
}

export interface DepartmentRow {
  section: string
  active: number
  completed: number
  staff: number
}

// ---------------------------------------------------------------------------
// Staff / Users
// ---------------------------------------------------------------------------

export async function getStaffUsers(role?: string): Promise<AppUser[]> {
  if (role) {
    const roleKey = roleToKey(role)
    const rows = (await sql`
      SELECT DISTINCT u.id, u.username, u.role, u.name, u.email, u.phone, u.active, u.created_at
      FROM app_users u
      LEFT JOIN staff_roles sr ON sr.user_id = u.id
      WHERE u.active = true
        AND u.role NOT IN ('Super Admin', 'Admin')
        AND (
          u.role = ${role}
          OR (${roleKey} IS NOT NULL AND sr.role_key = ${roleKey})
        )
      ORDER BY u.name
    `) as AppUser[]
    return attachUserRolesMany(rows)
  }
  const rows = (await sql`
    SELECT id, username, role, name, email, phone, active, created_at
    FROM app_users
    WHERE role NOT IN ('Super Admin', 'Admin') AND active = true
    ORDER BY name
  `) as AppUser[]
  return attachUserRolesMany(rows)
}

export async function getStaffPaginated(
  params: PaginationParams = {},
): Promise<PaginatedResult<AppUser>> {
  const requestedPage = parsePage(params.page)
  const pageSize = parsePageSize(params.pageSize)
  const search = buildSearchPattern(params.search)

  const countRows = (await sql`
    SELECT COUNT(*) AS count
    FROM app_users u
    WHERE u.role NOT IN ('Super Admin', 'Admin')
      AND (${search} IS NULL OR
        u.name LIKE ${search} OR
        u.username LIKE ${search} OR
        u.email LIKE ${search} OR
        u.phone LIKE ${search} OR
        u.role LIKE ${search} OR
        EXISTS (
          SELECT 1 FROM staff_roles sr
          WHERE sr.user_id = u.id AND sr.role_key LIKE ${search}
        ))
  `) as { count: number }[]
  const total = toSafeNumber(countRows[0]?.count)
  const page = clampPage(requestedPage, total, pageSize)
  const offset = pageOffset(page, pageSize)

  const rows =
    pageSize === -1
      ? ((await sql`
          SELECT id, username, role, name, email, phone, active, created_at
          FROM app_users u
          WHERE u.role NOT IN ('Super Admin', 'Admin')
            AND (${search} IS NULL OR
              u.name LIKE ${search} OR
              u.username LIKE ${search} OR
              u.email LIKE ${search} OR
              u.phone LIKE ${search} OR
              u.role LIKE ${search} OR
              EXISTS (
                SELECT 1 FROM staff_roles sr
                WHERE sr.user_id = u.id AND sr.role_key LIKE ${search}
              ))
          ORDER BY u.created_at DESC
        `) as AppUser[])
      : ((await sql`
          SELECT id, username, role, name, email, phone, active, created_at
          FROM app_users u
          WHERE u.role NOT IN ('Super Admin', 'Admin')
            AND (${search} IS NULL OR
              u.name LIKE ${search} OR
              u.username LIKE ${search} OR
              u.email LIKE ${search} OR
              u.phone LIKE ${search} OR
              u.role LIKE ${search} OR
              EXISTS (
                SELECT 1 FROM staff_roles sr
                WHERE sr.user_id = u.id AND sr.role_key LIKE ${search}
              ))
          ORDER BY u.created_at DESC
          LIMIT ${pageSize} OFFSET ${offset}
        `) as AppUser[])

  return toPaginatedResult(await attachUserRolesMany(rows), total, page, pageSize)
}

export async function getAdminUsers(): Promise<AppUser[]> {
  return (await sql`
    SELECT id, username, role, name, email, phone, active, created_at
    FROM app_users
    WHERE role = 'Admin'
    ORDER BY name
  `) as AppUser[]
}

export async function getAllUsersPaginated(
  params: PaginationParams = {},
): Promise<PaginatedResult<AppUser>> {
  const requestedPage = parsePage(params.page)
  const pageSize = parsePageSize(params.pageSize)
  const search = buildSearchPattern(params.search)

  const countRows = (await sql`
    SELECT COUNT(*) AS count
    FROM app_users u
    WHERE (${search} IS NULL OR
      u.name LIKE ${search} OR
      u.username LIKE ${search} OR
      u.email LIKE ${search} OR
      u.phone LIKE ${search} OR
      u.role LIKE ${search})
  `) as { count: number }[]
  const total = toSafeNumber(countRows[0]?.count)
  const page = clampPage(requestedPage, total, pageSize)
  const offset = pageOffset(page, pageSize)

  const rows =
    pageSize === -1
      ? ((await sql`
          SELECT id, username, role, name, email, phone, active, created_at
          FROM app_users u
          WHERE (${search} IS NULL OR
            u.name LIKE ${search} OR
            u.username LIKE ${search} OR
            u.email LIKE ${search} OR
            u.phone LIKE ${search} OR
            u.role LIKE ${search})
          ORDER BY
            CASE u.role
              WHEN 'Super Admin' THEN 0
              WHEN 'Admin' THEN 1
              ELSE 2
            END,
            u.name ASC
        `) as AppUser[])
      : ((await sql`
          SELECT id, username, role, name, email, phone, active, created_at
          FROM app_users u
          WHERE (${search} IS NULL OR
            u.name LIKE ${search} OR
            u.username LIKE ${search} OR
            u.email LIKE ${search} OR
            u.phone LIKE ${search} OR
            u.role LIKE ${search})
          ORDER BY
            CASE u.role
              WHEN 'Super Admin' THEN 0
              WHEN 'Admin' THEN 1
              ELSE 2
            END,
            u.name ASC
          LIMIT ${pageSize} OFFSET ${offset}
        `) as AppUser[])

  return toPaginatedResult(rows, total, page, pageSize)
}

export async function getAuditLogsPaginated(
  params: PaginationParams = {},
): Promise<PaginatedResult<AuditLog>> {
  const requestedPage = parsePage(params.page)
  const pageSize = parsePageSize(params.pageSize)
  const search = buildSearchPattern(params.search)

  const countRows = (await sql`
    SELECT COUNT(*) AS count
    FROM audit_logs a
    LEFT JOIN app_users u ON u.id = a.user_id
    WHERE (${search} IS NULL OR
      a.action LIKE ${search} OR
      a.entity_type LIKE ${search} OR
      a.role LIKE ${search} OR
      u.name LIKE ${search})
  `) as { count: number }[]
  const total = toSafeNumber(countRows[0]?.count)
  const page = clampPage(requestedPage, total, pageSize)
  const offset = pageOffset(page, pageSize)

  const rows =
    pageSize === -1
      ? ((await sql`
          SELECT a.*, u.name AS user_name
          FROM audit_logs a
          LEFT JOIN app_users u ON u.id = a.user_id
          WHERE (${search} IS NULL OR
            a.action LIKE ${search} OR
            a.entity_type LIKE ${search} OR
            a.role LIKE ${search} OR
            u.name LIKE ${search})
          ORDER BY a.created_at DESC
        `) as AuditLog[])
      : ((await sql`
          SELECT a.*, u.name AS user_name
          FROM audit_logs a
          LEFT JOIN app_users u ON u.id = a.user_id
          WHERE (${search} IS NULL OR
            a.action LIKE ${search} OR
            a.entity_type LIKE ${search} OR
            a.role LIKE ${search} OR
            u.name LIKE ${search})
          ORDER BY a.created_at DESC
          LIMIT ${pageSize} OFFSET ${offset}
        `) as AuditLog[])

  return toPaginatedResult(rows, total, page, pageSize)
}

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------

export async function getClients(search?: string): Promise<Client[]> {
  if (search && search.trim()) {
    const q = `%${search.trim()}%`
    return normalizeClients(
      (await sql`
      SELECT c.*, COUNT(p.id) AS project_count
      FROM clients c LEFT JOIN projects p ON p.client_id = c.id
      WHERE c.name LIKE ${q} OR c.phone LIKE ${q} OR c.email LIKE ${q}
      GROUP BY c.id ORDER BY c.created_at DESC
    `) as Client[],
    )
  }
  return normalizeClients(
    (await sql`
    SELECT c.*, COUNT(p.id) AS project_count
    FROM clients c LEFT JOIN projects p ON p.client_id = c.id
    GROUP BY c.id ORDER BY c.created_at DESC
  `) as Client[],
  )
}

export async function getClient(id: number): Promise<Client | null> {
  const rows = (await sql`SELECT * FROM clients WHERE id = ${id} LIMIT 1`) as Client[]
  return rows[0] ?? null
}

export async function getClientCount(): Promise<number> {
  const rows = (await sql`SELECT COUNT(*) AS count FROM clients`) as { count: number }[]
  return toSafeNumber(rows[0]?.count)
}

export async function getClientsPaginated(
  params: PaginationParams = {},
): Promise<PaginatedResult<Client>> {
  const requestedPage = parsePage(params.page)
  const pageSize = parsePageSize(params.pageSize)
  const search = buildSearchPattern(params.search)

  const countRows = (await sql`
    SELECT COUNT(*) AS count
    FROM clients c
    WHERE (${search} IS NULL OR
      c.name LIKE ${search} OR
      c.phone LIKE ${search} OR
      c.email LIKE ${search} OR
      c.address LIKE ${search} OR
      CAST(c.id AS CHAR) LIKE ${search})
  `) as { count: number }[]
  const total = toSafeNumber(countRows[0]?.count)
  const page = clampPage(requestedPage, total, pageSize)
  const offset = pageOffset(page, pageSize)

  const rows =
    pageSize === -1
      ? ((await sql`
          SELECT c.*, COUNT(p.id) AS project_count
          FROM clients c
          LEFT JOIN projects p ON p.client_id = c.id
          WHERE (${search} IS NULL OR
            c.name LIKE ${search} OR
            c.phone LIKE ${search} OR
            c.email LIKE ${search} OR
            c.address LIKE ${search} OR
            CAST(c.id AS CHAR) LIKE ${search})
          GROUP BY c.id
          ORDER BY c.created_at DESC
        `) as Client[])
      : ((await sql`
          SELECT c.*, COUNT(p.id) AS project_count
          FROM clients c
          LEFT JOIN projects p ON p.client_id = c.id
          WHERE (${search} IS NULL OR
            c.name LIKE ${search} OR
            c.phone LIKE ${search} OR
            c.email LIKE ${search} OR
            c.address LIKE ${search} OR
            CAST(c.id AS CHAR) LIKE ${search})
          GROUP BY c.id
          ORDER BY c.created_at DESC
          LIMIT ${pageSize} OFFSET ${offset}
        `) as Client[])

  return toPaginatedResult(normalizeClients(rows), total, page, pageSize)
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export async function getAllProjectsForExport(): Promise<Project[]> {
  return (await sql`
    SELECT p.*, c.name AS client_name, c.phone AS client_phone, u.name AS assignee_name
    FROM projects p
    JOIN clients c ON c.id = p.client_id
    LEFT JOIN app_users u ON u.id = p.assigned_to
    ORDER BY p.updated_at DESC
  `) as Project[]
}

export async function getProjectsForInvoiceSelect(): Promise<InvoiceProjectOption[]> {
  return (await sql`
    SELECT
      p.id,
      p.code,
      p.name,
      p.project_amount,
      c.name AS client_name,
      c.phone AS client_phone,
      c.email AS client_email,
      c.address AS client_address
    FROM projects p
    JOIN clients c ON c.id = p.client_id
    ORDER BY p.updated_at DESC
  `) as InvoiceProjectOption[]
}

export type InvoiceProjectOption = {
  id: number
  code: string
  name: string
  project_amount: string
  client_name: string
  client_phone: string
  client_email: string | null
  client_address: string | null
}

export async function getProjects(filters?: {
  status?: string
  section?: string
  priority?: string
  search?: string
}): Promise<Project[]> {
  const status = filters?.status && filters.status !== "all" ? filters.status : null
  const section = filters?.section && filters.section !== "all" ? filters.section : null
  const priority = filters?.priority && filters.priority !== "all" ? filters.priority : null
  const search = filters?.search?.trim() ? `%${filters.search.trim()}%` : null

  return (await sql`
    SELECT p.*, c.name AS client_name, c.phone AS client_phone, u.name AS assignee_name
    FROM projects p
    JOIN clients c ON c.id = p.client_id
    LEFT JOIN app_users u ON u.id = p.assigned_to
    WHERE (${status} IS NULL OR p.status = ${status})
      AND (${section} IS NULL OR p.section = ${section})
      AND (${priority} IS NULL OR p.priority = ${priority})
      AND (${search} IS NULL OR p.name LIKE ${search} OR p.code LIKE ${search} OR c.name LIKE ${search})
    ORDER BY p.updated_at DESC
  `) as Project[]
}

export async function getProjectsPaginated(
  filters: ProjectListFilters = {},
): Promise<PaginatedResult<Project>> {
  const requestedPage = parsePage(filters.page)
  const pageSize = parsePageSize(filters.pageSize)
  const status = filters.status && filters.status !== "all" ? filters.status : null
  const section = filters.section && filters.section !== "all" ? filters.section : null
  const priority = filters.priority && filters.priority !== "all" ? filters.priority : null
  const search = buildSearchPattern(filters.search)

  const countRows = (await sql`
    SELECT COUNT(*) AS count
    FROM projects p
    JOIN clients c ON c.id = p.client_id
    WHERE (${status} IS NULL OR p.status = ${status})
      AND (${section} IS NULL OR p.section = ${section})
      AND (${priority} IS NULL OR p.priority = ${priority})
      AND (${search} IS NULL OR
        p.name LIKE ${search} OR
        p.code LIKE ${search} OR
        p.location LIKE ${search} OR
        p.status LIKE ${search} OR
        p.section LIKE ${search} OR
        p.invoice_number LIKE ${search} OR
        CAST(p.id AS CHAR) LIKE ${search} OR
        c.name LIKE ${search} OR
        c.phone LIKE ${search} OR
        c.email LIKE ${search})
  `) as { count: number }[]
  const total = toSafeNumber(countRows[0]?.count)
  const page = clampPage(requestedPage, total, pageSize)
  const offset = pageOffset(page, pageSize)

  const rows =
    pageSize === -1
      ? ((await sql`
          SELECT p.*, c.name AS client_name, c.phone AS client_phone, u.name AS assignee_name
          FROM projects p
          JOIN clients c ON c.id = p.client_id
          LEFT JOIN app_users u ON u.id = p.assigned_to
          WHERE (${status} IS NULL OR p.status = ${status})
            AND (${section} IS NULL OR p.section = ${section})
            AND (${priority} IS NULL OR p.priority = ${priority})
            AND (${search} IS NULL OR
              p.name LIKE ${search} OR
              p.code LIKE ${search} OR
              p.location LIKE ${search} OR
              p.status LIKE ${search} OR
              p.section LIKE ${search} OR
              p.invoice_number LIKE ${search} OR
              CAST(p.id AS CHAR) LIKE ${search} OR
              c.name LIKE ${search} OR
              c.phone LIKE ${search} OR
              c.email LIKE ${search})
          ORDER BY p.updated_at DESC
        `) as Project[])
      : ((await sql`
          SELECT p.*, c.name AS client_name, c.phone AS client_phone, u.name AS assignee_name
          FROM projects p
          JOIN clients c ON c.id = p.client_id
          LEFT JOIN app_users u ON u.id = p.assigned_to
          WHERE (${status} IS NULL OR p.status = ${status})
            AND (${section} IS NULL OR p.section = ${section})
            AND (${priority} IS NULL OR p.priority = ${priority})
            AND (${search} IS NULL OR
              p.name LIKE ${search} OR
              p.code LIKE ${search} OR
              p.location LIKE ${search} OR
              p.status LIKE ${search} OR
              p.section LIKE ${search} OR
              p.invoice_number LIKE ${search} OR
              CAST(p.id AS CHAR) LIKE ${search} OR
              c.name LIKE ${search} OR
              c.phone LIKE ${search} OR
              c.email LIKE ${search})
          ORDER BY p.updated_at DESC
          LIMIT ${pageSize} OFFSET ${offset}
        `) as Project[])

  return toPaginatedResult(rows, total, page, pageSize)
}

export async function getReturnedProjects(): Promise<Project[]> {
  return (await sql`
    SELECT p.*, c.name AS client_name, c.phone AS client_phone, u.name AS assignee_name
    FROM projects p
    JOIN clients c ON c.id = p.client_id
    LEFT JOIN app_users u ON u.id = p.assigned_to
    WHERE p.status IN ('Returned', 'Pending Review', 'Correction Required')
    ORDER BY p.updated_at DESC
  `) as Project[]
}

export async function getProjectsForUser(userId: number): Promise<Project[]> {
  const rows = (await sql`
    SELECT p.*, c.name AS client_name, c.phone AS client_phone, u.name AS assignee_name
    FROM projects p
    JOIN clients c ON c.id = p.client_id
    LEFT JOIN app_users u ON u.id = p.assigned_to
    WHERE (
      p.assigned_to = ${userId}
      OR EXISTS (
        SELECT 1 FROM project_assignees pa
        WHERE pa.project_id = p.id
          AND pa.user_id = ${userId}
      )
    )
      AND p.status NOT IN ('Closed', 'Completed', 'Returned')
    ORDER BY
      CASE p.priority WHEN 'High' THEN 0 WHEN 'Medium' THEN 1 ELSE 2 END,
      ISNULL(p.due_date), p.due_date
  `) as Project[]
  return attachSiteAssigneesMany(rows)
}

export async function getStaffAllProjects(userId: number, userName: string): Promise<Project[]> {
  const rows = (await sql`
    SELECT p.*, c.name AS client_name, c.phone AS client_phone, u.name AS assignee_name
    FROM projects p
    JOIN clients c ON c.id = p.client_id
    LEFT JOIN app_users u ON u.id = p.assigned_to
    WHERE p.id IN (
      SELECT id FROM projects WHERE assigned_to = ${userId}
      UNION
      SELECT pa.project_id
      FROM project_assignees pa
      WHERE pa.user_id = ${userId}
      UNION
      SELECT project_id FROM status_history WHERE created_by = ${userName}
      UNION
      SELECT project_id FROM return_history WHERE created_by = ${userName}
    )
    ORDER BY p.updated_at DESC
  `) as Project[]
  return attachSiteAssigneesMany(rows)
}

export async function getStaffDashboardStats(userId: number, userName: string) {
  const rows = (await sql`
    SELECT
      SUM(CASE WHEN p.assigned_to = ${userId} AND p.status NOT IN ('Closed','Completed','Cancelled') THEN 1 ELSE 0 END) AS assigned,
      SUM(CASE WHEN p.assigned_to = ${userId} AND p.status IN ('Assigned','In Progress','Correction Required','Work Completed') THEN 1 ELSE 0 END) AS awaiting_action,
      SUM(CASE WHEN p.assigned_to = ${userId} AND p.status = 'Pending Review' THEN 1 ELSE 0 END) AS submitted_review,
      SUM(CASE WHEN p.assigned_to = ${userId} AND p.status = 'Correction Required' THEN 1 ELSE 0 END) AS correction,
      SUM(CASE WHEN p.assigned_to = ${userId} AND p.status = 'Returned' THEN 1 ELSE 0 END) AS returned,
      SUM(CASE WHEN p.assigned_to = ${userId} AND p.status IN ('Closed','Completed') THEN 1 ELSE 0 END) AS completed,
      SUM(CASE WHEN p.assigned_to = ${userId} AND p.due_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY) AND p.status NOT IN ('Closed','Completed') THEN 1 ELSE 0 END) AS upcoming_deadlines,
      SUM(CASE WHEN p.assigned_to = ${userId} AND p.due_date < CURDATE() AND p.status NOT IN ('Closed','Completed') THEN 1 ELSE 0 END) AS overdue,
      SUM(CASE WHEN p.status NOT IN ('Closed','Completed','Returned')
        AND (
          p.assigned_to = ${userId}
          OR EXISTS (
            SELECT 1 FROM project_assignees pa
            WHERE pa.project_id = p.id AND pa.user_id = ${userId}
          )
        ) THEN 1 ELSE 0 END) AS active,
      COUNT(DISTINCT p.id) AS total
    FROM projects p
    WHERE p.assigned_to = ${userId}
      OR EXISTS (SELECT 1 FROM project_assignees pa WHERE pa.project_id = p.id AND pa.user_id = ${userId})
      OR EXISTS (SELECT 1 FROM status_history sh WHERE sh.project_id = p.id AND sh.created_by = ${userName})
      OR EXISTS (SELECT 1 FROM return_history rh WHERE rh.project_id = p.id AND rh.created_by = ${userName})
  `) as {
    assigned: number
    awaiting_action: number
    submitted_review: number
    correction: number
    returned: number
    completed: number
    upcoming_deadlines: number
    overdue: number
    active: number
    total: number
  }[]
  return rows[0] ?? {
    assigned: 0,
    awaiting_action: 0,
    submitted_review: 0,
    correction: 0,
    returned: 0,
    completed: 0,
    upcoming_deadlines: 0,
    overdue: 0,
    active: 0,
    total: 0,
  }
}

export async function getDepartmentQueue(role: string): Promise<Project[]> {
  return getDepartmentQueueForRoles([role])
}

/** Department queue across one or more staff roles (multi-role employees). */
export async function getDepartmentQueueForRoles(roles: readonly string[]): Promise<Project[]> {
  const sections = [
    ...new Set(
      roles
        .map((role) => ROLE_SECTION[role])
        .filter((section): section is string => Boolean(section)),
    ),
  ]
  if (!sections.length) return []

  const results = await Promise.all(
    sections.map(
      (section) =>
        sql`
          SELECT p.*, c.name AS client_name, c.phone AS client_phone, u.name AS assignee_name
          FROM projects p
          JOIN clients c ON c.id = p.client_id
          LEFT JOIN app_users u ON u.id = p.assigned_to
          WHERE p.section = ${section}
            AND p.status IN ('New', 'Awaiting Assignment', 'Assigned', 'In Progress', 'Correction Required', 'Waiting for Documents')
            AND p.assigned_to IS NULL
          ORDER BY p.created_at ASC
        ` as Promise<Project[]>,
    ),
  )

  const seen = new Set<number>()
  const merged: Project[] = []
  for (const batch of results) {
    for (const project of batch) {
      if (seen.has(project.id)) continue
      seen.add(project.id)
      merged.push(project)
    }
  }
  merged.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
  return merged
}

export async function getProject(id: number): Promise<Project | null> {
  const rows = (await sql`
    SELECT p.*, c.name AS client_name, c.phone AS client_phone, u.name AS assignee_name
    FROM projects p
    JOIN clients c ON c.id = p.client_id
    LEFT JOIN app_users u ON u.id = p.assigned_to
    WHERE p.id = ${id} LIMIT 1
  `) as Project[]
  const project = rows[0]
  if (!project) return null
  return attachSiteAssignees(project)
}

/** Team assignees for a project. Optional stageKey filters to the active workflow step. */
export async function getProjectSiteAssignees(
  projectId: number,
  stageKey?: string | null,
): Promise<ProjectAssignee[]> {
  if (stageKey) {
    return (await sql`
      SELECT pa.user_id, pa.stage_key, u.name
      FROM project_assignees pa
      JOIN app_users u ON u.id = pa.user_id
      WHERE pa.project_id = ${projectId} AND pa.stage_key = ${stageKey}
      ORDER BY u.name
    `) as ProjectAssignee[]
  }
  return (await sql`
    SELECT pa.user_id, pa.stage_key, u.name
    FROM project_assignees pa
    JOIN app_users u ON u.id = pa.user_id
    WHERE pa.project_id = ${projectId}
    ORDER BY u.name
  `) as ProjectAssignee[]
}

async function resolveAssigneeStageKey(project: Project): Promise<string | null> {
  if (!project.current_workflow_step_id) return null
  const rows = (await sql`
    SELECT service_key, step_key, step_type
    FROM workflow_steps
    WHERE id = ${project.current_workflow_step_id}
    LIMIT 1
  `) as { service_key: string | null; step_key: string; step_type: string }[]
  const step = rows[0]
  if (!step) return null
  return step.service_key ?? step.step_key
}

async function attachSiteAssignees(project: Project): Promise<Project> {
  const stageKey = await resolveAssigneeStageKey(project)
  let assignees = await getProjectSiteAssignees(project.id, stageKey)
  // Backward compatible: older site survey rows may still use legacy site_visit key
  if (!assignees.length && stageKey === "site_survey") {
    assignees = await getProjectSiteAssignees(project.id, "site_visit")
  }
  if (!assignees.length && !stageKey) {
    assignees = await getProjectSiteAssignees(project.id)
  }
  // Unique by user_id for ownership / display
  const seen = new Set<number>()
  const unique = assignees.filter((a) => {
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

async function attachSiteAssigneesMany(projects: Project[]): Promise<Project[]> {
  return Promise.all(projects.map((project) => attachSiteAssignees(project)))
}

export async function getProjectsByClient(clientId: number): Promise<Project[]> {
  return (await sql`
    SELECT p.*, c.name AS client_name, c.phone AS client_phone, u.name AS assignee_name
    FROM projects p
    JOIN clients c ON c.id = p.client_id
    LEFT JOIN app_users u ON u.id = p.assigned_to
    WHERE p.client_id = ${clientId}
    ORDER BY p.created_at DESC
  `) as Project[]
}

// ---------------------------------------------------------------------------
// Project sub-resources
// ---------------------------------------------------------------------------

export async function getStatusHistory(projectId: number): Promise<StatusHistory[]> {
  return (await sql`
    SELECT * FROM status_history WHERE project_id = ${projectId} ORDER BY created_at DESC
  `) as StatusHistory[]
}

export async function getReturnHistory(projectId: number): Promise<ReturnHistory[]> {
  return (await sql`
    SELECT * FROM return_history WHERE project_id = ${projectId} ORDER BY created_at DESC
  `) as ReturnHistory[]
}

export async function getProjectFiles(projectId: number): Promise<ProjectFile[]> {
  return (await sql`
    SELECT f.*, u.name AS uploader_name
    FROM project_files f
    LEFT JOIN app_users u ON u.id = f.uploaded_by
    WHERE f.project_id = ${projectId}
    ORDER BY f.created_at DESC
  `) as ProjectFile[]
}

export async function getChecklist(projectId: number): Promise<ChecklistItem[]> {
  return (await sql`
    SELECT * FROM checklist_items WHERE project_id = ${projectId} ORDER BY id
  `) as ChecklistItem[]
}

export async function getProjectKmapAreas(projectId: number): Promise<ProjectKmapArea[]> {
  return (await sql`
    SELECT * FROM project_kmap_areas WHERE project_id = ${projectId} ORDER BY id
  `) as ProjectKmapArea[]
}

export async function getPayments(projectId: number): Promise<Payment[]> {
  return (await sql`
    SELECT pay.*, u.name AS recorder_name
    FROM payments pay
    LEFT JOIN app_users u ON u.id = pay.recorded_by
    WHERE pay.project_id = ${projectId}
    ORDER BY pay.created_at DESC
  `) as Payment[]
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export async function getNotifications(userId: number): Promise<Notification[]> {
  return (await sql`
    SELECT * FROM notifications WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT 50
  `) as Notification[]
}

export async function getUnreadCount(userId: number): Promise<number> {
  const rows = (await sql`
    SELECT COUNT(*) AS count FROM notifications
    WHERE user_id = ${userId} AND \`read\` = false
  `) as { count: number }[]
  return toSafeNumber(rows[0]?.count)
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

export async function getRecentPayments(
  limitParam = 5,
): Promise<(Payment & { project_name: string; project_code: string })[]> {
  const limit = Number(limitParam) || 5
  return (await sql`
    SELECT pay.*, p.name AS project_name, p.code AS project_code
    FROM payments pay
    JOIN projects p ON p.id = pay.project_id
    ORDER BY pay.created_at DESC
    LIMIT ${limit}
  `) as (Payment & { project_name: string; project_code: string })[]
}

export async function getAllPayments(limitParam = 50): Promise<
  (Payment & { project_name: string; project_code: string; client_name: string })[]
> {
  const limit = Number(limitParam) || 50
  return (await sql`
    SELECT pay.*, p.name AS project_name, p.code AS project_code, c.name AS client_name
    FROM payments pay
    JOIN projects p ON p.id = pay.project_id
    JOIN clients c ON c.id = p.client_id
    ORDER BY pay.created_at DESC
    LIMIT ${limit}
  `) as (Payment & { project_name: string; project_code: string; client_name: string })[]
}

export type PaymentWithProject = Payment & {
  project_name: string
  project_code: string
  client_name: string
}

export async function getPaymentsPaginated(
  params: PaginationParams = {},
): Promise<PaginatedResult<PaymentWithProject>> {
  const requestedPage = parsePage(params.page)
  const pageSize = parsePageSize(params.pageSize)
  const search = buildSearchPattern(params.search)

  const countRows = (await sql`
    SELECT COUNT(*) AS count
    FROM payments pay
    JOIN projects p ON p.id = pay.project_id
    JOIN clients c ON c.id = p.client_id
    WHERE (${search} IS NULL OR
      p.name LIKE ${search} OR
      p.code LIKE ${search} OR
      c.name LIKE ${search} OR
      c.phone LIKE ${search} OR
      c.email LIKE ${search} OR
      pay.method LIKE ${search} OR
      pay.note LIKE ${search} OR
      CAST(pay.id AS CHAR) LIKE ${search} OR
      CAST(pay.amount AS CHAR) LIKE ${search})
  `) as { count: number }[]
  const total = toSafeNumber(countRows[0]?.count)
  const page = clampPage(requestedPage, total, pageSize)
  const offset = pageOffset(page, pageSize)

  const rows =
    pageSize === -1
      ? ((await sql`
          SELECT pay.*, p.name AS project_name, p.code AS project_code, c.name AS client_name
          FROM payments pay
          JOIN projects p ON p.id = pay.project_id
          JOIN clients c ON c.id = p.client_id
          WHERE (${search} IS NULL OR
            p.name LIKE ${search} OR
            p.code LIKE ${search} OR
            c.name LIKE ${search} OR
            c.phone LIKE ${search} OR
            c.email LIKE ${search} OR
            pay.method LIKE ${search} OR
            pay.note LIKE ${search} OR
            CAST(pay.id AS CHAR) LIKE ${search} OR
            CAST(pay.amount AS CHAR) LIKE ${search})
          ORDER BY pay.created_at DESC
        `) as PaymentWithProject[])
      : ((await sql`
          SELECT pay.*, p.name AS project_name, p.code AS project_code, c.name AS client_name
          FROM payments pay
          JOIN projects p ON p.id = pay.project_id
          JOIN clients c ON c.id = p.client_id
          WHERE (${search} IS NULL OR
            p.name LIKE ${search} OR
            p.code LIKE ${search} OR
            c.name LIKE ${search} OR
            c.phone LIKE ${search} OR
            c.email LIKE ${search} OR
            pay.method LIKE ${search} OR
            pay.note LIKE ${search} OR
            CAST(pay.id AS CHAR) LIKE ${search} OR
            CAST(pay.amount AS CHAR) LIKE ${search})
          ORDER BY pay.created_at DESC
          LIMIT ${pageSize} OFFSET ${offset}
        `) as PaymentWithProject[])

  return toPaginatedResult(rows, total, page, pageSize)
}

// ---------------------------------------------------------------------------
// Dashboard & analytics
// ---------------------------------------------------------------------------

export async function getStaffPerformance(): Promise<
  { name: string; role: string; assigned: number; completed: number }[]
> {
  return (await sql`
    SELECT
      u.name,
      u.role,
      SUM(CASE WHEN p.status NOT IN ('Closed','Completed') THEN 1 ELSE 0 END) AS assigned,
      SUM(CASE WHEN p.status IN ('Closed','Completed') THEN 1 ELSE 0 END) AS completed
    FROM app_users u
    LEFT JOIN projects p ON p.assigned_to = u.id
    WHERE u.role NOT IN ('Super Admin', 'Admin')
    GROUP BY u.id, u.name, u.role
    ORDER BY assigned DESC
  `) as { name: string; role: string; assigned: number; completed: number }[]
}

export async function getRecentAuditLogs(limitParam = 10): Promise<AuditLog[]> {
  const limit = Number(limitParam) || 10
  return (await sql`
    SELECT a.*, u.name AS user_name
    FROM audit_logs a
    LEFT JOIN app_users u ON u.id = a.user_id
    ORDER BY a.created_at DESC
    LIMIT ${limit}
  `) as AuditLog[]
}

export interface DashboardStats {
  totalClients: number
  total: number
  active: number
  newProjects: number
  awaitingAssignment: number
  pending: number
  pendingReview: number
  correctionRequired: number
  waitingForClient: number
  waitingForGovernment: number
  waitingForPayment: number
  delayed: number
  completedToday: number
  completedThisMonth: number
  closed: number
  returned: number
  completed: number
  paymentsPending: number
  todaysTasks: number
  totalRevenue: number
  monthlyRevenue: number
  outstanding: number
  bySection: { section: string; count: number }[]
  byStatus: { status: string; count: number }[]
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const totals = (await sql`
    SELECT
      COUNT(*) AS total,
      COALESCE(SUM(CASE WHEN status IN ('Assigned','In Progress','Correction Required','Work Completed') THEN 1 ELSE 0 END), 0) AS active,
      COALESCE(SUM(CASE WHEN status = 'New' THEN 1 ELSE 0 END), 0) AS new_projects,
      COALESCE(SUM(CASE WHEN status = 'Awaiting Assignment' THEN 1 ELSE 0 END), 0) AS awaiting_assignment,
      COALESCE(SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END), 0) AS pending,
      COALESCE(SUM(CASE WHEN status = 'Pending Review' THEN 1 ELSE 0 END), 0) AS pending_review,
      COALESCE(SUM(CASE WHEN status = 'Correction Required' THEN 1 ELSE 0 END), 0) AS correction_required,
      COALESCE(SUM(CASE WHEN status = 'Waiting for Client' THEN 1 ELSE 0 END), 0) AS waiting_for_client,
      COALESCE(SUM(CASE WHEN status = 'Waiting for Government Approval' THEN 1 ELSE 0 END), 0) AS waiting_for_government,
      COALESCE(SUM(CASE WHEN status = 'Waiting for Payment' THEN 1 ELSE 0 END), 0) AS waiting_for_payment,
      COALESCE(SUM(CASE WHEN due_date < CURDATE() AND status NOT IN ('Closed','Completed','Cancelled') THEN 1 ELSE 0 END), 0) AS \`delayed\`,
      COALESCE(SUM(CASE WHEN status IN ('Completed','Closed') AND DATE(updated_at) = CURDATE() THEN 1 ELSE 0 END), 0) AS completed_today,
      COALESCE(SUM(CASE WHEN status IN ('Completed','Closed') AND updated_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01') THEN 1 ELSE 0 END), 0) AS completed_this_month,
      COALESCE(SUM(CASE WHEN status = 'Closed' THEN 1 ELSE 0 END), 0) AS closed,
      COALESCE(SUM(CASE WHEN status = 'Returned' THEN 1 ELSE 0 END), 0) AS returned,
      COALESCE(SUM(CASE WHEN status IN ('Completed','Closed') THEN 1 ELSE 0 END), 0) AS completed,
      COALESCE(SUM(CASE WHEN payment_status IN ('Unpaid','Partially Paid') AND project_amount > 0 THEN 1 ELSE 0 END), 0) AS payments_pending,
      COALESCE(SUM(CASE WHEN due_date = CURDATE() AND status NOT IN ('Closed','Completed') THEN 1 ELSE 0 END), 0) AS todays_tasks,
      COALESCE(SUM(advance_received), 0) AS total_revenue,
      COALESCE(SUM(project_amount - advance_received), 0) AS outstanding
    FROM projects
  `) as Record<string, number>[]

  const monthly = (await sql`
    SELECT COALESCE(SUM(amount), 0) AS revenue
    FROM payments
    WHERE created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
  `) as { revenue: number }[]

  const bySection = (await sql`
    SELECT section, COUNT(*) AS count FROM projects
    WHERE status NOT IN ('Closed')
    GROUP BY section
  `) as { section: string; count: number }[]

  const byStatus = (await sql`
    SELECT status, COUNT(*) AS count FROM projects GROUP BY status
  `) as { status: string; count: number }[]

  const clientCount = await getClientCount()
  const t = totals[0] ?? {}

  return {
    totalClients: clientCount,
    total: toSafeNumber(t.total),
    active: toSafeNumber(t.active),
    newProjects: toSafeNumber(t.new_projects),
    awaitingAssignment: toSafeNumber(t.awaiting_assignment),
    pending: toSafeNumber(t.pending),
    pendingReview: toSafeNumber(t.pending_review),
    correctionRequired: toSafeNumber(t.correction_required),
    waitingForClient: toSafeNumber(t.waiting_for_client),
    waitingForGovernment: toSafeNumber(t.waiting_for_government),
    waitingForPayment: toSafeNumber(t.waiting_for_payment),
    delayed: toSafeNumber(t.delayed),
    completedToday: toSafeNumber(t.completed_today),
    completedThisMonth: toSafeNumber(t.completed_this_month),
    closed: toSafeNumber(t.closed),
    returned: toSafeNumber(t.returned),
    completed: toSafeNumber(t.completed),
    paymentsPending: toSafeNumber(t.payments_pending),
    todaysTasks: toSafeNumber(t.todays_tasks),
    totalRevenue: toSafeNumber(t.total_revenue),
    monthlyRevenue: toSafeNumber(monthly[0]?.revenue),
    outstanding: toSafeNumber(t.outstanding),
    bySection: bySection.map((r) => ({
      section: r.section,
      count: toSafeNumber(r.count),
    })),
    byStatus: byStatus.map((r) => ({
      status: r.status,
      count: toSafeNumber(r.count),
    })),
  }
}

/**
 * Monthly revenue trend using a MySQL 8.0 recursive CTE.
 * Generates `months` data points from (months-1) months ago through today.
 */
export async function getMonthlyRevenueTrend(
  months = 6,
): Promise<{ month: string; revenue: number; projects: number }[]> {
  const monthsBack = months - 1
  const rows = (await sql`
    WITH RECURSIVE month_series (month_start) AS (
      SELECT DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL ${monthsBack} MONTH), '%Y-%m-01')
      UNION ALL
      SELECT DATE_FORMAT(DATE_ADD(month_start, INTERVAL 1 MONTH), '%Y-%m-01')
      FROM month_series
      WHERE month_start < DATE_FORMAT(CURDATE(), '%Y-%m-01')
    )
    SELECT
      DATE_FORMAT(m.month_start, '%b %y') AS month,
      COALESCE(SUM(pay.amount), 0)        AS revenue,
      COUNT(DISTINCT pay.project_id)      AS projects
    FROM month_series m
    LEFT JOIN payments pay
      ON DATE_FORMAT(pay.created_at, '%Y-%m-01') = m.month_start
    GROUP BY m.month_start
    ORDER BY m.month_start
  `) as { month: string; revenue: number; projects: number }[]

  return rows.map((r) => ({
    month: r.month,
    revenue: toSafeNumber(r.revenue),
    projects: toSafeNumber(r.projects),
  }))
}

/**
 * 7-day sparkline data using a MySQL 8.0 recursive CTE.
 */
export async function getKpiSparklines(): Promise<{
  clients: number[]
  projects: number[]
  revenue: number[]
}> {
  const rows = (await sql`
    WITH RECURSIVE day_series (day) AS (
      SELECT DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 6 DAY), '%Y-%m-%d')
      UNION ALL
      SELECT DATE_FORMAT(DATE_ADD(day, INTERVAL 1 DAY), '%Y-%m-%d')
      FROM day_series
      WHERE day < DATE_FORMAT(CURDATE(), '%Y-%m-%d')
    )
    SELECT
      d.day,
      (SELECT COUNT(*) FROM clients  WHERE DATE(created_at) <= d.day) AS client_count,
      (SELECT COUNT(*) FROM projects WHERE DATE(created_at) <= d.day AND status NOT IN ('Closed','Completed')) AS active_count,
      (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE DATE(created_at) = d.day)  AS daily_revenue
    FROM day_series d
    ORDER BY d.day
  `) as { day: string; client_count: number; active_count: number; daily_revenue: number }[]

  return {
    clients: rows.map((r) => toSafeNumber(r.client_count)),
    projects: rows.map((r) => toSafeNumber(r.active_count)),
    revenue: rows.map((r) => toSafeNumber(r.daily_revenue)),
  }
}

export interface BillingOverview {
  totalAmount: number
  advanceReceived: number
  balanceDue: number
  paidProjects: number
  partialProjects: number
  unpaidProjects: number
}

export async function getBillingOverview(): Promise<BillingOverview> {
  const rows = (await sql`
    SELECT
      COALESCE(SUM(project_amount), 0) AS total_amount,
      COALESCE(SUM(advance_received), 0) AS advance_received,
      COALESCE(SUM(project_amount - advance_received), 0) AS balance_due,
      COALESCE(SUM(CASE WHEN payment_status = 'Paid'           THEN 1 ELSE 0 END), 0) AS paid_projects,
      COALESCE(SUM(CASE WHEN payment_status = 'Partially Paid' THEN 1 ELSE 0 END), 0) AS partial_projects,
      COALESCE(SUM(CASE WHEN payment_status = 'Unpaid'         THEN 1 ELSE 0 END), 0) AS unpaid_projects
    FROM projects
    WHERE project_amount > 0
  `) as Record<string, number>[]
  const r = rows[0] ?? {}
  return {
    totalAmount: toSafeNumber(r.total_amount),
    advanceReceived: toSafeNumber(r.advance_received),
    balanceDue: toSafeNumber(r.balance_due),
    paidProjects: toSafeNumber(r.paid_projects),
    partialProjects: toSafeNumber(r.partial_projects),
    unpaidProjects: toSafeNumber(r.unpaid_projects),
  }
}

export async function getDepartmentStats(): Promise<DepartmentRow[]> {
  return (await sql`
    SELECT
      s.section,
      SUM(CASE WHEN p.status NOT IN ('Closed','Completed') THEN 1 ELSE 0 END) AS active,
      SUM(CASE WHEN p.status IN ('Closed','Completed')     THEN 1 ELSE 0 END) AS completed,
      (SELECT COUNT(DISTINCT u.id) FROM app_users u
       LEFT JOIN staff_roles sr ON sr.user_id = u.id
       WHERE u.active = 1 AND u.role NOT IN ('Super Admin', 'Admin') AND (
         (s.section = 'Planning & Design' AND (
           u.role = 'Planning Staff' OR sr.role_key = 'PLANNING_STAFF'
         )) OR
         (s.section = 'Building Permit' AND (
           u.role = 'Permit Staff' OR sr.role_key = 'PERMIT_STAFF'
         )) OR
         (s.section = '3D & Interior' AND (
           u.role = '3D Staff' OR sr.role_key = 'THREED_STAFF'
         )) OR
         (s.section = 'Estimation & Construction' AND (
           u.role = 'Estimation Staff' OR sr.role_key = 'ESTIMATION_STAFF'
         )) OR
         (s.section = 'Billing' AND (
           u.role = 'Billing Staff' OR sr.role_key = 'BILLING_STAFF'
         ))
       )
      ) AS staff
    FROM (
      SELECT 'Planning & Design'         AS section UNION ALL
      SELECT 'Building Permit'           UNION ALL
      SELECT '3D & Interior'             UNION ALL
      SELECT 'Estimation & Construction' UNION ALL
      SELECT 'Billing'
    ) s
    LEFT JOIN projects p ON p.section = s.section
    GROUP BY s.section
    ORDER BY s.section
  `) as DepartmentRow[]
}

export async function getDepartmentsPaginated(
  params: PaginationParams = {},
): Promise<PaginatedResult<DepartmentRow>> {
  const requestedPage = parsePage(params.page)
  const pageSize = parsePageSize(params.pageSize)
  const searchTerm = params.search?.trim().toLowerCase() ?? ""

  const allRows = await getDepartmentStats()
  const filtered = searchTerm
    ? allRows.filter(
        (row) =>
          row.section.toLowerCase().includes(searchTerm) ||
          String(row.active).includes(searchTerm) ||
          String(row.completed).includes(searchTerm) ||
          String(row.staff).includes(searchTerm),
      )
    : allRows
  const total = filtered.length
  const page = clampPage(requestedPage, total, pageSize)
  const offset = pageOffset(page, pageSize)

  const rows = pageSize === -1 ? filtered : filtered.slice(offset, offset + pageSize)
  return toPaginatedResult(rows, total, page, pageSize)
}

// ---------------------------------------------------------------------------
// Invoices
// ---------------------------------------------------------------------------

const DEFAULT_OFFICE_PROFILE: OfficeProfile = {
  companyName: "Acmmo Architects",
  address: "",
  phone: "",
  email: "",
  website: "",
  gstNumber: "",
  logoDataUrl: null,
  termsAndConditions: DEFAULT_INVOICE_TERMS,
}

function pickString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined
}

function normalizeStoredOfficeProfile(value: unknown): Partial<OfficeProfile> {
  if (!value) return {}

  let raw: unknown = value
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw)
    } catch {
      return {}
    }
  }

  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return {}

  const row = raw as Record<string, unknown>
  const logo = row.logoDataUrl ?? row.logo_data_url

  return {
    companyName: pickString(row.companyName ?? row.company_name),
    address: pickString(row.address),
    phone: pickString(row.phone),
    email: pickString(row.email),
    website: pickString(row.website),
    gstNumber: pickString(row.gstNumber ?? row.gst_number),
    logoDataUrl: typeof logo === "string" && logo.length > 0 ? logo : null,
    termsAndConditions: pickString(row.termsAndConditions ?? row.terms_and_conditions),
  }
}

export async function getOfficeProfile(): Promise<OfficeProfile> {
  const rows = (await sql`
    SELECT value FROM office_settings WHERE \`key\` = 'office_profile' LIMIT 1
  `) as { value: unknown }[]
  const stored = normalizeStoredOfficeProfile(rows[0]?.value)
  if (!Object.keys(stored).length) return { ...DEFAULT_OFFICE_PROFILE }
  return { ...DEFAULT_OFFICE_PROFILE, ...stored }
}

export async function persistOfficeProfile(profile: OfficeProfile): Promise<void> {
  await sql`
    INSERT INTO office_settings (\`key\`, value, updated_at)
    VALUES ('office_profile', ${sql.json(profile as unknown as Record<string, unknown>)}, now())
    ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = now()
  `
}

export async function updateOfficeProfileLogo(logoPath: string | null): Promise<void> {
  const profile = await getOfficeProfile()
  await persistOfficeProfile({ ...profile, logoDataUrl: logoPath })
}

function mapInvoiceRow(row: Invoice): Invoice {
  const total = Number(row.total)
  const paid = Number(row.amount_paid)
  const invoiceDate = normalizeDateField(row.invoice_date as string | Date) ?? ""
  const dueDate = normalizeDateField(row.due_date as string | Date | null)
  const status = deriveInvoiceStatus(row.status, total, paid, dueDate)
  return { ...row, invoice_date: invoiceDate, due_date: dueDate, status }
}

export async function getInvoice(id: number): Promise<InvoiceWithDetails | null> {
  const rows = (await sql`
    SELECT i.*, p.code AS project_code, u.name AS creator_name
    FROM invoices i
    LEFT JOIN projects p ON p.id = i.project_id
    LEFT JOIN app_users u ON u.id = i.created_by
    WHERE i.id = ${id}
    LIMIT 1
  `) as Invoice[]

  const invoice = rows[0]
  if (!invoice) return null

  const lineItems = (await sql`
    SELECT * FROM invoice_line_items
    WHERE invoice_id = ${id}
    ORDER BY sort_order ASC, id ASC
  `) as InvoiceLineItem[]

  const payments = (await sql`
    SELECT ip.*, u.name AS recorder_name
    FROM invoice_payments ip
    LEFT JOIN app_users u ON u.id = ip.recorded_by
    WHERE ip.invoice_id = ${id}
    ORDER BY ip.payment_date DESC, ip.id DESC
  `) as InvoicePayment[]

  return {
    ...mapInvoiceRow(invoice),
    line_items: lineItems,
    payments: payments.map((p) => ({
      ...p,
      payment_date: normalizeDateField(p.payment_date as string | Date) ?? "",
    })),
  }
}

export type InvoiceListRow = Invoice & { project_code: string | null }

export async function getInvoicesByProject(projectId: number): Promise<InvoiceListRow[]> {
  const rows = (await sql`
    SELECT i.*, p.code AS project_code
    FROM invoices i
    LEFT JOIN projects p ON p.id = i.project_id
    WHERE i.project_id = ${projectId}
    ORDER BY i.invoice_date DESC, i.id DESC
  `) as InvoiceListRow[]
  return rows.map(mapInvoiceRow) as InvoiceListRow[]
}

export async function getInvoicesPaginated(
  params: PaginationParams & { status?: string } = {},
): Promise<PaginatedResult<InvoiceListRow>> {
  const requestedPage = parsePage(params.page)
  const pageSize = parsePageSize(params.pageSize)
  const search = buildSearchPattern(params.search)
  const statusFilter = params.status?.trim() || null

  const countRows = (await sql`
    SELECT COUNT(*) AS count
    FROM invoices i
    LEFT JOIN projects p ON p.id = i.project_id
    WHERE (${search} IS NULL OR
      i.invoice_number LIKE ${search} OR
      i.client_name LIKE ${search} OR
      i.project_name LIKE ${search} OR
      p.code LIKE ${search} OR
      i.client_email LIKE ${search} OR
      i.client_phone LIKE ${search})
    AND (${statusFilter} IS NULL OR i.status = ${statusFilter})
  `) as { count: number }[]
  const total = toSafeNumber(countRows[0]?.count)
  const page = clampPage(requestedPage, total, pageSize)
  const offset = pageOffset(page, pageSize)

  const rows =
    pageSize === -1
      ? ((await sql`
          SELECT i.*, p.code AS project_code
          FROM invoices i
          LEFT JOIN projects p ON p.id = i.project_id
          WHERE (${search} IS NULL OR
            i.invoice_number LIKE ${search} OR
            i.client_name LIKE ${search} OR
            i.project_name LIKE ${search} OR
            p.code LIKE ${search} OR
            i.client_email LIKE ${search} OR
            i.client_phone LIKE ${search})
          AND (${statusFilter} IS NULL OR i.status = ${statusFilter})
          ORDER BY i.invoice_date DESC, i.id DESC
        `) as InvoiceListRow[])
      : ((await sql`
          SELECT i.*, p.code AS project_code
          FROM invoices i
          LEFT JOIN projects p ON p.id = i.project_id
          WHERE (${search} IS NULL OR
            i.invoice_number LIKE ${search} OR
            i.client_name LIKE ${search} OR
            i.project_name LIKE ${search} OR
            p.code LIKE ${search} OR
            i.client_email LIKE ${search} OR
            i.client_phone LIKE ${search})
          AND (${statusFilter} IS NULL OR i.status = ${statusFilter})
          ORDER BY i.invoice_date DESC, i.id DESC
          LIMIT ${pageSize} OFFSET ${offset}
        `) as InvoiceListRow[])

  return toPaginatedResult(rows.map(mapInvoiceRow) as InvoiceListRow[], total, page, pageSize)
}

export async function getAllInvoicesForExport(
  params: { search?: string; status?: string } = {},
): Promise<InvoiceListRow[]> {
  const search = buildSearchPattern(params.search)
  const statusFilter = params.status?.trim() || null
  const rows = (await sql`
    SELECT i.*, p.code AS project_code
    FROM invoices i
    LEFT JOIN projects p ON p.id = i.project_id
    WHERE (${search} IS NULL OR
      i.invoice_number LIKE ${search} OR
      i.client_name LIKE ${search} OR
      i.project_name LIKE ${search} OR
      p.code LIKE ${search} OR
      i.client_email LIKE ${search} OR
      i.client_phone LIKE ${search})
    AND (${statusFilter} IS NULL OR i.status = ${statusFilter})
    ORDER BY i.invoice_date DESC, i.id DESC
  `) as InvoiceListRow[]
  return rows.map(mapInvoiceRow) as InvoiceListRow[]
}

export async function getInvoiceOverview(): Promise<{
  totalInvoices: number
  totalBilled: number
  totalCollected: number
  outstanding: number
  overdueCount: number
}> {
  const rows = (await sql`
    SELECT
      COUNT(*) AS total_invoices,
      COALESCE(SUM(total), 0)       AS total_billed,
      COALESCE(SUM(amount_paid), 0) AS total_collected,
      COALESCE(SUM(balance), 0)     AS outstanding,
      SUM(CASE
        WHEN status NOT IN ('Paid','Cancelled','Draft') AND due_date < CURDATE() AND balance > 0
        THEN 1 ELSE 0
      END) AS overdue_count
    FROM invoices
  `) as Record<string, number>[]
  const r = rows[0] ?? {}
  return {
    totalInvoices: toSafeNumber(r.total_invoices),
    totalBilled: toSafeNumber(r.total_billed),
    totalCollected: toSafeNumber(r.total_collected),
    outstanding: toSafeNumber(r.outstanding),
    overdueCount: toSafeNumber(r.overdue_count),
  }
}

export { getWorkflowSteps, getCurrentWorkflowStep, getProjectServices } from "./workflow-db"
