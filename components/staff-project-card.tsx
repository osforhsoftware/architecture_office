import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { StatusBadge, PriorityBadge } from "@/components/status-badges"
import { WORKFLOW_STAGES, projectProgressPercent } from "@/lib/constants"
import { isOverdueDueDate } from "@/lib/project-list-filters"
import { cn } from "@/lib/utils"
import type { Project } from "@/lib/types"
import { Progress } from "@/components/ui/progress"

export function StaffProjectCard({ project }: { project: Project }) {
  const stage = WORKFLOW_STAGES[project.current_stage]
  const progress = projectProgressPercent(project.current_stage)

  const overdue = isOverdueDueDate(project.due_date, project.status)

  return (
    <Link
      href={`/staff/projects/${project.id}`}
      className={cn(
        "block rounded-xl border border-border bg-card p-4 transition-colors active:bg-muted/50",
        project.priority === "High" && "border-red-200 bg-red-50/90",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold leading-snug">{project.client_name || "—"}</p>
          <p className="mt-0.5 truncate text-sm leading-snug">{project.name}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{project.code}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {project.due_date ? (
            <span
              className={cn(
                "whitespace-nowrap text-xs tabular-nums",
                overdue ? "font-medium text-red-600" : "text-muted-foreground",
              )}
            >
              {new Date(project.due_date).toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "short",
              })}
            </span>
          ) : null}
          <ChevronRight className="size-4 text-muted-foreground" />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <StatusBadge status={project.status} />
        <PriorityBadge priority={project.priority} />
      </div>

      <div className="mt-3 space-y-1.5">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="min-w-0 truncate pr-2">{stage?.label ?? project.section}</span>
          <span className="shrink-0 tabular-nums">{progress}%</span>
        </div>
        <Progress value={progress} className="h-1.5" />
      </div>
    </Link>
  )
}
