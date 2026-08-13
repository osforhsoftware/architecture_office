"use client"

import { useEffect, useState, useTransition } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { FormField, FormSection, formTextareaClass } from "@/components/form-section"
import { updateProjectNotes } from "@/lib/actions"

export function ProjectNotesField({
  id,
  defaultValue = "",
}: {
  id: string
  defaultValue?: string
}) {
  return (
    <FormSection title="Notes">
      <FormField label="Project note" htmlFor={id}>
        <Textarea
          id={id}
          name="notes"
          defaultValue={defaultValue}
          placeholder="Optional note for this project"
          className={formTextareaClass}
        />
      </FormField>
      <p className="text-xs text-muted-foreground">
        Shown in the project Comments section for office and staff.
      </p>
    </FormSection>
  )
}

export function ProjectNotesPanel({
  projectId,
  notes,
  reviewNote,
  readOnly = false,
}: {
  projectId: number
  notes: string | null
  reviewNote?: string | null
  readOnly?: boolean
}) {
  const [value, setValue] = useState(notes ?? "")
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    setValue(notes ?? "")
  }, [notes])

  function onSave() {
    const fd = new FormData()
    fd.set("project_id", String(projectId))
    fd.set("notes", value)

    startTransition(async () => {
      const res = await updateProjectNotes(fd)
      if (res?.error) toast.error(res.error)
      else toast.success("Project note saved")
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h3 className="text-sm font-semibold">Comments</h3>
        <p className="text-xs text-muted-foreground">
          Office note added when the project was created or updated.
        </p>
      </div>

      {readOnly ? (
        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
          {notes?.trim() ? notes : "No comments yet."}
        </p>
      ) : (
        <>
          <Textarea
            id={`project-notes-${projectId}`}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Add a project note"
            disabled={pending}
            className={formTextareaClass}
          />
          <div className="flex justify-end">
            <Button type="button" size="sm" disabled={pending} onClick={onSave}>
              {pending ? "Saving..." : "Save note"}
            </Button>
          </div>
        </>
      )}

      {reviewNote?.trim() ? (
        <p className="rounded-lg bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300">
          Review note: {reviewNote}
        </p>
      ) : null}
    </div>
  )
}
