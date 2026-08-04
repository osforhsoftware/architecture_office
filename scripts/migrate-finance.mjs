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
