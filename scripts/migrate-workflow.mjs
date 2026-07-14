import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import mysql from "mysql2/promise"
import { loadEnv, parseDbUrl } from "./load-env.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const migrationPath = path.join(root, "scripts", "migrate-workflow.sql")

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

async function execRaw(rawSql) {
  const statements = rawSql
    .split(/;[ \t]*(?:\r?\n|$)/)
    .map((s) => s.trim())
    .filter(Boolean)
  for (const stmt of statements) {
    if (/ADD COLUMN IF NOT EXISTS/i.test(stmt)) continue
    await pool.execute(stmt)
  }
}

async function ensureProjectColumns() {
  const alters = [
    ["project_package", "VARCHAR(50) DEFAULT 'full'"],
    ["current_workflow_step_id", "INT NULL"],
    ["work_completed_at", "DATETIME NULL"],
  ]
  for (const [col, def] of alters) {
    if (!(await columnExists("projects", col))) {
      await pool.execute(`ALTER TABLE projects ADD COLUMN ${col} ${def}`)
      console.log(`Added projects.${col}`)
    }
  }
  if (!(await columnExists("checklist_items", "service_key"))) {
    await pool.execute(`ALTER TABLE checklist_items ADD COLUMN service_key VARCHAR(100) NULL`)
    console.log("Added checklist_items.service_key")
  }
}

const FULL_SERVICES = [
  "site_survey",
  "architecture_design",
  "concept_design",
  "plot_sketch",
  "building_permit",
  "permit_renewal",
  "3d_elevation",
  "interior_design",
  "working_drawings",
  "estimation",
  "construction_supervision",
  "valuation",
]

function buildSteps(selected) {
  const steps = []
  let order = 0
  steps.push({
    step_type: "planning",
    step_key: "planning",
    label: "Planning",
    section: "Planning & Design",
    service_key: null,
    sort_order: order++,
  })
  const catalog = [
    ["site_survey", "Site Survey / Measurement", "Planning & Design"],
    ["architecture_design", "Architecture Design", "Planning & Design"],
    ["concept_design", "Concept Design", "Planning & Design"],
    ["plot_sketch", "Plot Sketch", "Planning & Design"],
    ["building_permit", "Building Permit", "Building Permit"],
    ["permit_renewal", "Permit Renewal", "Building Permit"],
    ["3d_elevation", "3D Elevation", "3D & Interior"],
    ["interior_design", "Interior Design", "3D & Interior"],
    ["working_drawings", "Working Drawings", "Estimation & Construction"],
    ["estimation", "Estimation", "Estimation & Construction"],
    ["construction_supervision", "Construction Supervision", "Estimation & Construction"],
    ["valuation", "Valuation Course", "Estimation & Construction"],
  ]
  for (const [key, label, section] of catalog) {
    if (!selected.includes(key)) continue
    steps.push({
      step_type: "service",
      step_key: key,
      label,
      section,
      service_key: key,
      sort_order: order++,
    })
    steps.push({
      step_type: "admin_review",
      step_key: `review_${key}`,
      label: "Admin Review",
      section,
      service_key: key,
      sort_order: order++,
    })
  }
  steps.push({
    step_type: "billing",
    step_key: "billing",
    label: "Billing",
    section: "Billing",
    service_key: null,
    sort_order: order++,
  })
  return steps
}

async function backfillExistingProjects() {
  const [projects] = await pool.execute(
    `SELECT p.id, p.section, p.status, p.current_stage, p.assigned_to, p.current_workflow_step_id
     FROM projects p
     WHERE p.current_workflow_step_id IS NULL`,
  )

  for (const project of projects) {
    const projectId = project.id
    const [existingServices] = await pool.execute(
      `SELECT service_key FROM project_services WHERE project_id = ?`,
      [projectId],
    )
    let selected = existingServices.map((r) => r.service_key)
    if (!selected.length) {
      selected = [...FULL_SERVICES]
      for (const key of selected) {
        await pool.execute(
          `INSERT IGNORE INTO project_services (project_id, service_key) VALUES (?, ?)`,
          [projectId, key],
        )
      }
      await pool.execute(`UPDATE projects SET project_package = 'full' WHERE id = ?`, [projectId])
    }

    const steps = buildSteps(selected)
    let activeStepId = null
    for (const step of steps) {
      const isBilling = step.step_type === "billing"
      const isClosed = project.status === "Closed" || project.status === "Completed"
      let stepStatus = "pending"
      if (isClosed && isBilling) stepStatus = "completed"
      else if (isClosed) stepStatus = "completed"
      else if (project.section === step.section && step.step_type !== "admin_review") {
        if (project.status === "Pending Review" && step.step_type === "service") stepStatus = "completed"
        else stepStatus = "active"
      } else if (project.section === "Billing" && isBilling) stepStatus = "active"

      const [result] = await pool.execute(
        `INSERT IGNORE INTO workflow_steps
         (project_id, step_type, step_key, label, section, service_key, sort_order, step_status, assigned_to)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          projectId,
          step.step_type,
          step.step_key,
          step.label,
          step.section,
          step.service_key,
          step.sort_order,
          stepStatus,
          stepStatus === "active" && step.step_type !== "admin_review" ? project.assigned_to : null,
        ],
      )
      if (stepStatus === "active") {
        const [rows] = await pool.execute(
          `SELECT id FROM workflow_steps WHERE project_id = ? AND step_key = ?`,
          [projectId, step.step_key],
        )
        activeStepId = rows[0]?.id ?? activeStepId
      }
    }

    if (activeStepId) {
      await pool.execute(`UPDATE projects SET current_workflow_step_id = ? WHERE id = ?`, [
        activeStepId,
        projectId,
      ])
    }
  }

  if (projects.length) {
    console.log(`Backfilled workflow for ${projects.length} existing project(s).`)
  }
}

try {
  console.log("Applying workflow migration (MySQL)...")
  const ddl = fs.readFileSync(migrationPath, "utf8")
  await execRaw(ddl)
  await ensureProjectColumns()
  await backfillExistingProjects()
  console.log("Workflow migration applied successfully.")
} catch (error) {
  console.error("Failed to apply workflow migration:", error.message)
  process.exitCode = 1
} finally {
  await pool.end()
}
