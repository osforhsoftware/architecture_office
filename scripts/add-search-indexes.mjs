import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import mysql from "mysql2/promise"
import { loadEnv, parseDbUrl } from "./load-env.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const indexesPath = path.join(root, "scripts", "search-indexes.sql")

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
    await pool.execute(stmt)
  }
}

try {
  console.log("Applying MySQL search indexes...")
  const ddl = fs.readFileSync(indexesPath, "utf8")
  await execRaw(ddl)
  console.log("Search indexes applied successfully.")
} catch (error) {
  console.error("Failed to apply search indexes:", error.message)
  process.exitCode = 1
} finally {
  await pool.end()
}
