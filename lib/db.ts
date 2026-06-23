import mysql from "mysql2/promise"

// ---------------------------------------------------------------------------
// Connection config
// ---------------------------------------------------------------------------

function parseMysqlConfig(): mysql.PoolOptions {
  const url = process.env.DATABASE_URL || process.env.MYSQL_URL

  if (url) {
    const normalized = url.replace(/^mysql2:\/\//, "mysql://")
    try {
      const u = new URL(normalized)
      return {
        host: u.hostname,
        port: Number.parseInt(u.port || "3306", 10),
        user: decodeURIComponent(u.username),
        password: decodeURIComponent(u.password),
        database: u.pathname.slice(1).split("?")[0],
      }
    } catch {
      // fall through to individual env vars
    }
  }

  const host = process.env.MYSQL_HOST || process.env.DB_HOST
  const user = process.env.MYSQL_USER || process.env.DB_USER || process.env.MYSQL_USERNAME
  const password = process.env.MYSQL_PASSWORD || process.env.DB_PASSWORD
  const database = process.env.MYSQL_DATABASE || process.env.MYSQL_DB || process.env.DB_NAME

  if (!host || !user || !database) {
    throw new Error(
      "No database connection found. " +
        "Set DATABASE_URL (mysql://user:pass@host:3306/db) " +
        "or MYSQL_HOST / MYSQL_USER / MYSQL_PASSWORD / MYSQL_DATABASE.",
    )
  }

  return {
    host,
    port: Number.parseInt(process.env.MYSQL_PORT || "3306", 10),
    user,
    password: password || "",
    database,
  }
}

function createPool(): mysql.Pool {
  return mysql.createPool({
    ...parseMysqlConfig(),
    connectionLimit: process.env.NODE_ENV === "production" ? 10 : 3,
    connectTimeout: 15_000,
    waitForConnections: true,
    queueLimit: 0,
    charset: "utf8mb4",
    /**
     * Return DATE / DATETIME / TIMESTAMP columns as strings so the rest of
     * the application receives the same format it did from the postgres driver.
     */
    dateStrings: true,
    typeCast(field, next) {
      // BOOLEAN columns are stored as TINYINT(1); convert back to boolean.
      if (field.type === "TINY" && field.length === 1) {
        return field.string() === "1"
      }
      // Numeric aggregates — use next() instead of field.string(), which returns
      // binary buffer data for DECIMAL/BIGINT and parses to NaN.
      if (
        field.type === "NEWDECIMAL" ||
        field.type === "LONGLONG" ||
        field.type === "LONG" ||
        field.type === "INT24" ||
        field.type === "SHORT" ||
        field.type === "DOUBLE" ||
        field.type === "FLOAT"
      ) {
        const val = next()
        if (val === null) return null
        const n = typeof val === "number" ? val : Number.parseFloat(String(val))
        return Number.isFinite(n) ? n : 0
      }
      // JSON columns → parsed object
      if (field.type === "JSON") {
        const val = field.string()
        if (val === null) return null
        try {
          return JSON.parse(val)
        } catch {
          return val
        }
      }
      return next()
    },
  })
}

declare global {
  // eslint-disable-next-line no-var
  var __mysqlPool: mysql.Pool | undefined
  // eslint-disable-next-line no-var
  var __mysqlPoolVersion: number | undefined
}

/** Bump when pool options (e.g. typeCast) change so dev HMR recreates the pool. */
const MYSQL_POOL_VERSION = 2

function getPool(): mysql.Pool {
  if (
    !globalThis.__mysqlPool ||
    globalThis.__mysqlPoolVersion !== MYSQL_POOL_VERSION
  ) {
    void globalThis.__mysqlPool?.end()
    globalThis.__mysqlPool = createPool()
    globalThis.__mysqlPoolVersion = MYSQL_POOL_VERSION
  }
  return globalThis.__mysqlPool
}

// ---------------------------------------------------------------------------
// Tagged-template SQL executor
// ---------------------------------------------------------------------------

/** Marker type so sql.json() values are identified inside the executor. */
interface JsonMarker {
  readonly __mysqlJson: unknown
}

function isJsonMarker(v: unknown): v is JsonMarker {
  return v !== null && typeof v === "object" && "__mysqlJson" in (v as object)
}

const RETURNING_RE = /\bRETURNING\b[\s\S]*$/i

/**
 * Tagged template literal that builds a parameterized mysql2 query.
 *
 * PostgreSQL `RETURNING id` clauses are stripped automatically; for INSERT
 * statements the wrapper returns `[{ id: lastInsertId }]` so all existing
 * call sites continue to work without changes.
 */
async function execSql(strings: TemplateStringsArray, ...values: unknown[]): Promise<unknown[]> {
  let query = ""
  const params: unknown[] = []

  for (let i = 0; i < strings.length; i++) {
    query += strings[i]
    if (i < values.length) {
      const v = values[i]
      if (isJsonMarker(v)) {
        query += "?"
        params.push(JSON.stringify(v.__mysqlJson))
      } else {
        query += "?"
        params.push(v ?? null)
      }
    }
  }

  // Strip RETURNING clause (MySQL uses LAST_INSERT_ID() / insertId instead)
  query = query.replace(RETURNING_RE, "").trimEnd()

  const pool = getPool()
  // mysql2's execute() accepts unknown values at runtime; the cast is safe
  // because our params are always strings, numbers, booleans, or null.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [result] = await pool.execute(query, params as any)

  if (Array.isArray(result)) {
    return result as unknown[]
  }

  // INSERT / UPDATE / DELETE – return a synthetic id row when available
  const header = result as mysql.ResultSetHeader
  if (typeof header.insertId === "number" && header.insertId > 0) {
    return [{ id: header.insertId }]
  }
  return []
}

export const sql = Object.assign(execSql, {
  /**
   * Wrap a value to be JSON-serialized before insertion into a JSON column.
   * Drop-in replacement for the postgres package's `sql.json()`.
   */
  json(data: unknown): JsonMarker {
    return { __mysqlJson: data }
  },
})

// ---------------------------------------------------------------------------
// Error helpers
// ---------------------------------------------------------------------------

const TRANSIENT_CODES = new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "EPIPE",
  "ENOTFOUND",
  "PROTOCOL_CONNECTION_LOST",
  "ER_CON_COUNT_ERROR",
])

export function isTransientDbError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false
  const e = error as { code?: string; message?: string }
  if (e.code && TRANSIENT_CODES.has(e.code)) return true
  if (typeof e.message === "string") {
    return TRANSIENT_CODES.has(e.message) || e.message.includes("ECONNRESET")
  }
  return false
}

export async function withDbRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      if (!isTransientDbError(error) || attempt === retries) throw error
      await new Promise((resolve) => setTimeout(resolve, 200 * (attempt + 1)))
    }
  }
  throw lastError
}
