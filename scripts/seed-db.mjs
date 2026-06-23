import mysql from "mysql2/promise"
import { loadEnv, parseDbUrl } from "./load-env.mjs"

const CHECKLIST_ITEMS = [
  "Aadhaar Card",
  "PAN Card",
  "Title Deed",
  "Possession Certificate",
  "Land Tax Receipt",
  "Location Sketch",
  "Survey Sketch",
  "Site Plan",
  "Ownership Certificate",
  "Other Documents",
]

const url = loadEnv()
const pool = mysql.createPool({
  ...parseDbUrl(url),
  connectionLimit: 5,
  waitForConnections: true,
  charset: "utf8mb4",
})

async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params)
  return rows
}

async function ensureClient({ name, phone, email, address }) {
  const existing = await query("SELECT id FROM clients WHERE phone = ? LIMIT 1", [phone])
  if (existing.length > 0) return existing[0].id

  const [result] = await pool.execute(
    "INSERT INTO clients (name, phone, email, address) VALUES (?, ?, ?, ?)",
    [name, phone, email, address],
  )
  return result.insertId
}

async function ensureProject({
  code, name, clientId, location, type, priority,
  status, section, currentStage, assigneeId,
  dueDate, amount, invoice, paymentStatus, advance,
}) {
  const existing = await query("SELECT id FROM projects WHERE code = ? LIMIT 1", [code])
  if (existing.length > 0) return existing[0].id

  const [result] = await pool.execute(
    `INSERT INTO projects (
      code, name, client_id, location, type, priority, status, section,
      current_stage, assigned_to, due_date, project_amount, invoice_number,
      payment_status, advance_received
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [code, name, clientId, location, type, priority, status, section,
     currentStage, assigneeId, dueDate, amount, invoice, paymentStatus, advance],
  )
  const projectId = result.insertId

  for (const item of CHECKLIST_ITEMS) {
    await pool.execute(
      "INSERT IGNORE INTO checklist_items (project_id, item_key, checked, review_status) VALUES (?, ?, 0, 'Pending')",
      [projectId, item],
    )
  }

  await pool.execute(
    "INSERT INTO status_history (project_id, status, note, created_by) VALUES (?, ?, 'Project seeded', 'Office Admin')",
    [projectId, status],
  )

  return projectId
}

try {
  const admin = await query("SELECT id FROM app_users WHERE username = 'admin' LIMIT 1")
  if (admin.length === 0) {
    throw new Error("No admin user found. Run npm run db:setup first.")
  }

  const planning = await query("SELECT id FROM app_users WHERE username = 'planning' LIMIT 1")
  const planningId = planning[0]?.id ?? null

  console.log("Seeding clients...")
  const client1 = await ensureClient({
    name: "Rajesh Kumar",
    phone: "9876543210",
    email: "rajesh@example.com",
    address: "Kochi, Kerala",
  })
  const client2 = await ensureClient({
    name: "Priya Menon",
    phone: "9876543211",
    email: "priya@example.com",
    address: "Thrissur, Kerala",
  })

  console.log("Seeding projects...")
  const year = new Date().getFullYear()
  await ensureProject({
    code: `PROJECT-${year}-0001`,
    name: "Villa Design - Rajesh",
    clientId: client1,
    location: "Kakkanad, Kochi",
    type: "Residential",
    priority: "High",
    status: "Assigned",
    section: "Planning & Design",
    currentStage: 0,
    assigneeId: planningId,
    dueDate: "2026-08-15",
    amount: 250000,
    invoice: `INV-${year}-1001`,
    paymentStatus: "Partially Paid",
    advance: 50000,
  })
  await ensureProject({
    code: `PROJECT-${year}-0002`,
    name: "Office Renovation - Priya",
    clientId: client2,
    location: "Thrissur Town",
    type: "Commercial",
    priority: "Medium",
    status: "New",
    section: "Planning & Design",
    currentStage: 0,
    assigneeId: null,
    dueDate: "2026-09-01",
    amount: 180000,
    invoice: `INV-${year}-1002`,
    paymentStatus: "Unpaid",
    advance: 0,
  })

  await pool.execute(
    "INSERT INTO notifications (user_id, type, title, message) VALUES (?, 'info', 'Welcome', ?)",
    [admin[0].id, "Sample data has been loaded into the database."],
  )

  const [counts] = await pool.execute(`
    SELECT
      (SELECT COUNT(*) FROM clients)   AS clients,
      (SELECT COUNT(*) FROM projects)  AS projects,
      (SELECT COUNT(*) FROM app_users) AS users
  `)

  console.log("Seed complete.")
  console.log(`  Clients:  ${counts[0].clients}`)
  console.log(`  Projects: ${counts[0].projects}`)
  console.log(`  Users:    ${counts[0].users}`)
} catch (error) {
  console.error("Seed failed:", error.message)
  process.exitCode = 1
} finally {
  await pool.end()
}
