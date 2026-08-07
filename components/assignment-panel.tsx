"use client"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { FormSelect } from "@/components/form-select"
import { FormMultiSelect } from "@/components/form-multi-select"
import { assignProject, reassignReturnedProject } from "@/lib/actions"
import type { Project } from "@/lib/types"

type StaffOption = {
  value: string
  label: string
  description?: string
  avatarUrl?: string | null
}

export function AssignmentPanel({
  project,
  multiAssign,
  sectionStaffOptions,
  pending,
  onRun,
}: {
  project: Project
  multiAssign: boolean
  sectionStaffOptions: StaffOption[]
  pending: boolean
  onRun: (action: (fd: FormData) => Promise<{ error?: string; success?: boolean }>, fd: FormData) => void
}) {
  const isReviewActive = project.status === "Pending Review"

  return (
    <div className="flex flex-col gap-4">
      {project.status === "Returned" ? (
        <form action={(fd) => onRun(reassignReturnedProject, fd)} className="flex flex-col gap-2">
          <input type="hidden" name="project_id" value={project.id} />
          <Label>Reassign returned project</Label>
          <FormMultiSelect
            name="assigned_to"
            required
            placeholder="Search or select staff..."
            searchPlaceholder="Search staff..."
            options={sectionStaffOptions}
          />
          <Button type="submit" disabled={pending}>
            Reassign
          </Button>
        </form>
      ) : null}

      {!isReviewActive ? (
        <form action={(fd) => onRun(assignProject, fd)} className="flex flex-col gap-2">
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
    </div>
  )
}
