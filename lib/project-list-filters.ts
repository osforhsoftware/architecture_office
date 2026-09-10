/** Dashboard / list filter keys used in URL ?filter=… */
export const PROJECT_LIST_FILTERS = [
  "attention",
  "active",
  "delayed",
  "site_visit_pending",
  "under_construction",
  "plinth_inspection",
] as const

export type ProjectListFilter = (typeof PROJECT_LIST_FILTERS)[number]

export function isProjectListFilter(value: string | undefined | null): value is ProjectListFilter {
  return Boolean(value && (PROJECT_LIST_FILTERS as readonly string[]).includes(value))
}

/** Staff dashboard filter keys for /staff/projects?filter=… */
export const STAFF_PROJECT_FILTERS = [
  "assigned",
  "awaiting_action",
  "submitted_review",
  "correction",
  "overdue",
  "completed",
] as const

export type StaffProjectFilter = (typeof STAFF_PROJECT_FILTERS)[number]

export function isStaffProjectFilter(value: string | undefined | null): value is StaffProjectFilter {
  return Boolean(value && (STAFF_PROJECT_FILTERS as readonly string[]).includes(value))
}

/** Project create-time status flags (multi-select). */
export const PROJECT_CREATE_FLAGS = [
  { key: "site_visit_pending", label: "Site visit pending" },
  { key: "under_construction", label: "Under construction" },
] as const

export function isOverdueDueDate(
  dueDate: string | null | undefined,
  status: string,
): boolean {
  if (!dueDate) return false
  if (["Closed", "Completed", "Cancelled"].includes(status)) return false
  const due = new Date(dueDate)
  if (Number.isNaN(due.getTime())) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  due.setHours(0, 0, 0, 0)
  return due < today
}
