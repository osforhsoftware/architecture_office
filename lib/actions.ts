"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { mysqlErrorCode, mysqlErrorMessage, sql } from "./db"
import { clearSession, getCurrentUser } from "./auth"
import {
  allowsMultiAssignee,
  isReviewStep,
  isWorkStep,
  parseSelectedDocuments,
  parseSelectedServices,
  roleForStep,
  type ProjectPackage,
} from "./workflow"
import {
  activateWorkflowStep,
  completeCurrentStep,
  getCurrentWorkflowStep,
  recordWorkflowAssignment,
  recordWorkflowReview,
  seedProjectWorkflow,
  syncProjectWorkflowFromServices,
} from "./workflow-db"
import {
  DEFAULT_INVOICE_TERMS,
  INVOICE_STATUSES,
  KMAP_FLOOR_ROWS,
  isValidKmapFloorKey,
  PAYMENT_METHODS,
  RETURN_REASONS,
  ADMIN_ROLE,
  firstStageInSection,
  isOfficeAdmin,
  isPrivilegedRole,
  isSuperAdmin,
  roleToKey,
  showsResidentialDetails,
  userHasRole,
} from "./constants"
import {
  defaultRoleLabel,
  getDepartmentById,
  getDepartmentNames,
  getStaffRoleLabels,
  listDepartments,
  makeRoleKey,
  resolveRoleKey,
  roleForSection,
} from "./departments"
import {
  getProjectServiceById,
  listProjectServiceDefs,
  makeServiceKey,
} from "./project-services"
import {
  checklistItemsFromTemplates,
  getDocumentTemplateById,
} from "./document-templates"
import {
  getAdditionalRequirementTemplateById,
  makeRequirementKey,
  parseAdditionalRequirementsFromForm,
  saveProjectAdditionalRequirements,
} from "./additional-requirements"
import {
  parseChoiceOptions,
  parseCustomFieldValueType,
} from "./additional-requirements-shared"
import { hashPassword, verifyPassword } from "./password"
import {
  calculateInvoiceTotals,
  INVOICE_LIMITS,
  parseLineItemsJson,
  sanitizeInvoiceFormFields,
  sanitizeInvoicePercent,
  sanitizeInvoiceText,
  sanitizePaymentAmount,
  toStoredLineItems,
  validateInvoiceForm,
  validateInvoiceLineItems,
} from "./invoice-utils"
import { getOfficeProfile, persistOfficeProfile } from "./queries"
import { parseUpiPaymentApp } from "./upi-apps"
import { parseStaffRoles, syncStaffRoles } from "./staff-roles"
import { resolveStaffAvatarFromForm } from "./staff-avatar"
import {
  invoicePaymentDeleteConfirmationPhrase,
  paymentDeleteConfirmationPhrase,
} from "./payment-utils"
import { staffDeleteConfirmationPhrase } from "./staff-utils"
import {
  closedProjectMutationError,
  getProjectOrThrow,
  isAdmin,
  logAudit,
  logAuditForUser,
  requireStaffProjectAccess,
} from "./project-access"
import {
  ForbiddenError,
  requireAdminOrSuperAdmin,
  requireBillingAccess,
  requireSuperAdmin,
  requireUser,
} from "./permissions"
import type { AppUser, InvoiceStatus, OfficeProfile } from "./types"
import {
  isLocalToday,
  projectStartAtFromDate,
} from "./project-dates"
import { projectDeleteBlockedMessage } from "./project-delete"
import { projectDeleteConfirmationPhrase } from "./project-utils"
import { headers } from "next/headers"

// ---------- Auth ----------

async function clientIpAddress(): Promise<string | null> {
  try {
    const h = await headers()
    const forwarded = h.get("x-forwarded-for")
    if (forwarded) return forwarded.split(",")[0]?.trim() || null
    return h.get("x-real-ip")
  } catch {
    return null
  }
}

async function notifyOfficeAdmins(type: string, title: string, message: string) {
  const admins = (await sql`
    SELECT id FROM app_users
    WHERE role IN ('Acmmo Admin', 'Super Admin', 'Admin') AND active = true
  `) as { id: number }[]
  for (const a of admins) {
    await notify(a.id, type, title, message)
  }
}

export async function logoutAction() {
  const user = await getCurrentUser()
  if (user) {
    const ip = await clientIpAddress()
    await logAuditForUser(user, "auth.logout", "user", user.id, { username: user.username }, ip)
  }
  await clearSession()
  redirect("/login")
}

async function notify(userId: number, type: string, title: string, message: string) {
  await sql`
    INSERT INTO notifications (user_id, type, title, message)
    VALUES (${userId}, ${type}, ${title}, ${message})
  `
}

async function notifyRole(role: string, title: string, message: string) {
  const roleKey = (await resolveRoleKey(role)) ?? roleToKey(role)
  const staff = (await sql`
    SELECT DISTINCT u.id
    FROM app_users u
    LEFT JOIN staff_roles sr ON sr.user_id = u.id
    WHERE u.active = true
      AND (
        u.role = ${role}
        OR (${roleKey} IS NOT NULL AND sr.role_key = ${roleKey})
      )
  `) as { id: number }[]
  for (const s of staff) {
    await notify(s.id, "Department Queue", title, message)
  }
}

async function appendStatus(
  projectId: number,
  status: string,
  note: string | null,
  createdBy: string,
  createdAt?: string | null,
) {
  if (createdAt) {
    await sql`
      INSERT INTO status_history (project_id, status, note, created_by, created_at)
      VALUES (${projectId}, ${status}, ${note}, ${createdBy}, ${createdAt})
    `
    return
  }
  await sql`
    INSERT INTO status_history (project_id, status, note, created_by)
    VALUES (${projectId}, ${status}, ${note}, ${createdBy})
  `
}

function revalidateProjectPaths(projectId: number) {
  revalidatePath("/admin/projects")
  revalidatePath(`/admin/projects/${projectId}`)
  revalidatePath("/admin")
  revalidatePath("/staff")
  revalidatePath("/staff/projects")
  revalidatePath(`/staff/projects/${projectId}`)
}

function parseAssignedStaffIds(formData: FormData): number[] {
  const raw = formData.getAll("assigned_to")
  const ids = raw
    .map((value) => Number(value))
    .filter((id) => Number.isFinite(id) && id > 0)
  return [...new Set(ids)]
}

async function clearSiteAssignees(projectId: number, stageKey?: string) {
  if (stageKey) {
    await sql`
      DELETE FROM project_assignees
      WHERE project_id = ${projectId} AND stage_key = ${stageKey}
    `
    return
  }
  await sql`DELETE FROM project_assignees WHERE project_id = ${projectId}`
}

async function syncSiteAssignees(projectId: number, userIds: number[], stageKey: string) {
  await clearSiteAssignees(projectId, stageKey)
  for (const userId of userIds) {
    await sql`
      INSERT INTO project_assignees (project_id, user_id, stage_key)
      VALUES (${projectId}, ${userId}, ${stageKey})
    `
  }
}

function revalidateBillingPaths(invoiceId?: number) {
  revalidatePath("/admin/billing")
  revalidatePath("/admin/invoices")
  if (invoiceId) revalidatePath(`/admin/invoices/${invoiceId}`)
}

// ---------- Clients ----------

function revalidateClientPaths(clientId?: number) {
  revalidatePath("/admin/clients")
  revalidatePath("/admin")
  revalidatePath("/admin/reports")
  if (clientId) revalidatePath(`/admin/clients/${clientId}`)
}

function parseClientStringList(formData: FormData, key: string): string[] {
  const raw = String(formData.get(key) || "").trim()
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((item) => String(item ?? "").trim())
      .filter(Boolean)
  } catch {
    return []
  }
}

function parseClientAddressFields(formData: FormData) {
  return {
    street: String(formData.get("street") || "").trim() || null,
    district: String(formData.get("district") || "").trim() || null,
    aadhaarNumbers: parseClientStringList(formData, "aadhaar_numbers"),
    linkedNumbers: parseClientStringList(formData, "linked_numbers"),
  }
}

function clientActionFailure(error: unknown, fallback: string): { error: string } {
  console.error("[clients]", fallback, error)
  const code = mysqlErrorCode(error)
  if (code === "ER_DUP_ENTRY") return { error: "A client with this phone already exists." }
  const message = mysqlErrorMessage(error)
  if (code === "ER_BAD_FIELD_ERROR" || /unknown column/i.test(message)) {
    return { error: "Client fields are missing on this database. Please try again." }
  }
  return { error: message || fallback }
}

let clientExtraColumnsReady = false

async function addClientColumn(sqlTypeJson: () => Promise<unknown>, sqlTypeText: () => Promise<unknown>) {
  try {
    await sqlTypeJson()
  } catch (error) {
    if (mysqlErrorCode(error) === "ER_DUP_FIELDNAME") return
    try {
      await sqlTypeText()
    } catch (fallbackError) {
      if (mysqlErrorCode(fallbackError) !== "ER_DUP_FIELDNAME") {
        console.warn("[clients] could not add extra column:", fallbackError)
      }
    }
  }
}

/** Live DBs may predate street / Aadhaar columns — add them on first write. */
async function ensureClientExtraColumns() {
  if (clientExtraColumnsReady) return
  await addClientColumn(
    () => sql`ALTER TABLE clients ADD COLUMN street VARCHAR(500)`,
    () => sql`ALTER TABLE clients ADD COLUMN street TEXT`,
  )
  await addClientColumn(
    () => sql`ALTER TABLE clients ADD COLUMN district VARCHAR(100)`,
    () => sql`ALTER TABLE clients ADD COLUMN district VARCHAR(255)`,
  )
  await addClientColumn(
    () => sql`ALTER TABLE clients ADD COLUMN aadhaar_numbers JSON`,
    () => sql`ALTER TABLE clients ADD COLUMN aadhaar_numbers TEXT`,
  )
  await addClientColumn(
    () => sql`ALTER TABLE clients ADD COLUMN linked_numbers JSON`,
    () => sql`ALTER TABLE clients ADD COLUMN linked_numbers TEXT`,
  )
  clientExtraColumnsReady = true
}

async function insertClientRow(input: {
  name: string
  phone: string
  email: string | null
  address: string | null
  street: string | null
  district: string | null
  aadhaarNumbers: string[]
  linkedNumbers: string[]
}): Promise<{ id: number }[]> {
  try {
    return (await sql`
      INSERT INTO clients (name, phone, email, address, street, district, aadhaar_numbers, linked_numbers)
      VALUES (
        ${input.name}, ${input.phone}, ${input.email}, ${input.address}, ${input.street}, ${input.district},
        ${sql.json(input.aadhaarNumbers)}, ${sql.json(input.linkedNumbers)}
      )
    `) as { id: number }[]
  } catch (error) {
    if (mysqlErrorCode(error) !== "ER_BAD_FIELD_ERROR" && !/unknown column/i.test(mysqlErrorMessage(error))) {
      throw error
    }
    await ensureClientExtraColumns()
    try {
      return (await sql`
        INSERT INTO clients (name, phone, email, address, street, district, aadhaar_numbers, linked_numbers)
        VALUES (
          ${input.name}, ${input.phone}, ${input.email}, ${input.address}, ${input.street}, ${input.district},
          ${sql.json(input.aadhaarNumbers)}, ${sql.json(input.linkedNumbers)}
        )
      `) as { id: number }[]
    } catch (retryError) {
      if (
        mysqlErrorCode(retryError) !== "ER_BAD_FIELD_ERROR" &&
        !/unknown column/i.test(mysqlErrorMessage(retryError))
      ) {
        throw retryError
      }
      return (await sql`
        INSERT INTO clients (name, phone, email, address)
        VALUES (${input.name}, ${input.phone}, ${input.email}, ${input.address})
      `) as { id: number }[]
    }
  }
}

export async function createClient(formData: FormData) {
  try {
    const admin = await requireAdminOrSuperAdmin()
    const name = String(formData.get("name") || "").trim()
    const phone = String(formData.get("phone") || "").trim()
    const email = String(formData.get("email") || "").trim() || null
    const address = String(formData.get("address") || "").trim() || null
    const { street, district, aadhaarNumbers, linkedNumbers } = parseClientAddressFields(formData)

    if (!name) return { error: "Name is required." }

    if (phone) {
      const existing = (await sql`SELECT id FROM clients WHERE phone = ${phone} LIMIT 1`) as {
        id: number
      }[]
      if (existing.length) return { error: "A client with this phone already exists." }
    }

    const rows = await insertClientRow({
      name,
      phone,
      email,
      address,
      street,
      district,
      aadhaarNumbers,
      linkedNumbers,
    })
    const clientId = rows[0]?.id
    if (!clientId) return { error: "Client was not created." }

    await logAudit(admin.id, "client.create", "client", clientId, { name, phone })
    revalidateClientPaths(clientId)
    return { success: true, clientId }
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return { error: "You do not have permission to add clients." }
    }
    return clientActionFailure(error, "Could not add client.")
  }
}

export async function updateClient(formData: FormData) {
  try {
    const admin = await requireAdminOrSuperAdmin()
    const id = Number(formData.get("id"))
    const name = String(formData.get("name") || "").trim()
    const phone = String(formData.get("phone") || "").trim()
    const email = String(formData.get("email") || "").trim() || null
    const address = String(formData.get("address") || "").trim() || null
    const { street, district, aadhaarNumbers, linkedNumbers } = parseClientAddressFields(formData)

    if (!id || !name) return { error: "Name is required." }

    if (phone) {
      const existing = (await sql`
        SELECT id FROM clients WHERE phone = ${phone} AND id != ${id} LIMIT 1
      `) as { id: number }[]
      if (existing.length) return { error: "A client with this phone already exists." }
    }

    try {
      await sql`
        UPDATE clients SET
          name = ${name},
          phone = ${phone},
          email = ${email},
          address = ${address},
          street = ${street},
          district = ${district},
          aadhaar_numbers = ${sql.json(aadhaarNumbers)},
          linked_numbers = ${sql.json(linkedNumbers)}
        WHERE id = ${id}
      `
    } catch (error) {
      if (mysqlErrorCode(error) !== "ER_BAD_FIELD_ERROR" && !/unknown column/i.test(mysqlErrorMessage(error))) {
        throw error
      }
      await ensureClientExtraColumns()
      try {
        await sql`
          UPDATE clients SET
            name = ${name},
            phone = ${phone},
            email = ${email},
            address = ${address},
            street = ${street},
            district = ${district},
            aadhaar_numbers = ${sql.json(aadhaarNumbers)},
            linked_numbers = ${sql.json(linkedNumbers)}
          WHERE id = ${id}
        `
      } catch (retryError) {
        if (
          mysqlErrorCode(retryError) !== "ER_BAD_FIELD_ERROR" &&
          !/unknown column/i.test(mysqlErrorMessage(retryError))
        ) {
          throw retryError
        }
        await sql`
          UPDATE clients SET
            name = ${name},
            phone = ${phone},
            email = ${email},
            address = ${address}
          WHERE id = ${id}
        `
      }
    }
    await logAudit(admin.id, "client.update", "client", id, { name })
    revalidateClientPaths(id)
    return { success: true }
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return { error: "You do not have permission to update clients." }
    }
    return clientActionFailure(error, "Could not update client.")
  }
}

export async function registerClientWithProject(formData: FormData) {
  try {
    const admin = await requireAdminOrSuperAdmin()
    const clientName = String(formData.get("client_name") || "").trim()
    const projectName = String(formData.get("project_name") || "").trim()
    const phone = String(formData.get("phone") || "").trim()
    const email = String(formData.get("email") || "").trim() || null
    const address = String(formData.get("address") || "").trim() || null
    const { street, district, aadhaarNumbers, linkedNumbers } = parseClientAddressFields(formData)

    if (!clientName) return { error: "Client name is required." }
    if (!projectName) return { error: "Project name is required." }

    if (phone) {
      const existing = (await sql`SELECT id FROM clients WHERE phone = ${phone} LIMIT 1`) as {
        id: number
      }[]
      if (existing.length) return { error: "A client with this phone already exists." }
    }

    const clientRows = await insertClientRow({
      name: clientName,
      phone,
      email,
      address,
      street,
      district,
      aadhaarNumbers,
      linkedNumbers,
    })
    const clientId = clientRows[0]?.id
    if (!clientId) return { error: "Client was not created." }

    formData.set("client_id", String(clientId))
    formData.set("name", projectName)

    const projectRes = await createProject(formData)
    if (projectRes?.error) return projectRes

    await logAudit(admin.id, "client.register_with_project", "project", projectRes.projectId!, {
      clientId,
    })
    revalidateClientPaths(clientId)
    return { success: true, clientId, projectId: projectRes.projectId }
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return { error: "You do not have permission to add clients." }
    }
    return clientActionFailure(error, "Could not register client and project.")
  }
}

// ---------- Staff ----------

function parseStaffActive(formData: FormData): boolean {
  const value = formData.get("active")
  return value === "on" || value === "true"
}

async function isValidStaffRole(role: string): Promise<boolean> {
  const allowed = await getStaffRoleLabels(false)
  return allowed.includes(role)
}

export async function createStaff(formData: FormData) {
  const admin = await requireSuperAdmin()
  const name = String(formData.get("name") || "").trim()
  const username = String(formData.get("username") || "").trim()
  const password = String(formData.get("password") || "")
  const roles = await parseStaffRoles(formData)
  const legacyRole = String(formData.get("role") || "").trim()
  if (!roles.length && (await isValidStaffRole(legacyRole))) {
    roles.push(legacyRole)
  }
  const email = String(formData.get("email") || "").trim() || null
  const phone = String(formData.get("phone") || "").trim() || null
  const active = parseStaffActive(formData)

  if (!name || !username || !password || !roles.length) {
    return { error: "Name, username, password, and at least one department role are required." }
  }
  if (/\s/.test(username)) return { error: "Username cannot contain spaces." }
  if (password.length < 6) return { error: "Password must be at least 6 characters." }
  for (const role of roles) {
    if (!(await isValidStaffRole(role))) return { error: "Invalid staff role." }
  }

  const primaryRole = roles[0]

  const existing = (await sql`
    SELECT id FROM app_users WHERE username = ${username} LIMIT 1
  `) as { id: number }[]
  if (existing.length) return { error: "A user with this username already exists." }

  const hash = await hashPassword(password)
  const rows = (await sql`
    INSERT INTO app_users (username, password, role, name, email, phone, active)
    VALUES (${username}, ${hash}, ${primaryRole}, ${name}, ${email}, ${phone}, ${active})
  `) as { id: number }[]

  const staffId = rows[0].id
  await syncStaffRoles(staffId, roles)

  const avatarResult = await resolveStaffAvatarFromForm(formData, staffId, null)
  if (avatarResult.error) return { error: avatarResult.error }
  if (avatarResult.avatarUrl) {
    await sql`
      UPDATE app_users SET avatar_url = ${avatarResult.avatarUrl} WHERE id = ${staffId}
    `
  }

  await logAudit(admin.id, "staff.create", "user", staffId, {
    name,
    username,
    role: primaryRole,
    roles,
    avatar_url: avatarResult.avatarUrl,
  })
  revalidatePath("/admin/staff")
  revalidatePath("/admin/departments")
  revalidatePath("/admin/projects")
  return { success: true, staffId }
}

export async function updateStaff(formData: FormData) {
  const admin = await requireSuperAdmin()
  const id = Number(formData.get("id"))
  const name = String(formData.get("name") || "").trim()
  const username = String(formData.get("username") || "").trim()
  const password = String(formData.get("password") || "")
  const roles = await parseStaffRoles(formData)
  const legacyRole = String(formData.get("role") || "").trim()
  if (!roles.length && (await isValidStaffRole(legacyRole))) roles.push(legacyRole)
  const email = String(formData.get("email") || "").trim() || null
  const phone = String(formData.get("phone") || "").trim() || null
  const active = parseStaffActive(formData)

  if (!id || !name || !username || !roles.length) {
    return { error: "Name, username, and at least one department role are required." }
  }
  if (/\s/.test(username)) return { error: "Username cannot contain spaces." }
  if (password && password.length < 6) return { error: "Password must be at least 6 characters." }
  for (const role of roles) {
    if (!(await isValidStaffRole(role))) return { error: "Invalid staff role." }
  }
  if (id === admin.id && !active) {
    return { error: "You cannot deactivate your own account." }
  }

  const primaryRole = roles[0]

  const current = (await sql`
    SELECT id, role, password, avatar_url FROM app_users WHERE id = ${id} LIMIT 1
  `) as { id: number; role: string; password: string; avatar_url: string | null }[]
  if (!current.length) return { error: "Staff member not found." }
  if (isPrivilegedRole(current[0].role)) {
    return { error: "Admin accounts cannot be edited here. Use Admin Management." }
  }

  const duplicate = (await sql`
    SELECT id FROM app_users WHERE username = ${username} AND id <> ${id} LIMIT 1
  `) as { id: number }[]
  if (duplicate.length) return { error: "A user with this username already exists." }

  const avatarResult = await resolveStaffAvatarFromForm(
    formData,
    id,
    current[0].avatar_url ?? null,
  )
  if (avatarResult.error) return { error: avatarResult.error }

  const hash = password ? await hashPassword(password) : current[0].password

  await sql`
    UPDATE app_users
    SET username = ${username}, password = ${hash}, role = ${primaryRole}, name = ${name},
        email = ${email}, phone = ${phone}, active = ${active},
        avatar_url = ${avatarResult.avatarUrl}
    WHERE id = ${id}
  `
  await syncStaffRoles(id, roles)

  await logAudit(admin.id, "staff.update", "user", id, {
    name,
    username,
    role: primaryRole,
    roles,
    active,
    avatar_url: avatarResult.avatarUrl,
  })
  revalidatePath("/admin/staff")
  revalidatePath("/admin/departments")
  revalidatePath("/admin/projects")
  revalidatePath("/staff/profile")
  return { success: true }
}

export async function deleteStaff(formData: FormData) {
  const admin = await requireSuperAdmin()
  const id = Number(formData.get("id"))
  const confirmation = String(formData.get("confirmation") || "").trim()

  if (!id) return { error: "Staff member is required." }

  const current = (await sql`
    SELECT id, username, role, name FROM app_users WHERE id = ${id} LIMIT 1
  `) as { id: number; username: string; role: string; name: string }[]
  if (!current.length) return { error: "Staff member not found." }
  if (isPrivilegedRole(current[0].role)) {
    return { error: "Admin accounts cannot be removed here. Use Admin Management." }
  }
  if (id === admin.id) return { error: "You cannot remove your own account." }

  const expected = staffDeleteConfirmationPhrase(current[0].username)
  if (confirmation !== expected) {
    return { error: `Type ${expected} exactly to confirm removal.` }
  }

  await sql`UPDATE projects SET assigned_to = NULL WHERE assigned_to = ${id}`
  await sql`DELETE FROM project_assignees WHERE user_id = ${id}`
  await sql`UPDATE workflow_steps SET assigned_to = NULL WHERE assigned_to = ${id}`
  await sql`UPDATE workflow_reviews SET reviewed_by = NULL WHERE reviewed_by = ${id}`
  await sql`DELETE FROM workflow_assignments WHERE user_id = ${id}`
  await sql`UPDATE workflow_assignments SET assigned_by = NULL WHERE assigned_by = ${id}`
  await sql`UPDATE project_files SET uploaded_by = NULL WHERE uploaded_by = ${id}`
  await sql`UPDATE payments SET recorded_by = NULL WHERE recorded_by = ${id}`
  await sql`UPDATE invoice_payments SET recorded_by = NULL WHERE recorded_by = ${id}`
  await sql`UPDATE invoices SET created_by = NULL WHERE created_by = ${id}`
  await sql`UPDATE audit_logs SET user_id = NULL WHERE user_id = ${id}`
  await sql`DELETE FROM app_users WHERE id = ${id}`

  await logAudit(admin.id, "staff.delete", "user", id, {
    name: current[0].name,
    username: current[0].username,
    role: current[0].role,
  })
  revalidatePath("/admin/staff")
  revalidatePath("/admin/departments")
  revalidatePath("/admin/projects")
  return { success: true }
}

// ---------- Departments ----------

function revalidateServicePaths() {
  revalidatePath("/admin/services")
  revalidatePath("/admin/documents")
  revalidatePath("/admin/projects")
  revalidatePath("/admin/invoices")
  revalidatePath("/admin/invoices/new")
  revalidatePath("/admin")
  revalidatePath("/staff")
}

function revalidateDocumentPaths() {
  revalidatePath("/admin/documents")
  revalidatePath("/admin/projects")
  revalidatePath("/admin")
  revalidatePath("/staff")
}

function revalidateRequirementPaths() {
  revalidatePath("/admin/requirements")
  revalidatePath("/admin/projects")
  revalidatePath("/admin")
  revalidatePath("/staff")
}

function revalidateDepartmentPaths() {
  revalidatePath("/admin/departments")
  revalidatePath("/admin/staff")
  revalidatePath("/admin/projects")
  revalidatePath("/admin")
  revalidatePath("/staff")
}

export async function createDepartment(formData: FormData) {
  const admin = await requireSuperAdmin()
  const name = String(formData.get("name") || "").trim()
  const roleLabelInput = String(formData.get("role_label") || "").trim()
  const role_label = roleLabelInput || defaultRoleLabel(name)
  const role_key = makeRoleKey(name)

  if (!name) return { error: "Department name is required." }
  if (name.length > 100) return { error: "Department name is too long." }
  if (!role_label) return { error: "Staff role label is required." }

  const existing = await listDepartments({ includeInactive: true })
  if (existing.some((d) => d.name.toLowerCase() === name.toLowerCase())) {
    return { error: "A department with this name already exists." }
  }
  if (existing.some((d) => d.role_label.toLowerCase() === role_label.toLowerCase())) {
    return { error: "A department with this staff role already exists." }
  }
  if (existing.some((d) => d.role_key === role_key)) {
    return { error: "A department with a similar name already exists." }
  }

  const maxSort = existing.reduce((max, d) => Math.max(max, d.sort_order), 0)

  try {
    const rows = (await sql`
      INSERT INTO departments (name, role_label, role_key, sort_order, active)
      VALUES (${name}, ${role_label}, ${role_key}, ${maxSort + 10}, 1)
    `) as { id: number }[]

    await logAudit(admin.id, "department.create", "department", rows[0].id, {
      name,
      role_label,
      role_key,
    })
    revalidateDepartmentPaths()
    return { success: true, departmentId: rows[0].id }
  } catch (error) {
    console.error("[departments] create failed:", error)
    return { error: "Could not create department. Run db:migrate-departments if the table is missing." }
  }
}

export async function updateDepartment(formData: FormData) {
  const admin = await requireSuperAdmin()
  const id = Number(formData.get("id"))
  const name = String(formData.get("name") || "").trim()
  const roleLabelInput = String(formData.get("role_label") || "").trim()
  const active = formData.get("active") === "on" || formData.get("active") === "true"

  if (!id || !name) return { error: "Department name is required." }
  if (name.length > 100) return { error: "Department name is too long." }

  const current = await getDepartmentById(id)
  if (!current) return { error: "Department not found." }

  const role_label = roleLabelInput || current.role_label || defaultRoleLabel(name)

  const existing = await listDepartments({ includeInactive: true })
  if (existing.some((d) => d.id !== id && d.name.toLowerCase() === name.toLowerCase())) {
    return { error: "A department with this name already exists." }
  }
  if (existing.some((d) => d.id !== id && d.role_label.toLowerCase() === role_label.toLowerCase())) {
    return { error: "A department with this staff role already exists." }
  }

  try {
    await sql`
      UPDATE departments
      SET name = ${name}, role_label = ${role_label}, active = ${active}
      WHERE id = ${id}
    `

    if (current.name !== name) {
      await sql`UPDATE projects SET section = ${name} WHERE section = ${current.name}`
      try {
        await sql`UPDATE services SET section = ${name} WHERE section = ${current.name}`
      } catch {
        /* services table may be absent on older DBs */
      }
      try {
        await sql`UPDATE workflow_steps SET section = ${name} WHERE section = ${current.name}`
      } catch {
        /* workflow_steps may be absent on older DBs */
      }
    }

    if (current.role_label !== role_label) {
      await sql`UPDATE app_users SET role = ${role_label} WHERE role = ${current.role_label}`
      try {
        await sql`UPDATE services SET role = ${role_label} WHERE role = ${current.role_label}`
      } catch {
        /* services table may be absent on older DBs */
      }
    }

    await logAudit(admin.id, "department.update", "department", id, {
      from: current.name,
      to: name,
      role_label,
      active,
    })
    revalidateDepartmentPaths()
    return { success: true }
  } catch (error) {
    console.error("[departments] update failed:", error)
    return { error: "Could not update department." }
  }
}

export async function deleteDepartment(formData: FormData) {
  const admin = await requireSuperAdmin()
  const id = Number(formData.get("id"))
  if (!id) return { error: "Department is required." }

  const current = await getDepartmentById(id)
  if (!current) return { error: "Department not found." }

  const projectCount = (await sql`
    SELECT COUNT(*) AS count FROM projects WHERE section = ${current.name}
  `) as { count: number }[]
  if (Number(projectCount[0]?.count ?? 0) > 0) {
    return {
      error: `Cannot delete "${current.name}" while ${projectCount[0].count} project(s) still use it. Move or close those projects first.`,
    }
  }

  const staffCount = (await sql`
    SELECT COUNT(DISTINCT u.id) AS count
    FROM app_users u
    LEFT JOIN staff_roles sr ON sr.user_id = u.id
    WHERE u.role = ${current.role_label} OR sr.role_key = ${current.role_key}
  `) as { count: number }[]
  if (Number(staffCount[0]?.count ?? 0) > 0) {
    return {
      error: `Cannot delete "${current.name}" while staff still have the "${current.role_label}" role. Reassign those staff first.`,
    }
  }

  try {
    await sql`DELETE FROM staff_roles WHERE role_key = ${current.role_key}`
    await sql`DELETE FROM departments WHERE id = ${id}`
    await logAudit(admin.id, "department.delete", "department", id, {
      name: current.name,
      role_label: current.role_label,
      role_key: current.role_key,
    })
    revalidateDepartmentPaths()
    return { success: true }
  } catch (error) {
    console.error("[departments] delete failed:", error)
    return { error: "Could not delete department." }
  }
}

// ---------- Project services (catalog) ----------

export async function createProjectService(formData: FormData) {
  try {
    const admin = await requireSuperAdmin()
    const label = String(formData.get("label") || "").trim()
    const section = String(formData.get("section") || "").trim()
    const roleInput = String(formData.get("role") || "").trim()
    const keyInput = String(formData.get("service_key") || "").trim()
    const service_key = keyInput ? makeServiceKey(keyInput) : makeServiceKey(label)

    if (!label) return { error: "Service name is required." }
    if (label.length > 255) return { error: "Service name is too long." }
    if (!section) return { error: "Department is required." }
    if (!service_key) return { error: "Service key is required." }

    const departments = await listDepartments({ activeOnly: true })
    const dept = departments.find((d) => d.name === section)
    if (!dept) return { error: "Select a valid department." }
    const role = roleInput || dept.role_label

    const dupKey = (await sql`
      SELECT id FROM services WHERE service_key = ${service_key} LIMIT 1
    `) as { id: number }[]
    if (dupKey[0]) return { error: "A service with this key already exists." }

    const dupLabel = (await sql`
      SELECT id FROM services WHERE LOWER(label) = ${label.toLowerCase()} LIMIT 1
    `) as { id: number }[]
    if (dupLabel[0]) return { error: "A service with this name already exists." }

    const sortRows = (await sql`
      SELECT COALESCE(MAX(sort_order), 0) AS max_sort FROM services
    `) as { max_sort: number }[]
    const nextSort = Number(sortRows[0]?.max_sort ?? 0) + 1

    const rows = (await sql`
      INSERT INTO services (service_key, label, section, role, sort_order, active)
      VALUES (${service_key}, ${label}, ${section}, ${role}, ${nextSort}, 1)
    `) as { id: number }[]

    const serviceId = Number(rows[0]?.id)
    if (!serviceId) {
      return { error: "Service was created but no id was returned. Please refresh and check the list." }
    }

    await logAudit(admin.id, "service.create", "service", serviceId, {
      service_key,
      label,
      section,
      role,
    })
    revalidateServicePaths()
    return { success: true, serviceId }
  } catch (error) {
    console.error("[project-services] create failed:", error)
    const message = error instanceof Error ? error.message : ""
    if (message === "Forbidden" || message === "Unauthorized") {
      return { error: "Only Acmmo Admin can manage services." }
    }
    return {
      error: "Could not create service. Run db:migrate-workflow if the services table is missing.",
    }
  }
}

export async function updateProjectService(formData: FormData) {
  try {
    const admin = await requireSuperAdmin()
    const id = Number(formData.get("id"))
    const label = String(formData.get("label") || "").trim()
    const section = String(formData.get("section") || "").trim()
    const roleInput = String(formData.get("role") || "").trim()
    const sortOrder = Number(formData.get("sort_order") || 0)
    const active = formData.get("active") === "on" || formData.get("active") === "true"

    if (!id || !label) return { error: "Service name is required." }
    if (label.length > 255) return { error: "Service name is too long." }
    if (!section) return { error: "Department is required." }

    const current = await getProjectServiceById(id)
    if (!current) return { error: "Service not found." }

    const departments = await listDepartments({ includeInactive: true })
    const dept = departments.find((d) => d.name === section)
    if (!dept) return { error: "Select a valid department." }
    const role = roleInput || dept.role_label || current.role

    const dupLabel = (await sql`
      SELECT id FROM services
      WHERE LOWER(label) = ${label.toLowerCase()} AND id <> ${id}
      LIMIT 1
    `) as { id: number }[]
    if (dupLabel[0]) return { error: "A service with this name already exists." }

    await sql`
      UPDATE services
      SET label = ${label},
          section = ${section},
          role = ${role},
          sort_order = ${Number.isFinite(sortOrder) ? sortOrder : current.sort_order},
          active = ${active}
      WHERE id = ${id}
    `

    if (current.label !== label || current.section !== section) {
      try {
        await sql`
          UPDATE workflow_steps
          SET label = ${label}, section = ${section}
          WHERE service_key = ${current.service_key} AND step_type = 'service'
        `
        await sql`
          UPDATE workflow_steps
          SET section = ${section}
          WHERE service_key = ${current.service_key} AND step_type = 'admin_review'
        `
      } catch {
        /* workflow_steps may be absent */
      }
    }

    await logAudit(admin.id, "service.update", "service", id, {
      service_key: current.service_key,
      from: current.label,
      to: label,
      section,
      role,
      active,
    })
    revalidateServicePaths()
    return { success: true }
  } catch (error) {
    console.error("[project-services] update failed:", error)
    const message = error instanceof Error ? error.message : ""
    if (message === "Forbidden" || message === "Unauthorized") {
      return { error: "Only Acmmo Admin can manage services." }
    }
    return { error: "Could not update service." }
  }
}

export async function deleteProjectService(formData: FormData) {
  const admin = await requireSuperAdmin()
  const id = Number(formData.get("id"))
  if (!id) return { error: "Service is required." }

  const current = await getProjectServiceById(id)
  if (!current) return { error: "Service not found." }

  try {
    const usage = (await sql`
      SELECT COUNT(*) AS count FROM project_services WHERE service_key = ${current.service_key}
    `) as { count: number }[]
    if (Number(usage[0]?.count ?? 0) > 0) {
      return {
        error: `Cannot delete "${current.label}" while ${usage[0].count} project(s) still use it. Hide it instead.`,
      }
    }

    await sql`DELETE FROM services WHERE id = ${id}`
    await logAudit(admin.id, "service.delete", "service", id, {
      service_key: current.service_key,
      label: current.label,
    })
    revalidateServicePaths()
    return { success: true }
  } catch (error) {
    console.error("[project-services] delete failed:", error)
    return { error: "Could not delete service." }
  }
}

// ---------- Document templates (catalog) ----------

export async function createDocumentTemplate(formData: FormData) {
  try {
    const admin = await requireSuperAdmin()
    const label = String(formData.get("label") || "").trim()
    const serviceKey = String(formData.get("service_key") || "").trim()

    if (!label) return { error: "Document name is required." }
    if (label.length > 255) return { error: "Document name is too long." }
    if (!serviceKey) return { error: "Service is required." }

    const service = await listProjectServiceDefs({ includeInactive: true }).then((rows) =>
      rows.find((s) => s.key === serviceKey),
    )
    if (!service) return { error: "Select a valid service." }

    const dup = (await sql`
      SELECT id FROM document_templates
      WHERE service_key = ${serviceKey} AND LOWER(label) = ${label.toLowerCase()}
      LIMIT 1
    `) as { id: number }[]
    if (dup[0]) return { error: "This document already exists for that service." }

    const sortRows = (await sql`
      SELECT COALESCE(MAX(sort_order), 0) AS max_sort FROM document_templates
    `) as { max_sort: number }[]
    const nextSort = Number(sortRows[0]?.max_sort ?? 0) + 1

    const rows = (await sql`
      INSERT INTO document_templates (service_key, label, sort_order, active)
      VALUES (${serviceKey}, ${label}, ${nextSort}, 1)
    `) as { id: number }[]

    const documentId = Number(rows[0]?.id)
    if (!documentId) {
      return { error: "Document was created but no id was returned. Please refresh." }
    }

    await logAudit(admin.id, "document.create", "document_template", documentId, {
      service_key: serviceKey,
      label,
    })
    revalidateDocumentPaths()
    return { success: true, documentId }
  } catch (error) {
    console.error("[document-templates] create failed:", error)
    const message = error instanceof Error ? error.message : ""
    if (message === "Forbidden" || message === "Unauthorized") {
      return { error: "Only Acmmo Admin can manage documents." }
    }
    return {
      error:
        "Could not create document. Run npm run db:migrate-documents if the table is missing.",
    }
  }
}

export async function updateDocumentTemplate(formData: FormData) {
  try {
    const admin = await requireSuperAdmin()
    const id = Number(formData.get("id"))
    const label = String(formData.get("label") || "").trim()
    const serviceKey = String(formData.get("service_key") || "").trim()
    const sortOrder = Number(formData.get("sort_order") || 0)
    const active = formData.get("active") === "on" || formData.get("active") === "true"

    if (!id || !label) return { error: "Document name is required." }
    if (label.length > 255) return { error: "Document name is too long." }
    if (!serviceKey) return { error: "Service is required." }

    const current = await getDocumentTemplateById(id)
    if (!current) return { error: "Document not found." }

    const service = await listProjectServiceDefs({ includeInactive: true }).then((rows) =>
      rows.find((s) => s.key === serviceKey),
    )
    if (!service) return { error: "Select a valid service." }

    const dup = (await sql`
      SELECT id FROM document_templates
      WHERE service_key = ${serviceKey}
        AND LOWER(label) = ${label.toLowerCase()}
        AND id <> ${id}
      LIMIT 1
    `) as { id: number }[]
    if (dup[0]) return { error: "This document already exists for that service." }

    await sql`
      UPDATE document_templates
      SET label = ${label},
          service_key = ${serviceKey},
          sort_order = ${Number.isFinite(sortOrder) ? sortOrder : current.sort_order},
          active = ${active}
      WHERE id = ${id}
    `

    await logAudit(admin.id, "document.update", "document_template", id, {
      from: current.label,
      to: label,
      service_key: serviceKey,
      active,
    })
    revalidateDocumentPaths()
    return { success: true }
  } catch (error) {
    console.error("[document-templates] update failed:", error)
    const message = error instanceof Error ? error.message : ""
    if (message === "Forbidden" || message === "Unauthorized") {
      return { error: "Only Acmmo Admin can manage documents." }
    }
    return { error: "Could not update document." }
  }
}

export async function deleteDocumentTemplate(formData: FormData) {
  const admin = await requireSuperAdmin()
  const id = Number(formData.get("id"))
  if (!id) return { error: "Document is required." }

  const current = await getDocumentTemplateById(id)
  if (!current) return { error: "Document not found." }

  try {
    const itemKey = `${current.service_key}::${current.label}`
    const usage = (await sql`
      SELECT COUNT(*) AS count FROM checklist_items WHERE item_key = ${itemKey}
    `) as { count: number }[]
    if (Number(usage[0]?.count ?? 0) > 0) {
      return {
        error: `Cannot delete "${current.label}" while ${usage[0].count} project(s) still reference it. Hide it instead.`,
      }
    }

    await sql`DELETE FROM document_templates WHERE id = ${id}`
    await logAudit(admin.id, "document.delete", "document_template", id, {
      service_key: current.service_key,
      label: current.label,
    })
    revalidateDocumentPaths()
    return { success: true }
  } catch (error) {
    console.error("[document-templates] delete failed:", error)
    return { error: "Could not delete document." }
  }
}

// ---------- Additional requirement templates (catalog) ----------

export async function createAdditionalRequirementTemplate(formData: FormData) {
  try {
    const admin = await requireSuperAdmin()
    const label = String(formData.get("label") || "").trim()
    const keyInput = String(formData.get("requirement_key") || "").trim()
    const requirementKey = keyInput ? makeRequirementKey(keyInput) : makeRequirementKey(label)
    const valueType = parseCustomFieldValueType(formData.get("value_type"))
    const choiceOptions = valueType === "choice" ? parseChoiceOptions(formData.get("choice_options")) : []
    const choiceOptionsJson = choiceOptions.length ? JSON.stringify(choiceOptions) : null

    if (!label) return { error: "Field name is required." }
    if (label.length > 255) return { error: "Field name is too long." }
    if (!requirementKey) return { error: "Field key is required." }
    if (valueType === "choice" && choiceOptions.length < 2) {
      return { error: "Add at least two choices for a radio field." }
    }

    const dupKey = (await sql`
      SELECT id FROM additional_requirement_templates
      WHERE requirement_key = ${requirementKey}
      LIMIT 1
    `) as { id: number }[]
    if (dupKey[0]) return { error: "A requirement with this key already exists." }

    const dupLabel = (await sql`
      SELECT id FROM additional_requirement_templates
      WHERE LOWER(label) = ${label.toLowerCase()}
      LIMIT 1
    `) as { id: number }[]
    if (dupLabel[0]) return { error: "A requirement with this name already exists." }

    const sortRows = (await sql`
      SELECT COALESCE(MAX(sort_order), 0) AS max_sort FROM additional_requirement_templates
    `) as { max_sort: number }[]
    const nextSort = Number(sortRows[0]?.max_sort ?? 0) + 1

    const rows = (await sql`
      INSERT INTO additional_requirement_templates (requirement_key, label, value_type, choice_options, sort_order, active)
      VALUES (${requirementKey}, ${label}, ${valueType}, ${choiceOptionsJson}, ${nextSort}, 1)
    `) as { id: number }[]

    const requirementId = Number(rows[0]?.id)
    if (!requirementId) {
      return { error: "Requirement was created but no id was returned. Please refresh." }
    }

    await logAudit(admin.id, "requirement.create", "additional_requirement", requirementId, {
      requirement_key: requirementKey,
      label,
      value_type: valueType,
    })
    revalidateRequirementPaths()
    return { success: true, requirementId }
  } catch (error) {
    console.error("[additional-requirements] create failed:", error)
    const message = error instanceof Error ? error.message : ""
    if (message === "Forbidden" || message === "Unauthorized") {
      return { error: "Only Acmmo Admin can manage additional requirements." }
    }
    return {
      error:
        "Could not create requirement. Run npm run db:migrate-additional-requirements if the table is missing.",
    }
  }
}

export async function updateAdditionalRequirementTemplate(formData: FormData) {
  try {
    const admin = await requireSuperAdmin()
    const id = Number(formData.get("id"))
    const label = String(formData.get("label") || "").trim()
    const sortOrder = Number(formData.get("sort_order") || 0)
    const active = formData.get("active") === "on" || formData.get("active") === "true"
    const valueType = parseCustomFieldValueType(formData.get("value_type"))
    const choiceOptions = valueType === "choice" ? parseChoiceOptions(formData.get("choice_options")) : []
    const choiceOptionsJson = choiceOptions.length ? JSON.stringify(choiceOptions) : null

    if (!id || !label) return { error: "Field name is required." }
    if (label.length > 255) return { error: "Field name is too long." }
    if (valueType === "choice" && choiceOptions.length < 2) {
      return { error: "Add at least two choices for a radio field." }
    }

    const current = await getAdditionalRequirementTemplateById(id)
    if (!current) return { error: "Requirement not found." }

    const dupLabel = (await sql`
      SELECT id FROM additional_requirement_templates
      WHERE LOWER(label) = ${label.toLowerCase()}
        AND id <> ${id}
      LIMIT 1
    `) as { id: number }[]
    if (dupLabel[0]) return { error: "A field with this name already exists." }

    await sql`
      UPDATE additional_requirement_templates
      SET label = ${label},
          value_type = ${valueType},
          choice_options = ${choiceOptionsJson},
          sort_order = ${Number.isFinite(sortOrder) ? sortOrder : current.sort_order},
          active = ${active}
      WHERE id = ${id}
    `

    await sql`
      UPDATE project_additional_requirements
      SET label = ${label},
          value_type = ${valueType},
          choice_options = ${choiceOptionsJson}
      WHERE requirement_key = ${current.requirement_key}
    `

    await logAudit(admin.id, "requirement.update", "additional_requirement", id, {
      from: current.label,
      to: label,
      value_type: valueType,
      active,
    })
    revalidateRequirementPaths()
    return { success: true }
  } catch (error) {
    console.error("[additional-requirements] update failed:", error)
    const message = error instanceof Error ? error.message : ""
    if (message === "Forbidden" || message === "Unauthorized") {
      return { error: "Only Acmmo Admin can manage additional requirements." }
    }
    return { error: "Could not update requirement." }
  }
}

export async function deleteAdditionalRequirementTemplate(formData: FormData) {
  const admin = await requireSuperAdmin()
  const id = Number(formData.get("id"))
  if (!id) return { error: "Requirement is required." }

  const current = await getAdditionalRequirementTemplateById(id)
  if (!current) return { error: "Requirement not found." }

  try {
    const usage = (await sql`
      SELECT COUNT(*) AS count
      FROM project_additional_requirements
      WHERE requirement_key = ${current.requirement_key}
    `) as { count: number }[]
    if (Number(usage[0]?.count ?? 0) > 0) {
      return {
        error: `Cannot delete "${current.label}" while ${usage[0].count} project(s) still use it. Hide it instead.`,
      }
    }

    await sql`DELETE FROM additional_requirement_templates WHERE id = ${id}`
    await logAudit(admin.id, "requirement.delete", "additional_requirement", id, {
      requirement_key: current.requirement_key,
      label: current.label,
    })
    revalidateRequirementPaths()
    return { success: true }
  } catch (error) {
    console.error("[additional-requirements] delete failed:", error)
    return { error: "Could not delete requirement." }
  }
}

// ---------- Admin account management (Acmmo Admin only) ----------

export async function createAdminAccount(formData: FormData) {
  const actor = await requireSuperAdmin()
  const name = String(formData.get("name") || "").trim()
  const username = String(formData.get("username") || "").trim()
  const password = String(formData.get("password") || "")
  const email = String(formData.get("email") || "").trim() || null
  const phone = String(formData.get("phone") || "").trim() || null
  const active = parseStaffActive(formData)

  if (!name || !username || !password) {
    return { error: "Name, username, and password are required." }
  }
  if (/\s/.test(username)) return { error: "Username cannot contain spaces." }
  if (password.length < 8) return { error: "Password must be at least 8 characters." }

  const existing = (await sql`
    SELECT id FROM app_users WHERE username = ${username} LIMIT 1
  `) as { id: number }[]
  if (existing.length) return { error: "A user with this username already exists." }

  const hash = await hashPassword(password)
  const rows = (await sql`
    INSERT INTO app_users (username, password, role, name, email, phone, active)
    VALUES (${username}, ${hash}, ${ADMIN_ROLE}, ${name}, ${email}, ${phone}, ${active})
  `) as { id: number }[]

  await logAuditForUser(actor, "admin.create", "user", rows[0].id, {
    name,
    username,
    role: ADMIN_ROLE,
  })
  revalidatePath("/admin/admins")
  revalidatePath("/admin/users")
  return { success: true, adminId: rows[0].id }
}

export async function updateAdminAccount(formData: FormData) {
  const actor = await requireSuperAdmin()
  const id = Number(formData.get("id"))
  const name = String(formData.get("name") || "").trim()
  const username = String(formData.get("username") || "").trim()
  const password = String(formData.get("password") || "")
  const email = String(formData.get("email") || "").trim() || null
  const phone = String(formData.get("phone") || "").trim() || null
  const active = parseStaffActive(formData)

  if (!id || !name || !username) {
    return { error: "Name and username are required." }
  }
  if (/\s/.test(username)) return { error: "Username cannot contain spaces." }
  if (password && password.length < 8) return { error: "Password must be at least 8 characters." }
  if (id === actor.id && !active) {
    return { error: "You cannot deactivate your own account." }
  }

  const current = (await sql`
    SELECT id, role, password FROM app_users WHERE id = ${id} LIMIT 1
  `) as { id: number; role: string; password: string }[]
  if (!current.length) return { error: "Admin account not found." }
  if (current[0].role !== ADMIN_ROLE) {
    return { error: "Only Admin accounts can be edited here." }
  }

  const duplicate = (await sql`
    SELECT id FROM app_users WHERE username = ${username} AND id <> ${id} LIMIT 1
  `) as { id: number }[]
  if (duplicate.length) return { error: "A user with this username already exists." }

  const hash = password ? await hashPassword(password) : current[0].password

  await sql`
    UPDATE app_users
    SET username = ${username}, password = ${hash}, name = ${name},
        email = ${email}, phone = ${phone}, active = ${active}
    WHERE id = ${id}
  `

  await logAuditForUser(actor, "admin.update", "user", id, {
    name,
    username,
    role: ADMIN_ROLE,
    active,
  })
  revalidatePath("/admin/admins")
  revalidatePath("/admin/users")
  return { success: true }
}

export async function deleteAdminAccount(formData: FormData) {
  const actor = await requireSuperAdmin()
  const id = Number(formData.get("id"))
  const confirmation = String(formData.get("confirmation") || "").trim()

  if (!id) return { error: "Admin account is required." }
  if (id === actor.id) return { error: "You cannot remove your own account." }

  const current = (await sql`
    SELECT id, username, role, name FROM app_users WHERE id = ${id} LIMIT 1
  `) as { id: number; username: string; role: string; name: string }[]
  if (!current.length) return { error: "Admin account not found." }
  if (current[0].role !== ADMIN_ROLE) {
    return { error: "Only Admin accounts can be removed here." }
  }

  const expected = staffDeleteConfirmationPhrase(current[0].username)
  if (confirmation !== expected) {
    return { error: `Type ${expected} exactly to confirm removal.` }
  }

  await sql`UPDATE projects SET assigned_to = NULL WHERE assigned_to = ${id}`
  await sql`DELETE FROM project_assignees WHERE user_id = ${id}`
  await sql`UPDATE workflow_steps SET assigned_to = NULL WHERE assigned_to = ${id}`
  await sql`UPDATE workflow_reviews SET reviewed_by = NULL WHERE reviewed_by = ${id}`
  await sql`DELETE FROM workflow_assignments WHERE user_id = ${id}`
  await sql`UPDATE workflow_assignments SET assigned_by = NULL WHERE assigned_by = ${id}`
  await sql`UPDATE project_files SET uploaded_by = NULL WHERE uploaded_by = ${id}`
  await sql`UPDATE payments SET recorded_by = NULL WHERE recorded_by = ${id}`
  await sql`UPDATE invoice_payments SET recorded_by = NULL WHERE recorded_by = ${id}`
  await sql`UPDATE invoices SET created_by = NULL WHERE created_by = ${id}`
  await sql`UPDATE audit_logs SET user_id = NULL WHERE user_id = ${id}`
  await sql`DELETE FROM app_users WHERE id = ${id}`

  await logAuditForUser(actor, "admin.delete", "user", id, {
    name: current[0].name,
    username: current[0].username,
    role: current[0].role,
  })
  revalidatePath("/admin/admins")
  revalidatePath("/admin/users")
  return { success: true }
}

export async function setUserActive(formData: FormData) {
  const actor = await requireSuperAdmin()
  const id = Number(formData.get("id"))
  const active = parseStaffActive(formData)

  if (!id) return { error: "User is required." }
  if (id === actor.id && !active) {
    return { error: "You cannot deactivate your own account." }
  }

  const current = (await sql`
    SELECT id, username, role, name FROM app_users WHERE id = ${id} LIMIT 1
  `) as { id: number; username: string; role: string; name: string }[]
  if (!current.length) return { error: "User not found." }
  if (isSuperAdmin(current[0].role) && !active) {
    return { error: "Acmmo Admin accounts cannot be deactivated here." }
  }

  await sql`UPDATE app_users SET active = ${active} WHERE id = ${id}`
  await logAuditForUser(actor, "user.set_active", "user", id, {
    username: current[0].username,
    role: current[0].role,
    active,
  })
  revalidatePath("/admin/users")
  revalidatePath("/admin/admins")
  revalidatePath("/admin/staff")
  return { success: true }
}

// ---------- Projects ----------

async function nextProjectCode(): Promise<string> {
  const year = new Date().getFullYear()
  const rows = (await sql`
    SELECT code FROM projects WHERE code LIKE ${`PROJECT-${year}-%`}
    ORDER BY code DESC LIMIT 1
  `) as { code: string }[]
  let next = 1
  if (rows[0]) {
    const parts = rows[0].code.split("-")
    next = Number.parseInt(parts[2], 10) + 1
  }
  return `PROJECT-${year}-${String(next).padStart(4, "0")}`
}

async function nextInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear()
  const rows = (await sql`
    SELECT invoice_number FROM projects WHERE invoice_number LIKE ${`INV-${year}-%`}
    ORDER BY invoice_number DESC LIMIT 1
  `) as { invoice_number: string }[]
  let next = 1
  if (rows[0]?.invoice_number) {
    const parts = rows[0].invoice_number.split("-")
    next = Number.parseInt(parts[2], 10) + 1
  }
  return `INV-${year}-${String(next).padStart(4, "0")}`
}

async function nextDrawingNumber(): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `DRW-${year}-`
  const rows = (await sql`
    SELECT drawing_number FROM projects
    WHERE drawing_number LIKE ${`${prefix}%`}
  `) as { drawing_number: string }[]
  let maxSeq = 0
  for (const row of rows) {
    const suffix = row.drawing_number.slice(prefix.length)
    if (!/^\d+$/.test(suffix)) continue
    const seq = Number.parseInt(suffix, 10)
    if (seq > maxSeq) maxSeq = seq
  }
  return `${prefix}${String(maxSeq + 1).padStart(4, "0")}`
}

async function assertDrawingNumberAvailable(
  drawingNumber: string | null,
  excludeProjectId?: number,
): Promise<string | null> {
  if (!drawingNumber) return null
  const rows = excludeProjectId
    ? ((await sql`
        SELECT id, name FROM projects
        WHERE drawing_number = ${drawingNumber} AND id <> ${excludeProjectId}
        LIMIT 1
      `) as { id: number; name: string }[])
    : ((await sql`
        SELECT id, name FROM projects
        WHERE drawing_number = ${drawingNumber}
        LIMIT 1
      `) as { id: number; name: string }[])
  if (!rows.length) return null
  return `Drawing number ${drawingNumber} is already used by "${rows[0].name}".`
}

export async function generateDrawingNumber() {
  const user = await requireUser()
  if (
    !isAdmin(user) &&
    !userHasRole(user, "Planning Staff") &&
    user.role !== "Planning Staff"
  ) {
    return { error: "Only Admin or Planning Staff can generate drawing numbers." }
  }
  const drawingNumber = await nextDrawingNumber()
  return { drawingNumber }
}

function parseResidentialDetails(formData: FormData, type: string | null) {
  if (!showsResidentialDetails(type)) {
    return {
      buildingNumber: null,
      buildingPermitNumber: null,
      reqArchitecturalPlan: false,
      reqBuildingPermit: false,
      reqRegularization: false,
    }
  }
  const selectedServices = new Set(formData.getAll("services").map((value) => String(value)))
  return {
    buildingNumber: String(formData.get("building_number") || "").trim() || null,
    buildingPermitNumber: String(formData.get("building_permit_number") || "").trim() || null,
    reqArchitecturalPlan:
      formData.get("req_architectural_plan") === "true" ||
      selectedServices.has("architectural_plan"),
    reqBuildingPermit:
      formData.get("req_building_permit") === "true" || selectedServices.has("building_permit"),
    reqRegularization:
      formData.get("req_regularization") === "true" || selectedServices.has("regularization"),
  }
}

export async function createProject(formData: FormData) {
  const admin = await requireAdminOrSuperAdmin()
  const name = String(formData.get("name") || "").trim()
  const clientId = Number(formData.get("client_id"))
  const location = String(formData.get("location") || "").trim() || null
  const type = String(formData.get("type") || "").trim() || null
  const priority = String(formData.get("priority") || "Medium")
  const dueDate = String(formData.get("due_date") || "") || null
  const amount = Number(formData.get("project_amount") || 0)
  const drawingNumber = String(formData.get("drawing_number") || "").trim() || null
  const edgebookNumber = String(formData.get("edgebook_number") || "").trim() || null
  const referName = String(formData.get("refer_name") || "").trim() || null
  const notes = String(formData.get("notes") || "").trim() || null
  const projectPackage = (String(formData.get("project_package") || "full") as ProjectPackage)
  const residential = parseResidentialDetails(formData, type)
  const serviceCatalog = await listProjectServiceDefs({ activeOnly: true })
  const selectedServices = parseSelectedServices(formData, projectPackage, serviceCatalog)
  const allowedDocuments = await checklistItemsFromTemplates(selectedServices)
  const selectedDocuments = parseSelectedDocuments(formData, allowedDocuments)
  const additionalRequirements = await parseAdditionalRequirementsFromForm(formData)
  const startDateInput = String(formData.get("start_date") || "").trim()
  const customStartAt =
    isSuperAdmin(admin.role) && startDateInput && !isLocalToday(startDateInput)
      ? projectStartAtFromDate(startDateInput)
      : null

  if (!name || !clientId) return { error: "Project name and client are required." }
  if (isSuperAdmin(admin.role) && startDateInput && !projectStartAtFromDate(startDateInput)) {
    return { error: "Enter a valid project start date." }
  }
  if (
    !selectedServices.length &&
    !residential.reqArchitecturalPlan &&
    !residential.reqBuildingPermit &&
    !residential.reqRegularization
  ) {
    return { error: "Select at least one project service." }
  }

  const drawingConflict = await assertDrawingNumberAvailable(drawingNumber)
  if (drawingConflict) return { error: drawingConflict }

  const code = await nextProjectCode()
  const invoice = await nextInvoiceNumber()

  const rows = customStartAt
    ? ((await sql`
        INSERT INTO projects (
          code, name, client_id, location, type, priority, status, section, current_stage,
          due_date, project_amount, invoice_number, project_package,
          building_number, building_permit_number, drawing_number, edgebook_number, refer_name, notes,
          req_architectural_plan, req_building_permit, req_regularization, created_at
        )
        VALUES (
          ${code}, ${name}, ${clientId}, ${location}, ${type}, ${priority}, 'Awaiting Assignment', 'Planning & Design', 0,
          ${dueDate}, ${amount}, ${invoice}, ${projectPackage},
          ${residential.buildingNumber}, ${residential.buildingPermitNumber}, ${drawingNumber}, ${edgebookNumber}, ${referName}, ${notes},
          ${residential.reqArchitecturalPlan}, ${residential.reqBuildingPermit}, ${residential.reqRegularization},
          ${customStartAt}
        )
      `) as { id: number }[])
    : ((await sql`
        INSERT INTO projects (
          code, name, client_id, location, type, priority, status, section, current_stage,
          due_date, project_amount, invoice_number, project_package,
          building_number, building_permit_number, drawing_number, edgebook_number, refer_name, notes,
          req_architectural_plan, req_building_permit, req_regularization
        )
        VALUES (
          ${code}, ${name}, ${clientId}, ${location}, ${type}, ${priority}, 'Awaiting Assignment', 'Planning & Design', 0,
          ${dueDate}, ${amount}, ${invoice}, ${projectPackage},
          ${residential.buildingNumber}, ${residential.buildingPermitNumber}, ${drawingNumber}, ${edgebookNumber}, ${referName}, ${notes},
          ${residential.reqArchitecturalPlan}, ${residential.reqBuildingPermit}, ${residential.reqRegularization}
        )
      `) as { id: number }[])

  const projectId = rows[0].id
  await seedProjectWorkflow(projectId, selectedServices, selectedDocuments)
  await saveProjectAdditionalRequirements(projectId, additionalRequirements)

  for (const floor of KMAP_FLOOR_ROWS) {
    await sql`
      INSERT IGNORE INTO project_kmap_areas (project_id, floor_key)
      VALUES (${projectId}, ${floor.key})
    `
  }
  await appendStatus(projectId, "New", "Project created", "Office Admin", customStartAt)
  await appendStatus(
    projectId,
    "Awaiting Assignment",
    "Workflow generated from selected services",
    "Office Admin",
    customStartAt,
  )
  if (customStartAt) {
    await sql`
      UPDATE workflow_steps SET created_at = ${customStartAt} WHERE project_id = ${projectId}
    `
    await sql`
      UPDATE project_services SET created_at = ${customStartAt} WHERE project_id = ${projectId}
    `
  }
  revalidateProjectPaths(projectId)
  return { success: true, projectId }
}

export async function deleteProject(formData: FormData) {
  const admin = await requireAdminOrSuperAdmin()
  const id = Number(formData.get("id"))
  const confirmation = String(formData.get("confirmation") || "").trim()
  if (!id) return { error: "Project is required." }

  const rows = (await sql`
    SELECT id, code, name FROM projects WHERE id = ${id} LIMIT 1
  `) as { id: number; code: string; name: string }[]
  if (!rows.length) return { error: "Project not found." }

  const blocked = await projectDeleteBlockedMessage(id)
  if (blocked) return { error: blocked }

  const expected = projectDeleteConfirmationPhrase(rows[0].code)
  if (confirmation !== expected) {
    return { error: `Type ${expected} exactly to confirm hard delete.` }
  }

  try {
    await sql`DELETE FROM projects WHERE id = ${id}`
  } catch (error) {
    const code = mysqlErrorCode(error)
    if (code === "ER_ROW_IS_REFERENCED_2" || code === "ER_ROW_IS_REFERENCED") {
      return {
        error:
          "This project cannot be deleted because related records already exist (invoices, payments, or other activity). Only a newly created project with no other activity can be permanently removed.",
      }
    }
    console.error("[projects] delete failed:", error)
    return { error: "Could not delete this project." }
  }

  await logAudit(admin.id, "project.delete", "project", id, {
    code: rows[0].code,
    name: rows[0].name,
  })
  revalidatePath("/admin/projects")
  revalidatePath("/admin")
  revalidatePath("/staff")
  revalidatePath("/staff/projects")
  revalidatePath("/admin/finance/project")
  return { success: true }
}

export async function updateProjectDetails(formData: FormData) {
  const admin = await requireAdminOrSuperAdmin()
  const id = Number(formData.get("id"))
  const name = String(formData.get("name") || "").trim()
  const location = String(formData.get("location") || "").trim() || null
  const type = String(formData.get("type") || "").trim() || null
  const priority = String(formData.get("priority") || "Medium")
  const dueDate = String(formData.get("due_date") || "") || null
  const amount = Number(formData.get("project_amount") || 0)
  const drawingNumberInput = String(formData.get("drawing_number") || "").trim() || null
  const edgebookNumber = String(formData.get("edgebook_number") || "").trim() || null
  const referName = String(formData.get("refer_name") || "").trim() || null
  const notes = String(formData.get("notes") || "").trim() || null
  const residential = parseResidentialDetails(formData, type)
  const projectPackage = (String(formData.get("project_package") || "full") as ProjectPackage)
  const serviceCatalog = await listProjectServiceDefs({ includeInactive: true })
  const selectedServices = parseSelectedServices(
    formData,
    projectPackage,
    projectPackage === "full"
      ? serviceCatalog.filter((service) => service.active !== false)
      : serviceCatalog,
  )
  const allowedDocuments = await checklistItemsFromTemplates(selectedServices)
  const selectedDocuments = parseSelectedDocuments(formData, allowedDocuments)

  if (!id || !name) return { error: "Project name is required." }
  if (
    !selectedServices.length &&
    !residential.reqArchitecturalPlan &&
    !residential.reqBuildingPermit &&
    !residential.reqRegularization
  ) {
    return { error: "Select at least one project service." }
  }

  const project = await getProjectOrThrow(id)
  const closedError = closedProjectMutationError(admin, project)
  if (closedError) return { error: closedError }
  const drawingNumber = project.drawing_number?.trim()
    ? project.drawing_number.trim()
    : drawingNumberInput

  const clientId = Number(formData.get("client_id") || project.client_id)
  if (!clientId) return { error: "Client is required." }
  const clientRows = (await sql`
    SELECT id FROM clients WHERE id = ${clientId} LIMIT 1
  `) as { id: number }[]
  if (!clientRows.length) return { error: "Client not found." }

  const drawingConflict = await assertDrawingNumberAvailable(drawingNumber, id)
  if (drawingConflict) return { error: drawingConflict }

  let nextStartAt: string | null = null
  if (isSuperAdmin(admin.role)) {
    const startDateInput = String(formData.get("start_date") || "").trim()
    if (startDateInput) {
      const startAt = projectStartAtFromDate(startDateInput)
      if (!startAt) return { error: "Enter a valid project start date." }
      nextStartAt = projectStartAtFromDate(startDateInput, project.created_at) ?? startAt
    }
  }

  const workflowSync = await syncProjectWorkflowFromServices(id, selectedServices, selectedDocuments)
  if (workflowSync.error) return { error: workflowSync.error }

  await sql`
    UPDATE projects
    SET name = ${name}, location = ${location}, type = ${type}, priority = ${priority},
        client_id = ${clientId},
        due_date = ${dueDate}, project_amount = ${amount},
        building_number = ${residential.buildingNumber},
        building_permit_number = ${residential.buildingPermitNumber},
        drawing_number = ${drawingNumber},
        edgebook_number = ${edgebookNumber},
        refer_name = ${referName},
        notes = ${notes},
        project_package = ${projectPackage},
        req_architectural_plan = ${residential.reqArchitecturalPlan},
        req_building_permit = ${residential.reqBuildingPermit},
        req_regularization = ${residential.reqRegularization},
        updated_at = now()
    WHERE id = ${id}
  `

  if (formData.get("edit_custom_fields") === "1") {
    const additionalRequirements = await parseAdditionalRequirementsFromForm(formData, {
      includeInactive: true,
    })
    await saveProjectAdditionalRequirements(id, additionalRequirements)
  }

  if (nextStartAt) {
    await sql`
      UPDATE projects SET created_at = ${nextStartAt}, updated_at = now() WHERE id = ${id}
    `
    await sql`
      UPDATE status_history
      SET created_at = ${nextStartAt}
      WHERE project_id = ${id}
        AND status IN ('New', 'Awaiting Assignment')
        AND (
          note = 'Project created'
          OR note = 'Workflow generated from selected services'
        )
    `
  }

  await logAudit(admin.id, "project.update_details", "project", id, {
    name,
    project_package: projectPackage,
    services: selectedServices,
  })
  revalidateProjectPaths(id)
  return { success: true }
}

export async function updateProjectStartDate(formData: FormData) {
  const admin = await requireSuperAdmin()
  const id = Number(formData.get("project_id") || formData.get("id"))
  const startDateInput = String(formData.get("start_date") || "").trim()
  if (!id) return { error: "Invalid project." }

  const startAt = projectStartAtFromDate(startDateInput)
  if (!startAt) return { error: "Enter a valid project start date." }

  const project = await getProjectOrThrow(id)
  const nextStartAt = projectStartAtFromDate(startDateInput, project.created_at) ?? startAt

  await sql`
    UPDATE projects
    SET created_at = ${nextStartAt}, updated_at = now()
    WHERE id = ${id}
  `
  await sql`
    UPDATE status_history
    SET created_at = ${nextStartAt}
    WHERE project_id = ${id}
      AND status IN ('New', 'Awaiting Assignment')
      AND (
        note = 'Project created'
        OR note = 'Workflow generated from selected services'
      )
  `
  await logAudit(admin.id, "project.update_start_date", "project", id, {
    start_date: nextStartAt,
  })
  revalidateProjectPaths(id)
  return { success: true }
}

export async function updateProjectNotes(formData: FormData) {
  const admin = await requireAdminOrSuperAdmin()
  const id = Number(formData.get("project_id") || formData.get("id"))
  const notes = String(formData.get("notes") || "").trim() || null
  if (!id) return { error: "Invalid project." }

  const project = await getProjectOrThrow(id)
  const closedError = closedProjectMutationError(admin, project)
  if (closedError) return { error: closedError }

  await sql`
    UPDATE projects
    SET notes = ${notes}, updated_at = now()
    WHERE id = ${id}
  `
  await logAudit(admin.id, "project.update_notes", "project", id)
  revalidateProjectPaths(id)
  return { success: true }
}

export async function updateProjectCustomFields(formData: FormData) {
  const admin = await requireAdminOrSuperAdmin()
  const id = Number(formData.get("project_id") || formData.get("id"))
  if (!id) return { error: "Invalid project." }

  const project = await getProjectOrThrow(id)
  const closedError = closedProjectMutationError(admin, project)
  if (closedError) return { error: closedError }

  const fields = await parseAdditionalRequirementsFromForm(formData, { includeInactive: true })
  await saveProjectAdditionalRequirements(id, fields)
  await logAudit(admin.id, "project.update_custom_fields", "project", id)
  revalidateProjectPaths(id)
  return { success: true }
}

/** Saves all project-detail page fields in one request (custom fields, date, drawing, areas, notes). */
export async function saveProjectPageDetails(formData: FormData) {
  const admin = await requireAdminOrSuperAdmin()
  const id = Number(formData.get("project_id"))
  if (!id) return { error: "Invalid project." }

  if (formData.get("save_drawing") === "1") {
    const drawingRes = await updateProjectDrawingNumber(formData)
    if (drawingRes && "error" in drawingRes && drawingRes.error) return drawingRes
    const edgeRes = await updateProjectEdgebookNumber(formData)
    if (edgeRes && "error" in edgeRes && edgeRes.error) return edgeRes
  }

  if (formData.get("save_notes") === "1") {
    const notesRes = await updateProjectNotes(formData)
    if (notesRes && "error" in notesRes && notesRes.error) return notesRes
  }

  if (formData.get("save_start_date") === "1" && isSuperAdmin(admin.role)) {
    const startRes = await updateProjectStartDate(formData)
    if (startRes && "error" in startRes && startRes.error) return startRes
  }

  if (formData.get("save_custom_fields") === "1") {
    const fieldsRes = await updateProjectCustomFields(formData)
    if (fieldsRes && "error" in fieldsRes && fieldsRes.error) return fieldsRes
  }

  if (formData.get("save_areas") === "1") {
    const areasRes = await updateProjectKmapAreas(formData)
    if (areasRes && "error" in areasRes && areasRes.error) return areasRes
  }

  return { success: true }
}

export async function assignProject(formData: FormData) {
  const admin = await requireSuperAdmin()
  const id = Number(formData.get("project_id"))
  if (!id) return { error: "Invalid project." }

  const project = await getProjectOrThrow(id)
  const currentStep = await getCurrentWorkflowStep(id)
  if (!currentStep || !isWorkStep(currentStep)) {
    return { error: "No active work step to assign." }
  }
  if (isReviewStep(currentStep)) {
    return { error: "Cannot assign staff during admin review." }
  }

  const multiAssign = allowsMultiAssignee(currentStep)
  const staffIds = parseAssignedStaffIds(formData)

  if (!staffIds.length) {
    return { error: multiAssign ? "Select at least one staff member." : "Select a staff member." }
  }
  if (!multiAssign && staffIds.length > 1) {
    return { error: "Only one staff member can be assigned at this stage." }
  }

  const primaryAssignee = staffIds[0]
  const stageKey = currentStep.service_key ?? currentStep.step_key

  await activateWorkflowStep(id, currentStep.id, "Assigned", primaryAssignee)

  if (multiAssign) {
    await syncSiteAssignees(id, staffIds, stageKey)
  } else {
    await clearSiteAssignees(id)
  }

  const assigneeNote =
    multiAssign && staffIds.length > 1
      ? `Assigned ${staffIds.length} staff for ${currentStep.label}`
      : `Assigned to staff for ${currentStep.label}`

  await appendStatus(id, "Assigned", assigneeNote, admin.name)

  for (const assignee of staffIds) {
    await notify(
      assignee,
      "Staff Assigned",
      multiAssign && staffIds.length > 1 ? "Team assigned" : "New project assigned",
      `You have been assigned to ${project.name} — ${currentStep.label}.`,
    )
    await recordWorkflowAssignment(id, currentStep.id, assignee, admin.id, assigneeNote)
  }

  await logAudit(admin.id, "project.assign", "project", id, {
    assignee: primaryAssignee,
    assignees: staffIds,
    step: currentStep.step_key,
  })
  revalidateProjectPaths(id)
  return { success: true }
}

export async function assignToDepartment(formData: FormData) {
  const admin = await requireSuperAdmin()
  const id = Number(formData.get("project_id"))
  const section = String(formData.get("section") || "")
  const assignee = Number(formData.get("assigned_to")) || null

  if (!id || !section) return { error: "Select a department." }

  const knownSections = await getDepartmentNames(true)
  if (!knownSections.includes(section)) return { error: "Invalid department." }

  const stage = firstStageInSection(section)
  let staffId = assignee
  const sectionRole = await roleForSection(section)
  const roleKey = sectionRole ? await resolveRoleKey(sectionRole) : null

  if (!staffId && sectionRole) {
    const staff = (await sql`
      SELECT DISTINCT u.id
      FROM app_users u
      LEFT JOIN staff_roles sr ON sr.user_id = u.id
      WHERE u.active = true
        AND (
          u.role = ${sectionRole}
          OR (${roleKey} IS NOT NULL AND sr.role_key = ${roleKey})
        )
      ORDER BY u.id
      LIMIT 1
    `) as { id: number }[]
    staffId = staff[0]?.id ?? null
  }

  await clearSiteAssignees(id)
  await sql`
    UPDATE projects
    SET section = ${section}, current_stage = ${stage}, assigned_to = ${staffId},
        status = ${staffId ? "Assigned" : "New"}, updated_at = now()
    WHERE id = ${id}
  `
  await appendStatus(id, staffId ? "Assigned" : "New", `Moved to ${section}`, admin.name)
  if (staffId) {
    const project = await getProjectOrThrow(id)
    await notify(staffId, "Project Assigned", "Project in your department", project.name)
  } else if (sectionRole) {
    await notifyRole(sectionRole, "Department queue updated", `Project moved to ${section}`)
  }
  await logAudit(admin.id, "project.move_department", "project", id, { section, staffId })
  revalidateProjectPaths(id)
  return { success: true }
}

export async function startWork(formData: FormData) {
  const user = await requireUser()
  const id = Number(formData.get("project_id"))
  if (!id) return { error: "Invalid project." }

  const project = isAdmin(user)
    ? await getProjectOrThrow(id)
    : await requireStaffProjectAccess(user, id)

  if (!["Assigned", "Correction Required"].includes(project.status)) {
    return { error: "Work can only be started when assigned or after correction." }
  }

  await sql`
    UPDATE projects SET status = 'In Progress', updated_at = NOW() WHERE id = ${id}
  `
  await appendStatus(id, "In Progress", `Work started on ${project.section}`, user.name)
  await notify(project.assigned_to ?? user.id, "Work Started", "Project in progress", project.name)
  await logAudit(user.id, "project.start_work", "project", id)
  revalidateProjectPaths(id)
  return { success: true }
}

export async function markWorkComplete(formData: FormData) {
  const user = await requireUser()
  const id = Number(formData.get("project_id"))
  if (!id) return { error: "Invalid project." }

  const project = isAdmin(user)
    ? await getProjectOrThrow(id)
    : await requireStaffProjectAccess(user, id)

  const currentStep = await getCurrentWorkflowStep(id)
  if (!currentStep || !isWorkStep(currentStep)) {
    return { error: "No active work step." }
  }

  if (!["Assigned", "In Progress", "Correction Required"].includes(project.status)) {
    return { error: "Mark work complete only when actively working on this step." }
  }

  await sql`
    UPDATE projects
    SET status = 'Work Completed', work_completed_at = NOW(), updated_at = NOW()
    WHERE id = ${id}
  `
  await appendStatus(id, "Work Completed", `Completed ${currentStep.label}`, user.name)

  await notifyOfficeAdmins(
    "Work Completed",
    "Staff marked work complete",
    `${project.name} — ${currentStep.label}`,
  )
  await logAudit(user.id, "project.work_completed", "project", id, { step: currentStep.step_key })
  revalidateProjectPaths(id)
  return { success: true }
}

/** @deprecated Service workflow uses markWorkComplete — kept for compatibility */
export async function advanceStage(formData: FormData) {
  return markWorkComplete(formData)
}

export async function submitForReview(formData: FormData) {
  const user = await requireUser()
  const id = Number(formData.get("project_id"))
  const note = String(formData.get("note") || "").trim() || null
  if (!id) return { error: "Invalid project." }

  const project = isAdmin(user)
    ? await getProjectOrThrow(id)
    : await requireStaffProjectAccess(user, id)

  const currentStep = await getCurrentWorkflowStep(id)
  if (!currentStep || !isWorkStep(currentStep)) {
    return { error: "Submit for review from an active work step." }
  }

  if (!["Work Completed", "In Progress", "Assigned"].includes(project.status)) {
    return { error: "Complete your work before submitting for admin review." }
  }

  await sql`
    UPDATE workflow_steps
    SET step_status = 'completed', completed_at = NOW()
    WHERE id = ${currentStep.id}
  `

  const reviewStep = (await sql`
    SELECT id, project_id, step_type, step_key, label, section, service_key, sort_order,
           step_status, assigned_to, started_at, completed_at
    FROM workflow_steps
    WHERE project_id = ${id} AND step_type = 'admin_review' AND sort_order > ${currentStep.sort_order}
    ORDER BY sort_order ASC
    LIMIT 1
  `) as Awaited<ReturnType<typeof getCurrentWorkflowStep>>[]

  const nextReview = reviewStep[0]
  if (!nextReview) {
    return { error: "No review step found in workflow." }
  }

  await activateWorkflowStep(id, nextReview.id, "Pending Review", null)
  await sql`
    UPDATE projects SET review_note = ${note}, updated_at = NOW() WHERE id = ${id}
  `
  await appendStatus(id, "Pending Review", note ?? `Submitted ${currentStep.label} for review`, user.name)

  await notifyOfficeAdmins(
    "Submitted for Review",
    "Project awaiting admin review",
    `${project.name} — ${currentStep.label} needs your approval.`,
  )
  await logAudit(user.id, "project.submit_review", "project", id, { step: currentStep.step_key })
  revalidateProjectPaths(id)
  return { success: true }
}

export async function approveSectionReview(formData: FormData) {
  const admin = await requireSuperAdmin()
  const id = Number(formData.get("project_id"))
  const staffIds = parseAssignedStaffIds(formData)
  const note = String(formData.get("note") || "").trim() || "Admin approved work"

  if (!id) return { error: "Invalid project." }
  const project = await getProjectOrThrow(id)
  if (project.status !== "Pending Review") {
    return { error: "Project is not pending review." }
  }

  const currentStep = await getCurrentWorkflowStep(id)
  if (!currentStep || !isReviewStep(currentStep)) {
    return { error: "No active review step." }
  }

  await recordWorkflowReview(id, currentStep.id, "approved", note, admin.id)
  await sql`
    UPDATE workflow_steps SET step_status = 'completed', completed_at = NOW() WHERE id = ${currentStep.id}
  `

  const nextWork = (await sql`
    SELECT id, project_id, step_type, step_key, label, section, service_key, sort_order,
           step_status, assigned_to, started_at, completed_at
    FROM workflow_steps
    WHERE project_id = ${id} AND step_type IN ('service', 'planning', 'billing')
      AND sort_order > ${currentStep.sort_order}
    ORDER BY sort_order ASC
    LIMIT 1
  `) as Awaited<ReturnType<typeof getCurrentWorkflowStep>>[]

  const following = nextWork[0]
  if (!following) {
    return { error: "No next workflow step. Use close project instead." }
  }

  let assignees = staffIds
  const serviceCatalog = await listProjectServiceDefs({ includeInactive: true })
  const role = roleForStep(following, serviceCatalog)
  if (!assignees.length && role) {
    const roleKey = (await resolveRoleKey(role)) ?? roleToKey(role)
    const staff = (await sql`
      SELECT DISTINCT u.id
      FROM app_users u
      LEFT JOIN staff_roles sr ON sr.user_id = u.id
      WHERE u.active = true
        AND (
          u.role = ${role}
          OR (${roleKey} IS NOT NULL AND sr.role_key = ${roleKey})
        )
      ORDER BY u.id
      LIMIT 1
    `) as { id: number }[]
    if (staff[0]?.id) assignees = [staff[0].id]
  }

  const primaryAssignee = assignees[0] ?? null
  const newStatus = primaryAssignee ? "Assigned" : "Awaiting Assignment"
  const stageKey = following.service_key ?? following.step_key

  await clearSiteAssignees(id)
  await activateWorkflowStep(id, following.id, newStatus, primaryAssignee)
  if (assignees.length) {
    await syncSiteAssignees(id, assignees, stageKey)
  }
  await sql`UPDATE projects SET review_note = NULL, updated_at = NOW() WHERE id = ${id}`
  await appendStatus(id, "Approved", note, admin.name)
  await appendStatus(id, newStatus, `Next: ${following.label}`, admin.name)

  if (assignees.length) {
    for (const staffId of assignees) {
      await notify(
        staffId,
        "Approved",
        assignees.length > 1 ? "Project approved and team assigned" : "Project approved and assigned",
        `${project.name} — ${following.label}`,
      )
      await recordWorkflowAssignment(id, following.id, staffId, admin.id, note)
    }
  } else if (role) {
    await notifyRole(role, "Awaiting Assignment", `${project.name} is ready for ${following.label}`)
  }

  await logAudit(admin.id, "project.approve_review", "project", id, {
    nextStep: following.step_key,
    assignees,
  })
  revalidateProjectPaths(id)
  return { success: true }
}

export async function rejectReview(formData: FormData) {
  const admin = await requireSuperAdmin()
  const id = Number(formData.get("project_id"))
  const note = String(formData.get("note") || "").trim()
  if (!id || !note) return { error: "Provide feedback for correction." }

  const project = await getProjectOrThrow(id)
  const currentStep = await getCurrentWorkflowStep(id)
  if (!currentStep || !isReviewStep(currentStep)) {
    return { error: "No active review step." }
  }

  await recordWorkflowReview(id, currentStep.id, "rejected", note, admin.id)
  await sql`
    UPDATE workflow_steps SET step_status = 'completed', completed_at = NOW() WHERE id = ${currentStep.id}
  `

  const workStep = (await sql`
    SELECT id, project_id, step_type, step_key, label, section, service_key, sort_order,
           step_status, assigned_to, started_at, completed_at
    FROM workflow_steps
    WHERE project_id = ${id} AND service_key = ${currentStep.service_key}
      AND step_type IN ('service', 'planning')
    LIMIT 1
  `) as Awaited<ReturnType<typeof getCurrentWorkflowStep>>[]

  const priorWork = workStep[0]
  if (priorWork) {
    await sql`
      UPDATE workflow_steps
      SET step_status = 'active', completed_at = NULL
      WHERE id = ${priorWork.id}
    `
    await activateWorkflowStep(id, priorWork.id, "Correction Required", project.assigned_to)
  } else {
    await sql`
      UPDATE projects SET status = 'Correction Required', review_note = ${note}, updated_at = NOW()
      WHERE id = ${id}
    `
  }

  await sql`UPDATE projects SET review_note = ${note}, updated_at = NOW() WHERE id = ${id}`
  await appendStatus(id, "Correction Required", note, admin.name)

  if (project.assigned_to) {
    await notify(
      project.assigned_to,
      "Rejected",
      "Admin requested changes",
      `${project.name}: ${note}`,
    )
  }
  await logAudit(admin.id, "project.reject_review", "project", id, { note })
  revalidateProjectPaths(id)
  return { success: true }
}

export async function closeProject(formData: FormData) {
  const admin = await requireSuperAdmin()
  const id = Number(formData.get("project_id"))
  if (!id) return { error: "Invalid project." }

  const project = await getProjectOrThrow(id)
  if (project.payment_status !== "Paid" && Number(project.project_amount) > 0) {
    return { error: "Record full payment before closing the project." }
  }

  await clearSiteAssignees(id)
  await sql`
    UPDATE projects SET status = 'Closed', section = 'Billing', assigned_to = NULL, updated_at = now()
    WHERE id = ${id}
  `
  await sql`
    UPDATE workflow_steps SET step_status = 'completed', completed_at = NOW()
    WHERE project_id = ${id} AND step_type = 'billing'
  `
  await appendStatus(id, "Closed", "Project closed after billing", admin.name)
  await notifyRole("Billing Staff", "Project Closed", `${project.name} has been closed.`)
  await logAudit(admin.id, "project.close", "project", id)
  revalidateProjectPaths(id)
  return { success: true }
}

export async function setProjectStatus(formData: FormData) {
  const user = await requireUser()
  const id = Number(formData.get("project_id"))
  const status = String(formData.get("status") || "")
  const note = String(formData.get("note") || "").trim() || null
  if (!id || !status) return { error: "Invalid request." }

  if (!isAdmin(user)) {
    await requireStaffProjectAccess(user, id)
  }

  await sql`UPDATE projects SET status = ${status}, updated_at = now() WHERE id = ${id}`
  await appendStatus(id, status, note, user.name)
  await logAudit(user.id, "project.set_status", "project", id, { status })
  revalidateProjectPaths(id)
  return { success: true }
}

export async function returnProject(formData: FormData) {
  const user = await requireUser()
  const id = Number(formData.get("project_id"))
  const reason = String(formData.get("reason") || "")
  const notes = String(formData.get("notes") || "").trim() || null
  if (!id || !reason) return { error: "Select a reason for returning." }
  if (!RETURN_REASONS.includes(reason)) return { error: "Invalid return reason." }

  const project = isAdmin(user)
    ? await getProjectOrThrow(id)
    : await requireStaffProjectAccess(user, id)

  await sql`
    UPDATE projects SET status = 'Returned', updated_at = now()
    WHERE id = ${id}
  `
  await sql`
    INSERT INTO return_history (project_id, reason, notes, created_by)
    VALUES (${id}, ${reason}, ${notes}, ${user.name})
  `
  await appendStatus(id, "Returned", `Returned: ${reason}${notes ? ` — ${notes}` : ""}`, user.name)

  await notifyOfficeAdmins(
    "Project Returned",
    "Project returned to office",
    `${project.name} was returned by ${user.name}: ${reason}.`,
  )
  await logAudit(user.id, "project.return", "project", id, { reason })
  revalidateProjectPaths(id)
  return { success: true }
}

export async function reassignReturnedProject(formData: FormData) {
  const admin = await requireSuperAdmin()
  const id = Number(formData.get("project_id"))
  const staffIds = parseAssignedStaffIds(formData)
  if (!id || !staffIds.length) return { error: "Select staff to reassign." }

  const currentStep = await getCurrentWorkflowStep(id)
  const primaryAssignee = staffIds[0]
  const stageKey = currentStep
    ? currentStep.service_key ?? currentStep.step_key
    : "planning"

  await clearSiteAssignees(id)
  if (currentStep && isWorkStep(currentStep)) {
    await activateWorkflowStep(id, currentStep.id, "Assigned", primaryAssignee)
  } else {
    await sql`
      UPDATE projects SET assigned_to = ${primaryAssignee}, status = 'Assigned', updated_at = now()
      WHERE id = ${id}
    `
  }
  await syncSiteAssignees(id, staffIds, stageKey)
  await appendStatus(id, "Assigned", "Returned project reassigned", admin.name)
  for (const assignee of staffIds) {
    await notify(
      assignee,
      "Project Assigned",
      staffIds.length > 1 ? "Returned project team reassigned" : "Returned project reassigned",
      "A returned project was sent back to you.",
    )
    if (currentStep) {
      await recordWorkflowAssignment(id, currentStep.id, assignee, admin.id, "Returned reassign")
    }
  }
  await logAudit(admin.id, "project.reassign_returned", "project", id, {
    assignee: primaryAssignee,
    assignees: staffIds,
  })
  revalidateProjectPaths(id)
  return { success: true }
}

// ---------- Checklist ----------

export async function toggleChecklistItem(formData: FormData) {
  const user = await requireUser()
  const id = Number(formData.get("item_id"))
  const projectId = Number(formData.get("project_id"))
  const checked = String(formData.get("checked")) === "true"
  if (!id || !projectId) return { error: "Invalid item." }

  const project = !isAdmin(user)
    ? await requireStaffProjectAccess(user, projectId)
    : await getProjectOrThrow(projectId)
  const closedError = closedProjectMutationError(user, project)
  if (closedError) return { error: closedError }

  await sql`UPDATE checklist_items SET checked = ${checked} WHERE id = ${id}`
  revalidateProjectPaths(projectId)
  return { success: true }
}

export async function toggleChecklistFiled(formData: FormData) {
  const user = await requireUser()
  const id = Number(formData.get("item_id"))
  const projectId = Number(formData.get("project_id"))
  const filed = String(formData.get("filed")) === "true"
  if (!id || !projectId) return { error: "Invalid item." }

  const project = !isAdmin(user)
    ? await requireStaffProjectAccess(user, projectId)
    : await getProjectOrThrow(projectId)
  const closedError = closedProjectMutationError(user, project)
  if (closedError) return { error: closedError }

  await sql`UPDATE checklist_items SET filed = ${filed}, checked = ${filed} WHERE id = ${id}`
  revalidateProjectPaths(projectId)
  return { success: true }
}

export async function updateProjectKmapAreas(formData: FormData) {
  const user = await requireUser()
  const projectId = Number(formData.get("project_id"))
  if (!projectId) return { error: "Invalid project." }

  const project = !isAdmin(user)
    ? await requireStaffProjectAccess(user, projectId)
    : await getProjectOrThrow(projectId)
  const closedError = closedProjectMutationError(user, project)
  if (closedError) return { error: closedError }

  const raw = String(formData.get("areas") || "")
  let areas: {
    floor_key: string
    plinth_area: number | null
    floor_area: number | null
  }[]

  try {
    areas = JSON.parse(raw)
  } catch {
    return { error: "Invalid area data." }
  }

  if (!Array.isArray(areas)) return { error: "Invalid area data." }

  const keptKeys = new Set<string>()

  for (const row of areas) {
    if (!isValidKmapFloorKey(row.floor_key)) continue
    const plinth = row.plinth_area != null ? Number(row.plinth_area) : null
    const floor = row.floor_area != null ? Number(row.floor_area) : null
    keptKeys.add(row.floor_key)

    await sql`
      INSERT INTO project_kmap_areas (project_id, floor_key, plinth_area, floor_area)
      VALUES (${projectId}, ${row.floor_key}, ${plinth}, ${floor})
      ON DUPLICATE KEY UPDATE
        plinth_area = ${plinth},
        floor_area = ${floor}
    `
  }

  const existing = (await sql`
    SELECT floor_key FROM project_kmap_areas WHERE project_id = ${projectId}
  `) as { floor_key: string }[]

  for (const row of existing) {
    if (keptKeys.has(row.floor_key)) continue
    await sql`
      DELETE FROM project_kmap_areas
      WHERE project_id = ${projectId} AND floor_key = ${row.floor_key}
    `
  }

  revalidateProjectPaths(projectId)
  return { success: true }
}

export async function updateProjectDrawingNumber(formData: FormData) {
  const user = await requireUser()
  const projectId = Number(formData.get("project_id"))
  const drawingNumber = String(formData.get("drawing_number") || "").trim() || null

  if (!projectId) return { error: "Invalid project." }

  const project = await getProjectOrThrow(projectId)
  const closedError = closedProjectMutationError(user, project)
  if (closedError) return { error: closedError }

  const existingDrawing = project.drawing_number?.trim() || ""
  if (existingDrawing) {
    if ((drawingNumber || "") === existingDrawing) return { success: true }
    return { error: "Drawing number cannot be changed once it has been saved." }
  }

  if (isAdmin(user)) {
    // Admin can set drawing number at any stage (Super Admin when closed)
  } else if (userHasRole(user, "Planning Staff") || user.role === "Planning Staff") {
    try {
      await requireStaffProjectAccess(user, projectId)
    } catch {
      return { error: "You do not have access to edit this project." }
    }
    if (project.section !== "Planning & Design") {
      return { error: "Drawing number can only be updated during Planning & Design." }
    }
  } else {
    return { error: "Only Admin or Planning Staff can update the drawing number." }
  }

  const drawingConflict = await assertDrawingNumberAvailable(drawingNumber, projectId)
  if (drawingConflict) return { error: drawingConflict }

  await sql`
    UPDATE projects SET drawing_number = ${drawingNumber}, updated_at = now()
    WHERE id = ${projectId}
  `
  await logAudit(user.id, "project.update_drawing_number", "project", projectId, {
    drawingNumber,
  })
  revalidateProjectPaths(projectId)
  return { success: true }
}

export async function updateProjectEdgebookNumber(formData: FormData) {
  const user = await requireUser()
  const projectId = Number(formData.get("project_id"))
  const edgebookNumber = String(formData.get("edgebook_number") || "").trim() || null

  if (!projectId) return { error: "Invalid project." }

  const project = await getProjectOrThrow(projectId)
  const closedError = closedProjectMutationError(user, project)
  if (closedError) return { error: closedError }

  if (isAdmin(user)) {
    // Admin can set MBook Number at any stage (Super Admin when closed)
  } else if (userHasRole(user, "Planning Staff") || user.role === "Planning Staff") {
    try {
      await requireStaffProjectAccess(user, projectId)
    } catch {
      return { error: "You do not have access to edit this project." }
    }
  } else {
    return { error: "Only Admin or Planning Staff can update the MBook Number." }
  }

  await sql`
    UPDATE projects SET edgebook_number = ${edgebookNumber}, updated_at = now()
    WHERE id = ${projectId}
  `
  await logAudit(user.id, "project.update_edgebook_number", "project", projectId, {
    edgebookNumber,
  })
  revalidateProjectPaths(projectId)
  return { success: true }
}

export async function setChecklistReviewStatus(formData: FormData) {
  const admin = await requireSuperAdmin()
  const id = Number(formData.get("item_id"))
  const projectId = Number(formData.get("project_id"))
  const reviewStatus = String(formData.get("review_status") || "Pending")
  if (!id || !projectId) return { error: "Invalid item." }

  await sql`UPDATE checklist_items SET review_status = ${reviewStatus} WHERE id = ${id}`
  await logAudit(admin.id, "checklist.review", "project", projectId, { itemId: id, reviewStatus })
  revalidateProjectPaths(projectId)
  return { success: true }
}

// ---------- Files ----------

export async function addProjectFile(formData: FormData) {
  const user = await requireUser()
  const projectId = Number(formData.get("project_id"))
  const name = String(formData.get("name") || "").trim()
  const fileType = String(formData.get("file_type") || "PDF")
  const category = String(formData.get("category") || "Other")
  if (!projectId || !name) return { error: "File name is required." }

  const project = !isAdmin(user)
    ? await requireStaffProjectAccess(user, projectId)
    : await getProjectOrThrow(projectId)
  const closedError = closedProjectMutationError(user, project)
  if (closedError) return { error: closedError }

  await sql`
    INSERT INTO project_files (project_id, name, file_type, category, uploaded_by)
    VALUES (${projectId}, ${name}, ${fileType}, ${category}, ${user.id})
  `
  await logAudit(user.id, "file.add", "project", projectId, { name, fileType, category })
  revalidateProjectPaths(projectId)
  return { success: true }
}

export async function deleteProjectFile(formData: FormData) {
  const user = await requireUser()
  const id = Number(formData.get("file_id"))
  const projectId = Number(formData.get("project_id"))

  const project = !isAdmin(user)
    ? await requireStaffProjectAccess(user, projectId)
    : await getProjectOrThrow(projectId)
  const closedError = closedProjectMutationError(user, project)
  if (closedError) return { error: closedError }

  await sql`DELETE FROM project_files WHERE id = ${id}`
  await logAudit(user.id, "file.delete", "project", projectId, { fileId: id })
  revalidateProjectPaths(projectId)
  return { success: true }
}

// ---------- Payments ----------

async function syncProjectPaymentTotals(projectId: number) {
  const sumRows = (await sql`
    SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE project_id = ${projectId}
  `) as { total: string }[]
  const paid = Number(sumRows[0]?.total ?? 0)

  const rows = (await sql`
    SELECT project_amount FROM projects WHERE id = ${projectId}
  `) as { project_amount: string }[]
  const total = Number(rows[0]?.project_amount ?? 0)
  const payStatus = paid <= 0 ? "Unpaid" : paid >= total && total > 0 ? "Paid" : "Partially Paid"

  await sql`
    UPDATE projects
    SET advance_received = ${paid}, payment_status = ${payStatus}, updated_at = now()
    WHERE id = ${projectId}
  `
}

export async function recordPayment(formData: FormData) {
  const user = await requireBillingAccess()
  const projectId = Number(formData.get("project_id"))
  const amount = Number(formData.get("amount") || 0)
  const method = String(formData.get("method") || "Cash").trim()
  const note = String(formData.get("note") || "").trim() || null
  if (!projectId || amount <= 0) return { error: "Enter a valid amount." }
  if (!PAYMENT_METHODS.includes(method as (typeof PAYMENT_METHODS)[number])) {
    return { error: "Invalid payment method." }
  }

  await sql`
    INSERT INTO payments (project_id, amount, method, note, recorded_by)
    VALUES (${projectId}, ${amount}, ${method}, ${note}, ${user.id})
  `
  await syncProjectPaymentTotals(projectId)

  await logAudit(user.id, "payment.record", "project", projectId, { amount, method })
  revalidateProjectPaths(projectId)
  revalidateBillingPaths()
  return { success: true }
}

export async function updatePayment(formData: FormData) {
  const user = await requireBillingAccess()
  const id = Number(formData.get("id"))
  const amount = Number(formData.get("amount") || 0)
  const method = String(formData.get("method") || "Cash").trim()
  const note = String(formData.get("note") || "").trim() || null

  if (!id) return { error: "Payment is required." }
  if (!Number.isFinite(amount) || amount <= 0) return { error: "Enter a valid amount." }
  if (!PAYMENT_METHODS.includes(method as (typeof PAYMENT_METHODS)[number])) {
    return { error: "Invalid payment method." }
  }

  const existing = (await sql`
    SELECT id, project_id, amount, method, note FROM payments WHERE id = ${id} LIMIT 1
  `) as {
    id: number
    project_id: number
    amount: string
    method: string
    note: string | null
  }[]
  if (!existing.length) return { error: "Payment not found." }

  const projectId = existing[0].project_id

  await sql`
    UPDATE payments
    SET amount = ${amount}, method = ${method}, note = ${note}
    WHERE id = ${id}
  `
  await syncProjectPaymentTotals(projectId)

  await logAudit(user.id, "payment.update", "payment", id, {
    projectId,
    from: {
      amount: existing[0].amount,
      method: existing[0].method,
      note: existing[0].note,
    },
    to: { amount, method, note },
  })
  revalidateProjectPaths(projectId)
  revalidateBillingPaths()
  return { success: true }
}

export async function deletePayment(formData: FormData) {
  const user = await requireBillingAccess()
  const id = Number(formData.get("id"))
  const confirmation = String(formData.get("confirmation") || "").trim()

  if (!id) return { error: "Payment is required." }

  const existing = (await sql`
    SELECT id, project_id, amount, method, note FROM payments WHERE id = ${id} LIMIT 1
  `) as {
    id: number
    project_id: number
    amount: string
    method: string
    note: string | null
  }[]
  if (!existing.length) return { error: "Payment not found." }

  const expected = paymentDeleteConfirmationPhrase(id)
  if (confirmation !== expected) {
    return { error: `Type ${expected} exactly to confirm deletion.` }
  }

  const projectId = existing[0].project_id

  await sql`DELETE FROM payments WHERE id = ${id}`
  await syncProjectPaymentTotals(projectId)

  await logAudit(user.id, "payment.delete", "payment", id, {
    projectId,
    amount: existing[0].amount,
    method: existing[0].method,
    note: existing[0].note,
  })
  revalidateProjectPaths(projectId)
  revalidateBillingPaths()
  return { success: true }
}

// ---------- Notifications ----------

export async function markAllNotificationsRead() {
  const user = await requireUser()
  await sql`UPDATE notifications SET \`read\` = true WHERE user_id = ${user.id}`
  revalidatePath("/staff")
  revalidatePath("/admin")
  revalidatePath("/admin/notifications")
}

export async function markNotificationRead(formData: FormData) {
  const user = await requireUser()
  const id = Number(formData.get("id"))
  await sql`UPDATE notifications SET \`read\` = true WHERE id = ${id} AND user_id = ${user.id}`
  revalidatePath("/staff")
  revalidatePath("/admin")
  revalidatePath("/admin/notifications")
}

// ---------- Invoices ----------

async function nextDocumentInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear()
  const pattern = `INV-${year}-%`
  const rows = (await sql`
    SELECT invoice_number FROM (
      SELECT invoice_number FROM projects WHERE invoice_number LIKE ${pattern}
      UNION ALL
      SELECT invoice_number FROM invoices WHERE invoice_number LIKE ${pattern}
    ) AS nums
    ORDER BY invoice_number DESC LIMIT 1
  `) as { invoice_number: string }[]
  let next = 1
  if (rows[0]?.invoice_number) {
    const parts = rows[0].invoice_number.split("-")
    next = Number.parseInt(parts[2], 10) + 1
  }
  return `INV-${year}-${String(next).padStart(4, "0")}`
}

function parseInvoiceForm(formData: FormData) {
  const lineItems = parseLineItemsJson(String(formData.get("line_items") || "[]"))
  const taxPercent = sanitizeInvoicePercent(String(formData.get("tax_percent") || 0))
  // Line-level discounts are the source of truth; invoice-level % stays at 0.
  const discountPercent = 0
  const totals = calculateInvoiceTotals(lineItems, taxPercent, discountPercent)
  const fields = sanitizeInvoiceFormFields({
    invoiceNumber: String(formData.get("invoice_number") || "").trim(),
    clientName: String(formData.get("client_name") || "").trim(),
    clientAddress: String(formData.get("client_address") || "").trim(),
    clientEmail: String(formData.get("client_email") || "").trim(),
    clientPhone: String(formData.get("client_phone") || "").trim(),
    clientTaxId: String(formData.get("client_tax_id") || "").trim(),
    projectName: String(formData.get("project_name") || "").trim(),
    projectLocation: String(formData.get("project_location") || "").trim(),
    notes: String(formData.get("notes") || "").trim(),
    terms: String(formData.get("terms") || "").trim(),
  })

  return {
    invoiceNumber: fields.invoiceNumber,
    invoiceDate:
      String(formData.get("invoice_date") || "").trim() || new Date().toISOString().slice(0, 10),
    dueDate: String(formData.get("due_date") || "").trim() || null,
    clientName: fields.clientName,
    clientAddress: fields.clientAddress || null,
    clientEmail: fields.clientEmail || null,
    clientPhone: fields.clientPhone || null,
    clientTaxId: fields.clientTaxId || null,
    projectName: fields.projectName || null,
    projectLocation: fields.projectLocation || null,
    notes: fields.notes || null,
    terms: fields.terms || null,
    status: String(formData.get("status") || "Draft").trim() as InvoiceStatus,
    projectId: Number(formData.get("project_id") || 0) || null,
    taxPercent,
    discountPercent,
    totals,
    lineItems,
    storedLineItems: toStoredLineItems(lineItems),
  }
}

export async function createInvoiceFromProject(projectId: number) {
  const user = await requireBillingAccess()
  if (!projectId) return { error: "Invalid project." }

  const projectRows = (await sql`
    SELECT p.*, c.name AS client_name, c.phone AS client_phone, c.email AS client_email, c.address AS client_address
    FROM projects p
    JOIN clients c ON c.id = p.client_id
    WHERE p.id = ${projectId}
    LIMIT 1
  `) as {
    id: number
    name: string
    project_amount: string
    client_name: string
    client_phone: string
    client_email: string | null
    client_address: string | null
  }[]

  const project = projectRows[0]
  if (!project) return { error: "Project not found." }

  const profile = await getOfficeProfile()
  const invoiceNumber = await nextDocumentInvoiceNumber()
  const amount = Number(project.project_amount) || 0
  const today = new Date().toISOString().slice(0, 10)
  const dueDate = new Date()
  dueDate.setDate(dueDate.getDate() + 15)

  const invoiceRows = (await sql`
    INSERT INTO invoices (
      project_id, invoice_number, status, invoice_date, due_date,
      client_name, client_address, client_email, client_phone,
      project_name, notes, terms, subtotal, tax_percent, tax_amount,
      discount_percent, discount_amount, total, amount_paid, balance, created_by
    ) VALUES (
      ${projectId}, ${invoiceNumber}, 'Draft', ${today}, ${dueDate.toISOString().slice(0, 10)},
      ${project.client_name}, ${project.client_address}, ${project.client_email}, ${project.client_phone},
      ${project.name}, NULL, ${profile.termsAndConditions || DEFAULT_INVOICE_TERMS},
      ${amount}, 18, ${amount * 0.18}, 0, 0, ${amount * 1.18}, 0, ${amount * 1.18}, ${user.id}
    )
  `) as { id: number }[]

  const invoiceId = invoiceRows[0].id

  if (amount > 0) {
    await sql`
      INSERT INTO invoice_line_items (
        invoice_id, description, quantity, unit, unit_price,
        discount_amount, discount_percent, amount, sort_order
      )
      VALUES (
        ${invoiceId}, ${`Architectural services — ${project.name}`}, 1, 'Nos', ${amount},
        0, 0, ${amount}, 0
      )
    `
  }

  await logAudit(user.id, "invoice.create", "invoice", invoiceId, { projectId, invoiceNumber })
  revalidateBillingPaths(invoiceId)
  revalidateProjectPaths(projectId)
  return { success: true, invoiceId }
}

export async function saveInvoice(formData: FormData) {
  const user = await requireBillingAccess()
  const id = Number(formData.get("id") || 0)
  const data = parseInvoiceForm(formData)

  if (!data.clientName) return { error: "Client name is required." }
  const formError = validateInvoiceForm({
    invoiceNumber: data.invoiceNumber,
    clientName: data.clientName,
    clientAddress: data.clientAddress ?? "",
    clientEmail: data.clientEmail ?? "",
    clientPhone: data.clientPhone ?? "",
    clientTaxId: data.clientTaxId ?? "",
    projectName: data.projectName ?? "",
    projectLocation: data.projectLocation ?? "",
    notes: data.notes ?? "",
    terms: data.terms ?? "",
  })
  if (formError) return { error: formError }
  const lineItemError = validateInvoiceLineItems(data.lineItems)
  if (lineItemError) return { error: lineItemError }
  if (data.totals.total > INVOICE_LIMITS.maxInvoiceTotal) {
    return {
      error: `Invoice total cannot exceed ₹${INVOICE_LIMITS.maxInvoiceTotal.toLocaleString("en-IN")}.`,
    }
  }
  if (!INVOICE_STATUSES.includes(data.status)) return { error: "Invalid invoice status." }

  const invoiceNumber = data.invoiceNumber || (await nextDocumentInvoiceNumber())

  if (id) {
    await sql`
      UPDATE invoices SET
        project_id       = ${data.projectId},
        invoice_number   = ${invoiceNumber},
        status           = ${data.status},
        invoice_date     = ${data.invoiceDate},
        due_date         = ${data.dueDate},
        client_name      = ${data.clientName},
        client_address   = ${data.clientAddress},
        client_email     = ${data.clientEmail},
        client_phone     = ${data.clientPhone},
        client_tax_id    = ${data.clientTaxId},
        project_name     = ${data.projectName},
        notes            = ${data.notes},
        terms            = ${data.terms},
        subtotal         = ${data.totals.taxableAmount},
        tax_percent      = ${data.taxPercent},
        tax_amount       = ${data.totals.taxAmount},
        discount_percent = ${data.discountPercent},
        discount_amount  = ${data.totals.discountAmount},
        total            = ${data.totals.total},
        balance          = ${data.totals.total} - amount_paid,
        updated_at       = now()
      WHERE id = ${id}
    `
    await sql`DELETE FROM invoice_line_items WHERE invoice_id = ${id}`
    for (const item of data.storedLineItems) {
      await sql`
        INSERT INTO invoice_line_items (
          invoice_id, description, quantity, unit, unit_price,
          discount_amount, discount_percent, amount, sort_order
        )
        VALUES (
          ${id}, ${item.description}, ${item.quantity}, ${item.unit ?? "Nos"}, ${item.unit_price},
          ${item.discount_amount ?? "0"}, ${item.discount_percent ?? "0"}, ${item.amount}, ${item.sort_order ?? 0}
        )
      `
    }
    await logAudit(user.id, "invoice.update", "invoice", id, { invoiceNumber })
    revalidateBillingPaths(id)
    if (data.projectId) revalidateProjectPaths(data.projectId)
    return { success: true, invoiceId: id }
  }

  const rows = (await sql`
    INSERT INTO invoices (
      project_id, invoice_number, status, invoice_date, due_date,
      client_name, client_address, client_email, client_phone, client_tax_id,
      project_name, notes, terms, subtotal, tax_percent, tax_amount,
      discount_percent, discount_amount, total, amount_paid, balance, created_by
    ) VALUES (
      ${data.projectId}, ${invoiceNumber}, ${data.status}, ${data.invoiceDate}, ${data.dueDate},
      ${data.clientName}, ${data.clientAddress}, ${data.clientEmail}, ${data.clientPhone}, ${data.clientTaxId},
      ${data.projectName}, ${data.notes}, ${data.terms || DEFAULT_INVOICE_TERMS},
      ${data.totals.taxableAmount}, ${data.taxPercent}, ${data.totals.taxAmount},
      ${data.discountPercent}, ${data.totals.discountAmount}, ${data.totals.total}, 0, ${data.totals.total}, ${user.id}
    )
  `) as { id: number }[]

  const invoiceId = rows[0].id
  for (const item of data.storedLineItems) {
    await sql`
      INSERT INTO invoice_line_items (
        invoice_id, description, quantity, unit, unit_price,
        discount_amount, discount_percent, amount, sort_order
      )
      VALUES (
        ${invoiceId}, ${item.description}, ${item.quantity}, ${item.unit ?? "Nos"}, ${item.unit_price},
        ${item.discount_amount ?? "0"}, ${item.discount_percent ?? "0"}, ${item.amount}, ${item.sort_order ?? 0}
      )
    `
  }

  await logAudit(user.id, "invoice.create", "invoice", invoiceId, { invoiceNumber })
  revalidateBillingPaths(invoiceId)
  if (data.projectId) revalidateProjectPaths(data.projectId)
  return { success: true, invoiceId }
}

export async function updateInvoiceStatus(formData: FormData) {
  const user = await requireBillingAccess()
  const id = Number(formData.get("id"))
  const status = String(formData.get("status") || "").trim() as InvoiceStatus
  if (!id || !INVOICE_STATUSES.includes(status)) return { error: "Invalid request." }

  await sql`UPDATE invoices SET status = ${status}, updated_at = now() WHERE id = ${id}`
  await logAudit(user.id, "invoice.status", "invoice", id, { status })
  revalidateBillingPaths(id)
  return { success: true }
}

export async function recordInvoicePayment(formData: FormData) {
  const user = await requireBillingAccess()
  const invoiceId = Number(formData.get("invoice_id"))
  const amount = sanitizePaymentAmount(String(formData.get("amount") || 0))
  const method = sanitizeInvoiceText(String(formData.get("method") || "UPI"), 100)
  const paymentDate =
    String(formData.get("payment_date") || "").trim() || new Date().toISOString().slice(0, 10)
  const notes =
    sanitizeInvoiceText(String(formData.get("notes") || ""), INVOICE_LIMITS.maxPaymentNotesLength).trim() || null

  if (!invoiceId || amount < INVOICE_LIMITS.minPaymentAmount) {
    return { error: "Enter a valid payment amount." }
  }

  await sql`
    INSERT INTO invoice_payments (invoice_id, amount, payment_date, method, notes, recorded_by)
    VALUES (${invoiceId}, ${amount}, ${paymentDate}, ${method}, ${notes}, ${user.id})
  `

  const invRows = (await sql`
    SELECT total, amount_paid, project_id FROM invoices WHERE id = ${invoiceId}
  `) as { total: string; amount_paid: string; project_id: number | null }[]
  const inv = invRows[0]
  if (!inv) return { error: "Invoice not found." }

  const newPaid = Number(inv.amount_paid) + amount
  const total = Number(inv.total)
  const balance = Math.max(0, total - newPaid)
  let status: InvoiceStatus = "Pending"
  if (newPaid >= total && total > 0) status = "Paid"
  else if (newPaid > 0) status = "Partially Paid"

  await sql`
    UPDATE invoices
    SET amount_paid = ${newPaid}, balance = ${balance}, status = ${status}, updated_at = now()
    WHERE id = ${invoiceId}
  `

  await logAudit(user.id, "invoice.payment", "invoice", invoiceId, { amount, method })
  revalidateBillingPaths(invoiceId)
  if (inv.project_id) revalidateProjectPaths(inv.project_id)
  return { success: true }
}

export async function deleteInvoicePayment(formData: FormData) {
  const user = await requireBillingAccess()
  const id = Number(formData.get("id"))
  const confirmation = String(formData.get("confirmation") || "").trim()

  if (!id) return { error: "Payment is required." }

  const existing = (await sql`
    SELECT id, invoice_id, amount, method, notes, payment_date
    FROM invoice_payments
    WHERE id = ${id}
    LIMIT 1
  `) as {
    id: number
    invoice_id: number
    amount: string
    method: string
    notes: string | null
    payment_date: string
  }[]
  if (!existing.length) return { error: "Payment not found." }

  const expected = invoicePaymentDeleteConfirmationPhrase(id)
  if (confirmation !== expected) {
    return { error: `Type ${expected} exactly to confirm deletion.` }
  }

  const payment = existing[0]
  const invoiceId = payment.invoice_id
  const amount = Number(payment.amount)

  await sql`DELETE FROM invoice_payments WHERE id = ${id}`

  const invRows = (await sql`
    SELECT total, amount_paid, project_id, status, due_date
    FROM invoices
    WHERE id = ${invoiceId}
  `) as {
    total: string
    amount_paid: string
    project_id: number | null
    status: InvoiceStatus
    due_date: string | null
  }[]
  const inv = invRows[0]
  if (!inv) return { error: "Invoice not found." }

  const newPaid = Math.max(0, Number(inv.amount_paid) - amount)
  const total = Number(inv.total)
  const balance = Math.max(0, total - newPaid)

  let status: InvoiceStatus = inv.status
  if (status !== "Cancelled" && status !== "Draft") {
    if (newPaid >= total && total > 0) status = "Paid"
    else if (newPaid > 0) status = "Partially Paid"
    else if (
      inv.due_date &&
      new Date(inv.due_date) < new Date(new Date().toDateString())
    ) {
      status = "Overdue"
    } else if (status === "Paid" || status === "Partially Paid" || status === "Overdue") {
      status = "Pending"
    }
  }

  await sql`
    UPDATE invoices
    SET amount_paid = ${newPaid}, balance = ${balance}, status = ${status}, updated_at = now()
    WHERE id = ${invoiceId}
  `

  await logAudit(user.id, "invoice.payment.delete", "invoice", invoiceId, {
    paymentId: id,
    amount: payment.amount,
    method: payment.method,
    notes: payment.notes,
    paymentDate: payment.payment_date,
  })
  revalidateBillingPaths(invoiceId)
  if (inv.project_id) revalidateProjectPaths(inv.project_id)
  return { success: true }
}

export async function markInvoiceSent(invoiceId: number) {
  const user = await requireBillingAccess()
  if (!invoiceId) return { error: "Invalid invoice." }

  await sql`
    UPDATE invoices SET status = 'Sent', updated_at = now()
    WHERE id = ${invoiceId} AND status = 'Draft'
  `
  await logAudit(user.id, "invoice.sent", "invoice", invoiceId, {})
  revalidateBillingPaths(invoiceId)
  return { success: true }
}

export async function saveOfficeProfile(formData: FormData) {
  const admin = await requireSuperAdmin()
  const existing = await getOfficeProfile()
  const logoRaw = String(formData.get("logo_data_url") || "").trim()

  let logoDataUrl = existing.logoDataUrl
  if (logoRaw === "") {
    logoDataUrl = null
  } else if (logoRaw !== "__KEEP__") {
    if (logoRaw.startsWith("/") || logoRaw.startsWith("data:")) {
      logoDataUrl = logoRaw
    }
  }

  const profile: OfficeProfile = {
    ...existing,
    companyName: String(formData.get("company_name") || "").trim(),
    address: String(formData.get("address") || "").trim(),
    phone: String(formData.get("phone") || "").trim(),
    email: String(formData.get("email") || "").trim(),
    website: String(formData.get("website") || "").trim(),
    gstNumber: String(formData.get("gst_number") || "").trim(),
    logoDataUrl,
    termsAndConditions:
      String(formData.get("terms_and_conditions") || "").trim() || DEFAULT_INVOICE_TERMS,
    tagline: String(formData.get("tagline") || "").trim() || existing.tagline,
    bankName: String(formData.get("bank_name") || "").trim(),
    accountName: String(formData.get("account_name") || "").trim(),
    accountNumber: String(formData.get("account_number") || "").trim(),
    ifsc: String(formData.get("ifsc") || "").trim(),
    upiId: String(formData.get("upi_id") || "").trim(),
    upiPaymentNumber: String(formData.get("upi_payment_number") || "").trim(),
    upiPaymentApp: parseUpiPaymentApp(formData.get("upi_payment_app")),
    architectName: String(formData.get("architect_name") || "").trim(),
    architectDesignation: String(formData.get("architect_designation") || "").trim(),
  }

  const qrRaw = String(formData.get("qr_code_data_url") || "").trim()
  if (qrRaw === "") {
    profile.qrCodeDataUrl = null
  } else if (qrRaw !== "__KEEP__") {
    if (qrRaw.startsWith("/") || qrRaw.startsWith("data:")) {
      profile.qrCodeDataUrl = qrRaw
    }
  }

  const sigRaw = String(formData.get("signature_data_url") || "").trim()
  if (sigRaw === "") {
    profile.signatureDataUrl = null
  } else if (sigRaw !== "__KEEP__") {
    if (sigRaw.startsWith("/") || sigRaw.startsWith("data:")) {
      profile.signatureDataUrl = sigRaw
    }
  }

  if (!profile.companyName) return { error: "Company name is required." }

  await persistOfficeProfile(profile)

  await logAudit(admin.id, "settings.office_profile", "settings", 0, {
    companyName: profile.companyName,
  })
  revalidatePath("/admin/settings")
  revalidatePath("/admin/invoices")
  return { success: true }
}

export async function updateOwnProfile(formData: FormData) {
  const user = await requireUser()
  if (isOfficeAdmin(user.role)) {
    return { error: "Admins cannot update profile here." }
  }

  const name = String(formData.get("name") || "").trim()
  const email = String(formData.get("email") || "").trim() || null
  const phone = String(formData.get("phone") || "").trim() || null
  const currentPassword = String(formData.get("current_password") || "")
  const newPassword = String(formData.get("new_password") || "")

  if (!name) return { error: "Name is required." }

  const rows = (await sql`
    SELECT password, avatar_url FROM app_users WHERE id = ${user.id} LIMIT 1
  `) as { password: string; avatar_url: string | null }[]
  const stored = rows[0]?.password
  if (!stored) return { error: "Account not found." }

  const avatarResult = await resolveStaffAvatarFromForm(
    formData,
    user.id,
    rows[0].avatar_url ?? null,
  )
  if (avatarResult.error) return { error: avatarResult.error }

  if (newPassword) {
    if (!currentPassword) return { error: "Enter your current password to set a new one." }
    if (newPassword.length < 6) return { error: "New password must be at least 6 characters." }
    const valid = await verifyPassword(currentPassword, stored)
    if (!valid) return { error: "Current password is incorrect." }
    const hash = await hashPassword(newPassword)
    await sql`
      UPDATE app_users
      SET name = ${name}, email = ${email}, phone = ${phone}, password = ${hash},
          avatar_url = ${avatarResult.avatarUrl}
      WHERE id = ${user.id}
    `
  } else {
    await sql`
      UPDATE app_users
      SET name = ${name}, email = ${email}, phone = ${phone},
          avatar_url = ${avatarResult.avatarUrl}
      WHERE id = ${user.id}
    `
  }

  await logAudit(user.id, "profile.update", "user", user.id, {
    name,
    avatar_url: avatarResult.avatarUrl,
  })
  revalidatePath("/staff/profile")
  revalidatePath("/staff")
  return { success: true }
}
