"use client"

import { useTransition } from "react"
import { motion } from "framer-motion"
import { toast } from "sonner"
import { AlertTriangle, CheckCircle2, FileText } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { toggleChecklistFiled } from "@/lib/actions"
import { checklistCompletion } from "@/lib/constants"
import { serviceByKey } from "@/lib/workflow"
import type { ChecklistItem } from "@/lib/types"
import { cn } from "@/lib/utils"

function checklistDisplayLabel(itemKey: string): string {
  const parts = itemKey.split("::")
  return parts.length > 1 ? parts[1]! : itemKey
}

function groupChecklistItems(items: ChecklistItem[]) {
  const groups = new Map<string, ChecklistItem[]>()
  for (const item of items) {
    const key = item.service_key ?? "general"
    const list = groups.get(key) ?? []
    list.push(item)
    groups.set(key, list)
  }
  return [...groups.entries()]
}

export function ProjectChecklist({
  items,
  projectId,
}: {
  items: ChecklistItem[]
  projectId: number
}) {
  const [pending, startTransition] = useTransition()
  const filed = items.filter((i) => i.filed).length
  const pct = checklistCompletion(items)
  const missing = items.filter((i) => !i.filed)

  function onToggleFiled(itemId: number, filedValue: boolean) {
    const fd = new FormData()
    fd.set("item_id", String(itemId))
    fd.set("project_id", String(projectId))
    fd.set("filed", String(filedValue))
    startTransition(async () => {
      const res = await toggleChecklistFiled(fd)
      if (res?.error) toast.error(res.error)
    })
  }

  return (
    <div className="flex flex-col gap-5">
      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 px-4 py-8 text-center">
          <FileText className="mx-auto size-8 text-muted-foreground/50" />
          <p className="mt-3 text-sm font-medium">No documents for this project</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Documents are chosen when the project is created, based on the selected services.
          </p>
        </div>
      ) : (
        <>
      <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Document Progress</p>
            <p className="text-xs text-muted-foreground">
              {filed} / {items.length} documents filed
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold tabular-nums text-primary">{pct}%</p>
          </div>
        </div>
        <Progress value={pct} className="mt-3 h-2" />
        {missing.length > 0 ? (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-800 dark:text-amber-300">
            <AlertTriangle className="size-3.5 shrink-0" />
            {missing.length} document{missing.length === 1 ? "" : "s"} not yet filed
          </div>
        ) : (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-800 dark:text-emerald-300">
            <CheckCircle2 className="size-3.5 shrink-0" />
            All documents filed
          </div>
        )}
      </div>

      {groupChecklistItems(items).map(([serviceKey, groupItems]) => (
        <div key={serviceKey} className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {serviceKey === "general"
              ? "General documents"
              : serviceByKey(serviceKey)?.label ?? serviceKey}
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {groupItems.map((item, index) => {
              const filedItem = item.filed
              const filedId = `checklist-filed-${projectId}-${item.id}`

              return (
                <motion.div
                  key={item.id}
                  initial={false}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className={cn(
                    "flex items-start justify-between gap-3 rounded-xl border p-3 transition-all duration-200",
                    filedItem
                      ? "border-emerald-500/30 bg-emerald-500/5"
                      : "border-amber-500/30 bg-amber-500/5",
                  )}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <div
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-lg",
                        filedItem
                          ? "bg-emerald-500/15 text-emerald-600"
                          : "bg-amber-500/15 text-amber-600",
                      )}
                    >
                      <FileText className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium leading-tight">{checklistDisplayLabel(item.item_key)}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {filedItem ? "Filed" : "Not filed"}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-center gap-1">
                    <Checkbox
                      id={filedId}
                      checked={filedItem}
                      disabled={pending}
                      onCheckedChange={(v) => onToggleFiled(item.id, v === true)}
                    />
                    <Label htmlFor={filedId} className="cursor-pointer text-[10px] text-muted-foreground">
                      Filed
                    </Label>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>
      ))}
        </>
      )}
    </div>
  )
}
