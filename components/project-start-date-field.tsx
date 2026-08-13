"use client"

import { useEffect, useState, useTransition } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { FormField, formControlClass } from "@/components/form-section"
import { updateProjectStartDate } from "@/lib/actions"
import { localDateInputValue } from "@/lib/project-dates"

export function ProjectStartDateField({
  id,
  defaultValue,
}: {
  id: string
  defaultValue?: string
}) {
  return (
    <FormField label="Project start date" htmlFor={id}>
      <Input
        id={id}
        name="start_date"
        type="date"
        defaultValue={defaultValue ?? localDateInputValue()}
        className={formControlClass}
      />
      <p className="text-xs text-muted-foreground">
        Used as the project created / started time. Past dates are allowed.
      </p>
    </FormField>
  )
}

export function ProjectStartDatePanel({
  projectId,
  createdAt,
  readOnly = false,
}: {
  projectId: number
  createdAt: string
  readOnly?: boolean
}) {
  const [value, setValue] = useState(localDateInputValue(createdAt))
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    setValue(localDateInputValue(createdAt))
  }, [createdAt])

  function onSave() {
    const fd = new FormData()
    fd.set("project_id", String(projectId))
    fd.set("start_date", value)

    startTransition(async () => {
      const res = await updateProjectStartDate(fd)
      if (res?.error) toast.error(res.error)
      else toast.success("Project start date saved")
    })
  }

  const label = createdAt
    ? new Date(createdAt).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—"

  if (readOnly) {
    return (
      <div>
        <p className="text-xs text-muted-foreground">Started</p>
        <p className="font-semibold">{label}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h3 className="text-sm font-semibold">Project start date</h3>
        <p className="text-xs text-muted-foreground">
          Change the project created / started date, including previous dates.
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <FormField label="Start date" htmlFor={`project-start-${projectId}`} className="flex-1">
          <Input
            id={`project-start-${projectId}`}
            type="date"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={pending}
            className={formControlClass}
          />
        </FormField>
        <Button type="button" size="sm" disabled={pending || !value} onClick={onSave}>
          {pending ? "Saving..." : "Save date"}
        </Button>
      </div>
    </div>
  )
}
