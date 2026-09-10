import "server-only"

import { mysqlErrorCode, sql } from "./db"
import { SERVICE_CHECKLIST_ITEMS } from "./workflow"

let projectAcmmoReady = false

async function addProjectColumn(preferred: () => Promise<unknown>) {
  try {
    await preferred()
  } catch (error) {
    const code = mysqlErrorCode(error)
    const message = String((error as { message?: string })?.message ?? "")
    if (code === "ER_DUP_FIELDNAME" || /duplicate column/i.test(message)) return
    console.warn("[projects] could not add ACMMO column:", error)
  }
}

/** Live DBs may predate ACMMO project flags / plinth service — add them on first use. */
export async function ensureProjectAcmmoUpdates() {
  if (projectAcmmoReady) return

  await addProjectColumn(() =>
    sql`ALTER TABLE projects ADD COLUMN site_visit_pending TINYINT(1) NOT NULL DEFAULT 0`,
  )
  await addProjectColumn(() =>
    sql`ALTER TABLE projects ADD COLUMN under_construction TINYINT(1) NOT NULL DEFAULT 0`,
  )

  try {
    await sql`
      INSERT IGNORE INTO services (service_key, label, section, role, sort_order, active)
      VALUES (
        'plinth_level_inspection',
        'Plinth-Level Inspection',
        'Planning & Design',
        'Planning Staff',
        13,
        1
      )
    `
  } catch (error) {
    console.warn("[projects] could not ensure plinth service:", error)
  }

  try {
    const labels = SERVICE_CHECKLIST_ITEMS.plinth_level_inspection ?? []
    let sort = 0
    for (const label of labels) {
      sort += 1
      await sql`
        INSERT IGNORE INTO document_templates (service_key, label, sort_order, active)
        VALUES ('plinth_level_inspection', ${label}, ${sort}, 1)
      `
    }
  } catch (error) {
    console.warn("[projects] could not ensure plinth document templates:", error)
  }

  projectAcmmoReady = true
}
