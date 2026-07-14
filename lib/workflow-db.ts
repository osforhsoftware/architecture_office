import { sql } from "./db"
import {
  buildWorkflowSteps,
  checklistItemsForServices,
  syncLegacyFieldsFromStep,
  type ServiceKey,
  type WorkflowStepRecord,
} from "./workflow"

export async function seedProjectWorkflow(
  projectId: number,
  selectedServices: readonly ServiceKey[],
): Promise<number | null> {
  const definitions = buildWorkflowSteps(selectedServices)
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

  for (const item of checklistItemsForServices(selectedServices)) {
    await sql`
      INSERT IGNORE INTO checklist_items (project_id, item_key, service_key, checked, filed, review_status)
      VALUES (${projectId}, ${item.itemKey}, ${item.serviceKey}, false, false, 'Pending')
    `
  }

  if (firstStepId) {
    const firstStep = (await sql`
      SELECT * FROM workflow_steps WHERE id = ${firstStepId}
    `) as WorkflowStepRecord[]
    const legacy = syncLegacyFieldsFromStep(firstStep[0] ?? null, "New")
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

  const legacy = syncLegacyFieldsFromStep(step[0], status)
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
