import { sql } from "./db"
import { listProjectServiceDefs } from "./project-services"
import { checklistItemsFromTemplates } from "./document-templates"
import {
  buildWorkflowSteps,
  syncLegacyFieldsFromStep,
  type ServiceKey,
  type WorkflowStepRecord,
} from "./workflow"

export async function seedProjectWorkflow(
  projectId: number,
  selectedServices: readonly ServiceKey[],
  selectedDocuments?: readonly { itemKey: string; serviceKey: string }[],
): Promise<number | null> {
  const catalog = await listProjectServiceDefs({ includeInactive: true })
  const definitions = buildWorkflowSteps(selectedServices, catalog)
  let firstStepId: number | null = null

  for (const def of definitions) {
    const stepStatus = def.sortOrder === 0 ? "active" : "pending"
    const rows = (await sql`
      INSERT INTO workflow_steps (
        project_id, step_type, step_key, label, section, service_key, sort_order, step_status
      )
      VALUES (
        ${projectId}, ${def.stepType}, ${def.stepKey}, ${def.label}, ${def.section},
        ${def.serviceKey}, ${def.sortOrder}, ${stepStatus}
      )
    `) as { id: number }[]

    if (def.sortOrder === 0 && rows[0]?.id) firstStepId = rows[0].id
  }

  if (!firstStepId) {
    const found = (await sql`
      SELECT id FROM workflow_steps WHERE project_id = ${projectId} AND sort_order = 0 LIMIT 1
    `) as { id: number }[]
    firstStepId = found[0]?.id ?? null
  }

  for (const key of selectedServices) {
    await sql`
      INSERT IGNORE INTO project_services (project_id, service_key) VALUES (${projectId}, ${key})
    `
  }

  const documents =
    selectedDocuments ?? (await checklistItemsFromTemplates(selectedServices))
  for (const item of documents) {
    await sql`
      INSERT IGNORE INTO checklist_items (project_id, item_key, service_key, checked, filed, review_status)
      VALUES (${projectId}, ${item.itemKey}, ${item.serviceKey}, false, false, 'Pending')
    `
  }

  if (firstStepId) {
    const firstStep = (await sql`
      SELECT * FROM workflow_steps WHERE id = ${firstStepId}
    `) as WorkflowStepRecord[]
    const legacy = syncLegacyFieldsFromStep(firstStep[0] ?? null, "New", catalog)
    await sql`
      UPDATE projects
      SET current_workflow_step_id = ${firstStepId},
          section = ${legacy.section},
          current_stage = ${legacy.current_stage},
          status = 'Awaiting Assignment'
      WHERE id = ${projectId}
    `
  }

  return firstStepId
}

function workflowStepHasProgress(step: WorkflowStepRecord): boolean {
  return (
    step.step_status === "completed" ||
    step.step_status === "active" ||
    Boolean(step.started_at) ||
    Boolean(step.completed_at) ||
    Boolean(step.assigned_to)
  )
}

/** Add/remove workflow steps, services, and documents from an existing project. */
export async function syncProjectWorkflowFromServices(
  projectId: number,
  selectedServices: readonly ServiceKey[],
  selectedDocuments?: readonly { itemKey: string; serviceKey: string }[],
): Promise<{ error?: string }> {
  const catalog = await listProjectServiceDefs({ includeInactive: true })
  const definitions = buildWorkflowSteps(selectedServices, catalog)
  const existing = await getWorkflowSteps(projectId)
  const desiredKeys = new Set(definitions.map((def) => def.stepKey))

  for (const step of existing) {
    if (desiredKeys.has(step.step_key)) continue
    if (workflowStepHasProgress(step)) {
      return {
        error: `Cannot remove "${step.label}" from the workflow because that step already has progress. Keep the service, or finish that work first.`,
      }
    }
  }

  for (const step of existing) {
    if (desiredKeys.has(step.step_key)) continue
    await sql`DELETE FROM workflow_steps WHERE id = ${step.id} AND project_id = ${projectId}`
  }

  const remaining = await getWorkflowSteps(projectId)
  const remainingByKey = new Map(remaining.map((step) => [step.step_key, step]))

  for (const def of definitions) {
    const current = remainingByKey.get(def.stepKey)
    if (current) {
      await sql`
        UPDATE workflow_steps
        SET label = ${def.label},
            section = ${def.section},
            service_key = ${def.serviceKey},
            sort_order = ${def.sortOrder}
        WHERE id = ${current.id}
      `
      continue
    }
    await sql`
      INSERT INTO workflow_steps (
        project_id, step_type, step_key, label, section, service_key, sort_order, step_status
      )
      VALUES (
        ${projectId}, ${def.stepType}, ${def.stepKey}, ${def.label}, ${def.section},
        ${def.serviceKey}, ${def.sortOrder}, 'pending'
      )
    `
  }

  const existingServiceKeys = await getProjectServices(projectId)
  const keepServices = new Set(selectedServices)
  for (const key of existingServiceKeys) {
    if (!keepServices.has(key)) {
      await sql`
        DELETE FROM project_services
        WHERE project_id = ${projectId} AND service_key = ${key}
      `
    }
  }
  for (const key of selectedServices) {
    await sql`
      INSERT IGNORE INTO project_services (project_id, service_key) VALUES (${projectId}, ${key})
    `
  }

  const documents =
    selectedDocuments ?? (await checklistItemsFromTemplates(selectedServices))
  const desiredDocs = new Set(documents.map((item) => item.itemKey))
  const checklist = (await sql`
    SELECT id, item_key, checked, filed, review_status
    FROM checklist_items
    WHERE project_id = ${projectId}
  `) as {
    id: number
    item_key: string
    checked: boolean | number
    filed: boolean
    review_status: string | null
  }[]

  for (const item of checklist) {
    if (desiredDocs.has(item.item_key)) continue
    const kept =
      Boolean(item.checked) ||
      Boolean(item.filed) ||
      (item.review_status && item.review_status !== "Pending")
    if (kept) continue
    await sql`DELETE FROM checklist_items WHERE id = ${item.id}`
  }

  for (const item of documents) {
    await sql`
      INSERT IGNORE INTO checklist_items (project_id, item_key, service_key, checked, filed, review_status)
      VALUES (${projectId}, ${item.itemKey}, ${item.serviceKey}, false, false, 'Pending')
    `
  }

  const current = await getCurrentWorkflowStep(projectId)
  if (!current) {
    const first = (await sql`
      SELECT id FROM workflow_steps
      WHERE project_id = ${projectId}
      ORDER BY sort_order ASC
      LIMIT 1
    `) as { id: number }[]
    if (first[0]?.id) {
      await sql`
        UPDATE workflow_steps SET step_status = 'active' WHERE id = ${first[0].id}
      `
      await sql`
        UPDATE projects SET current_workflow_step_id = ${first[0].id} WHERE id = ${projectId}
      `
    }
  }

  return {}
}

export async function getWorkflowSteps(projectId: number): Promise<WorkflowStepRecord[]> {
  return (await sql`
    SELECT id, project_id, step_type, step_key, label, section, service_key, sort_order,
           step_status, assigned_to, started_at, completed_at
    FROM workflow_steps
    WHERE project_id = ${projectId}
    ORDER BY sort_order ASC
  `) as WorkflowStepRecord[]
}

export async function getCurrentWorkflowStep(projectId: number): Promise<WorkflowStepRecord | null> {
  const rows = (await sql`
    SELECT ws.id, ws.project_id, ws.step_type, ws.step_key, ws.label, ws.section,
           ws.service_key, ws.sort_order, ws.step_status, ws.assigned_to,
           ws.started_at, ws.completed_at
    FROM workflow_steps ws
    JOIN projects p ON p.current_workflow_step_id = ws.id
    WHERE p.id = ${projectId}
    LIMIT 1
  `) as WorkflowStepRecord[]

  if (rows[0]) return rows[0]

  const fallback = (await sql`
    SELECT id, project_id, step_type, step_key, label, section, service_key, sort_order,
           step_status, assigned_to, started_at, completed_at
    FROM workflow_steps
    WHERE project_id = ${projectId} AND step_status = 'active'
    ORDER BY sort_order ASC
    LIMIT 1
  `) as WorkflowStepRecord[]

  return fallback[0] ?? null
}

export async function getProjectServices(projectId: number): Promise<string[]> {
  const rows = (await sql`
    SELECT service_key FROM project_services WHERE project_id = ${projectId} ORDER BY service_key
  `) as { service_key: string }[]
  return rows.map((r) => r.service_key)
}

export async function activateWorkflowStep(
  projectId: number,
  stepId: number,
  status: string,
  assigneeId: number | null,
): Promise<void> {
  const step = (await sql`
    SELECT id, project_id, step_type, step_key, label, section, service_key, sort_order,
           step_status, assigned_to, started_at, completed_at
    FROM workflow_steps WHERE id = ${stepId} AND project_id = ${projectId}
  `) as WorkflowStepRecord[]

  if (!step[0]) return

  await sql`
    UPDATE workflow_steps SET step_status = 'pending', assigned_to = NULL
    WHERE project_id = ${projectId} AND step_status = 'active'
  `
  await sql`
    UPDATE workflow_steps
    SET step_status = 'active', assigned_to = ${assigneeId},
        started_at = COALESCE(started_at, NOW())
    WHERE id = ${stepId}
  `

  const catalog = await listProjectServiceDefs({ includeInactive: true })
  const legacy = syncLegacyFieldsFromStep(step[0], status, catalog)
  await sql`
    UPDATE projects
    SET current_workflow_step_id = ${stepId},
        section = ${legacy.section},
        current_stage = ${legacy.current_stage},
        assigned_to = ${assigneeId},
        status = ${status},
        work_completed_at = NULL,
        updated_at = NOW()
    WHERE id = ${projectId}
  `
}

export async function completeCurrentStep(projectId: number): Promise<WorkflowStepRecord | null> {
  const current = await getCurrentWorkflowStep(projectId)
  if (!current) return null

  await sql`
    UPDATE workflow_steps
    SET step_status = 'completed', completed_at = NOW()
    WHERE id = ${current.id}
  `

  const next = (await sql`
    SELECT id, project_id, step_type, step_key, label, section, service_key, sort_order,
           step_status, assigned_to, started_at, completed_at
    FROM workflow_steps
    WHERE project_id = ${projectId} AND sort_order > ${current.sort_order}
    ORDER BY sort_order ASC
    LIMIT 1
  `) as WorkflowStepRecord[]

  return next[0] ?? null
}

export async function recordWorkflowReview(
  projectId: number,
  stepId: number,
  decision: "approved" | "rejected",
  note: string | null,
  reviewerId: number,
): Promise<void> {
  await sql`
    INSERT INTO workflow_reviews (project_id, workflow_step_id, decision, note, reviewed_by)
    VALUES (${projectId}, ${stepId}, ${decision}, ${note}, ${reviewerId})
  `
}

export async function recordWorkflowAssignment(
  projectId: number,
  stepId: number,
  userId: number,
  assignedBy: number,
  note: string | null,
): Promise<void> {
  await sql`
    INSERT INTO workflow_assignments (project_id, workflow_step_id, user_id, assigned_by, note)
    VALUES (${projectId}, ${stepId}, ${userId}, ${assignedBy}, ${note})
  `
}

export type WorkflowReviewRow = {
  id: number
  project_id: number
  workflow_step_id: number
  decision: "approved" | "rejected" | string
  note: string | null
  reviewed_by: number | null
  created_at: string
  step_label: string
  step_key: string
  reviewer_name: string | null
}

export async function getWorkflowReviews(projectId: number): Promise<WorkflowReviewRow[]> {
  return (await sql`
    SELECT
      wr.id,
      wr.project_id,
      wr.workflow_step_id,
      wr.decision,
      wr.note,
      wr.reviewed_by,
      wr.created_at,
      ws.label AS step_label,
      ws.step_key,
      u.name AS reviewer_name
    FROM workflow_reviews wr
    JOIN workflow_steps ws ON ws.id = wr.workflow_step_id
    LEFT JOIN app_users u ON u.id = wr.reviewed_by
    WHERE wr.project_id = ${projectId}
    ORDER BY wr.created_at DESC
  `) as WorkflowReviewRow[]
}
