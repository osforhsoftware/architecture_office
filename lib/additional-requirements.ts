import "server-only"

import { cache } from "react"
import {
  additionalRequirementValueFieldName,
  parseChoiceOptions,
  parseCustomFieldValueType,
  type AdditionalRequirementOption,
} from "./additional-requirements-shared"
import { sql } from "./db"
import {
  clampPage,
  pageOffset,
  parsePage,
  parsePageSize,
  toPaginatedResult,
  type PaginatedResult,
  type PaginationParams,
} from "./pagination"
import type {
  AdditionalRequirementTemplate,
  AdditionalRequirementTemplateRow,
  ProjectAdditionalRequirement,
} from "./types"

export type {
  AdditionalRequirementOption,
  AdditionalRequirementTemplate,
  AdditionalRequirementTemplateRow,
  ProjectAdditionalRequirement,
}

function normalizeTemplate(row: Record<string, unknown>): AdditionalRequirementTemplate {
  return {
    id: Number(row.id),
    requirement_key: String(row.requirement_key),
    label: String(row.label),
    sort_order: Number(row.sort_order ?? 0),
    active: Boolean(row.active),
    value_type: parseCustomFieldValueType(row.value_type),
    choice_options: parseChoiceOptions(row.choice_options),
  }
}

function normalizeProjectRequirement(row: Record<string, unknown>): ProjectAdditionalRequirement {
  return {
    project_id: Number(row.project_id),
    requirement_key: String(row.requirement_key),
    label: String(row.label),
    value: String(row.value ?? ""),
    sort_order: Number(row.sort_order ?? 0),
    value_type: parseCustomFieldValueType(row.value_type),
    choice_options: parseChoiceOptions(row.choice_options),
  }
}

export const listAdditionalRequirementTemplates = cache(
  async (opts?: { activeOnly?: boolean }): Promise<AdditionalRequirementTemplate[]> => {
    const activeOnly = opts?.activeOnly !== false
    try {
      const rows = activeOnly
        ? ((await sql`
            SELECT id, requirement_key, label, sort_order, active, value_type, choice_options
            FROM additional_requirement_templates
            WHERE active = 1
            ORDER BY sort_order ASC, label ASC
          `) as Record<string, unknown>[])
        : ((await sql`
            SELECT id, requirement_key, label, sort_order, active, value_type, choice_options
            FROM additional_requirement_templates
            ORDER BY sort_order ASC, label ASC
          `) as Record<string, unknown>[])
      return rows.map(normalizeTemplate)
    } catch (error) {
      console.warn("[additional-requirements] Could not load templates:", error)
      return []
    }
  },
)

export function toAdditionalRequirementOption(
  template: AdditionalRequirementTemplate,
): AdditionalRequirementOption {
  return {
    value: template.requirement_key,
    label: template.label,
    valueType: template.value_type,
    choiceOptions: template.choice_options,
  }
}

export function makeRequirementKey(label: string): string {
  const base = label
    .normalize("NFKD")
    .replace(/[^\w\s/-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[/\s]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")

  return (base || "requirement").slice(0, 100)
}

export async function getAdditionalRequirementTemplateById(
  id: number,
): Promise<AdditionalRequirementTemplate | null> {
  try {
    const rows = (await sql`
      SELECT id, requirement_key, label, sort_order, active, value_type, choice_options
      FROM additional_requirement_templates
      WHERE id = ${id}
      LIMIT 1
    `) as Record<string, unknown>[]
    return rows[0] ? normalizeTemplate(rows[0]) : null
  } catch {
    return null
  }
}

export async function getAdditionalRequirementTemplatesPaginated(
  params: PaginationParams = {},
): Promise<PaginatedResult<AdditionalRequirementTemplateRow>> {
  const requestedPage = parsePage(params.page)
  const pageSize = parsePageSize(params.pageSize)
  const searchTerm = params.search?.trim().toLowerCase() ?? ""

  const templates = await listAdditionalRequirementTemplates({ activeOnly: false })
  const rows: AdditionalRequirementTemplateRow[] = []
  for (const template of templates) {
    let project_count = 0
    try {
      const counts = (await sql`
        SELECT COUNT(*) AS count
        FROM project_additional_requirements
        WHERE requirement_key = ${template.requirement_key}
      `) as { count: number }[]
      project_count = Number(counts[0]?.count ?? 0)
    } catch {
      project_count = 0
    }
    rows.push({ ...template, project_count })
  }

  const filtered = searchTerm
    ? rows.filter(
        (row) =>
          row.label.toLowerCase().includes(searchTerm) ||
          row.requirement_key.toLowerCase().includes(searchTerm),
      )
    : rows

  const total = filtered.length
  const page = clampPage(requestedPage, total, pageSize)
  const offset = pageOffset(page, pageSize)
  const pageRows = pageSize === -1 ? filtered : filtered.slice(offset, offset + pageSize)
  return toPaginatedResult(pageRows, total, page, pageSize)
}

export async function getProjectAdditionalRequirements(
  projectId: number,
): Promise<ProjectAdditionalRequirement[]> {
  try {
    const rows = (await sql`
      SELECT
        p.project_id,
        p.requirement_key,
        p.label,
        p.value,
        p.sort_order,
        COALESCE(t.value_type, p.value_type, 'text') AS value_type,
        COALESCE(t.choice_options, p.choice_options) AS choice_options
      FROM project_additional_requirements p
      LEFT JOIN additional_requirement_templates t
        ON t.requirement_key = p.requirement_key
      WHERE p.project_id = ${projectId}
      ORDER BY p.sort_order ASC, p.label ASC
    `) as Record<string, unknown>[]
    return rows.map(normalizeProjectRequirement)
  } catch {
    try {
      const rows = (await sql`
        SELECT project_id, requirement_key, label, value, sort_order
        FROM project_additional_requirements
        WHERE project_id = ${projectId}
        ORDER BY sort_order ASC, label ASC
      `) as Record<string, unknown>[]
      return rows.map(normalizeProjectRequirement)
    } catch {
      return []
    }
  }
}

export async function parseAdditionalRequirementsFromForm(
  formData: FormData,
  opts?: { includeInactive?: boolean },
): Promise<ProjectAdditionalRequirement[]> {
  const templates = await listAdditionalRequirementTemplates({
    activeOnly: !opts?.includeInactive,
  })
  const templateByKey = new Map(templates.map((template) => [template.requirement_key, template]))
  const selectedKeys = formData.getAll("additional_requirements").map((value) => String(value))

  const results: ProjectAdditionalRequirement[] = []
  for (const key of selectedKeys) {
    const template = templateByKey.get(key)
    if (!template) continue
    const value = String(formData.get(additionalRequirementValueFieldName(key)) || "").trim()
    results.push({
      project_id: 0,
      requirement_key: template.requirement_key,
      label: template.label,
      value,
      sort_order: template.sort_order,
      value_type: template.value_type,
      choice_options: template.choice_options,
    })
  }
  return results
}

export async function saveProjectAdditionalRequirements(
  projectId: number,
  requirements: readonly ProjectAdditionalRequirement[],
): Promise<void> {
  await sql`DELETE FROM project_additional_requirements WHERE project_id = ${projectId}`

  for (const requirement of requirements) {
    await sql`
      INSERT INTO project_additional_requirements (
        project_id, requirement_key, label, value, sort_order, value_type, choice_options
      )
      VALUES (
        ${projectId},
        ${requirement.requirement_key},
        ${requirement.label},
        ${requirement.value},
        ${requirement.sort_order},
        ${requirement.value_type},
        ${JSON.stringify(requirement.choice_options)}
      )
    `
  }
}
