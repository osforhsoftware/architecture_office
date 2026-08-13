export type FinanceSelectOption = { value: string; label: string; clientId?: string }

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
  projects: {
    id: number
    name: string
    code?: string | null
    client_name?: string | null
    client_id?: number | null
  }[],
): FinanceSelectOption[] {
  return projects.map((p) => {
    const base = p.code ? `${p.code} — ${p.name}` : p.name
    const label =
      p.client_name && !p.name.toLowerCase().includes(p.client_name.toLowerCase())
        ? `${base} - ${p.client_name}`
        : base
    return {
      value: String(p.id),
      label,
      ...(p.client_id != null ? { clientId: String(p.client_id) } : {}),
    }
  })
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
