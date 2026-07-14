import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import mysql from "mysql2/promise"
import { loadEnv, parseDbUrl } from "./load-env.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const migrationPath = path.join(root, "scripts", "migrate-client-fields.sql")

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
    try {
      await pool.execute(stmt)
    } catch (err) {
      // MySQL does not support IF NOT EXISTS for ALTER TABLE ADD COLUMN.
      // Ignore "duplicate column" errors (ER_DUP_FIELDNAME) which mean
      // the column already exists from a prior migration run.
      if (err.code === "ER_DUP_FIELDNAME") {
        console.warn(`  Column already exists, skipping: ${err.message}`)
      } else {
        throw err
      }
    }
  }
}

try {
  console.log("Applying client fields migration (MySQL)...")
  const ddl = fs.readFileSync(migrationPath, "utf8")
  await execRaw(ddl)
  console.log("Client fields migration applied successfully.")
} catch (error) {
  console.error("Failed to apply client fields migration:", error.message)
  process.exitCode = 1
} finally {
  await pool.end()
}
