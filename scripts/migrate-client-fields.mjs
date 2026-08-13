import mysql from "mysql2/promise"
import { loadEnv, parseDbUrl } from "./load-env.mjs"

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
    /Duplicate column/i.test(msg) ||
    /already exists/i.test(msg)
  )
}

async function addColumn(name, preferredType, fallbackType) {
  try {
    await pool.execute(`ALTER TABLE clients ADD COLUMN ${name} ${preferredType}`)
    console.log(`  Added ${name} ${preferredType}`)
    return
  } catch (err) {
    if (isSkippable(err)) {
      console.warn(`  Column already exists, skipping: ${name}`)
      return
    }
    if (!fallbackType) throw err
    try {
      await pool.execute(`ALTER TABLE clients ADD COLUMN ${name} ${fallbackType}`)
      console.log(`  Added ${name} ${fallbackType} (fallback)`)
    } catch (fallbackErr) {
      if (isSkippable(fallbackErr)) {
        console.warn(`  Column already exists, skipping: ${name}`)
        return
      }
      throw fallbackErr
    }
  }
}

try {
  console.log("Applying client fields migration (MySQL)...")
  await addColumn("street", "VARCHAR(500)", "TEXT")
  await addColumn("district", "VARCHAR(100)", "VARCHAR(255)")
  await addColumn("aadhaar_numbers", "JSON", "TEXT")
  await addColumn("linked_numbers", "JSON", "TEXT")
  console.log("Client fields migration applied successfully.")
} catch (error) {
  console.error("Failed to apply client fields migration:", error.message)
  process.exitCode = 1
} finally {
  await pool.end()
}
