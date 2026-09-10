import "server-only"

import { mysqlErrorCode, sql } from "./db"

let clientExtraColumnsReady = false

async function addClientColumn(
  preferred: () => Promise<unknown>,
  fallback: () => Promise<unknown>,
) {
  try {
    await preferred()
  } catch (error) {
    if (mysqlErrorCode(error) === "ER_DUP_FIELDNAME") return
    try {
      await fallback()
    } catch (fallbackError) {
      if (mysqlErrorCode(fallbackError) !== "ER_DUP_FIELDNAME") {
        console.warn("[clients] could not add extra column:", fallbackError)
      }
    }
  }
}

/** Live DBs may predate street / Aadhaar / source columns — add them on first use. */
export async function ensureClientExtraColumns() {
  if (clientExtraColumnsReady) return
  await addClientColumn(
    () => sql`ALTER TABLE clients ADD COLUMN street VARCHAR(500)`,
    () => sql`ALTER TABLE clients ADD COLUMN street TEXT`,
  )
  await addClientColumn(
    () => sql`ALTER TABLE clients ADD COLUMN district VARCHAR(100)`,
    () => sql`ALTER TABLE clients ADD COLUMN district VARCHAR(255)`,
  )
  await addClientColumn(
    () => sql`ALTER TABLE clients ADD COLUMN aadhaar_numbers JSON`,
    () => sql`ALTER TABLE clients ADD COLUMN aadhaar_numbers TEXT`,
  )
  await addClientColumn(
    () => sql`ALTER TABLE clients ADD COLUMN linked_numbers JSON`,
    () => sql`ALTER TABLE clients ADD COLUMN linked_numbers TEXT`,
  )
  await addClientColumn(
    () => sql`ALTER TABLE clients ADD COLUMN source VARCHAR(20) NOT NULL DEFAULT 'office'`,
    () => sql`ALTER TABLE clients ADD COLUMN source VARCHAR(50) DEFAULT 'office'`,
  )
  clientExtraColumnsReady = true
}
