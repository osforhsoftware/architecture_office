import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import mysql from "mysql2/promise"
import { loadEnv, parseDbUrl } from "./load-env.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const migrationPath = path.join(root, "scripts", "migrate-finance.sql")

const url = loadEnv()
const pool = mysql.createPool({
  ...parseDbUrl(url),
  connectionLimit: 5,
  waitForConnections: true,
  charset: "utf8mb4",
  multipleStatements: true,
})

function stripSqlComments(rawSql) {
  return rawSql
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
}

function normalizeStmt(stmt) {
  return stmt
    .replace(/CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS/gi, "CREATE INDEX")
    .replace(/ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS/gi, "ADD COLUMN")
}

function isSkippable(err) {
  const code = err.code || ""
  const msg = String(err.message || "")
  return (
    code === "ER_DUP_FIELDNAME" ||
    code === "ER_TABLE_EXISTS_ERROR" ||
    code === "ER_DUP_KEYNAME" ||
    code === "ER_DUP_ENTRY" ||
    /Duplicate column/i.test(msg) ||
    /Duplicate key name/i.test(msg) ||
    /already exists/i.test(msg)
  )
}

async function execRaw(rawSql) {
  const cleaned = stripSqlComments(rawSql)
  const statements = cleaned
    .split(/;[ \t]*(?:\r?\n|$)/)
    .map((s) => s.trim())
    .filter(Boolean)
  for (const raw of statements) {
    const stmt = normalizeStmt(raw)
    try {
      await pool.execute(stmt)
    } catch (err) {
      if (isSkippable(err)) {
        console.warn(`  Skipping: ${err.message}`)
        continue
      }
      console.error("Failed statement:\n", stmt.slice(0, 200), "...")
      throw err
    }
  }
}

try {
  console.log("Applying finance & expense management migration (MySQL)...")
  const ddl = fs.readFileSync(migrationPath, "utf8")
  await execRaw(ddl)
  console.log("Finance migration applied successfully.")
} catch (error) {
  console.error("Failed to apply finance migration:", error.message)
  process.exitCode = 1
} finally {
  await pool.end()
}
