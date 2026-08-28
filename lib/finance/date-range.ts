/** Parse an HTML date input or ISO date into YYYY-MM-DD, or null if empty/invalid. */
export function normalizeFinanceDate(value?: string | null): string | null {
  const raw = String(value ?? "").trim()
  if (!raw) return null
  const iso = raw.match(/^(\d{4}-\d{2}-\d{2})/)
  if (iso) return iso[1]
  const dmy = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (dmy) {
    const day = dmy[1].padStart(2, "0")
    const month = dmy[2].padStart(2, "0")
    const year = dmy[3]
    // Prefer DMY (en-IN). HTML date inputs already send ISO above.
    return `${year}-${month}-${day}`
  }
  return null
}

function addDaysIso(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map(Number)
  const date = new Date(year, month - 1, day + days)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

/**
 * Inclusive calendar range for SQL DATE / DATETIME columns.
 * Compare with: col >= from AND col < toExclusive
 * so the end date keeps every record on that day.
 */
export function financeDateRange(
  fromValue?: string | null,
  toValue?: string | null,
): { from: string | null; to: string | null; toExclusive: string | null } {
  let from = normalizeFinanceDate(fromValue)
  let to = normalizeFinanceDate(toValue)
  if (from && to && from > to) {
    const swap = from
    from = to
    to = swap
  }
  return {
    from,
    to,
    toExclusive: to ? addDaysIso(to, 1) : null,
  }
}
