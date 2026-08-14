import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import mysql from "mysql2/promise"
import { loadEnv, parseDbUrl } from "./load-env.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const migrationPath = path.join(root, "scripts", "migrate-additional-requirements.sql")

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

async function execRaw(rawSql) {
  const statements = rawSql
    .split(/;[ \t]*(?:\r?\n|$)/)
    .map((s) => s.trim())
    .filter(Boolean)
  for (const stmt of statements) {
    try {
      await pool.execute(stmt)
    } catch (err) {
      if (
        err.code === "ER_DUP_FIELDNAME" ||
        err.code === "ER_TABLE_EXISTS_ERROR" ||
        err.code === "ER_DUP_KEYNAME" ||
        err.code === "ER_DUP_ENTRY"
      ) {
        console.warn(`  Skipping: ${err.message}`)
      } else {
        throw err
      }
    }
  }
}

try {
  console.log("Applying additional requirements migration (MySQL)...")
  const ddl = fs.readFileSync(migrationPath, "utf8")
  await execRaw(ddl)

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
