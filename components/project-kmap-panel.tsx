"use client"

import { useMemo, useState, useTransition } from "react"
import { Info, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { updateProjectKmapAreas } from "@/lib/actions"
import {
  KMAP_FLOOR_ROWS,
  KMAP_MAX_FLOORS,
  kmapFloorLabel,
  kmapFloorNumber,
  nextKmapFloorKey,
} from "@/lib/constants"
import type { ProjectKmapArea } from "@/lib/types"

const TOTAL_TOOLTIP =
  "Sum of all floor values, then multiplied by 9 for square feet."

const DEFAULT_FLOOR_KEYS = new Set<string>(KMAP_FLOOR_ROWS.map((f) => f.key))

type RowState = {
  floor_key: string
  label: string
  plinth_area: string
  floor_area: string
}

function toNumber(value: string): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function sortFloorKeys(keys: string[]): string[] {
  return [...keys].sort((a, b) => kmapFloorNumber(a) - kmapFloorNumber(b))
}

function buildRows(areas: ProjectKmapArea[]): RowState[] {
  const byKey = new Map(areas.map((a) => [a.floor_key, a]))
  const keys =
    areas.length > 0
      ? areas.map((a) => a.floor_key)
      : KMAP_FLOOR_ROWS.map((floor) => floor.key)

  return sortFloorKeys([...new Set(keys)]).map((key) => {
    const row = byKey.get(key)
    return {
      floor_key: key,
      label: kmapFloorLabel(key),
      plinth_area: row?.plinth_area != null ? String(row.plinth_area) : "",
      floor_area: row?.floor_area != null ? String(row.floor_area) : "",
    }
  })
}

function formatTotal(value: number): string {
  const sqFt = value * 9
  return `${sqFt.toLocaleString("en-IN", { maximumFractionDigits: 2 })} sq ft`
}

export function ProjectKmapPanel({
  projectId,
  areas,
  readOnly = false,
}: {
  projectId: number
  areas: ProjectKmapArea[]
  readOnly?: boolean
}) {
  const [rows, setRows] = useState<RowState[]>(() => buildRows(areas))
  const [pending, startTransition] = useTransition()

  const totals = useMemo(() => {
    const plinth = rows.reduce((sum, row) => sum + toNumber(row.plinth_area), 0)
    const floor = rows.reduce((sum, row) => sum + toNumber(row.floor_area), 0)
    return { plinth, floor }
  }, [rows])

  const canAddFloor = rows.length < KMAP_MAX_FLOORS

  function updateRow(index: number, patch: Partial<RowState>) {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  function addFloor() {
    const nextKey = nextKmapFloorKey(rows.map((row) => row.floor_key))
    if (!nextKey) {
      toast.error(`Maximum of ${KMAP_MAX_FLOORS} floors reached`)
      return
    }
    if (rows.some((r) => r.floor_key === nextKey)) return

    setRows((prev) =>
      sortFloorKeys([...prev.map((row) => row.floor_key), nextKey]).map((key) => {
        const existing = prev.find((row) => row.floor_key === key)
        if (existing) return existing
        return {
          floor_key: nextKey,
          label: kmapFloorLabel(nextKey),
          plinth_area: "",
          floor_area: "",
        }
      }),
    )
  }

  function removeFloor(floorKey: string) {
    if (DEFAULT_FLOOR_KEYS.has(floorKey)) return
    setRows((prev) => prev.filter((row) => row.floor_key !== floorKey))
  }

  function onSave() {
    const payload = rows.map((row) => ({
      floor_key: row.floor_key,
      plinth_area: row.plinth_area.trim() ? Number(row.plinth_area) : null,
      floor_area: row.floor_area.trim() ? Number(row.floor_area) : null,
    }))

    const fd = new FormData()
    fd.set("project_id", String(projectId))
    fd.set("areas", JSON.stringify(payload))

    startTransition(async () => {
      const res = await updateProjectKmapAreas(fd)
      if (res?.error) toast.error(res.error)
      else toast.success("Areas saved")
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Area Capture</h3>
          <p className="text-xs text-muted-foreground">
            Floor plinth and floor areas in square feet.
          </p>
        </div>

        {!readOnly ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending || !canAddFloor}
            onClick={addFloor}
          >
            <Plus className="size-4" />
            Add floor
          </Button>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-xl border border-border/60">
        <table className="w-full min-w-[420px] text-sm">
          <thead>
            <tr className="border-b border-border/60 bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2.5 font-medium">Floor</th>
              <th className="px-3 py-2.5 font-medium">Plinth Area (Sq Ft)</th>
              <th className="px-3 py-2.5 font-medium">Floor Area (Sq Ft)</th>
              {!readOnly ? <th className="w-12 px-2 py-2.5" /> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.floor_key} className="border-b border-border/40 last:border-0">
                <td className="px-3 py-2 font-medium">{row.label}</td>
                <td className="px-3 py-2">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    value={row.plinth_area}
                    disabled={readOnly || pending}
                    onChange={(e) => updateRow(index, { plinth_area: e.target.value })}
                    placeholder="0"
                    className="h-8"
                  />
                </td>
                <td className="px-3 py-2">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    value={row.floor_area}
                    disabled={readOnly || pending}
                    onChange={(e) => updateRow(index, { floor_area: e.target.value })}
                    placeholder="0"
                    className="h-8"
                  />
                </td>
                {!readOnly ? (
                  <td className="px-2 py-2">
                    {!DEFAULT_FLOOR_KEYS.has(row.floor_key) ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="text-muted-foreground hover:text-destructive"
                        disabled={pending}
                        onClick={() => removeFloor(row.floor_key)}
                        aria-label={`Remove ${row.label}`}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    ) : null}
                  </td>
                ) : null}
              </tr>
            ))}
            <tr className="bg-muted/30 font-semibold">
              <td className="px-3 py-2.5">
                <span className="inline-flex items-center gap-1.5">
                  All Total
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger
                        type="button"
                        className="inline-flex size-4 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
                        aria-label="How totals are calculated"
                      >
                        <Info className="size-3.5" />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[240px] text-left">
                        {TOTAL_TOOLTIP}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </span>
              </td>
              <td className="px-3 py-2.5 tabular-nums" aria-live="polite">
                {formatTotal(totals.plinth)}
              </td>
              <td className="px-3 py-2.5 tabular-nums" aria-live="polite">
                {formatTotal(totals.floor)}
              </td>
              {!readOnly ? <td /> : null}
            </tr>
          </tbody>
        </table>
      </div>

      {!readOnly ? (
        <div className="flex justify-end">
          <Button type="button" size="sm" disabled={pending} onClick={onSave}>
            {pending ? "Saving..." : "Save areas"}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
