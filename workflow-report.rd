# Architecture Office App — Project Workflow & Assignment Report
# Generated from codebase (lib/workflow.ts, lib/workflow-db.ts, lib/actions.ts,
#   lib/project-access.ts, components/project-workflow-panel.tsx, scripts/schema.sql)
# Date: 2026-07-13
# Model: Service-driven workflow with per-step assignment and optional multi-assignee

================================================================================
1. OVERVIEW
================================================================================

Projects follow a SERVICE-DRIVEN WORKFLOW:

- When a project is created, selected services determine which workflow steps exist.
- Each selected service gets:  Work step  →  Admin Review step
- Fixed bookends: Planning (first) and Billing (last).
- Admin assigns staff to the active work step; staff complete work and submit for review.
- Admin approves (advance) or rejects (return to prior work step for correction).

Assignment model:
  - PRIMARY assignee  →  projects.assigned_to  (+ workflow_steps.assigned_to)
  - MULTI-assignees   →  project_assignees table (currently Site Survey only)
  - Assignment history →  workflow_assignments (audit trail per assign event)
  - Review history     →  workflow_reviews (approve / reject with notes)

Source of truth:
  - lib/workflow.ts       →  service catalog, step builder, multi-assignee rules
  - lib/workflow-db.ts    →  seed / activate / complete steps, record assign/review
  - lib/actions.ts        →  assignProject, approve/reject, staff work actions
  - components/project-workflow-panel.tsx  →  Admin & Staff UI controls
  - components/workflow-timeline.tsx       →  visual progress timeline

================================================================================
2. PACKAGES & SERVICE SELECTION
================================================================================

Project packages (projects.project_package):

| Package | Behavior |
|---------|----------|
| full    | All 12 catalog services are selected automatically |
| custom  | Admin picks services via form field `services` |

Selected services are stored in `project_services (project_id, service_key)`.

Alias (residential custom forms):
  - architectural_plan  →  architecture_design

On create, seedProjectWorkflow():
  1. buildWorkflowSteps(selectedServices)
  2. Insert workflow_steps (first step = active, rest = pending)
  3. Insert project_services rows
  4. Seed service-specific checklist_items
  5. Set project status = 'Awaiting Assignment'
  6. Point projects.current_workflow_step_id at Planning step

================================================================================
3. SERVICE CATALOG
================================================================================

From lib/workflow.ts → PROJECT_SERVICES (order = workflow sequence):

| # | Service Key              | Label                       | Section                     | Role               | Multi-assignee |
|---|--------------------------|-----------------------------|-----------------------------|--------------------|----------------|
| 1 | site_survey              | Site Survey / Measurement   | Planning & Design           | Planning Staff     | YES            |
| 2 | architecture_design      | Architecture Design         | Planning & Design           | Planning Staff     | No             |
| 3 | concept_design           | Concept Design              | Planning & Design           | Planning Staff     | No             |
| 4 | plot_sketch              | Plot Sketch                 | Planning & Design           | Planning Staff     | No             |
| 5 | building_permit          | Building Permit             | Building Permit             | Permit Staff       | No             |
| 6 | permit_renewal           | Permit Renewal              | Building Permit             | Permit Staff       | No             |
| 7 | 3d_elevation             | 3D Elevation                | 3D & Interior               | 3D Staff           | No             |
| 8 | interior_design          | Interior Design             | 3D & Interior               | 3D Staff           | No             |
| 9 | working_drawings         | Working Drawings            | Estimation & Construction   | Estimation Staff   | No             |
|10 | estimation               | Estimation                  | Estimation & Construction   | Estimation Staff   | No             |
|11 | construction_supervision | Construction Supervision    | Estimation & Construction   | Estimation Staff   | No             |
|12 | valuation                | Valuation Course            | Estimation & Construction   | Estimation Staff   | No             |

DB mirror: `services` table (seeded by migrate-workflow / schema.sql).
Runtime rules (allowsMultiAssignee, roleForStep) come from lib/workflow.ts, not from DB.

================================================================================
4. HOW WORKFLOW STEPS ARE BUILT
================================================================================

buildWorkflowSteps(selectedServices) produces:

  1. Planning                          (step_type = planning)
  2. For EACH selected service (catalog order):
       a. Service work step            (step_type = service,  step_key = service_key)
       b. Admin Review                 (step_type = admin_review, step_key = review_<service_key>)
  3. Billing                           (step_type = billing)

Example — custom project with only site_survey + building_permit:

  sort | step_key              | type         | label
  -----|-----------------------|--------------|---------------------------
    0  | planning              | planning     | Planning
    1  | site_survey           | service      | Site Survey / Measurement
    2  | review_site_survey    | admin_review | Admin Review
    3  | building_permit       | service      | Building Permit
  4  | review_building_permit| admin_review | Admin Review
    5  | billing               | billing      | Billing

Full package (all 12 services) → Planning + 12×(service+review) + Billing = 26 steps.

Step status values (workflow_steps.step_status):
  - pending    not yet reached
  - active     current step (projects.current_workflow_step_id)
  - completed  finished
  - skipped    (reserved; not heavily used in current actions)

Work vs review helpers:
  - isWorkStep()   → planning | service | billing
  - isReviewStep() → admin_review

================================================================================
5. HIGH-LEVEL PIPELINE
================================================================================

  Project Created
       ↓
  Planning  →  (assign)  →  staff work  →  submit
       ↓
  Admin Review  →  Approve → next service  |  Reject → Correction Required
       ↓
  … repeat for each selected service …
       ↓
  Billing  →  payment Paid  →  Close project  →  Closed / Completed

Typical staff loop per work step:
  Awaiting Assignment / New
       → Admin assigns
  Assigned
       → Staff: Start work
  In Progress
       → Staff: Mark work completed
  Work Completed
       → Staff: Submit for admin review
  Pending Review
       → Admin: Approve & assign next  OR  Reject (correction)

================================================================================
6. PROJECT STATUSES (WORKFLOW-RELEVANT)
================================================================================

From lib/constants.ts → PROJECT_STATUSES (subset used by workflow actions):

| Status                 | Who sets it              | Meaning |
|------------------------|--------------------------|---------|
| New                    | create / move dept       | Not yet in active assign flow |
| Awaiting Assignment    | seedProjectWorkflow      | Steps seeded; needs first assign |
| Assigned               | assignProject / approve  | Staff assigned to active step |
| In Progress            | startWork                | Staff started work |
| Work Completed         | markWorkComplete         | Staff finished; can submit |
| Pending Review         | submitForReview          | Admin must approve/reject |
| Correction Required    | rejectReview             | Staff must fix and resubmit |
| Returned               | returnProject            | Staff returned to office |
| Waiting for Documents  | set status / ops         | Blocked on docs |
| Waiting for Payment    | billing                  | Awaiting payment |
| Completed / Closed     | closeProject             | Finished |
| Cancelled / On Hold    | admin status update      | Stopped / paused |

================================================================================
7. ASSIGNMENT MODEL
================================================================================

--------------------------------------------------------------------------------
7.1 Primary assignee (single)
--------------------------------------------------------------------------------

Stored on:
  - projects.assigned_to          (legacy + UI "primary" display)
  - workflow_steps.assigned_to    (per active step)

Set by:
  - assignProject()           → activates step with primaryAssignee = first selected ID
  - approveSectionReview()    → optional next staff on approve
  - assignToDepartment()      → admin override move
  - activateWorkflowStep()    → writes both project + step assignee

UI:
  - FormSelect "Assign staff" when multi-assign is OFF for the current step
  - Staff list filtered by roleForStep(currentStep) / SECTION_ROLE[section]

--------------------------------------------------------------------------------
7.2 Multi-assignee (team assign) — FEATURE
--------------------------------------------------------------------------------

Flag: PROJECT_SERVICES[].allowsMultiAssignee

Current rule (lib/workflow.ts → allowsMultiAssignee()):
  - Only service steps whose service has allowsMultiAssignee = true
  - Planning / billing / admin_review → NEVER multi
  - TODAY: only site_survey = true

When multi-assign is ON for the active step:

  UI (ProjectWorkflowPanel):
    - Label: "Assign team"
    - Control: FormMultiSelect name="assigned_to"
    - Preselects project.site_assignee_ids
    - Options: staff matching Planning Staff (step role)

  Server (assignProject):
    1. parseAssignedStaffIds(formData) — FormData.getAll("assigned_to")
    2. Require ≥ 1 ID; allow multiple
    3. primaryAssignee = staffIds[0]
    4. activateWorkflowStep(..., primaryAssignee)
    5. syncSiteAssignees(projectId, staffIds, stageKey)
         stageKey = currentStep.service_key ?? currentStep.step_key
         → for site_survey, stage_key = "site_survey"
    6. Notify EVERY selected staff
    7. recordWorkflowAssignment for EACH staff
    8. Audit log includes assignee + assignees[]

When multi-assign is OFF:
  - Only one staff ID accepted (error if > 1)
  - clearSiteAssignees(projectId) — wipe team rows
  - Single FormSelect UI

--------------------------------------------------------------------------------
7.3 project_assignees table (team storage)
--------------------------------------------------------------------------------

Schema:
  project_assignees (
    project_id, user_id, stage_key, created_at
    PRIMARY KEY (project_id, user_id, stage_key)
  )

Purpose:
  - Extra assignees beyond projects.assigned_to
  - Used so co-assigned Planning staff can open/edit site survey projects

Loaded onto Project type as:
  - site_assignee_ids: number[]
  - site_assignee_names: string[]

Access (lib/project-access.ts → staffOwnsProject):
  - User is primary assignee  OR
  - Project is in site-visit stage AND user is in site_assignee_ids

Note: SITE_VISIT_STAGE_KEY in constants is still "site_visit" (legacy stage key).
Multi-assign sync uses the workflow service_key (e.g. "site_survey") as stage_key.
Site-visit ownership checks still use the legacy stage index in Planning & Design —
verify alignment if multi-assign access seems incorrect for co-assignees.

--------------------------------------------------------------------------------
7.4 Assignment history
--------------------------------------------------------------------------------

workflow_assignments (
  project_id, workflow_step_id, user_id, assigned_by, note, created_at
)

Written by recordWorkflowAssignment() on every assign (including each team member).

================================================================================
8. ADMIN ACTIONS (WORKFLOW PANEL)
================================================================================

Component: components/project-workflow-panel.tsx (isAdmin = true)

| Action                    | Server action              | When available |
|---------------------------|----------------------------|----------------|
| Assign / Assign team      | assignProject              | Not in Pending Review |
| Approve & assign next     | approveSectionReview       | status = Pending Review |
| Reject — correction       | rejectReview               | status = Pending Review |
| Reassign returned         | reassignReturnedProject    | status = Returned |
| Move department (override)| assignToDepartment         | Always (admin) |
| Update status             | setProjectStatus           | Always (admin) |
| Close project             | closeProject               | Billing step + payment Paid |

Approve flow:
  - Completes current admin_review step
  - Activates next work step (service / planning / billing)
  - Optional assigned_to → Assigned; else Awaiting Assignment / section default
  - Clears site assignees when moving on (via activate / clear paths as applicable)
  - Records workflow_reviews decision = approved

Reject flow:
  - Completes review step
  - Reactivates prior work step with status Correction Required
  - Notifies primary assignee
  - Records workflow_reviews decision = rejected

================================================================================
9. STAFF ACTIONS (WORKFLOW PANEL)
================================================================================

| Action                 | Server action     | Allowed statuses |
|------------------------|-------------------|------------------|
| Start work             | startWork         | Assigned, Correction Required |
| Mark work completed    | markWorkComplete  | Assigned, In Progress, Correction Required |
| Submit for admin review| submitForReview   | Work Completed, In Progress (+ Assigned guarded) |
| Return to office       | returnProject     | With RETURN_REASONS |

Guards:
  - requireStaffProjectAccess → must own/edit the project
  - Billing Staff typically does not run these staff work actions

Submit for review:
  - Completes current work step
  - Activates matching admin_review step
  - status → Pending Review
  - Notifies all Admins

================================================================================
10. SERVICE CHECKLISTS
================================================================================

SERVICE_CHECKLIST_ITEMS in lib/workflow.ts — seeded per selected service.

| Service Key              | Checklist items (examples) |
|--------------------------|----------------------------|
| site_survey              | Site Photos, Measurement Notes, Location Sketch |
| architecture_design      | Client Brief, Site Constraints, Design Options |
| concept_design           | Concept Drawings, Client Approval |
| plot_sketch              | Plot Dimensions, Boundary Sketch, North Point |
| building_permit          | Possession Certificate, Land Tax Receipt, Sale Deed, … |
| permit_renewal           | Existing Permit, Tax Receipt, Renewal Application |
| 3d_elevation             | Reference Photos, Elevation Views, Material Palette |
| interior_design          | Mood Board, Material Selection, Furniture Layout |
| working_drawings         | Structural Notes, MEP Coordination, Detail Sheets |
| estimation               | BOQ, Rate Analysis, Cost Summary |
| construction_supervision | Site Reports, Quality Checklist, Progress Photos |
| valuation                | Survey Plan, Tax Receipt, Property Details |

Item keys: `{service_key}::{label}` in checklist_items.

================================================================================
11. DATABASE TABLES (WORKFLOW)
================================================================================

| Table                | Role |
|----------------------|------|
| services             | Catalog mirror of PROJECT_SERVICES |
| project_services     | Which services this project selected |
| workflow_steps       | Ordered steps for the project |
| workflow_assignments | Who was assigned to which step (history) |
| workflow_reviews     | Approve/reject decisions |
| project_assignees    | Multi-assignee / team members for a stage |
| checklist_items      | Service-scoped checklist (service_key column) |
| projects             | assigned_to, current_workflow_step_id, project_package, work_completed_at, section, status |

Migration scripts:
  - scripts/migrate-workflow.sql / .mjs
  - scripts/migrate-project-assignees.sql / .mjs
  - scripts/schema.sql (full create)

================================================================================
12. UI SURFACES
================================================================================

| UI                         | Path / component                      | Shows |
|----------------------------|---------------------------------------|-------|
| Workflow panel             | ProjectWorkflowPanel                  | Current step, assign, review, staff actions |
| Timeline                   | WorkflowTimeline                      | Horizontal/vertical progress nodes |
| Project detail (admin)     | app/admin/projects/[id]               | Primary assignee + multi site names |
| Project detail (staff)     | app/staff/projects/[id]               | Own work actions |
| Form multi-select          | FormMultiSelect                       | Team pick for site_survey |

Timeline node types: milestone | service | review | billing | closed

================================================================================
13. HOW TO ENABLE MULTI-ASSIGN FOR ANOTHER SERVICE
================================================================================

Today only site_survey supports multi-assign. To add another service:

  1. In lib/workflow.ts → PROJECT_SERVICES entry:
       set allowsMultiAssignee: true

  2. No UI change needed — ProjectWorkflowPanel already switches on
       allowsMultiAssignee(currentStep)

  3. assignProject already:
       - accepts multiple IDs
       - syncSiteAssignees with stage_key = service_key
       - notifies & records each assignee

  4. Review lib/project-access.ts staffOwnsProject / staffContributedToProject
       if co-assignees must edit outside the legacy site-visit stage check.
       You may need a broader "member of project_assignees for current stage"
       rule instead of only site-visit stage.

  5. Optionally extend project detail UI that shows site_assignee_names
       so team names display for other multi-assign stages too.

================================================================================
14. KEY CODE MAP
================================================================================

| Concern                    | File |
|----------------------------|------|
| Service catalog + builder  | lib/workflow.ts |
| Seed / activate / complete | lib/workflow-db.ts |
| Assign / approve / staff   | lib/actions.ts (assignProject, approveSectionReview, …) |
| Ownership / multi access   | lib/project-access.ts |
| Admin/staff controls       | components/project-workflow-panel.tsx |
| Timeline UI                | components/workflow-timeline.tsx |
| Multi-select control       | components/form-multi-select.tsx |
| Schema                     | scripts/schema.sql, scripts/migrate-workflow.sql |

================================================================================
15. QUICK REFERENCE — WHO DOES WHAT
================================================================================

Admin:
  - Create project + choose package/services
  - Assign staff (single) or team (site survey)
  - Approve / reject after each service
  - Move department (override), reassign returned, close after billing paid

Planning / Permit / 3D / Estimation Staff:
  - See projects they own (primary) or co-own (site assignees where applicable)
  - Start work → complete → submit for review
  - Return with reason if blocked

Billing Staff:
  - Billing / invoices / payment; close path depends on Admin close + Paid
  - Not the primary workflow assignees for planning/permit/3D/estimation steps

================================================================================
END OF WORKFLOW REPORT
================================================================================
