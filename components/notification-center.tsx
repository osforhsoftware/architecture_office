"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { markNotificationRead } from "@/lib/actions"
import type { Notification } from "@/lib/types"
import { cn } from "@/lib/utils"
import {
  ArrowLeftRight,
  Bell,
  CheckCircle2,
  CreditCard,
  FileQuestion,
  RotateCcw,
  UserPlus,
} from "lucide-react"

const CATEGORY_MAP: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  assignment: { label: "Assignment", icon: UserPlus, color: "bg-blue-500/10 text-blue-600" },
  returned: { label: "Returned", icon: RotateCcw, color: "bg-rose-500/10 text-rose-600" },
  approval: { label: "Approval", icon: CheckCircle2, color: "bg-violet-500/10 text-violet-600" },
  payment: { label: "Payment", icon: CreditCard, color: "bg-emerald-500/10 text-emerald-600" },
  document: { label: "Document", icon: FileQuestion, color: "bg-amber-500/10 text-amber-600" },
}

function categorize(type: string): keyof typeof CATEGORY_MAP {
  const t = type.toLowerCase()
  if (t.includes("assign")) return "assignment"
  if (t.includes("return")) return "returned"
  if (t.includes("review") || t.includes("approv")) return "approval"
  if (t.includes("pay")) return "payment"
  if (t.includes("doc")) return "document"
  return "assignment"
}

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "Just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export function NotificationCenter({
  notifications,
}: {
  notifications: Notification[]
}) {
  const unread = notifications.filter((n) => !n.read)
  const categories = ["all", "assignment", "returned", "approval", "payment", "document"] as const

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Notification Center</h2>
          <p className="text-sm text-muted-foreground">
            {unread.length} unread · {notifications.length} total
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <span
              key={cat}
              className="rounded-full border border-border px-3 py-1 text-xs font-medium capitalize text-muted-foreground"
            >
              {cat === "all" ? "All" : CATEGORY_MAP[cat]?.label ?? cat}
            </span>
          ))}
        </div>
      </div>

      <div className="grid gap-3">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
            <Bell className="size-10 text-muted-foreground/40" />
            <p className="mt-3 text-sm font-medium">No notifications yet</p>
            <p className="text-xs text-muted-foreground">Updates will appear here</p>
          </div>
        ) : (
          notifications.map((n, i) => {
            const cat = categorize(n.type)
            const meta = CATEGORY_MAP[cat]
            const Icon = meta.icon

            return (
              <motion.div
                key={n.id}
                initial={false}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className={cn(
                  "group rounded-xl border border-border/60 bg-card p-4 shadow-premium transition-all hover:border-primary/20",
                  !n.read && "border-l-4 border-l-primary bg-primary/[0.02]",
                )}
              >
                <div className="flex items-start gap-4">
                  <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", meta.color)}>
                    <Icon className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{n.title}</p>
                      {!n.read ? (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                          New
                        </span>
                      ) : null}
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", meta.color)}>
                        {meta.label}
                      </span>
                    </div>
                    {n.message ? (
                      <p className="mt-1 text-sm text-muted-foreground">{n.message}</p>
                    ) : null}
                    <p className="mt-2 text-xs text-muted-foreground">{timeAgo(n.created_at)}</p>
                  </div>
                  <div className="flex shrink-0 flex-col gap-1">
                    {!n.read ? (
                      <form action={markNotificationRead}>
                        <input type="hidden" name="id" value={n.id} />
                        <button
                          type="submit"
                          className="rounded-lg px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10"
                        >
                          Mark read
                        </button>
                      </form>
                    ) : null}
                    <Link
                      href="/admin/projects"
                      className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
                    >
                      <ArrowLeftRight className="size-3" />
                      View
                    </Link>
                  </div>
                </div>
              </motion.div>
            )
          })
        )}
      </div>
    </div>
  )
}
