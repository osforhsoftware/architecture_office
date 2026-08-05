"use client"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { FormMultiSelect } from "@/components/form-multi-select"
import { approveSectionReview, rejectReview } from "@/lib/actions"
import type { Project } from "@/lib/types"

type StaffOption = {
  value: string
  label: string
  description?: string
}

export function ReviewPanel({
  project,
  allStaffOptions,
  pending,
  onRun,
}: {
  project: Project
  allStaffOptions: StaffOption[]
  pending: boolean
  onRun: (action: (fd: FormData) => Promise<{ error?: string; success?: boolean }>, fd: FormData) => void
}) {
  if (project.status !== "Pending Review") return null

  return (
    <div className="rounded-lg border border-violet-200 bg-violet-50 p-4 dark:border-violet-900 dark:bg-violet-950/30">
      <p className="mb-3 text-sm font-medium">Admin review required</p>
      <form action={(fd) => onRun(approveSectionReview, fd)} className="flex flex-col gap-3">
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
        <Button type="submit" disabled={pending}>
          Approve & assign next
        </Button>
      </form>
      <form
        action={(fd) => onRun(rejectReview, fd)}
        className="mt-3 flex flex-col gap-2 border-t border-violet-200 pt-3 dark:border-violet-900"
      >
        <input type="hidden" name="project_id" value={project.id} />
        <Textarea name="note" placeholder="Correction feedback (required)" required />
        <Button type="submit" variant="destructive" disabled={pending}>
          Reject — correction required
        </Button>
      </form>
    </div>
  )
}
