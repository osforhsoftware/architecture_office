"use client"

import { useEffect, useState, useTransition } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { updateProjectDrawingNumber } from "@/lib/actions"
import { formControlClass } from "@/components/form-section"

export function ProjectDrawingNumberPanel({
  projectId,
  drawingNumber,
  readOnly = false,
}: {
  projectId: number
  drawingNumber: string | null
  readOnly?: boolean
}) {
  const [value, setValue] = useState(drawingNumber ?? "")
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    setValue(drawingNumber ?? "")
  }, [drawingNumber])

  function onSave() {
    const fd = new FormData()
    fd.set("project_id", String(projectId))
    fd.set("drawing_number", value)

    startTransition(async () => {
      const res = await updateProjectDrawingNumber(fd)
      if (res?.error) toast.error(res.error)
      else toast.success("Drawing number saved")
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h3 className="text-sm font-semibold">Drawing Number</h3>
        <p className="text-xs text-muted-foreground">
          Office drawing register number for this project.
        </p>
      </div>

      {readOnly ? (
        <p className="text-sm font-medium">{drawingNumber?.trim() ? drawingNumber : "—"}</p>
      ) : (
        <>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`drawing-number-${projectId}`} className="text-sm font-medium">
              Drawing number
            </Label>
            <Input
              id={`drawing-number-${projectId}`}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="e.g. DRW-2024-001"
              disabled={pending}
              className={formControlClass}
            />
          </div>
          <div className="flex justify-end">
            <Button type="button" size="sm" disabled={pending} onClick={onSave}>
              {pending ? "Saving..." : "Save drawing number"}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

export function DrawingNumberField({
  idPrefix = "",
  defaultValue = "",
}: {
  idPrefix?: string
  defaultValue?: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={`${idPrefix}drawing_number`} className="text-sm font-medium">
        Drawing Number
      </Label>
      <Input
        id={`${idPrefix}drawing_number`}
        name="drawing_number"
        placeholder="e.g. DRW-2024-001"
        defaultValue={defaultValue}
        className={formControlClass}
      />
    </div>
  )
}
