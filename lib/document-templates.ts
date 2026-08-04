import "server-only"

import { cache } from "react"
import { sql } from "./db"
import {
  SERVICE_CHECKLIST_ITEMS,
  type DocumentTemplateOption,
  type ServiceKey,
} from "./workflow"

export type { DocumentTemplateOption }

export interface DocumentTemplate {
  id: number
  service_key: string
  label: string
  sort_order: number
  active: boolean
}

function normalizeTemplate(row: Record<string, unknown>): DocumentTemplate {
  return {
    id: Number(row.id),
    service_key: String(row.service_key),
    label: String(row.label),
    sort_order: Number(row.sort_order ?? 0),
    active: Boolean(row.active),
  }
}

function defaultTemplates(): DocumentTemplate[] {
  const rows: DocumentTemplate[] = []
  let id = 0
  let sort = 0
  for (const [serviceKey, labels] of Object.entries(SERVICE_CHECKLIST_ITEMS)) {
    for (const label of labels) {
      id -= 1
      sort += 1
      rows.push({
        id,
        service_key: serviceKey,
        label,
        sort_order: sort,
        active: true,
      })
    }
  }
  return rows
}

async function ensureDefaultDocumentTemplatesSeeded(): Promise<void> {
  try {
    const countRows = (await sql`
      SELECT COUNT(*) AS count FROM document_templates
    `) as { count: number }[]
    if (Number(countRows[0]?.count ?? 0) > 0) return

    let sort = 0
    for (const [serviceKey, labels] of Object.entries(SERVICE_CHECKLIST_ITEMS)) {
      for (const label of labels) {
        sort += 1
        await sql`
          INSERT IGNORE INTO document_templates (service_key, label, sort_order, active)
          VALUES (${serviceKey}, ${label}, ${sort}, 1)
        `
      }
    }
  } catch (error) {
    console.warn("[document-templates] Could not seed defaults:", error)
  }
}

export const listDocumentTemplates = cache(
  async (opts?: {
    activeOnly?: boolean
    includeInactive?: boolean
  }): Promise<DocumentTemplate[]> => {
    const activeOnly = opts?.includeInactive ? false : opts?.activeOnly !== false
    try {
      await ensureDefaultDocumentTemplatesSeeded()

      const rows = activeOnly
        ? ((await sql`
            SELECT id, service_key, label, sort_order, active
            FROM document_templates
            WHERE active = 1
            ORDER BY sort_order ASC, label ASC
          `) as Record<string, unknown>[])
        : ((await sql`
            SELECT id, service_key, label, sort_order, active
            FROM document_templates
            ORDER BY sort_order ASC, label ASC
          `) as Record<string, unknown>[])

      if (!rows.length) {
        return defaultTemplates().filter((t) => (activeOnly ? t.active : true))
      }
      return rows.map(normalizeTemplate)
    } catch (error) {
      console.warn("[document-templates] Falling back to hardcoded catalog:", error)
      return defaultTemplates().filter((t) => (activeOnly ? t.active : true))
    }
  },
)

export async function getDocumentTemplateById(id: number): Promise<DocumentTemplate | null> {
  try {
    const rows = (await sql`
      SELECT id, service_key, label, sort_order, active
      FROM document_templates
      WHERE id = ${id}
      LIMIT 1
    `) as Record<string, unknown>[]
    return rows[0] ? normalizeTemplate(rows[0]) : null
  } catch {
    return null
  }
}

export function toDocumentOption(template: DocumentTemplate): DocumentTemplateOption {
  return {
    itemKey: `${template.service_key}::${template.label}`,
    serviceKey: template.service_key,
    label: template.label,
  }
}

/** Options for project create — only templates belonging to the given services. */
export function documentOptionsForServices(
  templates: readonly DocumentTemplate[],
  selectedServices: readonly ServiceKey[],
): DocumentTemplateOption[] {
  const selected = new Set(selectedServices)
  return templates
    .filter((t) => selected.has(t.service_key))
    .map(toDocumentOption)
}

export async function checklistItemsFromTemplates(
  selectedServices: readonly ServiceKey[],
): Promise<{ itemKey: string; serviceKey: string }[]> {
  const templates = await listDocumentTemplates({ activeOnly: true })
  return documentOptionsForServices(templates, selectedServices).map((item) => ({
    itemKey: item.itemKey,
    serviceKey: item.serviceKey,
  }))
}
