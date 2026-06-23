"use client"

import { motion } from "framer-motion"
import type { ReturnHistory, StatusHistory } from "@/lib/types"
import { StatusBadge } from "@/components/status-badges"
import { RotateCcw, Activity } from "lucide-react"

export function ProjectActivityFeed({
  statusHistory,
  returnHistory,
}: {
  statusHistory: StatusHistory[]
  returnHistory: ReturnHistory[]
}) {
  const events = [
    ...statusHistory.map((h) => ({
      id: `s-${h.id}`,
      type: "status" as const,
      title: `Status changed to ${h.status}`,
      note: h.note,
      by: h.created_by,
      at: h.created_at,
      status: h.status,
    })),
    ...returnHistory.map((r) => ({
      id: `r-${r.id}`,
      type: "return" as const,
      title: `Project returned: ${r.reason}`,
      note: r.notes,
      by: r.created_by,
      at: r.created_at,
      status: null,
    })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Activity className="size-4 text-primary" />
        <h3 className="text-sm font-semibold">Activity Feed</h3>
      </div>
      <div className="max-h-[480px] space-y-3 overflow-y-auto pr-1">
        {events.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No activity yet.</p>
        ) : (
          events.map((e, i) => (
            <motion.div
              key={e.id}
              initial={false}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
              className="relative rounded-lg border border-border/60 bg-card p-3 shadow-sm"
            >
              <div className="flex items-start gap-2">
                {e.type === "return" ? (
                  <RotateCcw className="mt-0.5 size-3.5 shrink-0 text-rose-500" />
                ) : (
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-snug">{e.title}</p>
                  {e.note ? (
                    <p className="mt-1 text-xs text-muted-foreground">{e.note}</p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {e.status ? <StatusBadge status={e.status} /> : null}
                    <span className="text-[11px] text-muted-foreground">
                      {e.by ?? "System"} · {new Date(e.at).toLocaleString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  )
}
