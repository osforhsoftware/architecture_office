"use client"

import { useEffect, useState, useTransition } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useProjectSaveSection } from "@/components/project-details-save"
import {
  generateDrawingNumber,
  updateProjectDrawingNumber,
  updateProjectEdgebookNumber,
} from "@/lib/actions"
import { formControlClass } from "@/components/form-section"

export function ProjectDrawingNumberPanel({
  projectId,
  drawingNumber,
  edgebookNumber,
  readOnly = false,
}: {
  projectId: number
  drawingNumber: string | null
  edgebookNumber?: string | null
  readOnly?: boolean
}) {
  const savedDrawing = drawingNumber?.trim() ?? ""
  const drawingLocked = Boolean(savedDrawing)
  const [value, setValue] = useState(drawingNumber ?? "")
  const [edgebook, setEdgebook] = useState(edgebookNumber ?? "")
  const [pending, startTransition] = useTransition()
  const [edgebookPending, startEdgebookTransition] = useTransition()
  const [generating, startGenerate] = useTransition()
  const { grouped, pending: groupedPending } = useProjectSaveSection("drawing", () => {
    const fd = new FormData()
    if (!readOnly) {
      fd.set("save_drawing", "1")
      fd.set("drawing_number", drawingLocked ? savedDrawing : value)
      fd.set("edgebook_number", edgebook)
    }
    return fd
  })

  useEffect(() => {
    setValue(drawingNumber ?? "")
  }, [drawingNumber])

  useEffect(() => {
    setEdgebook(edgebookNumber ?? "")
  }, [edgebookNumber])

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

  function onSaveEdgebook() {
    const fd = new FormData()
    fd.set("project_id", String(projectId))
    fd.set("edgebook_number", edgebook)

    startEdgebookTransition(async () => {
      const res = await updateProjectEdgebookNumber(fd)
      if (res?.error) toast.error(res.error)
      else toast.success("MBook Number saved")
    })
  }

  function onGenerate() {
    startGenerate(async () => {
      const res = await generateDrawingNumber()
      if (res?.error) {
        toast.error(res.error)
        return
      }
      if (res?.drawingNumber) {
        setValue(res.drawingNumber)
        toast.success(
          grouped
            ? "Drawing number generated. Click Update Project to save."
            : "Drawing number generated",
        )
      }
    })
  }

  const busy = pending || generating || edgebookPending || groupedPending
  const showAutoGenerate = !drawingLocked && !value.trim()

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <div>
          <h3 className="text-sm font-semibold">Drawing Number</h3>
          <p className="text-xs text-muted-foreground">
            Office drawing register number for this project.
          </p>
        </div>

        {readOnly || drawingLocked ? (
          <div>
            <p className="text-sm font-medium">{savedDrawing || "—"}</p>
            {drawingLocked ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Saved drawing numbers cannot be changed.
              </p>
            ) : null}
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`drawing-number-${projectId}`} className="text-sm font-medium">
                Drawing number
              </Label>
              <div className="flex gap-2">
                <Input
                  id={`drawing-number-${projectId}`}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder="e.g. DRW-2026-0001"
                  disabled={busy}
                  className={formControlClass}
                />
                {showAutoGenerate ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={onGenerate}
                    className="shrink-0"
                  >
                    {generating ? "Generating..." : "Auto generate"}
                  </Button>
                ) : null}
              </div>
            </div>
            {!grouped ? (
              <div className="flex justify-end">
                <Button type="button" size="sm" disabled={busy} onClick={onSave}>
                  {pending ? "Saving..." : "Save drawing number"}
                </Button>
              </div>
            ) : null}
          </>
        )}
      </div>

      <div className="border-t border-border/60 pt-4">
        <div className="flex flex-col gap-3">
          <div>
            <h3 className="text-sm font-semibold">MBook Number</h3>
            <p className="text-xs text-muted-foreground">
              Office MBook register number for this project.
            </p>
          </div>

          {readOnly ? (
            <p className="text-sm font-medium">{edgebookNumber?.trim() ? edgebookNumber : "—"}</p>
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`edgebook-number-${projectId}`} className="text-sm font-medium">
                  MBook Number
                </Label>
                <Input
                  id={`edgebook-number-${projectId}`}
                  value={edgebook}
                  onChange={(e) => setEdgebook(e.target.value)}
                  placeholder="e.g. MB-2026-0001"
                  disabled={busy}
                  className={formControlClass}
                />
              </div>
              {!grouped ? (
                <div className="flex justify-end">
                  <Button type="button" size="sm" disabled={busy} onClick={onSaveEdgebook}>
                    {edgebookPending ? "Saving..." : "Save MBook Number"}
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
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
  const locked = Boolean(defaultValue.trim())
  const [value, setValue] = useState(defaultValue)
  const [generating, startGenerate] = useTransition()

  function onGenerate() {
    startGenerate(async () => {
      const res = await generateDrawingNumber()
      if (res?.error) {
        toast.error(res.error)
        return
      }
      if (res?.drawingNumber) {
        setValue(res.drawingNumber)
        toast.success("Drawing number generated")
      }
    })
  }

  if (locked) {
    return (
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${idPrefix}drawing_number`} className="text-sm font-medium">
          Drawing Number
        </Label>
        <p id={`${idPrefix}drawing_number`} className="text-sm font-medium">
          {defaultValue.trim()}
        </p>
        <input type="hidden" name="drawing_number" value={defaultValue.trim()} />
        <p className="text-xs text-muted-foreground">
          Saved drawing numbers cannot be changed.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={`${idPrefix}drawing_number`} className="text-sm font-medium">
        Drawing Number
      </Label>
      <div className="flex gap-2">
        <Input
          id={`${idPrefix}drawing_number`}
          name="drawing_number"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="e.g. DRW-2026-0001"
          disabled={generating}
          className={formControlClass}
        />
        {!value.trim() ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={generating}
            onClick={onGenerate}
            className="shrink-0"
          >
            {generating ? "Generating..." : "Auto generate"}
          </Button>
        ) : null}
      </div>
    </div>
  )
}
