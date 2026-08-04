import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import mysql from "mysql2/promise"
import { loadEnv, parseDbUrl } from "./load-env.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const migrationPath = path.join(root, "scripts", "migrate-document-templates.sql")

const DEFAULT_DOCS = {
  site_survey: ["Site Photos", "Measurement Notes", "Location Sketch"],
  architecture_design: ["Client Brief", "Site Constraints", "Design Options"],
  concept_design: ["Concept Drawings", "Client Approval"],
  plot_sketch: ["Plot Dimensions", "Boundary Sketch", "North Point"],
  building_permit: [
    "Possession Certificate",
    "Land Tax Receipt",
    "Sale Deed",
    "Location Sketch",
    "Aadhaar",
    "Ownership Certificate",
  ],
  permit_renewal: ["Existing Permit", "Tax Receipt", "Renewal Application"],
  "3d_elevation": ["Reference Photos", "Elevation Views", "Material Palette"],
  interior_design: ["Mood Board", "Material Selection", "Furniture Layout"],
  working_drawings: ["Structural Notes", "MEP Coordination", "Detail Sheets"],
  estimation: ["BOQ", "Rate Analysis", "Cost Summary"],
  construction_supervision: ["Site Reports", "Quality Checklist", "Progress Photos"],
  valuation: ["Survey Plan", "Tax Receipt", "Property Details"],
}

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
  console.log("Applying document templates migration (MySQL)...")
  const ddl = fs.readFileSync(migrationPath, "utf8")
  await execRaw(ddl)

  const [countRows] = await pool.execute("SELECT COUNT(*) AS count FROM document_templates")
  const count = Number(countRows[0]?.count ?? 0)
  if (count === 0) {
    let sort = 0
    for (const [serviceKey, labels] of Object.entries(DEFAULT_DOCS)) {
      for (const label of labels) {
        sort += 1
        await pool.execute(
          `INSERT IGNORE INTO document_templates (service_key, label, sort_order, active)
           VALUES (?, ?, ?, 1)`,
          [serviceKey, label, sort],
        )
      }
    }
    console.log("Seeded default document templates.")
  } else {
    console.log(`document_templates already has ${count} row(s); skip seed.`)
  }

  console.log("Document templates migration applied successfully.")
} catch (error) {
  console.error("Failed to apply document templates migration:", error.message)
  process.exitCode = 1
} finally {
  await pool.end()
}
