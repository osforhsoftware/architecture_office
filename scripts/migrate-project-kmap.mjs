import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import mysql from "mysql2/promise"
import { loadEnv, parseDbUrl } from "./load-env.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const migrationPath = path.join(root, "scripts", "migrate-project-kmap.sql")

const FLOOR_KEYS = ["ground_floor", "first_floor", "second_floor", "third_floor"]

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
      if (err.code === "ER_TABLE_EXISTS_ERROR" || err.code === "ER_DUP_FIELDNAME") {
        console.warn(`  Already exists, skipping: ${err.message}`)
      } else {
        throw err
      }
    }
  }
}

try {
  console.log("Applying K-Map areas migration (MySQL)...")
  const ddl = fs.readFileSync(migrationPath, "utf8")
  await execRaw(ddl)

  try {
    await pool.execute("ALTER TABLE project_kmap_areas DROP COLUMN captured_time")
    console.log("  Dropped legacy captured_time column.")
  } catch (err) {
    if (err.code !== "ER_BAD_FIELD_ERROR" && err.code !== "ER_CANT_DROP_FIELD_OR_KEY") {
      throw err
    }
  }

  const [projects] = await pool.execute("SELECT id FROM projects")
  for (const project of projects) {
    for (const floorKey of FLOOR_KEYS) {
      await pool.execute(
        "INSERT IGNORE INTO project_kmap_areas (project_id, floor_key) VALUES (?, ?)",
        [project.id, floorKey],
      )
    }
  }

  console.log(`K-Map areas migration applied for ${projects.length} project(s).`)
} catch (error) {
  console.error("Failed to apply K-Map areas migration:", error.message)
  process.exitCode = 1
} finally {
  await pool.end()
}
