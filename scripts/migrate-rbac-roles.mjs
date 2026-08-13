import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import mysql from "mysql2/promise"
import bcrypt from "bcryptjs"
import { loadEnv, parseDbUrl } from "./load-env.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const migrationPath = path.join(root, "scripts", "migrate-rbac-roles.sql")

loadEnv()

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
      if (err.code === "ER_DUP_FIELDNAME") {
        console.warn(`  Column already exists, skipping: ${err.message}`)
      } else {
        throw err
      }
    }
  }
}

async function upsertUser({ username, password, role, name }) {
  const [existing] = await pool.execute(
    "SELECT id, role FROM app_users WHERE username = ? LIMIT 1",
    [username],
  )
  const hash = await bcrypt.hash(password, 10)

  if (existing.length) {
    if (role === "Admin" && (existing[0].role === "Acmmo Admin" || existing[0].role === "Super Admin")) {
      console.warn(
        `  Skipping Admin upsert for "${username}" — that account is Acmmo Admin. Use a different ADMIN_USERNAME.`,
      )
      return
    }
    await pool.execute(
      "UPDATE app_users SET password = ?, role = ?, name = ?, active = 1 WHERE id = ?",
      [hash, role, name, existing[0].id],
    )
    console.log(`  Updated ${username} → ${role}`)
    return
  }

  await pool.execute(
    "INSERT INTO app_users (username, password, role, name, active) VALUES (?, ?, ?, ?, 1)",
    [username, hash, role, name],
  )
  console.log(`  Created ${username} → ${role}`)
}

try {
  console.log("Applying RBAC roles migration (MySQL)...")
  const ddl = fs.readFileSync(migrationPath, "utf8")
  await execRaw(ddl)

  const superUsername = process.env.SUPER_ADMIN_USERNAME?.trim()
  const superPassword = process.env.SUPER_ADMIN_PASSWORD?.trim()
  const adminUsername = process.env.ADMIN_USERNAME?.trim()
  const adminPassword = process.env.ADMIN_PASSWORD?.trim()

  if (!superUsername || !superPassword || !adminUsername || !adminPassword) {
    console.warn(
      "  Skipping privileged user upsert — set SUPER_ADMIN_USERNAME/PASSWORD and ADMIN_USERNAME/PASSWORD in .env",
    )
  } else {
    if (superUsername === adminUsername) {
      throw new Error("SUPER_ADMIN_USERNAME and ADMIN_USERNAME must be different.")
    }
    console.log("Upserting privileged accounts from environment...")
    await upsertUser({
      username: superUsername,
      password: superPassword,
      role: "Acmmo Admin",
      name: "Acmmo Admin",
    })
    await upsertUser({
      username: adminUsername,
      password: adminPassword,
      role: "Admin",
      name: "Office Admin",
    })
  }

  const [roles] = await pool.execute(
    "SELECT role, COUNT(*) AS count FROM app_users GROUP BY role ORDER BY role",
  )
  console.log("Role counts:")
  for (const row of roles) {
    console.log(`  - ${row.role}: ${row.count}`)
  }
  console.log("RBAC migration applied successfully.")
} catch (error) {
  console.error("Failed to apply RBAC migration:", error.message)
  process.exitCode = 1
} finally {
  await pool.end()
}
