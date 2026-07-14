import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import mysql from "mysql2/promise"
import { loadEnv, parseDbUrl } from "./load-env.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const migrationPath = path.join(root, "scripts", "cleanup-stale-site-assignees.sql")

const url = loadEnv()
const pool = mysql.createPool({
  ...parseDbUrl(url),
  connectionLimit: 5,
  waitForConnections: true,
  charset: "utf8mb4",
})

async function execRaw(rawSql) {
  const statements = rawSql
    .split(/;[ \t]*(?:\r?\n|$)/)
    .map((s) => s.trim())
    .filter(Boolean)
  for (const stmt of statements) {
    const [result] = await pool.execute(stmt)
    if (result && typeof result.affectedRows === "number") {
      console.log(`Removed ${result.affectedRows} stale site-visit assignee row(s).`)
    }
  }
}

try {
  console.log("Cleaning stale site-visit assignees (MySQL)...")
  const ddl = fs.readFileSync(migrationPath, "utf8")
  await execRaw(ddl)
  console.log("Stale site-visit assignee cleanup complete.")
} catch (error) {
  console.error("Failed to clean stale site-visit assignees:", error.message)
  process.exitCode = 1
} finally {
  await pool.end()
}
