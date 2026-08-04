import path from "path"
import { fileURLToPath } from "url"
import mysql from "mysql2/promise"
import { loadEnv, parseDbUrl } from "./load-env.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
void root

const url = loadEnv()
const pool = mysql.createPool({
  ...parseDbUrl(url),
  connectionLimit: 5,
  waitForConnections: true,
  charset: "utf8mb4",
})

async function columnExists(table, column) {
  const [rows] = await pool.execute(
    `SELECT COUNT(*) AS cnt
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?`,
    [table, column],
  )
  return Number(rows[0]?.cnt) > 0
}

try {
  console.log("Adding invoice line item discount columns...")

  if (!(await columnExists("invoice_line_items", "discount_amount"))) {
    await pool.execute(
      `ALTER TABLE invoice_line_items
       ADD COLUMN discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER unit_price`,
    )
    console.log("  + discount_amount")
  } else {
    console.log("  = discount_amount already exists")
  }

  if (!(await columnExists("invoice_line_items", "discount_percent"))) {
    await pool.execute(
      `ALTER TABLE invoice_line_items
       ADD COLUMN discount_percent DECIMAL(5,2) NOT NULL DEFAULT 0 AFTER discount_amount`,
    )
    console.log("  + discount_percent")
  } else {
    console.log("  = discount_percent already exists")
  }

  console.log("Invoice line discount migration applied.")
} catch (error) {
  console.error("Failed to apply discount migration:", error.message)
  process.exitCode = 1
} finally {
  await pool.end()
}
