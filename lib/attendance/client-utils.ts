/** Client-safe calendar date in Asia/Kolkata (YYYY-MM-DD). */
export function todayInOfficeTzClient(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date)
}
