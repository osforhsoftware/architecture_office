import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const envPath = path.join(root, ".env")

/**
 * Loads .env into process.env and returns the DATABASE_URL string.
 * Supports both mysql:// URL format and individual MYSQL_* env vars.
 */
export function loadEnv() {
  if (!fs.existsSync(envPath)) {
    throw new Error("Missing .env file. Create one with DATABASE_URL (mysql://...).")
  }

  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const value = trimmed.slice(eq + 1).trim()
    if (!process.env[key]) process.env[key] = value
  }

  const url = process.env.DATABASE_URL || process.env.MYSQL_URL
  if (url) return url

  // Fall back to individual env vars → build a mysql:// URL
  const host = process.env.MYSQL_HOST || process.env.DB_HOST
  const user = process.env.MYSQL_USER || process.env.DB_USER
  const pass = process.env.MYSQL_PASSWORD || process.env.DB_PASSWORD || ""
  const db = process.env.MYSQL_DATABASE || process.env.MYSQL_DB || process.env.DB_NAME
  const port = process.env.MYSQL_PORT || "3306"

  if (host && user && db) {
    return `mysql://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${host}:${port}/${db}`
  }

  throw new Error(
    "No database connection string found. " +
      "Set DATABASE_URL (mysql://user:pass@host:3306/db) in .env",
  )
}

/**
 * Parse a mysql:// connection URL into a mysql2 createPool() options object.
 */
export function parseDbUrl(url) {
  const normalized = url.replace(/^mysql2:\/\//, "mysql://")
  const u = new URL(normalized)
  return {
    host: u.hostname,
    port: parseInt(u.port || "3306", 10),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.slice(1).split("?")[0],
  }
}
