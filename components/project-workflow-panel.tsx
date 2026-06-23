"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { FormSelect } from "@/components/form-select"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  advanceStage,
  approveSectionReview,
  assignProject,
  assignToDepartment,
  closeProject,
  reassignReturnedProject,
  rejectReview,
  returnProject,
  setProjectStatus,
  submitForReview,
} from "@/lib/actions"
import {
  PROJECT_STATUSES,
  RETURN_REASONS,
  SECTIONS,
  SECTION_ROLE,
  WORKFLOW_STAGES,
  lastStageInSection,
} from "@/lib/constants"
import type { AppUser, Project } from "@/lib/types"

export function ProjectWorkflowPanel({
  project,
  staff,
  isAdmin,
  userRole,
  readOnly = false,
}: {
  project: Project
  staff: AppUser[]
  isAdmin: boolean
  userRole: string
  readOnly?: boolean
}) {
  const [pending, startTransition] = useTransition()
  const [status, setStatus] = useState(project.status)

  useEffect(() => {
    setStatus(project.status)
  }, [project.status])

  const stage = WORKFLOW_STAGES[project.current_stage]
  const atSectionEnd = project.current_stage >= lastStageInSection(project.section)
  const sectionStaff = staff.filter((s) => SECTION_ROLE[project.section] === s.role)

  const sectionStaffOptions = useMemo(
    () => sectionStaff.map((s) => ({ value: String(s.id), label: s.name })),
    [sectionStaff],
  )

  const allStaffOptions = useMemo(
    () => staff.map((s) => ({ value: String(s.id), label: `${s.name} (${s.role})` })),
    [staff],
  )

  const sectionOptions = useMemo(
    () => SECTIONS.map((s) => ({ value: s, label: s })),
    [],
  )

  function run(action: (fd: FormData) => Promise<{ error?: string; success?: boolean }>, fd: FormData) {
    startTransition(async () => {
      const res = await action(fd)
      if (res?.error) toast.error(res.error)
      else toast.success("Updated")
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg bg-muted/50 p-4">
        <p className="text-sm font-medium">Current stage</p>
        <p className="text-lg">{stage?.label ?? "—"}</p>
        <p className="text-sm text-muted-foreground">
          {project.section} · Stage {project.current_stage + 1} of {WORKFLOW_STAGES.length}
        </p>
        {project.review_note ? (
          <p className="mt-2 text-sm text-amber-800">Review note: {project.review_note}</p>
        ) : null}
      </div>

      {isAdmin ? (
        <div className="flex flex-col gap-4">
          {project.status === "Pending Review" ? (
            <div className="rounded-lg border border-violet-200 bg-violet-50 p-4 dark:border-violet-900 dark:bg-violet-950/30">
              <p className="mb-3 text-sm font-medium">Admin review required</p>
              <form
                action={(fd) => run(approveSectionReview, fd)}
                className="flex flex-col gap-3"
              >
                <input type="hidden" name="project_id" value={project.id} />
                <div className="flex flex-col gap-2">
                  <Label>Assign next staff (optional)</Label>
                  <FormSelect
                    name="assigned_to"
                    placeholder="Auto-assign department"
                    options={allStaffOptions}
                  />
                </div>
                <Textarea name="note" placeholder="Approval notes" />
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" disabled={pending}>Approve & forward</Button>
                </div>
              </form>
              <form
                action={(fd) => run(rejectReview, fd)}
                className="mt-3 flex flex-col gap-2 border-t border-violet-200 pt-3"
              >
                <input type="hidden" name="project_id" value={project.id} />
                <Textarea name="note" placeholder="Correction feedback (required)" required />
                <Button type="submit" variant="destructive" disabled={pending}>
                  Request correction
                </Button>
              </form>
            </div>
          ) : null}

          {project.status === "Returned" ? (
            <form action={(fd) => run(reassignReturnedProject, fd)} className="flex flex-col gap-2">
              <input type="hidden" name="project_id" value={project.id} />
              <Label>Reassign returned project</Label>
              <FormSelect
                name="assigned_to"
                required
                placeholder="Select staff"
                options={sectionStaffOptions}
              />
              <Button type="submit" disabled={pending}>Reassign</Button>
            </form>
          ) : null}

          <form action={(fd) => run(assignProject, fd)} className="flex flex-col gap-2">
            <input type="hidden" name="project_id" value={project.id} />
            <Label>Assign to staff</Label>
            <FormSelect
              name="assigned_to"
              required
              placeholder="Select staff"
              options={sectionStaffOptions}
            />
            <Button type="submit" variant="outline" disabled={pending}>Assign</Button>
          </form>

          <form action={(fd) => run(assignToDepartment, fd)} className="flex flex-col gap-2">
            <input type="hidden" name="project_id" value={project.id} />
            <Label>Move to department</Label>
            <FormSelect
              name="section"
              required
              placeholder="Department"
              options={sectionOptions}
            />
            <FormSelect
              name="assigned_to"
              placeholder="Optional staff"
              options={allStaffOptions}
            />
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

          {project.section === "Billing" ? (
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
          {!atSectionEnd && project.section !== "Billing" ? (
            <form action={(fd) => run(advanceStage, fd)}>
              <input type="hidden" name="project_id" value={project.id} />
              <Button type="submit" disabled={pending} className="w-full">
                Advance to next stage
              </Button>
            </form>
          ) : null}

          {atSectionEnd && project.status !== "Pending Review" && project.section !== "Billing" ? (
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
