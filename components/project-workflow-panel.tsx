"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { FormSelect } from "@/components/form-select"
import { FormMultiSelect } from "@/components/form-multi-select"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  approveSectionReview,
  assignProject,
  assignToDepartment,
  closeProject,
  markWorkComplete,
  reassignReturnedProject,
  rejectReview,
  returnProject,
  setProjectStatus,
  startWork,
  submitForReview,
} from "@/lib/actions"
import { PROJECT_STATUSES, RETURN_REASONS, SECTIONS, SECTION_ROLE, formatRolesLabel, userHasRole } from "@/lib/constants"
import { allowsMultiAssignee, roleForStep } from "@/lib/workflow"
import type { WorkflowStepRecord } from "@/lib/workflow"
import type { AppUser, Project } from "@/lib/types"

export function ProjectWorkflowPanel({
  project,
  workflowSteps,
  currentStep,
  staff,
  isAdmin,
  readOnly = false,
  departmentOptions,
  sectionRoleMap,
}: {
  project: Project
  workflowSteps: WorkflowStepRecord[]
  currentStep: WorkflowStepRecord | null
  staff: AppUser[]
  isAdmin: boolean
  userRole: string
  readOnly?: boolean
  /** Active department names for the move-to-department select */
  departmentOptions?: string[]
  /** section name → staff role label */
  sectionRoleMap?: Record<string, string>
}) {
  const [pending, startTransition] = useTransition()
  const [status, setStatus] = useState(project.status)

  useEffect(() => {
    setStatus(project.status)
  }, [project.status])

  const multiAssign = currentStep ? allowsMultiAssignee(currentStep) : false
  const roleMap = sectionRoleMap ?? SECTION_ROLE
  const stepRole = currentStep
    ? roleForStep(currentStep) ?? roleMap[currentStep.section] ?? null
    : null
  const sectionStaff = staff.filter((s) => {
    if (stepRole) return userHasRole(s, stepRole)
    const sectionRole = roleMap[project.section]
    return sectionRole ? userHasRole(s, sectionRole) : false
  })

  const sectionStaffOptions = useMemo(
    () =>
      sectionStaff.map((s) => ({
        value: String(s.id),
        label: s.name,
        description: formatRolesLabel(s),
      })),
    [sectionStaff],
  )

  const allStaffOptions = useMemo(
    () =>
      staff.map((s) => ({
        value: String(s.id),
        label: s.name,
        description: formatRolesLabel(s),
      })),
    [staff],
  )

  const sections = departmentOptions?.length ? departmentOptions : [...SECTIONS]
  const sectionOptions = useMemo(
    () => sections.map((s) => ({ value: s, label: s })),
    [sections],
  )

  const completedCount = workflowSteps.filter((s) => s.step_status === "completed").length

  function run(action: (fd: FormData) => Promise<{ error?: string; success?: boolean }>, fd: FormData) {
    startTransition(async () => {
      const res = await action(fd)
      if (res?.error) toast.error(res.error)
      else toast.success("Updated")
    })
  }

  const isBillingStep = currentStep?.step_type === "billing"
  const isReviewActive = project.status === "Pending Review"

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg bg-muted/50 p-4">
        <p className="text-sm font-medium">Current step</p>
        <p className="text-lg">{currentStep?.label ?? "—"}</p>
        <p className="text-sm text-muted-foreground">
          {project.section} · {completedCount} of {workflowSteps.length} steps completed
        </p>
        {project.review_note ? (
          <p className="mt-2 text-sm text-amber-800">Review note: {project.review_note}</p>
        ) : null}
      </div>

      {isAdmin ? (
        <div className="flex flex-col gap-4">
          {isReviewActive ? (
            <div className="rounded-lg border border-violet-200 bg-violet-50 p-4 dark:border-violet-900 dark:bg-violet-950/30">
              <p className="mb-3 text-sm font-medium">Admin review required</p>
              <form
                action={(fd) => run(approveSectionReview, fd)}
                className="flex flex-col gap-3"
              >
                <input type="hidden" name="project_id" value={project.id} />
                <div className="flex flex-col gap-2">
                  <Label>Assign next staff (optional)</Label>
                  <FormMultiSelect
                    name="assigned_to"
                    placeholder="Search or select staff for next step..."
                    searchPlaceholder="Search staff..."
                    options={allStaffOptions}
                  />
                </div>
                <Textarea name="note" placeholder="Approval notes" />
                <Button type="submit" disabled={pending}>Approve & assign next</Button>
              </form>
              <form
                action={(fd) => run(rejectReview, fd)}
                className="mt-3 flex flex-col gap-2 border-t border-violet-200 pt-3"
              >
                <input type="hidden" name="project_id" value={project.id} />
                <Textarea name="note" placeholder="Correction feedback (required)" required />
                <Button type="submit" variant="destructive" disabled={pending}>
                  Reject — correction required
                </Button>
              </form>
            </div>
          ) : null}

          {project.status === "Returned" ? (
            <form action={(fd) => run(reassignReturnedProject, fd)} className="flex flex-col gap-2">
              <input type="hidden" name="project_id" value={project.id} />
              <Label>Reassign returned project</Label>
              <FormMultiSelect
                name="assigned_to"
                required
                placeholder="Search or select staff..."
                searchPlaceholder="Search staff..."
                options={sectionStaffOptions}
              />
              <Button type="submit" disabled={pending}>Reassign</Button>
            </form>
          ) : null}

          {!isReviewActive ? (
            <form action={(fd) => run(assignProject, fd)} className="flex flex-col gap-2">
              <input type="hidden" name="project_id" value={project.id} />
              <Label>{multiAssign ? "Assign team" : "Assign staff"}</Label>
              {multiAssign ? (
                <FormMultiSelect
                  name="assigned_to"
                  required
                  placeholder="Search or select staff..."
                  searchPlaceholder="Search staff..."
                  options={sectionStaffOptions}
                  defaultSelected={(project.site_assignee_ids ?? []).map(String)}
                />
              ) : (
                <FormSelect
                  name="assigned_to"
                  required
                  placeholder="Select staff"
                  options={sectionStaffOptions}
                />
              )}
              <Button type="submit" variant="outline" disabled={pending}>
                {multiAssign ? "Assign team" : "Assign"}
              </Button>
            </form>
          ) : null}

          <form action={(fd) => run(assignToDepartment, fd)} className="flex flex-col gap-2">
            <input type="hidden" name="project_id" value={project.id} />
            <Label>Move to department (admin override)</Label>
            <FormSelect name="section" required placeholder="Department" options={sectionOptions} />
            <FormSelect name="assigned_to" placeholder="Optional staff" options={allStaffOptions} />
            <Button type="submit" variant="outline" disabled={pending}>Move department</Button>
          </form>

          <form action={(fd) => run(setProjectStatus, fd)} className="flex flex-col gap-2">
            <input type="hidden" name="project_id" value={project.id} />
            <Label>Update status</Label>
            <Select name="status" value={status} onValueChange={(value) => value && setStatus(value)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PROJECT_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Textarea name="note" placeholder="Status note" />
            <Button type="submit" variant="outline" disabled={pending}>Update status</Button>
          </form>

          {isBillingStep ? (
            <form action={(fd) => run(closeProject, fd)}>
              <input type="hidden" name="project_id" value={project.id} />
              <Button type="submit" disabled={pending || project.payment_status !== "Paid"}>
                Close project
              </Button>
            </form>
          ) : null}
        </div>
      ) : readOnly ? null : (
        <div className="flex flex-col gap-3">
          {["Assigned", "Correction Required"].includes(project.status) ? (
            <form action={(fd) => run(startWork, fd)}>
              <input type="hidden" name="project_id" value={project.id} />
              <Button type="submit" disabled={pending} variant="outline" className="w-full">
                Start work
              </Button>
            </form>
          ) : null}

          {["Assigned", "In Progress", "Correction Required"].includes(project.status) ? (
            <form action={(fd) => run(markWorkComplete, fd)}>
              <input type="hidden" name="project_id" value={project.id} />
              <Button type="submit" disabled={pending} className="w-full">
                Mark work completed
              </Button>
            </form>
          ) : null}

          {["Work Completed", "In Progress"].includes(project.status) && !isReviewActive ? (
            <form action={(fd) => run(submitForReview, fd)} className="flex flex-col gap-2">
              <input type="hidden" name="project_id" value={project.id} />
              <Textarea name="note" placeholder="Notes for admin review" />
              <Button type="submit" disabled={pending}>Submit for admin review</Button>
            </form>
          ) : null}

          <form action={(fd) => run(returnProject, fd)} className="flex flex-col gap-2 rounded-lg border border-border p-3">
            <input type="hidden" name="project_id" value={project.id} />
            <Label>Return to office</Label>
            <Select name="reason" required>
              <SelectTrigger><SelectValue placeholder="Reason" /></SelectTrigger>
              <SelectContent>
                {RETURN_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Textarea name="notes" placeholder="Additional notes" />
            <Button type="submit" variant="destructive" disabled={pending}>Return project</Button>
          </form>
        </div>
      )}
    </div>
  )
}
