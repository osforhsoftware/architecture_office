"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { sql } from "./db"
import { clearSession, getCurrentUser, setSession } from "./auth"
import {
  allowsMultiAssignee,
  isReviewStep,
  isWorkStep,
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
} from "./workflow-db"
import {
  DEFAULT_INVOICE_TERMS,
  INVOICE_STATUSES,
  KMAP_FLOOR_ROWS,
  RETURN_REASONS,
  SECTION_ROLE,
  STAFF_ROLES,
  ADMIN_ROLE,
  SUPER_ADMIN_ROLE,
  firstStageInSection,
  homePathForRole,
  isOfficeAdmin,
  isPrivilegedRole,
  roleToKey,
  showsResidentialDetails,
  userHasRole,
} from "./constants"
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
import { parseStaffRoles, syncStaffRoles } from "./staff-roles"
import { staffDeleteConfirmationPhrase } from "./staff-utils"
import {
  getProjectOrThrow,
  isAdmin,
  logAudit,
  logAuditForUser,
  requireStaffProjectAccess,
} from "./project-access"
import {
  requireAdminOrSuperAdmin,
  requireBillingAccess,
  requireSuperAdmin,
  requireUser,
} from "./permissions"
import type { AppUser, InvoiceStatus, OfficeProfile } from "./types"
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
    WHERE role IN ('Super Admin', 'Admin') AND active = true
  `) as { id: number }[]
  for (const a of admins) {
    await notify(a.id, type, title, message)
  }
}

export async function loginAction(_prev: unknown, formData: FormData) {
  const loginId = String(formData.get("username") || "").trim()
  const password = String(formData.get("password") || "")

  if (!loginId || !password) {
    return { error: "Please enter your email or username and password." }
  }

  const rows = (await sql`
    SELECT id, username, password, role, name, active FROM app_users
    WHERE username = ${loginId}
       OR (email IS NOT NULL AND LOWER(email) = LOWER(${loginId}))
    LIMIT 1
  `) as (AppUser & { password: string; active: boolean })[]

  const user = rows[0]
  if (!user || !(await verifyPassword(password, user.password))) {
    return { error: "Invalid email/username or password." }
  }

  if (user.active === false) {
    return { error: "This account has been deactivated. Contact your administrator." }
  }

  await setSession(user.id)
  const ip = await clientIpAddress()
  await logAuditForUser(user, "auth.login", "user", user.id, { username: user.username }, ip)
  redirect(homePathForRole(user.role))
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
  const roleKey = roleToKey(role)
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
) {
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

function parseClientAadhaarNumbers(formData: FormData): string[] {
  const raw = String(formData.get("aadhaar_numbers") || "").trim()
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
    aadhaarNumbers: parseClientAadhaarNumbers(formData),
  }
}

export async function createClient(formData: FormData) {
  const admin = await requireSuperAdmin()
  const name = String(formData.get("name") || "").trim()
  const phone = String(formData.get("phone") || "").trim()
  const email = String(formData.get("email") || "").trim() || null
  const address = String(formData.get("address") || "").trim() || null
  const { street, district, aadhaarNumbers } = parseClientAddressFields(formData)

  if (!name || !phone) return { error: "Name and phone are required." }

  const existing = (await sql`SELECT id FROM clients WHERE phone = ${phone} LIMIT 1`) as {
    id: number
  }[]
  if (existing.length) return { error: "A client with this phone already exists." }

  // RETURNING removed — wrapper returns [{ id: lastInsertId }] automatically
  const rows = (await sql`
    INSERT INTO clients (name, phone, email, address, street, district, aadhaar_numbers)
    VALUES (${name}, ${phone}, ${email}, ${address}, ${street}, ${district}, ${sql.json(aadhaarNumbers)})
  `) as { id: number }[]

  await logAudit(admin.id, "client.create", "client", rows[0].id, { name, phone })
  revalidateClientPaths(rows[0].id)
  return { success: true, clientId: rows[0].id }
}

export async function updateClient(formData: FormData) {
  const admin = await requireSuperAdmin()
  const id = Number(formData.get("id"))
  const name = String(formData.get("name") || "").trim()
  const phone = String(formData.get("phone") || "").trim()
  const email = String(formData.get("email") || "").trim() || null
  const address = String(formData.get("address") || "").trim() || null
  const { street, district, aadhaarNumbers } = parseClientAddressFields(formData)

  if (!id || !name || !phone) return { error: "Name and phone are required." }

  await sql`
    UPDATE clients SET
      name = ${name},
      phone = ${phone},
      email = ${email},
      address = ${address},
      street = ${street},
      district = ${district},
      aadhaar_numbers = ${sql.json(aadhaarNumbers)}
    WHERE id = ${id}
  `
  await logAudit(admin.id, "client.update", "client", id, { name })
  revalidateClientPaths(id)
  return { success: true }
}

export async function registerClientWithProject(formData: FormData) {
  const admin = await requireSuperAdmin()
  const clientName = String(formData.get("client_name") || "").trim()
  const projectName = String(formData.get("project_name") || "").trim()
  const phone = String(formData.get("phone") || "").trim()
  const email = String(formData.get("email") || "").trim() || null
  const address = String(formData.get("address") || "").trim() || null
  const { street, district, aadhaarNumbers } = parseClientAddressFields(formData)

  if (!clientName || !phone) return { error: "Client name and phone are required." }
  if (!projectName) return { error: "Project name is required." }

  const existing = (await sql`SELECT id FROM clients WHERE phone = ${phone} LIMIT 1`) as {
    id: number
  }[]
  if (existing.length) return { error: "A client with this phone already exists." }

  const clientRows = (await sql`
    INSERT INTO clients (name, phone, email, address, street, district, aadhaar_numbers)
    VALUES (${clientName}, ${phone}, ${email}, ${address}, ${street}, ${district}, ${sql.json(aadhaarNumbers)})
  `) as { id: number }[]

  const clientId = clientRows[0].id
  formData.set("client_id", String(clientId))
  formData.set("name", projectName)

  const projectRes = await createProject(formData)
  if (projectRes?.error) return projectRes

  await logAudit(admin.id, "client.register_with_project", "project", projectRes.projectId!, {
    clientId,
  })
  revalidateClientPaths(clientId)
  return { success: true, clientId, projectId: projectRes.projectId }
}

// ---------- Staff ----------

function parseStaffActive(formData: FormData): boolean {
  const value = formData.get("active")
  return value === "on" || value === "true"
}

function isValidStaffRole(role: string): role is (typeof STAFF_ROLES)[number] {
  return (STAFF_ROLES as readonly string[]).includes(role)
}

export async function createStaff(formData: FormData) {
  const admin = await requireAdminOrSuperAdmin()
  const name = String(formData.get("name") || "").trim()
  const username = String(formData.get("username") || "").trim()
  const password = String(formData.get("password") || "")
  const roles = parseStaffRoles(formData)
  const legacyRole = String(formData.get("role") || "").trim()
  if (!roles.length && isValidStaffRole(legacyRole)) {
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
  if (roles.some((role) => !isValidStaffRole(role))) return { error: "Invalid staff role." }

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

  await logAudit(admin.id, "staff.create", "user", staffId, {
    name,
    username,
    role: primaryRole,
    roles,
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
  const roles = parseStaffRoles(formData)
  const legacyRole = String(formData.get("role") || "").trim()
  if (!roles.length && isValidStaffRole(legacyRole)) roles.push(legacyRole)
  const email = String(formData.get("email") || "").trim() || null
  const phone = String(formData.get("phone") || "").trim() || null
  const active = parseStaffActive(formData)

  if (!id || !name || !username || !roles.length) {
    return { error: "Name, username, and at least one department role are required." }
  }
  if (/\s/.test(username)) return { error: "Username cannot contain spaces." }
  if (password && password.length < 6) return { error: "Password must be at least 6 characters." }
  if (roles.some((role) => !isValidStaffRole(role))) return { error: "Invalid staff role." }
  if (id === admin.id && !active) {
    return { error: "You cannot deactivate your own account." }
  }

  const primaryRole = roles[0]

  const current = (await sql`
    SELECT id, role, password FROM app_users WHERE id = ${id} LIMIT 1
  `) as { id: number; role: string; password: string }[]
  if (!current.length) return { error: "Staff member not found." }
  if (isPrivilegedRole(current[0].role)) {
    return { error: "Admin accounts cannot be edited here. Use Admin Management." }
  }

  const duplicate = (await sql`
    SELECT id FROM app_users WHERE username = ${username} AND id <> ${id} LIMIT 1
  `) as { id: number }[]
  if (duplicate.length) return { error: "A user with this username already exists." }

  const hash = password ? await hashPassword(password) : current[0].password

  await sql`
    UPDATE app_users
    SET username = ${username}, password = ${hash}, role = ${primaryRole}, name = ${name},
        email = ${email}, phone = ${phone}, active = ${active}
    WHERE id = ${id}
  `
  await syncStaffRoles(id, roles)

  await logAudit(admin.id, "staff.update", "user", id, {
    name,
    username,
    role: primaryRole,
    roles,
    active,
  })
  revalidatePath("/admin/staff")
  revalidatePath("/admin/departments")
  revalidatePath("/admin/projects")
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

// ---------- Admin account management (Super Admin only) ----------

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
  if (current[0].role === SUPER_ADMIN_ROLE && !active) {
    return { error: "Super Admin accounts cannot be deactivated here." }
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
  await requireAdminOrSuperAdmin()
  const name = String(formData.get("name") || "").trim()
  const clientId = Number(formData.get("client_id"))
  const location = String(formData.get("location") || "").trim() || null
  const type = String(formData.get("type") || "").trim() || null
  const priority = String(formData.get("priority") || "Medium")
  const dueDate = String(formData.get("due_date") || "") || null
  const amount = Number(formData.get("project_amount") || 0)
  const drawingNumber = String(formData.get("drawing_number") || "").trim() || null
  const projectPackage = (String(formData.get("project_package") || "full") as ProjectPackage)
  const residential = parseResidentialDetails(formData, type)
  const selectedServices = parseSelectedServices(formData, projectPackage)

  if (!name || !clientId) return { error: "Project name and client are required." }
  if (
    !selectedServices.length &&
    !residential.reqArchitecturalPlan &&
    !residential.reqBuildingPermit &&
    !residential.reqRegularization
  ) {
    return { error: "Select at least one project service." }
  }

  const code = await nextProjectCode()
  const invoice = await nextInvoiceNumber()

  const rows = (await sql`
    INSERT INTO projects (
      code, name, client_id, location, type, priority, status, section, current_stage,
      due_date, project_amount, invoice_number, project_package,
      building_number, building_permit_number, drawing_number,
      req_architectural_plan, req_building_permit, req_regularization
    )
    VALUES (
      ${code}, ${name}, ${clientId}, ${location}, ${type}, ${priority}, 'Awaiting Assignment', 'Planning & Design', 0,
      ${dueDate}, ${amount}, ${invoice}, ${projectPackage},
      ${residential.buildingNumber}, ${residential.buildingPermitNumber}, ${drawingNumber},
      ${residential.reqArchitecturalPlan}, ${residential.reqBuildingPermit}, ${residential.reqRegularization}
    )
  `) as { id: number }[]

  const projectId = rows[0].id
  await seedProjectWorkflow(projectId, selectedServices)

  for (const floor of KMAP_FLOOR_ROWS) {
    await sql`
      INSERT IGNORE INTO project_kmap_areas (project_id, floor_key)
      VALUES (${projectId}, ${floor.key})
    `
  }
  await appendStatus(projectId, "New", "Project created", "Office Admin")
  await appendStatus(projectId, "Awaiting Assignment", "Workflow generated from selected services", "Office Admin")
  revalidateProjectPaths(projectId)
  return { success: true, projectId }
}

export async function updateProjectDetails(formData: FormData) {
  await requireSuperAdmin()
  const id = Number(formData.get("id"))
  const name = String(formData.get("name") || "").trim()
  const location = String(formData.get("location") || "").trim() || null
  const type = String(formData.get("type") || "").trim() || null
  const priority = String(formData.get("priority") || "Medium")
  const dueDate = String(formData.get("due_date") || "") || null
  const amount = Number(formData.get("project_amount") || 0)
  const drawingNumber = String(formData.get("drawing_number") || "").trim() || null
  const residential = parseResidentialDetails(formData, type)

  if (!id || !name) return { error: "Project name is required." }

  await sql`
    UPDATE projects
    SET name = ${name}, location = ${location}, type = ${type}, priority = ${priority},
        due_date = ${dueDate}, project_amount = ${amount},
        building_number = ${residential.buildingNumber},
        building_permit_number = ${residential.buildingPermitNumber},
        drawing_number = ${drawingNumber},
        req_architectural_plan = ${residential.reqArchitecturalPlan},
        req_building_permit = ${residential.reqBuildingPermit},
        req_regularization = ${residential.reqRegularization},
        updated_at = now()
    WHERE id = ${id}
  `
  revalidateProjectPaths(id)
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

  const stage = firstStageInSection(section)
  let staffId = assignee

  if (!staffId && SECTION_ROLE[section]) {
    const role = SECTION_ROLE[section]
    const roleKey = roleToKey(role)
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
  } else if (SECTION_ROLE[section]) {
    await notifyRole(SECTION_ROLE[section], "Department queue updated", `Project moved to ${section}`)
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
  const role = roleForStep(following)
  if (!assignees.length && role) {
    const roleKey = roleToKey(role)
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

  if (!isAdmin(user)) {
    await requireStaffProjectAccess(user, projectId)
  }

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

  if (!isAdmin(user)) {
    await requireStaffProjectAccess(user, projectId)
  }

  await sql`UPDATE checklist_items SET filed = ${filed}, checked = ${filed} WHERE id = ${id}`
  revalidateProjectPaths(projectId)
  return { success: true }
}

export async function updateProjectKmapAreas(formData: FormData) {
  const user = await requireUser()
  const projectId = Number(formData.get("project_id"))
  if (!projectId) return { error: "Invalid project." }

  if (!isAdmin(user)) {
    await requireStaffProjectAccess(user, projectId)
  }

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

  const allowedKeys = new Set<string>(KMAP_FLOOR_ROWS.map((f) => f.key))
  for (const row of areas) {
    if (!allowedKeys.has(row.floor_key)) continue
    const plinth = row.plinth_area != null ? Number(row.plinth_area) : null
    const floor = row.floor_area != null ? Number(row.floor_area) : null

    await sql`
      UPDATE project_kmap_areas
      SET plinth_area = ${plinth}, floor_area = ${floor}
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

  if (isAdmin(user)) {
    // Admin can set drawing number at any stage
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

  if (!isAdmin(user)) {
    await requireStaffProjectAccess(user, projectId)
  }

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

  if (!isAdmin(user)) {
    await requireStaffProjectAccess(user, projectId)
  }

  await sql`DELETE FROM project_files WHERE id = ${id}`
  await logAudit(user.id, "file.delete", "project", projectId, { fileId: id })
  revalidateProjectPaths(projectId)
  return { success: true }
}

// ---------- Payments ----------

export async function recordPayment(formData: FormData) {
  const user = await requireBillingAccess()
  const projectId = Number(formData.get("project_id"))
  const amount = Number(formData.get("amount") || 0)
  const method = String(formData.get("method") || "Cash")
  const note = String(formData.get("note") || "").trim() || null
  if (!projectId || amount <= 0) return { error: "Enter a valid amount." }

  await sql`
    INSERT INTO payments (project_id, amount, method, note, recorded_by)
    VALUES (${projectId}, ${amount}, ${method}, ${note}, ${user.id})
  `
  await sql`
    UPDATE projects SET advance_received = advance_received + ${amount}, updated_at = now()
    WHERE id = ${projectId}
  `

  const rows = (await sql`
    SELECT project_amount, advance_received FROM projects WHERE id = ${projectId}
  `) as { project_amount: string; advance_received: string }[]
  const total = Number(rows[0]?.project_amount ?? 0)
  const paid = Number(rows[0]?.advance_received ?? 0)
  const payStatus = paid <= 0 ? "Unpaid" : paid >= total && total > 0 ? "Paid" : "Partially Paid"
  await sql`UPDATE projects SET payment_status = ${payStatus} WHERE id = ${projectId}`

  await logAudit(user.id, "payment.record", "project", projectId, { amount, method })
  revalidateProjectPaths(projectId)
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
  const discountPercent = sanitizeInvoicePercent(String(formData.get("discount_percent") || 0))
  const totals = calculateInvoiceTotals(lineItems, taxPercent, discountPercent)
  const fields = sanitizeInvoiceFormFields({
    invoiceNumber: String(formData.get("invoice_number") || "").trim(),
    clientName: String(formData.get("client_name") || "").trim(),
    clientAddress: String(formData.get("client_address") || "").trim(),
    clientEmail: String(formData.get("client_email") || "").trim(),
    clientPhone: String(formData.get("client_phone") || "").trim(),
    clientTaxId: String(formData.get("client_tax_id") || "").trim(),
    projectName: String(formData.get("project_name") || "").trim(),
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
      INSERT INTO invoice_line_items (invoice_id, description, quantity, unit, unit_price, amount, sort_order)
      VALUES (${invoiceId}, ${`Architectural services — ${project.name}`}, 1, 'Nos', ${amount}, ${amount}, 0)
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
        subtotal         = ${data.totals.subtotal},
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
        INSERT INTO invoice_line_items (invoice_id, description, quantity, unit, unit_price, amount, sort_order)
        VALUES (${id}, ${item.description}, ${item.quantity}, ${item.unit ?? "Nos"}, ${item.unit_price}, ${item.amount}, ${item.sort_order ?? 0})
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
      ${data.totals.subtotal}, ${data.taxPercent}, ${data.totals.taxAmount},
      ${data.discountPercent}, ${data.totals.discountAmount}, ${data.totals.total}, 0, ${data.totals.total}, ${user.id}
    )
  `) as { id: number }[]

  const invoiceId = rows[0].id
  for (const item of data.storedLineItems) {
    await sql`
      INSERT INTO invoice_line_items (invoice_id, description, quantity, unit, unit_price, amount, sort_order)
      VALUES (${invoiceId}, ${item.description}, ${item.quantity}, ${item.unit ?? "Nos"}, ${item.unit_price}, ${item.amount}, ${item.sort_order ?? 0})
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
    SELECT password FROM app_users WHERE id = ${user.id} LIMIT 1
  `) as { password: string }[]
  const stored = rows[0]?.password
  if (!stored) return { error: "Account not found." }

  if (newPassword) {
    if (!currentPassword) return { error: "Enter your current password to set a new one." }
    if (newPassword.length < 6) return { error: "New password must be at least 6 characters." }
    const valid = await verifyPassword(currentPassword, stored)
    if (!valid) return { error: "Current password is incorrect." }
    const hash = await hashPassword(newPassword)
    await sql`
      UPDATE app_users
      SET name = ${name}, email = ${email}, phone = ${phone}, password = ${hash}
      WHERE id = ${user.id}
    `
  } else {
    await sql`
      UPDATE app_users
      SET name = ${name}, email = ${email}, phone = ${phone}
      WHERE id = ${user.id}
    `
  }

  await logAudit(user.id, "profile.update", "user", user.id, { name })
  revalidatePath("/staff/profile")
  revalidatePath("/staff")
  return { success: true }
}
