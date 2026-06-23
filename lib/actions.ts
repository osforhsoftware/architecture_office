"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { sql } from "./db"
import { clearSession, getCurrentUser, setSession } from "./auth"
import {
  CHECKLIST_ITEMS,
  DEFAULT_INVOICE_TERMS,
  INVOICE_STATUSES,
  RETURN_REASONS,
  SECTION_ROLE,
  STAFF_ROLES,
  WORKFLOW_STAGES,
  firstStageInSection,
  lastStageInSection,
  nextSection,
  sectionForStage,
  canAccessBilling,
  homePathForRole,
} from "./constants"
import { hashPassword, verifyPassword } from "./password"
import {
  calculateInvoiceTotals,
  INVOICE_LIMITS,
  parseLineItemsJson,
  toStoredLineItems,
  validateInvoiceLineItems,
} from "./invoice-utils"
import { getOfficeProfile, persistOfficeProfile } from "./queries"
import { staffDeleteConfirmationPhrase } from "./staff-utils"
import {
  getProjectOrThrow,
  isAdmin,
  logAudit,
  requireStaffProjectAccess,
  staffOwnsProject,
} from "./project-access"
import type { AppUser, InvoiceStatus, OfficeProfile } from "./types"

// ---------- Auth ----------

export async function loginAction(_prev: unknown, formData: FormData) {
  const username = String(formData.get("username") || "").trim()
  const password = String(formData.get("password") || "")

  if (!username || !password) {
    return { error: "Please enter username and password." }
  }

  const rows = (await sql`
    SELECT id, username, password, role, name, active FROM app_users
    WHERE username = ${username} LIMIT 1
  `) as (AppUser & { password: string; active: boolean })[]

  const user = rows[0]
  if (!user || !(await verifyPassword(password, user.password))) {
    return { error: "Invalid username or password." }
  }

  if (user.active === false) {
    return { error: "This account has been deactivated. Contact your administrator." }
  }

  await setSession(user.id)
  redirect(homePathForRole(user.role))
}

export async function logoutAction() {
  await clearSession()
  redirect("/login")
}

async function requireAdmin(): Promise<AppUser> {
  const user = await getCurrentUser()
  if (!user || user.role !== "Admin") {
    throw new Error("Unauthorized")
  }
  return user
}

async function requireBillingAccess(): Promise<AppUser> {
  const user = await getCurrentUser()
  if (!user || !canAccessBilling(user.role)) {
    throw new Error("Unauthorized")
  }
  return user
}

async function requireUser(): Promise<AppUser> {
  const user = await getCurrentUser()
  if (!user) throw new Error("Unauthorized")
  return user
}

async function notify(userId: number, type: string, title: string, message: string) {
  await sql`
    INSERT INTO notifications (user_id, type, title, message)
    VALUES (${userId}, ${type}, ${title}, ${message})
  `
}

async function notifyRole(role: string, title: string, message: string) {
  const staff = (await sql`
    SELECT id FROM app_users WHERE role = ${role} AND active = true
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

export async function createClient(formData: FormData) {
  const admin = await requireAdmin()
  const name = String(formData.get("name") || "").trim()
  const phone = String(formData.get("phone") || "").trim()
  const email = String(formData.get("email") || "").trim() || null
  const address = String(formData.get("address") || "").trim() || null

  if (!name || !phone) return { error: "Name and phone are required." }

  const existing = (await sql`SELECT id FROM clients WHERE phone = ${phone} LIMIT 1`) as {
    id: number
  }[]
  if (existing.length) return { error: "A client with this phone already exists." }

  // RETURNING removed — wrapper returns [{ id: lastInsertId }] automatically
  const rows = (await sql`
    INSERT INTO clients (name, phone, email, address)
    VALUES (${name}, ${phone}, ${email}, ${address})
  `) as { id: number }[]

  await logAudit(admin.id, "client.create", "client", rows[0].id, { name, phone })
  revalidateClientPaths(rows[0].id)
  return { success: true, clientId: rows[0].id }
}

export async function updateClient(formData: FormData) {
  const admin = await requireAdmin()
  const id = Number(formData.get("id"))
  const name = String(formData.get("name") || "").trim()
  const phone = String(formData.get("phone") || "").trim()
  const email = String(formData.get("email") || "").trim() || null
  const address = String(formData.get("address") || "").trim() || null

  if (!id || !name || !phone) return { error: "Name and phone are required." }

  await sql`
    UPDATE clients SET name = ${name}, phone = ${phone}, email = ${email}, address = ${address}
    WHERE id = ${id}
  `
  await logAudit(admin.id, "client.update", "client", id, { name })
  revalidateClientPaths(id)
  return { success: true }
}

export async function registerClientWithProject(formData: FormData) {
  const admin = await requireAdmin()
  const clientName = String(formData.get("client_name") || "").trim()
  const projectName = String(formData.get("project_name") || "").trim()
  const phone = String(formData.get("phone") || "").trim()
  const email = String(formData.get("email") || "").trim() || null
  const address = String(formData.get("address") || "").trim() || null

  if (!clientName || !phone) return { error: "Client name and phone are required." }
  if (!projectName) return { error: "Project name is required." }

  const existing = (await sql`SELECT id FROM clients WHERE phone = ${phone} LIMIT 1`) as {
    id: number
  }[]
  if (existing.length) return { error: "A client with this phone already exists." }

  const clientRows = (await sql`
    INSERT INTO clients (name, phone, email, address)
    VALUES (${clientName}, ${phone}, ${email}, ${address})
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
  const admin = await requireAdmin()
  const name = String(formData.get("name") || "").trim()
  const username = String(formData.get("username") || "").trim()
  const password = String(formData.get("password") || "")
  const role = String(formData.get("role") || "").trim()
  const email = String(formData.get("email") || "").trim() || null
  const phone = String(formData.get("phone") || "").trim() || null
  const active = parseStaffActive(formData)

  if (!name || !username || !password || !role) {
    return { error: "Name, username, password, and role are required." }
  }
  if (/\s/.test(username)) return { error: "Username cannot contain spaces." }
  if (password.length < 6) return { error: "Password must be at least 6 characters." }
  if (!isValidStaffRole(role)) return { error: "Invalid staff role." }

  const existing = (await sql`
    SELECT id FROM app_users WHERE username = ${username} LIMIT 1
  `) as { id: number }[]
  if (existing.length) return { error: "A user with this username already exists." }

  const hash = await hashPassword(password)
  const rows = (await sql`
    INSERT INTO app_users (username, password, role, name, email, phone, active)
    VALUES (${username}, ${hash}, ${role}, ${name}, ${email}, ${phone}, ${active})
  `) as { id: number }[]

  await logAudit(admin.id, "staff.create", "user", rows[0].id, { name, username, role })
  revalidatePath("/admin/staff")
  revalidatePath("/admin/departments")
  revalidatePath("/admin/projects")
  return { success: true, staffId: rows[0].id }
}

export async function updateStaff(formData: FormData) {
  const admin = await requireAdmin()
  const id = Number(formData.get("id"))
  const name = String(formData.get("name") || "").trim()
  const username = String(formData.get("username") || "").trim()
  const password = String(formData.get("password") || "")
  const role = String(formData.get("role") || "").trim()
  const email = String(formData.get("email") || "").trim() || null
  const phone = String(formData.get("phone") || "").trim() || null
  const active = parseStaffActive(formData)

  if (!id || !name || !username || !role) {
    return { error: "Name, username, and role are required." }
  }
  if (/\s/.test(username)) return { error: "Username cannot contain spaces." }
  if (password && password.length < 6) return { error: "Password must be at least 6 characters." }
  if (!isValidStaffRole(role)) return { error: "Invalid staff role." }
  if (id === admin.id && !active) {
    return { error: "You cannot deactivate your own account." }
  }

  const current = (await sql`
    SELECT id, role, password FROM app_users WHERE id = ${id} LIMIT 1
  `) as { id: number; role: string; password: string }[]
  if (!current.length) return { error: "Staff member not found." }
  if (current[0].role === "Admin") return { error: "Admin accounts cannot be edited here." }

  const duplicate = (await sql`
    SELECT id FROM app_users WHERE username = ${username} AND id <> ${id} LIMIT 1
  `) as { id: number }[]
  if (duplicate.length) return { error: "A user with this username already exists." }

  const hash = password ? await hashPassword(password) : current[0].password

  await sql`
    UPDATE app_users
    SET username = ${username}, password = ${hash}, role = ${role}, name = ${name},
        email = ${email}, phone = ${phone}, active = ${active}
    WHERE id = ${id}
  `

  await logAudit(admin.id, "staff.update", "user", id, { name, username, role, active })
  revalidatePath("/admin/staff")
  revalidatePath("/admin/departments")
  revalidatePath("/admin/projects")
  return { success: true }
}

export async function deleteStaff(formData: FormData) {
  const admin = await requireAdmin()
  const id = Number(formData.get("id"))
  const confirmation = String(formData.get("confirmation") || "").trim()

  if (!id) return { error: "Staff member is required." }

  const current = (await sql`
    SELECT id, username, role, name FROM app_users WHERE id = ${id} LIMIT 1
  `) as { id: number; username: string; role: string; name: string }[]
  if (!current.length) return { error: "Staff member not found." }
  if (current[0].role === "Admin") return { error: "Admin accounts cannot be removed here." }
  if (id === admin.id) return { error: "You cannot remove your own account." }

  const expected = staffDeleteConfirmationPhrase(current[0].username)
  if (confirmation !== expected) {
    return { error: `Type ${expected} exactly to confirm removal.` }
  }

  await sql`UPDATE projects SET assigned_to = NULL WHERE assigned_to = ${id}`
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

export async function createProject(formData: FormData) {
  await requireAdmin()
  const name = String(formData.get("name") || "").trim()
  const clientId = Number(formData.get("client_id"))
  const location = String(formData.get("location") || "").trim() || null
  const type = String(formData.get("type") || "").trim() || null
  const priority = String(formData.get("priority") || "Medium")
  const dueDate = String(formData.get("due_date") || "") || null
  const amount = Number(formData.get("project_amount") || 0)

  if (!name || !clientId) return { error: "Project name and client are required." }

  const code = await nextProjectCode()
  const invoice = await nextInvoiceNumber()

  const rows = (await sql`
    INSERT INTO projects (code, name, client_id, location, type, priority, status, section, current_stage, due_date, project_amount, invoice_number)
    VALUES (${code}, ${name}, ${clientId}, ${location}, ${type}, ${priority}, 'New', 'Planning & Design', 0, ${dueDate}, ${amount}, ${invoice})
  `) as { id: number }[]

  const projectId = rows[0].id
  for (const item of CHECKLIST_ITEMS) {
    // INSERT IGNORE skips the row when (project_id, item_key) already exists
    await sql`
      INSERT IGNORE INTO checklist_items (project_id, item_key, checked, review_status)
      VALUES (${projectId}, ${item}, false, 'Pending')
    `
  }
  await appendStatus(projectId, "New", "Project created", "Office Admin")
  revalidateProjectPaths(projectId)
  return { success: true, projectId }
}

export async function updateProjectDetails(formData: FormData) {
  await requireAdmin()
  const id = Number(formData.get("id"))
  const name = String(formData.get("name") || "").trim()
  const location = String(formData.get("location") || "").trim() || null
  const type = String(formData.get("type") || "").trim() || null
  const priority = String(formData.get("priority") || "Medium")
  const dueDate = String(formData.get("due_date") || "") || null
  const amount = Number(formData.get("project_amount") || 0)

  if (!id || !name) return { error: "Project name is required." }

  await sql`
    UPDATE projects
    SET name = ${name}, location = ${location}, type = ${type}, priority = ${priority},
        due_date = ${dueDate}, project_amount = ${amount}, updated_at = now()
    WHERE id = ${id}
  `
  revalidateProjectPaths(id)
  return { success: true }
}

export async function assignProject(formData: FormData) {
  const admin = await requireAdmin()
  const id = Number(formData.get("project_id"))
  const assignee = Number(formData.get("assigned_to"))
  if (!id || !assignee) return { error: "Select a staff member." }

  const project = await getProjectOrThrow(id)
  await sql`
    UPDATE projects SET assigned_to = ${assignee}, status = 'Assigned', updated_at = now()
    WHERE id = ${id}
  `
  await appendStatus(id, "Assigned", `Assigned to staff in ${project.section}`, admin.name)
  await notify(
    assignee,
    "Project Assigned",
    "New project assigned",
    `You have been assigned to ${project.name}.`,
  )
  await logAudit(admin.id, "project.assign", "project", id, { assignee })
  revalidateProjectPaths(id)
  return { success: true }
}

export async function assignToDepartment(formData: FormData) {
  const admin = await requireAdmin()
  const id = Number(formData.get("project_id"))
  const section = String(formData.get("section") || "")
  const assignee = Number(formData.get("assigned_to")) || null

  if (!id || !section) return { error: "Select a department." }

  const stage = firstStageInSection(section)
  let staffId = assignee

  if (!staffId && SECTION_ROLE[section]) {
    const staff = (await sql`
      SELECT id FROM app_users WHERE role = ${SECTION_ROLE[section]} ORDER BY id LIMIT 1
    `) as { id: number }[]
    staffId = staff[0]?.id ?? null
  }

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

export async function advanceStage(formData: FormData) {
  const user = await requireUser()
  const id = Number(formData.get("project_id"))
  if (!id) return { error: "Invalid project." }

  const project = isAdmin(user)
    ? await getProjectOrThrow(id)
    : await requireStaffProjectAccess(user, id)

  if (project.section === "Billing") {
    return { error: "Work stages are complete. Awaiting billing and closure." }
  }

  const current = project.current_stage
  const sectionLast = lastStageInSection(project.section)
  if (current >= sectionLast) {
    return { error: "Section work complete. Submit for admin review." }
  }

  const nextStage = current + 1
  const newStatus = "In Progress"
  const stageLabel = WORKFLOW_STAGES[nextStage]?.label ?? "next stage"

  await sql`
    UPDATE projects
    SET current_stage = ${nextStage}, status = ${newStatus}, updated_at = now()
    WHERE id = ${id}
  `
  await appendStatus(id, newStatus, `Advanced to ${stageLabel}`, user.name)
  await logAudit(user.id, "project.advance_stage", "project", id, { stage: nextStage })
  revalidateProjectPaths(id)
  return { success: true }
}

export async function submitForReview(formData: FormData) {
  const user = await requireUser()
  const id = Number(formData.get("project_id"))
  const note = String(formData.get("note") || "").trim() || null
  if (!id) return { error: "Invalid project." }

  const project = isAdmin(user)
    ? await getProjectOrThrow(id)
    : await requireStaffProjectAccess(user, id)

  const sectionLast = lastStageInSection(project.section)
  if (project.current_stage < sectionLast && project.section !== "Billing") {
    return { error: "Complete all stages in this section before submitting for review." }
  }

  await sql`
    UPDATE projects SET status = 'Pending Review', review_note = ${note}, updated_at = now()
    WHERE id = ${id}
  `
  await appendStatus(id, "Pending Review", note ?? `Submitted from ${project.section}`, user.name)

  const admins = (await sql`SELECT id FROM app_users WHERE role = 'Admin'`) as { id: number }[]
  for (const a of admins) {
    await notify(
      a.id,
      "Review Required",
      "Project awaiting admin review",
      `${project.name} (${project.section}) needs your approval.`,
    )
  }
  await logAudit(user.id, "project.submit_review", "project", id, { section: project.section })
  revalidateProjectPaths(id)
  return { success: true }
}

export async function approveSectionReview(formData: FormData) {
  const admin = await requireAdmin()
  const id = Number(formData.get("project_id"))
  const assignee = Number(formData.get("assigned_to")) || null
  const note = String(formData.get("note") || "").trim() || "Admin approved section work"

  if (!id) return { error: "Invalid project." }
  const project = await getProjectOrThrow(id)
  if (project.status !== "Pending Review") {
    return { error: "Project is not pending review." }
  }

  const following = nextSection(project.section)
  if (!following) {
    return { error: "No next section. Use close project instead." }
  }

  const stage = following === "Billing" ? project.current_stage : firstStageInSection(following)
  let staffId = assignee
  const role = SECTION_ROLE[following]

  if (!staffId && role) {
    const staff = (await sql`SELECT id FROM app_users WHERE role = ${role} ORDER BY id LIMIT 1`) as {
      id: number
    }[]
    staffId = staff[0]?.id ?? null
  }

  const newStatus = following === "Billing" ? "Assigned" : staffId ? "Assigned" : "New"

  await sql`
    UPDATE projects
    SET section = ${following}, current_stage = ${stage}, assigned_to = ${staffId},
        status = ${newStatus}, review_note = NULL, updated_at = now()
    WHERE id = ${id}
  `
  await appendStatus(id, newStatus, `${note}. Forwarded to ${following}`, admin.name)

  if (staffId) {
    await notify(staffId, "Section Handoff", "Project approved and assigned", project.name)
  } else if (role) {
    await notifyRole(role, "Department queue updated", `${project.name} is ready in ${following}`)
  }

  await logAudit(admin.id, "project.approve_review", "project", id, { nextSection: following })
  revalidateProjectPaths(id)
  return { success: true }
}

export async function rejectReview(formData: FormData) {
  const admin = await requireAdmin()
  const id = Number(formData.get("project_id"))
  const note = String(formData.get("note") || "").trim()
  if (!id || !note) return { error: "Provide feedback for correction." }

  const project = await getProjectOrThrow(id)
  await sql`
    UPDATE projects SET status = 'Correction Required', review_note = ${note}, updated_at = now()
    WHERE id = ${id}
  `
  await appendStatus(id, "Correction Required", note, admin.name)

  if (project.assigned_to) {
    await notify(
      project.assigned_to,
      "Correction Required",
      "Admin requested changes",
      `${project.name}: ${note}`,
    )
  }
  await logAudit(admin.id, "project.reject_review", "project", id, { note })
  revalidateProjectPaths(id)
  return { success: true }
}

export async function closeProject(formData: FormData) {
  const admin = await requireAdmin()
  const id = Number(formData.get("project_id"))
  if (!id) return { error: "Invalid project." }

  const project = await getProjectOrThrow(id)
  if (project.payment_status !== "Paid" && Number(project.project_amount) > 0) {
    return { error: "Record full payment before closing the project." }
  }

  await sql`
    UPDATE projects SET status = 'Closed', section = 'Billing', assigned_to = NULL, updated_at = now()
    WHERE id = ${id}
  `
  await appendStatus(id, "Closed", "Project closed after billing", admin.name)
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

  const admins = (await sql`SELECT id FROM app_users WHERE role = 'Admin'`) as { id: number }[]
  for (const a of admins) {
    await notify(
      a.id,
      "Project Returned",
      "Project returned to office",
      `${project.name} was returned by ${user.name}: ${reason}.`,
    )
  }
  await logAudit(user.id, "project.return", "project", id, { reason })
  revalidateProjectPaths(id)
  return { success: true }
}

export async function reassignReturnedProject(formData: FormData) {
  const admin = await requireAdmin()
  const id = Number(formData.get("project_id"))
  const assignee = Number(formData.get("assigned_to"))
  if (!id || !assignee) return { error: "Select staff to reassign." }

  await sql`
    UPDATE projects SET assigned_to = ${assignee}, status = 'Assigned', updated_at = now()
    WHERE id = ${id}
  `
  await appendStatus(id, "Assigned", "Returned project reassigned", admin.name)
  await notify(
    assignee,
    "Project Assigned",
    "Returned project reassigned",
    "A returned project was sent back to you.",
  )
  await logAudit(admin.id, "project.reassign_returned", "project", id, { assignee })
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

export async function setChecklistReviewStatus(formData: FormData) {
  const admin = await requireAdmin()
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
  const taxPercent = Number(formData.get("tax_percent") || 0)
  const discountPercent = Number(formData.get("discount_percent") || 0)
  const totals = calculateInvoiceTotals(lineItems, taxPercent, discountPercent)

  return {
    invoiceNumber: String(formData.get("invoice_number") || "").trim(),
    invoiceDate:
      String(formData.get("invoice_date") || "").trim() || new Date().toISOString().slice(0, 10),
    dueDate: String(formData.get("due_date") || "").trim() || null,
    clientName: String(formData.get("client_name") || "").trim(),
    clientAddress: String(formData.get("client_address") || "").trim() || null,
    clientEmail: String(formData.get("client_email") || "").trim() || null,
    clientPhone: String(formData.get("client_phone") || "").trim() || null,
    clientTaxId: String(formData.get("client_tax_id") || "").trim() || null,
    projectName: String(formData.get("project_name") || "").trim() || null,
    notes: String(formData.get("notes") || "").trim() || null,
    terms: String(formData.get("terms") || "").trim() || null,
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
  const amount = Number(formData.get("amount") || 0)
  const method = String(formData.get("method") || "UPI")
  const paymentDate =
    String(formData.get("payment_date") || "").trim() || new Date().toISOString().slice(0, 10)
  const notes = String(formData.get("notes") || "").trim() || null

  if (!invoiceId || amount <= 0) return { error: "Enter a valid payment amount." }

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
  const admin = await requireAdmin()
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
