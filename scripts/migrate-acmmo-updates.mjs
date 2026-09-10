import path from "path"
import { fileURLToPath } from "url"
import mysql from "mysql2/promise"
import { loadEnv, parseDbUrl } from "./load-env.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

const url = loadEnv()
const pool = mysql.createPool({
  ...parseDbUrl(url),
  connectionLimit: 5,
  waitForConnections: true,
  charset: "utf8mb4",
})

async function columnExists(table, column) {
  const [rows] = await pool.execute(
    `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column],
  )
  return Number(rows[0]?.c ?? 0) > 0
}

async function ensureProjectFlags() {
  const columns = [
    ["site_visit_pending", "TINYINT(1) NOT NULL DEFAULT 0"],
    ["under_construction", "TINYINT(1) NOT NULL DEFAULT 0"],
  ]
  for (const [col, def] of columns) {
    if (!(await columnExists("projects", col))) {
      await pool.execute(`ALTER TABLE projects ADD COLUMN ${col} ${def}`)
      console.log(`Added projects.${col}`)
    }
  }
}

async function ensurePlinthService() {
  await pool.execute(
    `INSERT IGNORE INTO services (service_key, label, section, role, sort_order, active)
     VALUES (?, ?, ?, ?, ?, 1)`,
    [
      "plinth_level_inspection",
      "Plinth-Level Inspection",
      "Planning & Design",
      "Planning Staff",
      13,
    ],
  )
  console.log("Ensured plinth_level_inspection service")
}

async function ensurePlinthDocuments() {
  const labels = ["Plinth Photos", "Level Measurements", "Inspection Report"]
  for (const [index, label] of labels.entries()) {
    await pool.execute(
      `INSERT IGNORE INTO document_templates (service_key, label, sort_order, active)
       VALUES (?, ?, ?, 1)`,
      ["plinth_level_inspection", label, index + 1],
    )
  }
  console.log("Ensured plinth_level_inspection document templates")
}

async function main() {
  await ensureProjectFlags()
  await ensurePlinthService()
  await ensurePlinthDocuments()
  console.log("ACMMO updates migration complete.")
  await pool.end()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
