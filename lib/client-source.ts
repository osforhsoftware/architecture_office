export const CLIENT_SOURCES = ["office", "finance"] as const
export type ClientSource = (typeof CLIENT_SOURCES)[number]

export function parseClientSource(value: unknown): ClientSource {
  return String(value ?? "").trim().toLowerCase() === "finance" ? "finance" : "office"
}

export function clientSourceLabel(source: unknown): string {
  return parseClientSource(source) === "finance" ? "Finance" : "Office"
}
