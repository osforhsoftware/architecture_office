import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import mysql from "mysql2/promise"
import { loadEnv, parseDbUrl } from "./load-env.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const migrationPath = path.join(root, "scripts", "migrate-drawing-number-unique.sql")

const url = loadEnv()
const pool = mysql.createPool({
  ...parseDbUrl(url),
  connectionLimit: 5,
  waitForConnections: true,
  charset: "utf8mb4",
})

async function nextDrawingNumber(conn) {
  const year = new Date().getFullYear()
  const prefix = `DRW-${year}-`
  const [rows] = await conn.query(
    `SELECT drawing_number FROM projects WHERE drawing_number LIKE ?`,
    [`${prefix}%`],
  )
  let maxSeq = 0
  for (const row of rows) {
    const suffix = String(row.drawing_number).slice(prefix.length)
    if (!/^\d+$/.test(suffix)) continue
    const seq = Number.parseInt(suffix, 10)
    if (seq > maxSeq) maxSeq = seq
  }
  return `${prefix}${String(maxSeq + 1).padStart(4, "0")}`
}

try {
  console.log("Fixing duplicate drawing numbers and adding unique index...")
  const conn = await pool.getConnection()
  try {
    const [dups] = await conn.query(
      `SELECT drawing_number, MIN(id) AS keep_id, GROUP_CONCAT(id ORDER BY id) AS ids
       FROM projects
       WHERE drawing_number IS NOT NULL AND drawing_number <> ''
       GROUP BY drawing_number
       HAVING COUNT(*) > 1`,
    )

    for (const dup of dups) {
      const ids = String(dup.ids)
        .split(",")
        .map((id) => Number(id))
        .filter((id) => id !== Number(dup.keep_id))

      for (const id of ids) {
        const next = await nextDrawingNumber(conn)
        await conn.execute(`UPDATE projects SET drawing_number = ? WHERE id = ?`, [next, id])
        console.log(`  Reassigned project ${id}: ${dup.drawing_number} → ${next}`)
      }
    }

    const ddl = fs.readFileSync(migrationPath, "utf8").trim().replace(/;?\s*$/, "")
    try {
      await conn.execute(ddl)
      console.log("  Unique index uq_projects_drawing_number created.")
    } catch (err) {
      if (err.code === "ER_DUP_KEYNAME") {
        console.warn("  Unique index already exists, skipping.")
      } else {
        throw err
      }
    }
  } finally {
    conn.release()
  }

  console.log("Drawing number uniqueness migration applied successfully.")
} catch (error) {
  console.error("Failed to apply drawing number uniqueness migration:", error.message)
  process.exitCode = 1
} finally {
  await pool.end()
}
