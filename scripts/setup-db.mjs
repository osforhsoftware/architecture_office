import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import mysql from "mysql2/promise"
import bcrypt from "bcryptjs"
import { loadEnv, parseDbUrl } from "./load-env.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const schemaPath = path.join(root, "scripts", "schema.sql")

const DEFAULT_USERS = [
  { username: "admin",    password: "admin123",  role: "Admin",             name: "Office Admin" },
  { username: "planning", password: "plan123",   role: "Planning Staff",    name: "Planning User" },
  { username: "permit",   password: "permit123", role: "Permit Staff",      name: "Permit User" },
  { username: "3d",       password: "3d123",     role: "3D Staff",          name: "3D User" },
  { username: "estimate", password: "est123",    role: "Estimation Staff",  name: "Estimation User" },
  { username: "billing",  password: "bill123",   role: "Billing Staff",     name: "Billing User" },
]

const url = loadEnv()
const config = parseDbUrl(url)

/**
 * Execute a raw SQL string that may contain multiple statements.
 * Statements are split on semicolons then executed one-by-one.
 */
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
  console.log("Disabling FK checks and dropping app tables...")
  await pool.execute("SET FOREIGN_KEY_CHECKS = 0")
  for (const tbl of [
    "audit_logs", "notifications", "invoice_payments", "invoice_line_items",
    "invoices", "office_settings", "payments", "project_files",
    "return_history", "status_history", "checklist_items", "projects",
    "clients", "app_users",
  ]) {
    await pool.execute(`DROP TABLE IF EXISTS \`${tbl}\``)
  }
  await pool.execute("SET FOREIGN_KEY_CHECKS = 1")

  console.log("Creating tables from schema.sql...")
  const schema = fs.readFileSync(schemaPath, "utf8")
  await execRaw(pool, schema)

  console.log("Inserting default users (hashed passwords)...")
  for (const user of DEFAULT_USERS) {
    const hash = await bcrypt.hash(user.password, 10)
    // INSERT IGNORE skips the row if username already exists
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
  console.log("\nLogin as admin / admin123")
  console.log("Run npm run db:seed to add sample clients and projects.")
} catch (error) {
  console.error("Setup failed:", error.message)
  process.exitCode = 1
} finally {
  await pool.end()
}
