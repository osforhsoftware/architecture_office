import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { StatusBadge, PriorityBadge } from "@/components/status-badges"
import { WORKFLOW_STAGES, projectProgressPercent } from "@/lib/constants"
import type { Project } from "@/lib/types"
import { Progress } from "@/components/ui/progress"

export function StaffProjectCard({ project }: { project: Project }) {
  const stage = WORKFLOW_STAGES[project.current_stage]
  const progress = projectProgressPercent(project.current_stage)

  return (
    <Link
      href={`/staff/projects/${project.id}`}
      className="block rounded-xl border border-border bg-card p-4 transition-colors active:bg-muted/50"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium leading-snug">{project.name}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {project.code} · {project.client_name}
          </p>
        </div>
        <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <StatusBadge status={project.status} />
        <PriorityBadge priority={project.priority} />
      </div>

      <div className="mt-3 space-y-1.5">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{stage?.label ?? project.section}</span>
          <span>{progress}%</span>
        </div>
        <Progress value={progress} className="h-1.5" />
      </div>
    </Link>
  )
}
