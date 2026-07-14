import mysql from "mysql2/promise"
import bcrypt from "bcryptjs"
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

const KMAP_FLOOR_KEYS = ["ground_floor", "first_floor", "second_floor", "third_floor"]

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

async function ensureStaff({ username, password, role, name, email, phone }) {
  const existing = await query("SELECT id FROM app_users WHERE username = ? LIMIT 1", [username])
  if (existing.length > 0) return existing[0].id

  const hash = await bcrypt.hash(password, 10)
  const [result] = await pool.execute(
    "INSERT INTO app_users (username, password, role, name, email, phone, active) VALUES (?, ?, ?, ?, ?, ?, 1)",
    [username, hash, role, name, email ?? null, phone ?? null],
  )
  return result.insertId
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
      "INSERT IGNORE INTO checklist_items (project_id, item_key, checked, filed, review_status) VALUES (?, ?, 0, 0, 'Pending')",
      [projectId, item],
    )
  }

  for (const floorKey of KMAP_FLOOR_KEYS) {
    await pool.execute(
      "INSERT IGNORE INTO project_kmap_areas (project_id, floor_key) VALUES (?, ?)",
      [projectId, floorKey],
    )
  }

  await pool.execute(
    "INSERT INTO status_history (project_id, status, note, created_by) VALUES (?, ?, 'Project seeded', 'Office Admin')",
    [projectId, status],
  )

  return projectId
}

try {
  const admin = await query(`
    SELECT id FROM app_users
    WHERE role IN ('Super Admin', 'Admin')
    ORDER BY CASE role WHEN 'Super Admin' THEN 0 ELSE 1 END, id ASC
    LIMIT 1
  `)
  if (admin.length === 0) {
    throw new Error(
      "No Super Admin / Admin user found. Run npm run db:setup (or db:migrate-rbac) first.",
    )
  }

  console.log("Seeding staff...")
  const planningId = await ensureStaff({
    username: "planning",
    password: "plan123",
    role: "Planning Staff",
    name: "Planning User",
    email: "planning@acmmo.local",
    phone: "9847010001",
  })
  const planning2Id = await ensureStaff({
    username: "planning2",
    password: "plan123",
    role: "Planning Staff",
    name: "Anjali Nair",
    email: "anjali@acmmo.local",
    phone: "9847010002",
  })
  const permitId = await ensureStaff({
    username: "permit",
    password: "permit123",
    role: "Permit Staff",
    name: "Permit User",
    email: "permit@acmmo.local",
    phone: "9847020001",
  })
  const permit2Id = await ensureStaff({
    username: "permit2",
    password: "permit123",
    role: "Permit Staff",
    name: "Suresh Pillai",
    email: "suresh@acmmo.local",
    phone: "9847020002",
  })
  const threeDId = await ensureStaff({
    username: "3d",
    password: "3d123",
    role: "3D Staff",
    name: "3D User",
    email: "3d@acmmo.local",
    phone: "9847030001",
  })
  const threeD2Id = await ensureStaff({
    username: "3d2",
    password: "3d123",
    role: "3D Staff",
    name: "Meera Varghese",
    email: "meera@acmmo.local",
    phone: "9847030002",
  })
  const estimateId = await ensureStaff({
    username: "estimate",
    password: "est123",
    role: "Estimation Staff",
    name: "Estimation User",
    email: "estimate@acmmo.local",
    phone: "9847040001",
  })
  const estimate2Id = await ensureStaff({
    username: "estimate2",
    password: "est123",
    role: "Estimation Staff",
    name: "Arun Das",
    email: "arun@acmmo.local",
    phone: "9847040002",
  })
  const billingId = await ensureStaff({
    username: "billing",
    password: "bill123",
    role: "Billing Staff",
    name: "Billing User",
    email: "billing@acmmo.local",
    phone: "9847050001",
  })
  const billing2Id = await ensureStaff({
    username: "billing2",
    password: "bill123",
    role: "Billing Staff",
    name: "Deepa Thomas",
    email: "deepa@acmmo.local",
    phone: "9847050002",
  })

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
  const client3 = await ensureClient({
    name: "Mohammed Rafi",
    phone: "9876543212",
    email: "rafi@example.com",
    address: "Kozhikode, Kerala",
  })
  const client4 = await ensureClient({
    name: "Lakshmi Nambiar",
    phone: "9876543213",
    email: "lakshmi@example.com",
    address: "Palakkad, Kerala",
  })
  const client5 = await ensureClient({
    name: "Thomas George",
    phone: "9876543214",
    email: "thomas@example.com",
    address: "Kottayam, Kerala",
  })
  const client6 = await ensureClient({
    name: "Sneha Krishnan",
    phone: "9876543215",
    email: "sneha@example.com",
    address: "Alappuzha, Kerala",
  })

  console.log("Seeding projects...")
  const year = new Date().getFullYear()
  const projects = [
    {
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
    },
    {
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
    },
    {
      code: `PROJECT-${year}-0003`,
      name: "Apartment Block - Rafi",
      clientId: client3,
      location: "Nadakkavu, Kozhikode",
      type: "Residential",
      priority: "High",
      status: "In Progress",
      section: "Planning & Design",
      currentStage: 1,
      assigneeId: planning2Id,
      dueDate: "2026-07-30",
      amount: 420000,
      invoice: `INV-${year}-1003`,
      paymentStatus: "Partially Paid",
      advance: 100000,
    },
    {
      code: `PROJECT-${year}-0004`,
      name: "Retail Showroom - Lakshmi",
      clientId: client4,
      location: "Palakkad Junction",
      type: "Commercial",
      priority: "Medium",
      status: "Assigned",
      section: "Building Permit",
      currentStage: 2,
      assigneeId: permitId,
      dueDate: "2026-08-20",
      amount: 310000,
      invoice: `INV-${year}-1004`,
      paymentStatus: "Unpaid",
      advance: 25000,
    },
    {
      code: `PROJECT-${year}-0005`,
      name: "Warehouse Permit - Thomas",
      clientId: client5,
      location: "Pala, Kottayam",
      type: "Industrial",
      priority: "Low",
      status: "Pending Review",
      section: "Building Permit",
      currentStage: 3,
      assigneeId: permit2Id,
      dueDate: "2026-09-10",
      amount: 550000,
      invoice: `INV-${year}-1005`,
      paymentStatus: "Partially Paid",
      advance: 150000,
    },
    {
      code: `PROJECT-${year}-0006`,
      name: "Bungalow 3D Views - Sneha",
      clientId: client6,
      location: "Alleppey Beach Road",
      type: "Residential",
      priority: "High",
      status: "In Progress",
      section: "3D & Interior",
      currentStage: 4,
      assigneeId: threeDId,
      dueDate: "2026-08-05",
      amount: 195000,
      invoice: `INV-${year}-1006`,
      paymentStatus: "Paid",
      advance: 195000,
    },
    {
      code: `PROJECT-${year}-0007`,
      name: "Cafe Interior - Priya",
      clientId: client2,
      location: "Thrissur Round",
      type: "Commercial",
      priority: "Medium",
      status: "Assigned",
      section: "3D & Interior",
      currentStage: 5,
      assigneeId: threeD2Id,
      dueDate: "2026-08-25",
      amount: 145000,
      invoice: `INV-${year}-1007`,
      paymentStatus: "Unpaid",
      advance: 0,
    },
    {
      code: `PROJECT-${year}-0008`,
      name: "School Extension - Rajesh",
      clientId: client1,
      location: "Edappally, Kochi",
      type: "Institutional",
      priority: "High",
      status: "In Progress",
      section: "Estimation & Construction",
      currentStage: 6,
      assigneeId: estimateId,
      dueDate: "2026-10-01",
      amount: 780000,
      invoice: `INV-${year}-1008`,
      paymentStatus: "Partially Paid",
      advance: 200000,
    },
    {
      code: `PROJECT-${year}-0009`,
      name: "Home Renovation - Lakshmi",
      clientId: client4,
      location: "Ottapalam",
      type: "Renovation",
      priority: "Low",
      status: "Assigned",
      section: "Estimation & Construction",
      currentStage: 7,
      assigneeId: estimate2Id,
      dueDate: "2026-09-15",
      amount: 95000,
      invoice: `INV-${year}-1009`,
      paymentStatus: "Unpaid",
      advance: 10000,
    },
    {
      code: `PROJECT-${year}-0010`,
      name: "Villa Handover - Rafi",
      clientId: client3,
      location: "Feroke, Kozhikode",
      type: "Residential",
      priority: "Medium",
      status: "Completed",
      section: "Estimation & Construction",
      currentStage: 9,
      assigneeId: estimateId,
      dueDate: "2026-06-30",
      amount: 360000,
      invoice: `INV-${year}-1010`,
      paymentStatus: "Paid",
      advance: 360000,
    },
    {
      code: `PROJECT-${year}-0011`,
      name: "Billing - Villa Design Rajesh",
      clientId: client1,
      location: "Kakkanad, Kochi",
      type: "Residential",
      priority: "High",
      status: "Assigned",
      section: "Billing",
      currentStage: 8,
      assigneeId: billingId,
      dueDate: "2026-08-18",
      amount: 250000,
      invoice: `INV-${year}-1001`,
      paymentStatus: "Partially Paid",
      advance: 50000,
    },
    {
      code: `PROJECT-${year}-0012`,
      name: "Billing - Apartment Block Rafi",
      clientId: client3,
      location: "Nadakkavu, Kozhikode",
      type: "Residential",
      priority: "High",
      status: "Pending",
      section: "Billing",
      currentStage: 8,
      assigneeId: billing2Id,
      dueDate: "2026-08-22",
      amount: 420000,
      invoice: `INV-${year}-1003`,
      paymentStatus: "Partially Paid",
      advance: 100000,
    },
  ]

  for (const project of projects) {
    await ensureProject(project)
  }

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

  const [staffCount] = await pool.execute(
    "SELECT COUNT(*) AS count FROM app_users WHERE role NOT IN ('Super Admin', 'Admin')",
  )

  console.log("Seed complete.")
  console.log(`  Clients:  ${counts[0].clients}`)
  console.log(`  Projects: ${counts[0].projects}`)
  console.log(`  Users:    ${counts[0].users} (${staffCount[0].count} staff)`)
  console.log("\nStaff logins (password shown for testing):")
  console.log("  planning / plan123    planning2 / plan123")
  console.log("  permit / permit123    permit2 / permit123")
  console.log("  3d / 3d123            3d2 / 3d123")
  console.log("  estimate / est123     estimate2 / est123")
  console.log("  billing / bill123     billing2 / bill123")
} catch (error) {
  console.error("Seed failed:", error.message)
  process.exitCode = 1
} finally {
  await pool.end()
}
