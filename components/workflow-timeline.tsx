"use client"

import { motion } from "framer-motion"
import { Check, Circle, Clock, Shield, Sparkles } from "lucide-react"
import { buildTimelineNodes } from "@/lib/workflow"
import type { WorkflowStepRecord } from "@/lib/workflow"
import { HorizontalScrollArea } from "@/components/horizontal-scroll-area"
import { cn } from "@/lib/utils"

const NODE_COLORS: Record<string, { ring: string; bg: string; border: string; text: string; fill: string; connector: string }> = {
  milestone: {
    ring: "ring-sky-300/50",
    bg: "bg-sky-50",
    border: "border-sky-400",
    text: "text-sky-700",
    fill: "bg-sky-500",
    connector: "bg-sky-400",
  },
  service: {
    ring: "ring-amber-300/50",
    bg: "bg-amber-50",
    border: "border-amber-400",
    text: "text-amber-800",
    fill: "bg-amber-500",
    connector: "bg-amber-400",
  },
  review: {
    ring: "ring-violet-300/50",
    bg: "bg-violet-50",
    border: "border-violet-400",
    text: "text-violet-700",
    fill: "bg-violet-500",
    connector: "bg-violet-400",
  },
  billing: {
    ring: "ring-orange-300/50",
    bg: "bg-orange-50",
    border: "border-orange-400",
    text: "text-orange-800",
    fill: "bg-orange-500",
    connector: "bg-orange-400",
  },
  closed: {
    ring: "ring-emerald-300/50",
    bg: "bg-emerald-50",
    border: "border-emerald-400",
    text: "text-emerald-700",
    fill: "bg-emerald-500",
    connector: "bg-emerald-400",
  },
}

function resolveCurrentIndex(steps: WorkflowStepRecord[], status: string): number {
  if (status === "Closed" || status === "Completed") return 9999
  const active = steps.find((s) => s.step_status === "active")
  if (active) return active.sort_order
  if (status === "Pending Review") {
    const review = steps.find((s) => s.step_type === "admin_review" && s.step_status === "active")
    if (review) return review.sort_order
  }
  const lastDone = [...steps].reverse().find((s) => s.step_status === "completed")
  return lastDone?.sort_order ?? -1
}

export function WorkflowTimeline({
  workflowSteps,
  status,
  compact = false,
  orientation = "horizontal",
}: {
  workflowSteps: WorkflowStepRecord[]
  status: string
  compact?: boolean
  orientation?: "horizontal" | "vertical"
}) {
  const stepDefs = workflowSteps.map((s) => ({
    stepType: s.step_type as "planning" | "service" | "admin_review" | "billing",
    stepKey: s.step_key,
    label: s.label,
    section: s.section,
    serviceKey: s.service_key,
    sortOrder: s.sort_order,
  }))

  const nodes = buildTimelineNodes(stepDefs, status)
  const currentIndex = resolveCurrentIndex(workflowSteps, status)

  const renderNode = (node: ReturnType<typeof buildTimelineNodes>[number], index: number) => {
    const colors = NODE_COLORS[node.type] ?? NODE_COLORS.service
    const isComplete =
      node.type === "closed"
        ? status === "Closed" || status === "Completed"
        : node.sortOrder < currentIndex || (node.sortOrder === currentIndex && status === "Work Completed")
    const isCurrent = node.sortOrder === currentIndex && !isComplete
    const isUpcoming = !isComplete && !isCurrent
    const isReview = node.type === "review"

    return (
      <div key={node.key} className={orientation === "vertical" ? "relative flex gap-3" : "flex items-start"}>
        {orientation === "vertical" ? (
          <>
            {index < nodes.length - 1 ? (
              <div
                className={cn(
                  "absolute left-[15px] top-8 w-0.5",
                  compact ? "h-6" : "h-10",
                  isComplete ? colors.connector : "bg-border",
                )}
              />
            ) : null}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: index * 0.04 }}
              className={cn(
                "relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border-2 transition-all",
                isComplete && cn(colors.fill, "border-transparent text-white"),
                isCurrent && cn(colors.bg, colors.border, colors.text, "ring-4", colors.ring),
                isUpcoming && "border-border bg-muted text-muted-foreground",
              )}
            >
              {isComplete ? (
                <Check className="size-3.5" strokeWidth={3} />
              ) : isCurrent ? (
                isReview ? <Shield className="size-3.5" /> : <Clock className="size-3.5" />
              ) : (
                <Circle className="size-2 fill-current" />
              )}
            </motion.div>
            <div className={cn("min-w-0 pb-4", compact && "pb-3")}>
              <p
                className={cn(
                  "text-sm font-medium leading-tight",
                  isCurrent && colors.text,
                  isComplete && colors.text,
                  isUpcoming && "text-muted-foreground",
                )}
              >
                {node.label}
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="flex w-[88px] flex-col items-center sm:w-[96px]">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: index * 0.04 }}
                className={cn(
                  "relative z-10 flex size-9 shrink-0 items-center justify-center rounded-full border-2 shadow-sm transition-all",
                  isComplete && cn(colors.fill, "border-transparent text-white shadow-md"),
                  isCurrent && cn(colors.bg, colors.border, colors.text, "ring-4 shadow-md", colors.ring),
                  isUpcoming && "border-border/80 bg-muted/60 text-muted-foreground",
                )}
              >
                {isComplete ? (
                  <Check className="size-4" strokeWidth={3} />
                ) : isCurrent ? (
                  node.type === "closed" ? (
                    <Sparkles className="size-4" />
                  ) : isReview ? (
                    <Shield className="size-4" />
                  ) : (
                    <Clock className="size-4" />
                  )
                ) : (
                  <Circle className="size-2.5 fill-current" />
                )}
              </motion.div>
              <p
                className={cn(
                  "mt-2 w-full px-0.5 text-center text-[11px] font-semibold leading-tight sm:text-xs",
                  isCurrent && colors.text,
                  isComplete && colors.text,
                  isUpcoming && "text-muted-foreground",
                )}
              >
                {node.label}
              </p>
            </div>
            {index < nodes.length - 1 ? (
              <div className="flex h-9 w-4 shrink-0 items-center sm:w-5">
                <div
                  className={cn(
                    "h-1 w-full rounded-full",
                    isComplete ? colors.connector : "bg-border/70",
                  )}
                />
              </div>
            ) : null}
          </>
        )}
      </div>
    )
  }

  if (orientation === "vertical") {
    return (
      <div className={cn("relative", compact ? "py-2" : "py-4")}>
        <div className="flex flex-col gap-0">{nodes.map((node, i) => renderNode(node, i))}</div>
      </div>
    )
  }

  return (
    <HorizontalScrollArea className="pb-1">
      <div className="flex min-w-max items-start px-1">
        {nodes.map((node, i) => renderNode(node, i))}
      </div>
    </HorizontalScrollArea>
  )
}
