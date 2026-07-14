import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import mysql from "mysql2/promise"
import bcrypt from "bcryptjs"
import { loadEnv, parseDbUrl } from "./load-env.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const schemaPath = path.join(root, "scripts", "schema.sql")

loadEnv()

function requireEnv(name) {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(
      `Missing ${name}. Set Super Admin / Admin credentials in .env before running db:setup.`,
    )
  }
  return value
}

const SUPER_ADMIN_USERNAME = requireEnv("SUPER_ADMIN_USERNAME")
const SUPER_ADMIN_PASSWORD = requireEnv("SUPER_ADMIN_PASSWORD")
const ADMIN_USERNAME = requireEnv("ADMIN_USERNAME")
const ADMIN_PASSWORD = requireEnv("ADMIN_PASSWORD")

const DEFAULT_STAFF = [
  { username: "planning", password: "plan123", role: "Planning Staff", name: "Planning User" },
  { username: "planning2", password: "plan123", role: "Planning Staff", name: "Anjali Nair" },
  { username: "permit", password: "permit123", role: "Permit Staff", name: "Permit User" },
  { username: "permit2", password: "permit123", role: "Permit Staff", name: "Suresh Pillai" },
  { username: "3d", password: "3d123", role: "3D Staff", name: "3D User" },
  { username: "3d2", password: "3d123", role: "3D Staff", name: "Meera Varghese" },
  { username: "estimate", password: "est123", role: "Estimation Staff", name: "Estimation User" },
  { username: "estimate2", password: "est123", role: "Estimation Staff", name: "Arun Das" },
  { username: "billing", password: "bill123", role: "Billing Staff", name: "Billing User" },
  { username: "billing2", password: "bill123", role: "Billing Staff", name: "Deepa Thomas" },
]

const PRIVILEGED_USERS = [
  {
    username: SUPER_ADMIN_USERNAME,
    password: SUPER_ADMIN_PASSWORD,
    role: "Super Admin",
    name: "Super Admin",
  },
  {
    username: ADMIN_USERNAME,
    password: ADMIN_PASSWORD,
    role: "Admin",
    name: "Office Admin",
  },
]

const url = loadEnv()
const config = parseDbUrl(url)

async function execRaw(pool, rawSql) {
  const statements = rawSql
    .split(/;[ \t]*(?:\r?\n|$)/)
    .map((s) => s.trim())
    .filter(Boolean)
  for (const stmt of statements) {
    await pool.execute(stmt)
  }
}

const pool = mysql.createPool({
  ...config,
  connectionLimit: 5,
  waitForConnections: true,
  charset: "utf8mb4",
})

try {
  if (SUPER_ADMIN_USERNAME === ADMIN_USERNAME) {
    throw new Error("SUPER_ADMIN_USERNAME and ADMIN_USERNAME must be different.")
  }

  console.log("Disabling FK checks and dropping app tables...")
  await pool.execute("SET FOREIGN_KEY_CHECKS = 0")
  for (const tbl of [
    "audit_logs", "notifications", "invoice_payments", "invoice_line_items",
    "invoices", "office_settings", "payments", "project_files",
    "return_history", "status_history", "checklist_items", "project_kmap_areas",
    "workflow_assignments", "workflow_reviews", "workflow_steps", "project_services",
    "services", "project_assignees", "projects",
    "clients", "app_users",
  ]) {
    await pool.execute(`DROP TABLE IF EXISTS \`${tbl}\``)
  }
  await pool.execute("SET FOREIGN_KEY_CHECKS = 1")

  console.log("Creating tables from schema.sql...")
  const schema = fs.readFileSync(schemaPath, "utf8")
  await execRaw(pool, schema)

  console.log("Inserting privileged users from environment variables...")
  for (const user of PRIVILEGED_USERS) {
    const hash = await bcrypt.hash(user.password, 10)
    await pool.execute(
      "INSERT INTO app_users (username, password, role, name) VALUES (?, ?, ?, ?)",
      [user.username, hash, user.role, user.name],
    )
  }

  console.log("Inserting default staff users (hashed passwords)...")
  for (const user of DEFAULT_STAFF) {
    const hash = await bcrypt.hash(user.password, 10)
    await pool.execute(
      "INSERT IGNORE INTO app_users (username, password, role, name) VALUES (?, ?, ?, ?)",
      [user.username, hash, user.role, user.name],
    )
  }

  const [users] = await pool.execute(
    "SELECT username, role FROM app_users ORDER BY id",
  )
  console.log(`Done. ${users.length} user(s) in app_users:`)
  for (const user of users) {
    console.log(`  - ${user.username} (${user.role})`)
  }
  console.log(`\nLogin as Super Admin: ${SUPER_ADMIN_USERNAME} (password from SUPER_ADMIN_PASSWORD)`)
  console.log(`Login as Admin: ${ADMIN_USERNAME} (password from ADMIN_PASSWORD)`)
  console.log("Run npm run db:seed to add sample clients and projects.")
} catch (error) {
  console.error("Setup failed:", error.message)
  process.exitCode = 1
} finally {
  await pool.end()
}
