export type FinanceSelectOption = { value: string; label: string }

export type FinanceDialogOptions = {
  clients: FinanceSelectOption[]
  projects: FinanceSelectOption[]
  categories: FinanceSelectOption[]
  accounts: FinanceSelectOption[]
  vendors?: FinanceSelectOption[]
}

export function clientsToOptions(clients: { id: number; name: string }[]): FinanceSelectOption[] {
  return clients.map((c) => ({ value: String(c.id), label: c.name }))
}

export function projectsToOptions(
  projects: { id: number; name: string; code?: string | null }[],
): FinanceSelectOption[] {
  return projects.map((p) => ({
    value: String(p.id),
    label: p.code ? `${p.code} — ${p.name}` : p.name,
  }))
}

export function categoriesToOptions(categories: { id: number; name: string }[]): FinanceSelectOption[] {
  return categories.map((c) => ({ value: String(c.id), label: c.name }))
}

export function accountsToOptions(accounts: { id: number; name: string }[]): FinanceSelectOption[] {
  return accounts.map((a) => ({ value: String(a.id), label: a.name }))
}

export function vendorsToOptions(vendors: { id: number; name: string }[]): FinanceSelectOption[] {
  return vendors.map((v) => ({ value: String(v.id), label: v.name }))
}
