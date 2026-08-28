export type ProjectDeleteBlocker = {
  key: string
  singular: string
  plural: string
  count: number
}

export function projectDeleteConfirmationPhrase(code: string): string {
  return `delete_${code}`
}

export function activeProjectDeleteBlockers(
  blockers: ProjectDeleteBlocker[],
): ProjectDeleteBlocker[] {
  return blockers.filter((item) => item.count > 0)
}

export function formatProjectDeleteBlockedError(blockers: ProjectDeleteBlocker[]): string {
  const active = activeProjectDeleteBlockers(blockers)
  if (!active.length) {
    return "This project cannot be deleted because related records already exist."
  }

  const list = active
    .map((item) => `${item.count} ${item.count === 1 ? item.singular : item.plural}`)
    .join(", ")

  return `This project cannot be deleted because related records already exist (${list}). Only a newly created project with no invoices or other activity can be permanently removed.`
}
