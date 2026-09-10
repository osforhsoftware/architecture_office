"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { LayoutGrid, List } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { StaffProjectCard } from "@/components/staff-project-card"
import { StatusBadge, PriorityBadge } from "@/components/status-badges"
import { DebouncedSearchInput } from "@/components/debounced-search-input"
import { TableQueryProvider, useTableParams } from "@/components/use-table-params"
import { WORKFLOW_STAGES, projectProgressPercent } from "@/lib/constants"
import { isOverdueDueDate, STAFF_PROJECT_FILTERS } from "@/lib/project-list-filters"
import { cn } from "@/lib/utils"
import type { Project } from "@/lib/types"

const FILTER_LABELS: Record<string, string> = {
  assigned: "My assigned",
  awaiting_action: "Awaiting action",
  submitted_review: "In review",
  correction: "Corrections",
  overdue: "Overdue",
  completed: "Completed",
}

type StaffProjectsViewProps = {
  projects: Project[]
  filter: string
  search: string
}

function StaffProjectsViewInner({ projects, filter, search }: StaffProjectsViewProps) {
  const { updateParams } = useTableParams()
  const [view, setView] = useState<"grid" | "table">("grid")

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return projects
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        (p.client_name ?? "").toLowerCase().includes(q),
    )
  }, [projects, search])

  const cards = (
    <div className="grid gap-3 md:grid-cols-2">
      {filtered.map((p) => (
        <StaffProjectCard key={p.id} project={p} />
      ))}
    </div>
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <DebouncedSearchInput placeholder="Search projects..." className="w-full max-w-none md:max-w-sm" />
        <div className="flex items-center gap-2">
          <Select
            value={filter}
            onValueChange={(value) => {
              if (!value) return
              updateParams({ filter: value === "all" ? null : value })
            }}
          >
            <SelectTrigger className="min-w-0 flex-1 md:w-[160px] md:flex-none">
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All work</SelectItem>
              {STAFF_PROJECT_FILTERS.map((f) => (
                <SelectItem key={f} value={f}>
                  {FILTER_LABELS[f] ?? f}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="hidden shrink-0 rounded-lg border border-border/60 p-0.5 md:flex">
            <Button
              type="button"
              variant={view === "grid" ? "secondary" : "ghost"}
              size="icon-sm"
              onClick={() => setView("grid")}
              title="Grid view"
            >
              <LayoutGrid className="size-4" />
            </Button>
            <Button
              type="button"
              variant={view === "table" ? "secondary" : "ghost"}
              size="icon-sm"
              onClick={() => setView("table")}
              title="Table view"
            >
              <List className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">No projects match.</p>
      ) : view === "grid" ? (
        cards
      ) : (
        <>
          <div className="md:hidden">{cards}</div>
          <div className="hidden overflow-x-auto rounded-xl border border-border/60 bg-card md:block">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="border-b border-border bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-semibold">Client</th>
                  <th className="px-4 py-3 font-semibold">Project</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="whitespace-nowrap px-4 py-3 font-semibold">Due</th>
                  <th className="px-4 py-3 font-semibold">Stage</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const overdue = isOverdueDueDate(p.due_date, p.status)
                  return (
                    <tr
                      key={p.id}
                      className={cn(
                        "border-b border-border/50 hover:bg-muted/40",
                        p.priority === "High" && "bg-red-50/80",
                      )}
                    >
                      <td className="max-w-[10rem] px-4 py-3">
                        <span className="block truncate font-semibold">{p.client_name || "—"}</span>
                      </td>
                      <td className="max-w-[14rem] px-4 py-3">
                        <Link
                          href={`/staff/projects/${p.id}`}
                          className="block truncate hover:text-primary hover:underline"
                        >
                          {p.name}
                        </Link>
                        <p className="truncate text-xs text-muted-foreground">{p.code}</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col items-start gap-1">
                          <StatusBadge status={p.status} />
                          <PriorityBadge priority={p.priority} />
                        </div>
                      </td>
                      <td
                        className={cn(
                          "whitespace-nowrap px-4 py-3 tabular-nums",
                          overdue && "font-medium text-red-600",
                        )}
                      >
                        {p.due_date
                          ? new Date(p.due_date).toLocaleDateString("en-IN", {
                              day: "2-digit",
                              month: "short",
                            })
                          : "—"}
                      </td>
                      <td className="max-w-[12rem] px-4 py-3 text-xs leading-snug text-muted-foreground">
                        <span className="block">
                          {WORKFLOW_STAGES[p.current_stage]?.label ?? p.section}
                        </span>
                        <span>{projectProgressPercent(p.current_stage)}%</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

export function StaffProjectsView(props: StaffProjectsViewProps) {
  return (
    <TableQueryProvider>
      <StaffProjectsViewInner {...props} />
    </TableQueryProvider>
  )
}
