export type Role =
  | "Super Admin"
  | "Admin"
  | "Planning Staff"
  | "Permit Staff"
  | "3D Staff"
  | "Estimation Staff"
  | "Billing Staff"
  /** Custom department staff roles from the departments table */
  | (string & {})

/** Machine-style role keys used by middleware / guards */
export const ROLE_KEYS = {
  SUPER_ADMIN: "SUPER_ADMIN",
  ADMIN: "ADMIN",
  PLANNING_STAFF: "PLANNING_STAFF",
  PERMIT_STAFF: "PERMIT_STAFF",
  THREED_STAFF: "THREED_STAFF",
  ESTIMATION_STAFF: "ESTIMATION_STAFF",
  BILLING_STAFF: "BILLING_STAFF",
} as const

export type RoleKey = (typeof ROLE_KEYS)[keyof typeof ROLE_KEYS] | (string & {})

export const SUPER_ADMIN_ROLE = "Super Admin" as const
export const ADMIN_ROLE = "Admin" as const
export const BILLING_STAFF_ROLE = "Billing Staff" as const

export const PRIVILEGED_ROLES: readonly Role[] = [SUPER_ADMIN_ROLE, ADMIN_ROLE]

export const STAFF_ROLES: Role[] = [
  "Planning Staff",
  "Permit Staff",
  "3D Staff",
  "Estimation Staff",
  "Billing Staff",
]

export const ALL_ROLES: Role[] = [SUPER_ADMIN_ROLE, ADMIN_ROLE, ...STAFF_ROLES]

/** SQL-safe list for excluding Super Admin + Admin from staff directories */
export const PRIVILEGED_ROLE_SQL = `'Super Admin', 'Admin'`

/** Routes office Admin may access under /admin (clients + projects + finance) */
export const ADMIN_ROUTE_PREFIXES = [
  "/admin/clients",
  "/admin/projects",
  "/admin/finance",
] as const

/** Routes Billing Staff may access under /admin */
export const BILLING_STAFF_ROUTE_PREFIXES = [
  "/admin/billing",
  "/admin/invoices",
  "/admin/projects",
  "/admin/notifications",
  "/admin/finance",
] as const

/** Routes only Super Admin may access under /admin */
export const SUPER_ADMIN_ONLY_ROUTE_PREFIXES = [
  "/admin/admins",
  "/admin/users",
  "/admin/security",
  "/admin/audit",
  "/admin/settings",
  "/admin/reports",
  "/admin/attendance",
] as const

export function roleToKey(role: string): RoleKey | null {
  switch (role) {
    case SUPER_ADMIN_ROLE:
      return ROLE_KEYS.SUPER_ADMIN
    case ADMIN_ROLE:
      return ROLE_KEYS.ADMIN
    case "Planning Staff":
      return ROLE_KEYS.PLANNING_STAFF
    case "Permit Staff":
      return ROLE_KEYS.PERMIT_STAFF
    case "3D Staff":
      return ROLE_KEYS.THREED_STAFF
    case "Estimation Staff":
      return ROLE_KEYS.ESTIMATION_STAFF
    case BILLING_STAFF_ROLE:
      return ROLE_KEYS.BILLING_STAFF
    default:
      return null
  }
}

export function keyToRole(key: string): Role | null {
  switch (key) {
    case ROLE_KEYS.SUPER_ADMIN:
      return SUPER_ADMIN_ROLE
    case ROLE_KEYS.ADMIN:
      return ADMIN_ROLE
    case ROLE_KEYS.PLANNING_STAFF:
      return "Planning Staff"
    case ROLE_KEYS.PERMIT_STAFF:
      return "Permit Staff"
    case ROLE_KEYS.THREED_STAFF:
      return "3D Staff"
    case ROLE_KEYS.ESTIMATION_STAFF:
      return "Estimation Staff"
    case ROLE_KEYS.BILLING_STAFF:
      return BILLING_STAFF_ROLE
    default:
      return null
  }
}

/** Resolve all roles for a user (multi-role with single-role fallback). */
export function rolesOf(user: { role: string; roles?: readonly string[] }): string[] {
  if (user.roles && user.roles.length > 0) return [...user.roles]
  return user.role ? [user.role] : []
}

export function userHasRole(
  user: { role: string; roles?: readonly string[] },
  role: string,
): boolean {
  return rolesOf(user).includes(role)
}

export function userHasAnyRole(
  user: { role: string; roles?: readonly string[] },
  candidates: readonly string[],
): boolean {
  const set = new Set(rolesOf(user))
  return candidates.some((role) => set.has(role))
}

export function formatRolesLabel(user: { role: string; roles?: readonly string[] }): string {
  const list = rolesOf(user)
  return list.length ? list.join(", ") : user.role
}

export function isSuperAdmin(role: string): boolean {
  return role === SUPER_ADMIN_ROLE
}

export function isOfficeAdmin(role: string): boolean {
  return role === SUPER_ADMIN_ROLE || role === ADMIN_ROLE
}

export function isPrivilegedRole(role: string): boolean {
  return isOfficeAdmin(role)
}

/** Any non-admin role is treated as a department staff role (supports dynamic departments). */
export function isStaffRole(role: string): boolean {
  return Boolean(role) && !isPrivilegedRole(role)
}

export function isBillingStaff(role: string): boolean {
  return role === BILLING_STAFF_ROLE
}

export function canAccessAdminPortal(role: string): boolean {
  return isOfficeAdmin(role) || isBillingStaff(role)
}

/** Multi-role aware: Billing Staff among roles OR office admin. */
export function userCanAccessAdminPortal(user: {
  role: string
  roles?: readonly string[]
}): boolean {
  return isOfficeAdmin(user.role) || userHasRole(user, BILLING_STAFF_ROLE)
}

export function canAccessBilling(role: string): boolean {
  return isSuperAdmin(role) || isBillingStaff(role)
}

/** Multi-role aware billing access. */
export function userCanAccessBilling(user: {
  role: string
  roles?: readonly string[]
}): boolean {
  return isSuperAdmin(user.role) || userHasRole(user, BILLING_STAFF_ROLE)
}

export function canManageAdmins(role: string): boolean {
  return isSuperAdmin(role)
}

export function canAccessSystemSettings(role: string): boolean {
  return isSuperAdmin(role)
}

export function canViewAuditLogs(role: string): boolean {
  return isSuperAdmin(role)
}

export function canManageUsers(role: string): boolean {
  return isSuperAdmin(role)
}

export function canAccessReports(role: string): boolean {
  return isSuperAdmin(role)
}

/** Admin may only add clients / projects (not full office management) */
export function canAddClientsAndProjects(role: string): boolean {
  return isOfficeAdmin(role)
}

/** @deprecated Use canAddClientsAndProjects */
export function canAddStaffAndProjects(role: string): boolean {
  return canAddClientsAndProjects(role)
}

/** True when the user has at least one non-admin (department) role. */
export function userIsStaffRole(user: { role: string; roles?: readonly string[] }): boolean {
  return rolesOf(user).some((role) => isStaffRole(role))
}

export function userIsBillingStaff(user: {
  role: string
  roles?: readonly string[]
}): boolean {
  return userHasRole(user, BILLING_STAFF_ROLE)
}

/** True when the user has Planning Staff among their department roles. */
export function userIsPlanningStaff(user: {
  role: string
  roles?: readonly string[]
}): boolean {
  return userHasRole(user, "Planning Staff")
}

export function isBillingStaffRouteAllowed(pathname: string): boolean {
  return BILLING_STAFF_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}

export function isAdminRouteAllowed(pathname: string): boolean {
  return ADMIN_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}

export function isSuperAdminOnlyRoute(pathname: string): boolean {
  return SUPER_ADMIN_ONLY_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}

export function homePathForRole(role: string): string {
  if (isSuperAdmin(role)) return "/admin"
  if (role === ADMIN_ROLE) return "/admin/projects"
  if (role === BILLING_STAFF_ROLE) return "/admin/billing"
  return "/staff"
}

export const WORKFLOW_STAGES: { key: string; label: string; section: string }[] = [
  { key: "site_visit", label: "Site Visit & Measurement", section: "Planning & Design" },
  { key: "concept_design", label: "Concept Design", section: "Planning & Design" },
  { key: "permit_drawings", label: "Permit Drawings", section: "Building Permit" },
  { key: "permit_submission", label: "Permit Submission & Approval", section: "Building Permit" },
  { key: "3d_views", label: "3D Elevation Views", section: "3D & Interior" },
  { key: "interior_design", label: "Interior Design", section: "3D & Interior" },
  { key: "working_drawings", label: "Working Drawings", section: "Estimation & Construction" },
  { key: "estimation", label: "Cost Estimation", section: "Estimation & Construction" },
  { key: "construction", label: "Construction Supervision", section: "Estimation & Construction" },
  { key: "handover", label: "Project Handover", section: "Estimation & Construction" },
]

export const SECTIONS = [
  "Planning & Design",
  "Building Permit",
  "3D & Interior",
  "Estimation & Construction",
  "Billing",
] as const

export const WORKFLOW_PIPELINE: {
  key: string
  label: string
  type: "department" | "review" | "complete"
}[] = [
  { key: "planning", label: "Planning", type: "department" },
  { key: "review_1", label: "Admin Review", type: "review" },
  { key: "permit", label: "Building Permit", type: "department" },
  { key: "review_2", label: "Admin Review", type: "review" },
  { key: "3d", label: "3D & Interior", type: "department" },
  { key: "review_3", label: "Admin Review", type: "review" },
  { key: "estimation", label: "Estimation", type: "department" },
  { key: "review_4", label: "Admin Review", type: "review" },
  { key: "billing", label: "Billing", type: "department" },
  { key: "completed", label: "Completed", type: "complete" },
]

const SECTION_TO_PIPELINE_INDEX: Record<string, number> = {
  "Planning & Design": 0,
  "Building Permit": 2,
  "3D & Interior": 4,
  "Estimation & Construction": 6,
  Billing: 8,
}

export function pipelineIndexForProject(section: string, status: string): number {
  if (status === "Completed" || status === "Closed") return WORKFLOW_PIPELINE.length - 1
  if (status === "Pending Review") {
    const base = SECTION_TO_PIPELINE_INDEX[section] ?? 0
    return base + 1
  }
  return SECTION_TO_PIPELINE_INDEX[section] ?? 0
}

export function workflowProgressPercent(steps: { step_status: string }[]): number {
  if (!steps.length) return 0
  const done = steps.filter((s) => s.step_status === "completed").length
  return Math.round((done / steps.length) * 100)
}

export function projectProgressPercent(currentStage: number, workflowSteps?: { step_status: string }[]): number {
  if (workflowSteps?.length) return workflowProgressPercent(workflowSteps)
  if (!WORKFLOW_STAGES.length) return 0
  return Math.round(((currentStage + 1) / WORKFLOW_STAGES.length) * 100)
}

export const SECTION_ROLE: Record<string, Role> = {
  "Planning & Design": "Planning Staff",
  "Building Permit": "Permit Staff",
  "3D & Interior": "3D Staff",
  "Estimation & Construction": "Estimation Staff",
  Billing: "Billing Staff",
}

export const ROLE_SECTION: Record<string, string> = {
  "Planning Staff": "Planning & Design",
  "Permit Staff": "Building Permit",
  "3D Staff": "3D & Interior",
  "Estimation Staff": "Estimation & Construction",
  "Billing Staff": "Billing",
}

export function departmentForRole(role: string): string | null {
  return ROLE_SECTION[role] ?? null
}

export const PROJECT_STATUSES = [
  "New",
  "Awaiting Assignment",
  "Assigned",
  "In Progress",
  "Work Completed",
  "Pending Review",
  "Approved",
  "Correction Required",
  "Returned",
  "Waiting for Client",
  "Waiting for Documents",
  "Waiting for Government Approval",
  "Waiting for Payment",
  "On Hold",
  "Completed",
  "Closed",
  "Cancelled",
] as const

export const PRIORITIES = ["Low", "Medium", "High"] as const

export const PROJECT_TYPES = [
  "Residential",
  "Commercial",
  "Industrial",
  "Institutional",
  "Renovation",
  "Other",
] as const

export type ProjectType = (typeof PROJECT_TYPES)[number]

/** Project types that show the residential details form section. Extend this list to enable for other types. */
export const PROJECT_TYPES_WITH_RESIDENTIAL_DETAILS: readonly ProjectType[] = ["Residential"]

export function showsResidentialDetails(type: string | null | undefined): boolean {
  return !!type && (PROJECT_TYPES_WITH_RESIDENTIAL_DETAILS as readonly string[]).includes(type)
}

export const RESIDENTIAL_SERVICE_TYPES = [
  {
    key: "architectural_plan",
    label: "Architectural Plan",
    fieldName: "req_architectural_plan",
  },
  {
    key: "building_permit",
    label: "Building Permit",
    fieldName: "req_building_permit",
  },
  {
    key: "regularization",
    label: "Regularization",
    fieldName: "req_regularization",
  },
] as const

export type ResidentialServiceKey = (typeof RESIDENTIAL_SERVICE_TYPES)[number]["key"]

/** Use `"single"` for one service only, or `"multiple"` to allow several. */
export const RESIDENTIAL_SERVICE_SELECTION_MODE: "single" | "multiple" = "multiple"

/** Services that reveal building number and permit number fields. */
export const RESIDENTIAL_SERVICES_WITH_PROPERTY_FIELDS: readonly ResidentialServiceKey[] = [
  "architectural_plan",
  "building_permit",
]

export function showsResidentialPropertyFields(services: readonly ResidentialServiceKey[]): boolean {
  return services.some((service) =>
    (RESIDENTIAL_SERVICES_WITH_PROPERTY_FIELDS as readonly string[]).includes(service),
  )
}

export const PAYMENT_STATUSES = ["Unpaid", "Partially Paid", "Paid"] as const

export const INVOICE_STATUSES = [
  "Draft",
  "Sent",
  "Pending",
  "Partially Paid",
  "Paid",
  "Overdue",
  "Cancelled",
] as const

export const DEFAULT_INVOICE_TERMS =
  "Payment is due within 15 days of invoice date. Late payments may incur additional charges. All amounts are in INR."

export const CHECKLIST_ITEMS = [
  "Possession",
  "Land Tax",
  "Deed",
  "One Time Tax",
  "Building Cess",
  "Plot Sketch",
  "Aadhaar Card",
  "Consent",
  "Permit",
  "Labour Cess",
] as const

/** Default floors seeded on every new project. */
export const KMAP_DEFAULT_FLOOR_COUNT = 2

/** Max floors that can be added via Area Capture. */
export const KMAP_MAX_FLOORS = 50

const LEGACY_FLOOR_NUMBERS: Record<string, number> = {
  basement: 0,
  ground_floor: 0,
  first_floor: 1,
  second_floor: 2,
  third_floor: 3,
  fourth_floor: 4,
  fifth_floor: 5,
  sixth_floor: 6,
  seventh_floor: 7,
  eighth_floor: 8,
  ninth_floor: 9,
  tenth_floor: 10,
  terrace: 11,
}

/** Default floors seeded on every new project (Floor 1, Floor 2). */
export const KMAP_FLOOR_ROWS = Array.from({ length: KMAP_DEFAULT_FLOOR_COUNT }, (_, i) => {
  const n = i + 1
  return { key: `floor_${n}`, label: `Floor ${n}` }
})

export function kmapFloorKey(n: number): string {
  return `floor_${n}`
}

export function kmapFloorNumber(key: string): number {
  const match = /^floor_(\d+)$/.exec(key)
  if (match) return Number(match[1])
  return LEGACY_FLOOR_NUMBERS[key] ?? 0
}

export function kmapFloorLabel(key: string): string {
  const match = /^floor_(\d+)$/.exec(key)
  if (match) return `Floor ${match[1]}`
  if (key in LEGACY_FLOOR_NUMBERS) {
    return key
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")
      .replace("Terrace", "Terrace / Roof")
  }
  return key
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

export function isValidKmapFloorKey(key: string): boolean {
  if (/^floor_\d+$/.test(key)) {
    const n = kmapFloorNumber(key)
    return n >= 1 && n <= KMAP_MAX_FLOORS
  }
  return key in LEGACY_FLOOR_NUMBERS
}

export function nextKmapFloorKey(existingKeys: string[]): string | null {
  const max = existingKeys.reduce((m, key) => Math.max(m, kmapFloorNumber(key)), 0)
  const next = Math.max(max + 1, 1)
  if (next > KMAP_MAX_FLOORS) return null
  return kmapFloorKey(next)
}

export const RETURN_REASONS = [
  "Missing Documents",
  "Site Plan Missing",
  "Aadhaar Missing",
  "Tax Receipt Missing",
  "Client Approval Pending",
  "Clarification Required",
  "Setback Issue",
  "Room Size Issue",
  "Other",
]

export const PAYMENT_METHODS = ["Cash", "Bank Transfer", "UPI", "Cheque", "Card"]

export const FILE_CATEGORIES = [
  "Drawing",
  "Permit Document",
  "Photo",
  "Estimate",
  "Other",
]

export const FILE_TYPES = ["PDF", "DWG", "JPG", "PNG", "Excel", "ZIP", "Other"]

export function sectionForStage(stage: number): string {
  return WORKFLOW_STAGES[Math.min(stage, WORKFLOW_STAGES.length - 1)]?.section ?? SECTIONS[0]
}

export function firstStageInSection(section: string): number {
  const idx = WORKFLOW_STAGES.findIndex((s) => s.section === section)
  return idx >= 0 ? idx : 0
}

export const SITE_VISIT_STAGE_KEY = "site_visit"

export function isSiteVisitStage(section: string, currentStage: number): boolean {
  return (
    section === "Planning & Design" &&
    WORKFLOW_STAGES[currentStage]?.key === SITE_VISIT_STAGE_KEY
  )
}

export function lastStageInSection(section: string): number {
  let last = 0
  for (let i = 0; i < WORKFLOW_STAGES.length; i++) {
    if (WORKFLOW_STAGES[i].section === section) last = i
  }
  return last
}

export function nextSection(current: string): string | null {
  const order = [
    "Planning & Design",
    "Building Permit",
    "3D & Interior",
    "Estimation & Construction",
    "Billing",
  ]
  const idx = order.indexOf(current)
  if (idx < 0 || idx >= order.length - 1) return null
  return order[idx + 1]
}

export const KERALA_DISTRICTS = [
  "Alappuzha",
  "Ernakulam",
  "Idukki",
  "Kannur",
  "Kasaragod",
  "Kollam",
  "Kottayam",
  "Kozhikode",
  "Malappuram",
  "Palakkad",
  "Pathanamthitta",
  "Thiruvananthapuram",
  "Thrissur",
  "Wayanad",
] as const

export type KeralaDistrict = (typeof KERALA_DISTRICTS)[number]

export function formatClientId(id: number): string {
  const year = new Date().getFullYear()
  return `CLI-${year}-${String(id).padStart(4, "0")}`
}

export function formatCurrency(value: number | string): string {
  const n = typeof value === "string" ? Number.parseFloat(value) : value
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0)
}

export function balanceAmount(projectAmount: number | string, paid: number | string): number {
  const total = typeof projectAmount === "string" ? Number.parseFloat(projectAmount) : projectAmount
  const received = typeof paid === "string" ? Number.parseFloat(paid) : paid
  return Math.max(0, (Number.isFinite(total) ? total : 0) - (Number.isFinite(received) ? received : 0))
}

export function checklistCompletion(items: { checked: boolean; filed?: boolean }[]): number {
  if (!items.length) return 0
  const done = items.filter((i) => (i.filed ?? i.checked)).length
  return Math.round((done / items.length) * 100)
}

export function statusColor(status: string): string {
  switch (status) {
    case "New":
      return "bg-slate-100 text-slate-700 border-slate-200"
    case "Awaiting Assignment":
      return "bg-sky-100 text-sky-800 border-sky-200"
    case "Assigned":
      return "bg-blue-100 text-blue-700 border-blue-200"
    case "In Progress":
      return "bg-amber-100 text-amber-800 border-amber-200"
    case "Work Completed":
      return "bg-teal-100 text-teal-800 border-teal-200"
    case "Pending Review":
      return "bg-violet-100 text-violet-800 border-violet-200"
    case "Approved":
      return "bg-indigo-100 text-indigo-800 border-indigo-200"
    case "Correction Required":
      return "bg-rose-100 text-rose-800 border-rose-200"
    case "Waiting for Client":
      return "bg-orange-100 text-orange-800 border-orange-200"
    case "Waiting for Documents":
      return "bg-yellow-100 text-yellow-900 border-yellow-200"
    case "Waiting for Government Approval":
      return "bg-purple-100 text-purple-800 border-purple-200"
    case "Waiting for Payment":
      return "bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200"
    case "On Hold":
      return "bg-gray-100 text-gray-700 border-gray-200"
    case "Returned":
      return "bg-red-100 text-red-700 border-red-200"
    case "Completed":
      return "bg-green-100 text-green-700 border-green-200"
    case "Closed":
      return "bg-emerald-100 text-emerald-800 border-emerald-200"
    case "Cancelled":
      return "bg-neutral-100 text-neutral-600 border-neutral-200"
    default:
      return "bg-slate-100 text-slate-700 border-slate-200"
  }
}

export function priorityColor(priority: string): string {
  switch (priority) {
    case "High":
      return "bg-red-100 text-red-700 border-red-200"
    case "Medium":
      return "bg-amber-100 text-amber-800 border-amber-200"
    case "Low":
      return "bg-green-100 text-green-700 border-green-200"
    default:
      return "bg-slate-100 text-slate-700 border-slate-200"
  }
}

export function paymentColor(status: string): string {
  switch (status) {
    case "Paid":
      return "bg-green-100 text-green-700 border-green-200"
    case "Partially Paid":
      return "bg-amber-100 text-amber-800 border-amber-200"
    case "Unpaid":
      return "bg-red-100 text-red-700 border-red-200"
    default:
      return "bg-slate-100 text-slate-700 border-slate-200"
  }
}

export function invoiceStatusColor(status: string): string {
  switch (status) {
    case "Draft":
      return "bg-slate-100 text-slate-700 border-slate-200"
    case "Sent":
      return "bg-blue-100 text-blue-700 border-blue-200"
    case "Pending":
      return "bg-orange-100 text-orange-800 border-orange-200"
    case "Partially Paid":
      return "bg-amber-100 text-amber-800 border-amber-200"
    case "Paid":
      return "bg-green-100 text-green-700 border-green-200"
    case "Overdue":
      return "bg-red-100 text-red-700 border-red-200"
    case "Cancelled":
      return "bg-gray-100 text-gray-600 border-gray-200"
    default:
      return "bg-slate-100 text-slate-700 border-slate-200"
  }
}
