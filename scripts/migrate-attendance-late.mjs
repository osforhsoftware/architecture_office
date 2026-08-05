import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import mysql from "mysql2/promise"
import { loadEnv, parseDbUrl } from "./load-env.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const migrationPath = path.join(root, "scripts", "migrate-attendance-late.sql")

const url = loadEnv()
const pool = mysql.createPool({
  ...parseDbUrl(url),
  connectionLimit: 5,
  waitForConnections: true,
  charset: "utf8mb4",
})

function stripSqlComments(rawSql) {
  return rawSql
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
}

function isSkippable(err) {
  const code = err.code || ""
  const msg = String(err.message || "")
  return (
    code === "ER_DUP_FIELDNAME" ||
    code === "ER_TABLE_EXISTS_ERROR" ||
    code === "ER_DUP_KEYNAME" ||
    code === "ER_DUP_ENTRY" ||
    code === "ER_FK_DUP_NAME" ||
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
  for (const stmt of statements) {
    try {
      await pool.execute(stmt)
    } catch (err) {
      if (isSkippable(err)) {
        console.warn("Skipping (already applied):", stmt.slice(0, 80))
        continue
      }
      console.error("Failed statement:\n", stmt.slice(0, 240))
      throw err
    }
  }
}

try {
  console.log("Applying attendance late-coming migration (MySQL)...")
  const ddl = fs.readFileSync(migrationPath, "utf8")
  await execRaw(ddl)
  console.log("Attendance late-coming migration applied successfully.")
} catch (error) {
  console.error("Failed to apply attendance late migration:", error.message)
  process.exitCode = 1
} finally {
  await pool.end()
}
