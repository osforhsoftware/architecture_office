/**
 * PostgreSQL → MySQL data migration script
 *
 * Usage:
 *   PG_URL=postgresql://user:pass@host:5432/archoffice \
 *   DATABASE_URL=mysql://user:pass@localhost:3306/archoffice \
 *   node scripts/migrate-pg-to-mysql.mjs
 *
 * Prerequisites:
 *   - npm install pg        (postgres source driver, installed temporarily)
 *   - Run npm run db:setup on the MySQL target first to create tables.
 *
 * The script migrates all rows in dependency order so FK constraints are satisfied.
 * It disables FK checks during the migration then re-enables them.
 */

import mysql from "mysql2/promise"
import { loadEnv, parseDbUrl } from "./load-env.mjs"

loadEnv()

const pgUrl = process.env.PG_URL || process.env.POSTGRES_URL
if (!pgUrl) {
  console.error("Set PG_URL=postgresql://... to point to the source PostgreSQL database.")
  process.exit(1)
}

const mysqlUrl = process.env.DATABASE_URL || process.env.MYSQL_URL
if (!mysqlUrl) {
  console.error("Set DATABASE_URL=mysql://... to point to the target MySQL database.")
  process.exit(1)
}

// Dynamic import so pg is optional (only needed for migration)
let pg
try {
  pg = await import("pg")
} catch {
  console.error(
    "The 'pg' package is required for migration. Install it with:\n  npm install pg\nThen re-run this script.",
  )
  process.exit(1)
}

const pgPool = new pg.default.Pool({ connectionString: pgUrl })
const myPool = mysql.createPool({
  ...parseDbUrl(mysqlUrl),
  connectionLimit: 5,
  waitForConnections: true,
  charset: "utf8mb4",
  // Keep DECIMALs as strings from MySQL side for correct insert
  decimalNumbers: true,
})

async function pgQuery(sql, params) {
  const res = await pgPool.query(sql, params)
  return res.rows
}

async function myExec(sql, params) {
  await myPool.execute(sql, params)
}

async function migrateTable(tableName, pgSql, myInsertSql, rowMapper) {
  const rows = await pgQuery(pgSql)
  if (rows.length === 0) {
    console.log(`  ${tableName}: 0 rows (skipping)`)
    return
  }
  let count = 0
  for (const row of rows) {
    await myExec(myInsertSql, rowMapper(row))
    count++
  }
  console.log(`  ${tableName}: ${count} row(s) migrated`)
}

function dateStr(val) {
  if (!val) return null
  if (val instanceof Date) return val.toISOString().slice(0, 10)
  return String(val).slice(0, 10)
}

function datetimeStr(val) {
  if (!val) return null
  if (val instanceof Date) return val.toISOString().slice(0, 19).replace("T", " ")
  return String(val).slice(0, 19).replace("T", " ")
}

try {
  console.log("Starting PostgreSQL → MySQL migration…\n")
  const conn = await myPool.getConnection()
  await conn.execute("SET FOREIGN_KEY_CHECKS = 0")
  conn.release()

  // 1. app_users
  await migrateTable(
    "app_users",
    "SELECT * FROM app_users ORDER BY id",
    `INSERT INTO app_users (id, username, password, role, name, email, phone, active, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    (r) => [r.id, r.username, r.password, r.role, r.name, r.email ?? null, r.phone ?? null, r.active ? 1 : 0, datetimeStr(r.created_at)],
  )

  // 2. clients
  await migrateTable(
    "clients",
    "SELECT * FROM clients ORDER BY id",
    `INSERT INTO clients (id, name, phone, email, address, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
    (r) => [r.id, r.name, r.phone, r.email ?? null, r.address ?? null, datetimeStr(r.created_at)],
  )

  // 3. projects
  await migrateTable(
    "projects",
    "SELECT * FROM projects ORDER BY id",
    `INSERT INTO projects (id, code, name, client_id, location, type, priority, status, section,
      current_stage, assigned_to, due_date, project_amount, advance_received, invoice_number,
      payment_status, review_note, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    (r) => [
      r.id, r.code, r.name, r.client_id, r.location ?? null, r.type ?? null,
      r.priority, r.status, r.section, r.current_stage, r.assigned_to ?? null,
      dateStr(r.due_date), r.project_amount, r.advance_received, r.invoice_number ?? null,
      r.payment_status, r.review_note ?? null, datetimeStr(r.created_at), datetimeStr(r.updated_at),
    ],
  )

  // 4. checklist_items
  await migrateTable(
    "checklist_items",
    "SELECT * FROM checklist_items ORDER BY id",
    `INSERT INTO checklist_items (id, project_id, item_key, checked, review_status) VALUES (?, ?, ?, ?, ?)`,
    (r) => [r.id, r.project_id, r.item_key, r.checked ? 1 : 0, r.review_status],
  )

  // 5. status_history
  await migrateTable(
    "status_history",
    "SELECT * FROM status_history ORDER BY id",
    `INSERT INTO status_history (id, project_id, status, note, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
    (r) => [r.id, r.project_id, r.status, r.note ?? null, r.created_by ?? null, datetimeStr(r.created_at)],
  )

  // 6. return_history
  await migrateTable(
    "return_history",
    "SELECT * FROM return_history ORDER BY id",
    `INSERT INTO return_history (id, project_id, reason, notes, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
    (r) => [r.id, r.project_id, r.reason, r.notes ?? null, r.created_by ?? null, datetimeStr(r.created_at)],
  )

  // 7. project_files
  await migrateTable(
    "project_files",
    "SELECT * FROM project_files ORDER BY id",
    `INSERT INTO project_files (id, project_id, name, file_type, category, uploaded_by, version, storage_path, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    (r) => [r.id, r.project_id, r.name, r.file_type ?? null, r.category ?? null, r.uploaded_by ?? null, r.version ?? 1, r.storage_path ?? null, datetimeStr(r.created_at)],
  )

  // 8. payments
  await migrateTable(
    "payments",
    "SELECT * FROM payments ORDER BY id",
    `INSERT INTO payments (id, project_id, amount, method, note, recorded_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    (r) => [r.id, r.project_id, r.amount, r.method, r.note ?? null, r.recorded_by ?? null, datetimeStr(r.created_at)],
  )

  // 9. notifications
  await migrateTable(
    "notifications",
    "SELECT * FROM notifications ORDER BY id",
    `INSERT INTO notifications (id, user_id, type, title, message, \`read\`, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    (r) => [r.id, r.user_id, r.type, r.title, r.message ?? null, r.read ? 1 : 0, datetimeStr(r.created_at)],
  )

  // 10. audit_logs (JSONB → JSON)
  await migrateTable(
    "audit_logs",
    "SELECT * FROM audit_logs ORDER BY id",
    `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    (r) => [
      r.id, r.user_id ?? null, r.action, r.entity_type, r.entity_id ?? null,
      r.details ? JSON.stringify(r.details) : null,
      datetimeStr(r.created_at),
    ],
  )

  // 11. office_settings (JSONB → JSON)
  await migrateTable(
    "office_settings",
    "SELECT * FROM office_settings",
    `INSERT INTO office_settings (\`key\`, value, updated_at) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = VALUES(updated_at)`,
    (r) => [r.key, JSON.stringify(r.value), datetimeStr(r.updated_at)],
  )

  // 12. invoices
  await migrateTable(
    "invoices",
    "SELECT * FROM invoices ORDER BY id",
    `INSERT INTO invoices (id, project_id, invoice_number, status, invoice_date, due_date,
      client_name, client_address, client_email, client_phone, client_tax_id, project_name,
      notes, terms, subtotal, tax_percent, tax_amount, discount_percent, discount_amount,
      total, amount_paid, balance, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    (r) => [
      r.id, r.project_id ?? null, r.invoice_number, r.status, dateStr(r.invoice_date),
      dateStr(r.due_date), r.client_name, r.client_address ?? null, r.client_email ?? null,
      r.client_phone ?? null, r.client_tax_id ?? null, r.project_name ?? null,
      r.notes ?? null, r.terms ?? null,
      r.subtotal, r.tax_percent, r.tax_amount, r.discount_percent, r.discount_amount,
      r.total, r.amount_paid, r.balance, r.created_by ?? null,
      datetimeStr(r.created_at), datetimeStr(r.updated_at),
    ],
  )

  // 13. invoice_line_items
  await migrateTable(
    "invoice_line_items",
    "SELECT * FROM invoice_line_items ORDER BY id",
    `INSERT INTO invoice_line_items (id, invoice_id, description, quantity, unit, unit_price, amount, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    (r) => [r.id, r.invoice_id, r.description, r.quantity, r.unit ?? "Nos", r.unit_price, r.amount, r.sort_order ?? 0],
  )

  // 14. invoice_payments
  await migrateTable(
    "invoice_payments",
    "SELECT * FROM invoice_payments ORDER BY id",
    `INSERT INTO invoice_payments (id, invoice_id, amount, payment_date, method, notes, recorded_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    (r) => [r.id, r.invoice_id, r.amount, dateStr(r.payment_date), r.method, r.notes ?? null, r.recorded_by ?? null, datetimeStr(r.created_at)],
  )

  // Re-enable FK checks
  const conn2 = await myPool.getConnection()
  await conn2.execute("SET FOREIGN_KEY_CHECKS = 1")
  conn2.release()

  // Reset AUTO_INCREMENT counters to max(id)+1 for each table
  console.log("\nResetting AUTO_INCREMENT counters…")
  const tables = [
    "app_users", "clients", "projects", "checklist_items", "status_history",
    "return_history", "project_files", "payments", "notifications", "audit_logs",
    "invoices", "invoice_line_items", "invoice_payments",
  ]
  for (const tbl of tables) {
    const [maxRow] = await myPool.execute(`SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM \`${tbl}\``)
    const nextId = maxRow[0].next_id
    await myPool.execute(`ALTER TABLE \`${tbl}\` AUTO_INCREMENT = ${nextId}`)
  }

  console.log("\nMigration complete! All tables transferred from PostgreSQL to MySQL.")
} catch (error) {
  console.error("\nMigration failed:", error.message)
  console.error(error.stack)
  process.exitCode = 1
} finally {
  await pgPool.end()
  await myPool.end()
}
