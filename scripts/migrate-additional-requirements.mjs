import mysql from "mysql2/promise"
import { loadEnv, parseDbUrl } from "./load-env.mjs"

const DEFAULT_REQUIREMENTS = [
  { key: "ward_number", label: "Ward Number", sort: 1 },
  { key: "area_code", label: "Area Code", sort: 2 },
]

const url = loadEnv()
const pool = mysql.createPool({
  ...parseDbUrl(url),
  connectionLimit: 5,
  waitForConnections: true,
  charset: "utf8mb4",
})

function isSkippable(err) {
  const code = err?.code || ""
  const msg = String(err?.message || "")
  return (
    code === "ER_DUP_FIELDNAME" ||
    code === "ER_TABLE_EXISTS_ERROR" ||
    code === "ER_DUP_KEYNAME" ||
    code === "ER_DUP_ENTRY" ||
    code === "ER_FK_DUP_NAME" ||
    /Duplicate column/i.test(msg) ||
    /already exists/i.test(msg)
  )
}

async function run(sql, params) {
  try {
    if (params) await pool.execute(sql, params)
    else await pool.query(sql)
  } catch (err) {
    if (isSkippable(err)) {
      console.warn(`  Skipping: ${err.message}`)
      return
    }
    throw err
  }
}

async function addColumn(table, name, preferredType, fallbackType) {
  try {
    await pool.query(`ALTER TABLE ${table} ADD COLUMN ${name} ${preferredType}`)
    console.log(`  Added ${table}.${name} ${preferredType}`)
  } catch (err) {
    if (isSkippable(err)) {
      console.warn(`  Column already exists, skipping: ${table}.${name}`)
      return
    }
    if (!fallbackType) throw err
    try {
      await pool.query(`ALTER TABLE ${table} ADD COLUMN ${name} ${fallbackType}`)
      console.log(`  Added ${table}.${name} ${fallbackType} (fallback)`)
    } catch (fallbackErr) {
      if (isSkippable(fallbackErr)) {
        console.warn(`  Column already exists, skipping: ${table}.${name}`)
        return
      }
      throw fallbackErr
    }
  }
}

try {
  console.log("Applying additional requirements migration (MySQL)...")

  await run(`
    CREATE TABLE IF NOT EXISTS additional_requirement_templates (
      id              INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      requirement_key VARCHAR(100) UNIQUE NOT NULL,
      label           VARCHAR(255) NOT NULL,
      sort_order      INT NOT NULL DEFAULT 0,
      active          TINYINT(1) NOT NULL DEFAULT 1,
      created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_additional_requirement_label (label),
      KEY idx_additional_requirement_active (active)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  await run(`
    CREATE TABLE IF NOT EXISTS project_additional_requirements (
      project_id      INT NOT NULL,
      requirement_key VARCHAR(100) NOT NULL,
      label           VARCHAR(255) NOT NULL,
      value           VARCHAR(500) NOT NULL DEFAULT '',
      sort_order      INT NOT NULL DEFAULT 0,
      created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (project_id, requirement_key),
      CONSTRAINT fk_par_project
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  await addColumn("additional_requirement_templates", "value_type", "VARCHAR(20) NOT NULL DEFAULT 'text'")
  await addColumn("additional_requirement_templates", "choice_options", "JSON", "TEXT")
  await addColumn("project_additional_requirements", "value_type", "VARCHAR(20) NOT NULL DEFAULT 'text'")
  await addColumn("project_additional_requirements", "choice_options", "JSON", "TEXT")

  const [countRows] = await pool.execute(
    "SELECT COUNT(*) AS count FROM additional_requirement_templates",
  )
  const count = Number(countRows[0]?.count ?? 0)
  if (count === 0) {
    for (const item of DEFAULT_REQUIREMENTS) {
      await pool.execute(
        `INSERT IGNORE INTO additional_requirement_templates (requirement_key, label, value_type, sort_order, active)
         VALUES (?, ?, 'text', ?, 1)`,
        [item.key, item.label, item.sort],
      )
    }
    console.log("Seeded default additional requirement templates.")
  } else {
    console.log(`additional_requirement_templates already has ${count} row(s); skip seed.`)
  }

  console.log("Additional requirements migration applied successfully.")
} catch (error) {
  console.error("Failed to apply additional requirements migration:", error.message)
  process.exitCode = 1
} finally {
  await pool.end()
}
