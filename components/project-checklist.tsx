"use client"

import { useEffect, useState, useTransition } from "react"
import { motion } from "framer-motion"
import { toast } from "sonner"
import { AlertTriangle, CheckCircle2, FileText, Upload } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toggleChecklistItem, setChecklistReviewStatus } from "@/lib/actions"
import { checklistCompletion } from "@/lib/constants"
import type { ChecklistItem } from "@/lib/types"
import { cn } from "@/lib/utils"

const REVIEW_STATUSES = ["Pending", "Approved", "Rejected"] as const
type ReviewStatus = (typeof REVIEW_STATUSES)[number]

function normalizeReviewStatus(status: string | null | undefined): ReviewStatus {
  return REVIEW_STATUSES.includes(status as ReviewStatus) ? (status as ReviewStatus) : "Pending"
}

function ChecklistReviewSelect({
  itemId,
  reviewStatus,
  disabled,
  onReview,
}: {
  itemId: number
  reviewStatus: string | null | undefined
  disabled?: boolean
  onReview: (itemId: number, reviewStatus: string) => void
}) {
  const [value, setValue] = useState<ReviewStatus>(() => normalizeReviewStatus(reviewStatus))

  useEffect(() => {
    setValue(normalizeReviewStatus(reviewStatus))
  }, [reviewStatus])

  return (
    <Select
      value={value}
      disabled={disabled}
      onValueChange={(next) => {
        const normalized = normalizeReviewStatus(next)
        setValue(normalized)
        onReview(itemId, normalized)
      }}
    >
      <SelectTrigger className="h-7 w-full text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="Pending">Pending review</SelectItem>
        <SelectItem value="Approved">Approved</SelectItem>
        <SelectItem value="Rejected">Rejected</SelectItem>
      </SelectContent>
    </Select>
  )
}

export function ProjectChecklist({
  items,
  projectId,
  isAdmin,
}: {
  items: ChecklistItem[]
  projectId: number
  isAdmin: boolean
}) {
  const [pending, startTransition] = useTransition()
  const done = items.filter((i) => i.checked).length
  const pct = checklistCompletion(items)
  const missing = items.filter((i) => !i.checked)

  function onToggle(itemId: number, checked: boolean) {
    const fd = new FormData()
    fd.set("item_id", String(itemId))
    fd.set("project_id", String(projectId))
    fd.set("checked", String(checked))
    startTransition(async () => {
      const res = await toggleChecklistItem(fd)
      if (res?.error) toast.error(res.error)
    })
  }

  function onReview(itemId: number, reviewStatus: string) {
    const fd = new FormData()
    fd.set("item_id", String(itemId))
    fd.set("project_id", String(projectId))
    fd.set("review_status", reviewStatus)
    startTransition(async () => {
      const res = await setChecklistReviewStatus(fd)
      if (res?.error) toast.error(res.error)
      else toast.success("Review status updated")
    })
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Document Progress</p>
            <p className="text-xs text-muted-foreground">
              {done} / {items.length} Documents Complete
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
            {missing.length} document{missing.length === 1 ? "" : "s"} missing
          </div>
        ) : (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-800 dark:text-emerald-300">
            <CheckCircle2 className="size-3.5 shrink-0" />
            All documents collected
          </div>
        )}
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {items.map((item, index) => {
          const uploaded = item.checked
          const rejected = item.review_status === "Rejected"
          const checkboxId = `checklist-${projectId}-${item.id}`

          return (
            <motion.div
              key={item.id}
              initial={false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
              className={cn(
                "flex flex-col gap-2 rounded-xl border p-3 transition-all duration-200",
                uploaded
                  ? "border-emerald-500/30 bg-emerald-500/5"
                  : "border-amber-500/30 bg-amber-500/5",
                rejected && "border-rose-500/30 bg-rose-500/5",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <Checkbox
                    id={checkboxId}
                    checked={item.checked}
                    disabled={pending}
                    onCheckedChange={(v) => onToggle(item.id, v === true)}
                  />
                  <div
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-lg",
                      uploaded ? "bg-emerald-500/15 text-emerald-600" : "bg-amber-500/15 text-amber-600",
                    )}
                  >
                    {uploaded ? <Upload className="size-4" /> : <FileText className="size-4" />}
                  </div>
                  <div className="min-w-0">
                    <Label htmlFor={checkboxId} className="cursor-pointer text-sm font-medium leading-tight">
                      {item.item_key}
                    </Label>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {uploaded ? "Uploaded" : "Missing"}
                    </p>
                  </div>
                </div>
                <span className="shrink-0 text-lg" aria-hidden>
                  {uploaded ? "✓" : "⚠"}
                </span>
              </div>
              {isAdmin ? (
                <ChecklistReviewSelect
                  itemId={item.id}
                  reviewStatus={item.review_status}
                  disabled={pending}
                  onReview={onReview}
                />
              ) : (
                <span className="text-xs text-muted-foreground">{item.review_status}</span>
              )}
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
