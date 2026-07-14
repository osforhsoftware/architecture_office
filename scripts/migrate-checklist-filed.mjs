import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import mysql from "mysql2/promise"
import { loadEnv, parseDbUrl } from "./load-env.mjs"

const CHECKLIST_ITEMS = [
  "Possession",
  "Land Tax",
  "Deed",
  "One Time Tax",
  "Building Cess",
  "Plot Sketch",
  "Aadhaar Card",
  "Consent",
  "Permit",
  "Labour Cess",
]

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const migrationPath = path.join(root, "scripts", "migrate-checklist-filed.sql")

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
      if (err.code === "ER_DUP_FIELDNAME") {
        console.warn(`  Column already exists, skipping: ${err.message}`)
      } else {
        throw err
      }
    }
  }
}

try {
  console.log("Applying checklist filed migration (MySQL)...")
  const ddl = fs.readFileSync(migrationPath, "utf8")
  await execRaw(ddl)

  const [projects] = await pool.execute("SELECT id FROM projects")
  for (const project of projects) {
    for (const item of CHECKLIST_ITEMS) {
      await pool.execute(
        "INSERT IGNORE INTO checklist_items (project_id, item_key, checked, filed, review_status) VALUES (?, ?, 0, 0, 'Pending')",
        [project.id, item],
      )
    }
  }

  console.log(`Checklist filed migration applied for ${projects.length} project(s).`)
} catch (error) {
  console.error("Failed to apply checklist filed migration:", error.message)
  process.exitCode = 1
} finally {
  await pool.end()
}
