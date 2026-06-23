export type Role =
  | "Admin"
  | "Planning Staff"
  | "Permit Staff"
  | "3D Staff"
  | "Estimation Staff"
  | "Billing Staff"

export const STAFF_ROLES: Role[] = [
  "Planning Staff",
  "Permit Staff",
  "3D Staff",
  "Estimation Staff",
  "Billing Staff",
]

export const BILLING_STAFF_ROLE = "Billing Staff" as const

/** Routes Billing Staff may access under /admin */
export const BILLING_STAFF_ROUTE_PREFIXES = [
  "/admin/billing",
  "/admin/invoices",
  "/admin/projects",
  "/admin/notifications",
] as const

export function isBillingStaff(role: string): boolean {
  return role === BILLING_STAFF_ROLE
}

export function canAccessBilling(role: string): boolean {
  return role === "Admin" || role === BILLING_STAFF_ROLE
}

export function isBillingStaffRouteAllowed(pathname: string): boolean {
  return BILLING_STAFF_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}

export function homePathForRole(role: string): string {
  if (role === "Admin") return "/admin"
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

export function projectProgressPercent(currentStage: number): number {
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

export const PROJECT_STATUSES = [
  "New",
  "Assigned",
  "In Progress",
  "Pending",
  "Pending Review",
  "Correction Required",
  "Waiting For Documents",
  "Returned",
  "Completed",
  "Closed",
] as const

export const PRIORITIES = ["Low", "Medium", "High"] as const

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
  "Aadhaar Card",
  "PAN Card",
  "Title Deed",
  "Possession Certificate",
  "Land Tax Receipt",
  "Location Sketch",
  "Survey Sketch",
  "Site Plan",
  "Ownership Certificate",
  "Other Documents",
]

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

export function checklistCompletion(items: { checked: boolean }[]): number {
  if (!items.length) return 0
  const done = items.filter((i) => i.checked).length
  return Math.round((done / items.length) * 100)
}

export function statusColor(status: string): string {
  switch (status) {
    case "New":
      return "bg-slate-100 text-slate-700 border-slate-200"
    case "Assigned":
      return "bg-blue-100 text-blue-700 border-blue-200"
    case "In Progress":
      return "bg-amber-100 text-amber-800 border-amber-200"
    case "Pending":
      return "bg-orange-100 text-orange-800 border-orange-200"
    case "Pending Review":
      return "bg-violet-100 text-violet-800 border-violet-200"
    case "Correction Required":
      return "bg-rose-100 text-rose-800 border-rose-200"
    case "Waiting For Documents":
      return "bg-yellow-100 text-yellow-900 border-yellow-200"
    case "Returned":
      return "bg-red-100 text-red-700 border-red-200"
    case "Completed":
      return "bg-green-100 text-green-700 border-green-200"
    case "Closed":
      return "bg-emerald-100 text-emerald-800 border-emerald-200"
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
