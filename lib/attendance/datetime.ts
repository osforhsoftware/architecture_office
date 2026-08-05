/** Parse a MySQL DATETIME stored as Asia/Kolkata wall clock. */
export function parseOfficeDateTime(value: string): Date {
  const trimmed = value.trim()
  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(trimmed)) {
    return new Date(trimmed)
  }
  const normalized = trimmed.includes("T")
    ? trimmed
    : trimmed.replace(" ", "T")
  return new Date(`${normalized}+05:30`)
}

export function formatOfficeTime(value: string | null): string {
  if (!value) return "—"
  return parseOfficeDateTime(value).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  })
}

export function formatOfficeDate(value: string | null): string {
  if (!value) return "—"
  // DATE-only values
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T00:00:00+05:30`).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "Asia/Kolkata",
    })
  }
  return parseOfficeDateTime(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  })
}

export function formatMysqlDateTimeIst(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date)
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "00"
  const hour = get("hour") === "24" ? "00" : get("hour")
  return `${get("year")}-${get("month")}-${get("day")} ${hour}:${get("minute")}:${get("second")}`
}

export function workingHoursBetween(checkIn: string, checkOut: Date): number {
  const start = parseOfficeDateTime(checkIn).getTime()
  const end = checkOut.getTime()
  const hours = (end - start) / (1000 * 60 * 60)
  return Math.round(Math.max(0, hours) * 100) / 100
}

/** Normalize HH:mm or HH:mm:ss to HH:mm */
export function normalizeTimeHm(value: string, fallback = "09:30"): string {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/)
  if (!match) return fallback
  const h = Number(match[1])
  const m = Number(match[2])
  if (!Number.isFinite(h) || !Number.isFinite(m) || h < 0 || h > 23 || m < 0 || m > 59) {
    return fallback
  }
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

export function officeDeadlineMs(
  dateYmd: string,
  officeStartTime: string,
  bufferMinutes: number,
): number {
  const start = normalizeTimeHm(officeStartTime)
  const base = parseOfficeDateTime(`${dateYmd} ${start}:00`).getTime()
  const buffer = Math.max(0, Math.trunc(bufferMinutes))
  return base + buffer * 60 * 1000
}

export function formatHmFromMs(ms: number): string {
  return new Date(ms).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  })
}

export function isAfterOfficeBuffer(
  at: Date,
  dateYmd: string,
  officeStartTime: string,
  bufferMinutes: number,
): boolean {
  return at.getTime() > officeDeadlineMs(dateYmd, officeStartTime, bufferMinutes)
}
