import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import mysql from "mysql2/promise"
import { loadEnv, parseDbUrl } from "./load-env.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const migrationPath = path.join(root, "scripts", "migrate-finance-v2.sql")

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
      // MySQL < 8.0.12 may not support ADD COLUMN IF NOT EXISTS — retry without IF NOT EXISTS
      const msg = String(err.message || "")
      if (msg.includes("Duplicate column") || msg.includes("check that it exists")) {
        console.warn("Skipping (already applied):", stmt.slice(0, 80))
        continue
      }
      console.error("Failed statement:\n", stmt.slice(0, 240))
      throw err
    }
  }
}

try {
  console.log("Applying finance v2 dual-ledger migration (MySQL)...")
  const ddl = fs.readFileSync(migrationPath, "utf8")
  await execRaw(ddl)
  console.log("Finance v2 migration applied successfully.")
} catch (error) {
  console.error("Failed to apply finance v2 migration:", error.message)
  process.exitCode = 1
} finally {
  await pool.end()
}
