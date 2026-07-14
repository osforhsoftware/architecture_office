import type { Role } from "./constants"

/** Canonical service catalog — order defines workflow sequence. */
export const PROJECT_SERVICES = [
  {
    key: "site_survey",
    label: "Site Survey / Measurement",
    section: "Planning & Design",
    role: "Planning Staff" as Role,
    allowsMultiAssignee: true,
  },
  {
    key: "architecture_design",
    label: "Architecture Design",
    section: "Planning & Design",
    role: "Planning Staff" as Role,
    allowsMultiAssignee: true,
  },
  {
    key: "concept_design",
    label: "Concept Design",
    section: "Planning & Design",
    role: "Planning Staff" as Role,
    allowsMultiAssignee: true,
  },
  {
    key: "plot_sketch",
    label: "Plot Sketch",
    section: "Planning & Design",
    role: "Planning Staff" as Role,
    allowsMultiAssignee: true,
  },
  {
    key: "building_permit",
    label: "Building Permit",
    section: "Building Permit",
    role: "Permit Staff" as Role,
    allowsMultiAssignee: true,
  },
  {
    key: "permit_renewal",
    label: "Permit Renewal",
    section: "Building Permit",
    role: "Permit Staff" as Role,
    allowsMultiAssignee: true,
  },
  {
    key: "3d_elevation",
    label: "3D Elevation",
    section: "3D & Interior",
    role: "3D Staff" as Role,
    allowsMultiAssignee: true,
  },
  {
    key: "interior_design",
    label: "Interior Design",
    section: "3D & Interior",
    role: "3D Staff" as Role,
    allowsMultiAssignee: true,
  },
  {
    key: "working_drawings",
    label: "Working Drawings",
    section: "Estimation & Construction",
    role: "Estimation Staff" as Role,
    allowsMultiAssignee: true,
  },
  {
    key: "estimation",
    label: "Estimation",
    section: "Estimation & Construction",
    role: "Estimation Staff" as Role,
    allowsMultiAssignee: true,
  },
  {
    key: "construction_supervision",
    label: "Construction Supervision",
    section: "Estimation & Construction",
    role: "Estimation Staff" as Role,
    allowsMultiAssignee: true,
  },
  {
    key: "valuation",
    label: "Valuation Course",
    section: "Estimation & Construction",
    role: "Estimation Staff" as Role,
    allowsMultiAssignee: true,
  },
] as const

export type ServiceKey = (typeof PROJECT_SERVICES)[number]["key"]

export const FULL_PROJECT_SERVICE_KEYS: ServiceKey[] = PROJECT_SERVICES.map((s) => s.key)

export const PROJECT_PACKAGES = ["full", "custom"] as const
export type ProjectPackage = (typeof PROJECT_PACKAGES)[number]

export type WorkflowStepType = "planning" | "service" | "admin_review" | "billing"

export interface WorkflowStepDefinition {
  stepType: WorkflowStepType
  stepKey: string
  label: string
  section: string
  serviceKey: string | null
  sortOrder: number
}

export interface WorkflowStepRecord {
  id: number
  project_id: number
  step_type: WorkflowStepType
  step_key: string
  label: string
  section: string
  service_key: string | null
  sort_order: number
  step_status: "pending" | "active" | "completed" | "skipped"
  assigned_to: number | null
  started_at: string | null
  completed_at: string | null
}

/** Service-specific checklist items shown only when that service is selected. */
export const SERVICE_CHECKLIST_ITEMS: Record<string, readonly string[]> = {
  site_survey: ["Site Photos", "Measurement Notes", "Location Sketch"],
  architecture_design: ["Client Brief", "Site Constraints", "Design Options"],
  concept_design: ["Concept Drawings", "Client Approval"],
  plot_sketch: ["Plot Dimensions", "Boundary Sketch", "North Point"],
  building_permit: [
    "Possession Certificate",
    "Land Tax Receipt",
    "Sale Deed",
    "Location Sketch",
    "Aadhaar",
    "Ownership Certificate",
  ],
  permit_renewal: ["Existing Permit", "Tax Receipt", "Renewal Application"],
  "3d_elevation": ["Reference Photos", "Elevation Views", "Material Palette"],
  interior_design: ["Mood Board", "Material Selection", "Furniture Layout"],
  working_drawings: ["Structural Notes", "MEP Coordination", "Detail Sheets"],
  estimation: ["BOQ", "Rate Analysis", "Cost Summary"],
  construction_supervision: ["Site Reports", "Quality Checklist", "Progress Photos"],
  valuation: ["Survey Plan", "Tax Receipt", "Property Details"],
}

export function serviceByKey(key: string) {
  return PROJECT_SERVICES.find((s) => s.key === key)
}

export function parseSelectedServices(formData: FormData, projectPackage: ProjectPackage): ServiceKey[] {
  if (projectPackage === "full") return [...FULL_PROJECT_SERVICE_KEYS]
  const raw = formData.getAll("services")
  const keys = raw.map((v) => String(v).trim()).filter(Boolean)
  const valid = new Set<string>(FULL_PROJECT_SERVICE_KEYS)
  /** Residential custom-service labels that map into the workflow catalog. */
  const aliases: Record<string, ServiceKey> = {
    architectural_plan: "architecture_design",
  }
  const selected: ServiceKey[] = []
  for (const key of keys) {
    const mapped = (aliases[key] ?? key) as ServiceKey
    if (!valid.has(mapped)) continue
    if (!selected.includes(mapped)) selected.push(mapped)
  }
  return selected
}

/** Build ordered workflow steps for a project based on selected services. */
export function buildWorkflowSteps(selectedServices: readonly ServiceKey[]): WorkflowStepDefinition[] {
  const selected = new Set(selectedServices)
  const steps: WorkflowStepDefinition[] = []
  let order = 0

  steps.push({
    stepType: "planning",
    stepKey: "planning",
    label: "Planning",
    section: "Planning & Design",
    serviceKey: null,
    sortOrder: order++,
  })

  for (const service of PROJECT_SERVICES) {
    if (!selected.has(service.key)) continue
    steps.push({
      stepType: "service",
      stepKey: service.key,
      label: service.label,
      section: service.section,
      serviceKey: service.key,
      sortOrder: order++,
    })
    steps.push({
      stepType: "admin_review",
      stepKey: `review_${service.key}`,
      label: "Admin Review",
      section: service.section,
      serviceKey: service.key,
      sortOrder: order++,
    })
  }

  steps.push({
    stepType: "billing",
    stepKey: "billing",
    label: "Billing",
    section: "Billing",
    serviceKey: null,
    sortOrder: order++,
  })

  return steps
}

/** Checklist keys to seed for selected services (service_key prefix on item_key). */
export function checklistItemsForServices(selectedServices: readonly ServiceKey[]): { itemKey: string; serviceKey: string }[] {
  const items: { itemKey: string; serviceKey: string }[] = []
  for (const key of selectedServices) {
    const list = SERVICE_CHECKLIST_ITEMS[key] ?? []
    for (const label of list) {
      items.push({ itemKey: `${key}::${label}`, serviceKey: key })
    }
  }
  return items
}

export function isWorkStep(step: Pick<WorkflowStepRecord, "step_type">): boolean {
  return step.step_type === "planning" || step.step_type === "service" || step.step_type === "billing"
}

export function isReviewStep(step: Pick<WorkflowStepRecord, "step_type">): boolean {
  return step.step_type === "admin_review"
}

/** All work steps (Planning, every service, Billing) support multi-staff assignment. */
export function allowsMultiAssignee(step: Pick<WorkflowStepRecord, "step_type" | "service_key">): boolean {
  if (step.step_type === "planning" || step.step_type === "billing") return true
  if (step.step_type !== "service" || !step.service_key) return false
  return serviceByKey(step.service_key)?.allowsMultiAssignee ?? false
}

export function roleForStep(step: Pick<WorkflowStepRecord, "step_type" | "section" | "service_key">): Role | null {
  if (step.service_key) {
    return serviceByKey(step.service_key)?.role ?? null
  }
  if (step.step_type === "planning") return "Planning Staff"
  if (step.step_type === "billing") return "Billing Staff"
  return null
}

export type TimelineNode = {
  key: string
  label: string
  type: "milestone" | "service" | "review" | "billing" | "closed"
  sortOrder: number
}

/** Timeline nodes for UI — only selected services + gates. */
export function buildTimelineNodes(steps: WorkflowStepDefinition[], projectStatus: string): TimelineNode[] {
  const nodes: TimelineNode[] = [
    { key: "created", label: "Project Created", type: "milestone", sortOrder: -1 },
  ]

  for (const step of steps) {
    if (step.stepType === "admin_review") {
      nodes.push({ key: step.stepKey, label: "Admin Review", type: "review", sortOrder: step.sortOrder })
    } else {
      nodes.push({
        key: step.stepKey,
        label: step.label,
        type: step.stepType === "billing" ? "billing" : step.stepType === "planning" ? "milestone" : "service",
        sortOrder: step.sortOrder,
      })
    }
  }

  if (projectStatus === "Closed" || projectStatus === "Completed") {
    nodes.push({ key: "closed", label: "Closed", type: "closed", sortOrder: 9999 })
  }

  return nodes
}

export function activeTimelineIndex(
  steps: WorkflowStepRecord[],
  projectStatus: string,
): number {
  const active = steps.find((s) => s.step_status === "active")
  if (!active) {
    if (projectStatus === "Closed" || projectStatus === "Completed") return 9999
    if (projectStatus === "Pending Review") {
      const pendingReview = steps.find((s) => s.step_type === "admin_review" && s.step_status === "active")
      if (pendingReview) return pendingReview.sort_order
    }
    const lastCompleted = [...steps].reverse().find((s) => s.step_status === "completed")
    return lastCompleted?.sort_order ?? 0
  }
  return active.sort_order
}

export function syncLegacyFieldsFromStep(
  step: WorkflowStepRecord | null,
  status: string,
): { section: string; current_stage: number } {
  if (!step) return { section: "Planning & Design", current_stage: 0 }
  const serviceIndex = step.service_key
    ? PROJECT_SERVICES.findIndex((s) => s.key === step.service_key)
    : step.step_type === "billing"
      ? PROJECT_SERVICES.length
      : 0
  return {
    section: step.section,
    current_stage: Math.max(0, serviceIndex),
  }
}
