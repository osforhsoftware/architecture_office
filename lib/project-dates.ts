/** YYYY-MM-DD in the local timezone (avoids UTC day-shift from toISOString). */
export function localDateInputValue(value?: string | Date | null): string {
  if (value) {
    const str = String(value)
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10)
    const parsed = value instanceof Date ? value : new Date(str)
    if (!Number.isNaN(parsed.getTime())) {
      const y = parsed.getFullYear()
      const m = String(parsed.getMonth() + 1).padStart(2, "0")
      const d = String(parsed.getDate()).padStart(2, "0")
      return `${y}-${m}-${d}`
    }
  }
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, "0")
  const d = String(now.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

export function isLocalToday(dateInput: string): boolean {
  return dateInput === localDateInputValue()
}

/** Build a MySQL DATETIME from an HTML date input. Returns null if invalid. */
export function projectStartAtFromDate(
  dateInput: string,
  existing?: string | Date | null,
): string | null {
  const date = String(dateInput || "").trim()
  if (!DATE_ONLY.test(date)) return null

  let time = "09:00:00"
  if (existing) {
    const str = existing instanceof Date ? existing.toTimeString().slice(0, 8) : String(existing)
    const match = str.match(/(\d{2}:\d{2})(?::(\d{2}))?/)
    if (match) time = `${match[1]}:${match[2] ?? "00"}`
  }
  return `${date} ${time}`
}
