"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useTransition,
  type ReactNode,
} from "react"
import { Save } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { saveProjectPageDetails } from "@/lib/actions"
import { cn } from "@/lib/utils"

type CollectFn = () => FormData

type ProjectDetailsSaveContextValue = {
  register: (id: string, collect: CollectFn) => void
  unregister: (id: string) => void
  saveAll: () => void
  pending: boolean
}

const ProjectDetailsSaveContext = createContext<ProjectDetailsSaveContextValue | null>(null)

export function ProjectDetailsSaveProvider({
  projectId,
  children,
}: {
  projectId: number
  children: ReactNode
}) {
  const collectorsRef = useRef(new Map<string, CollectFn>())
  const [pending, startTransition] = useTransition()

  const register = useCallback((id: string, collect: CollectFn) => {
    collectorsRef.current.set(id, collect)
  }, [])

  const unregister = useCallback((id: string) => {
    collectorsRef.current.delete(id)
  }, [])

  const saveAll = useCallback(() => {
    startTransition(async () => {
      const fd = new FormData()
      fd.set("project_id", String(projectId))
      for (const collect of collectorsRef.current.values()) {
        const part = collect()
        for (const [key, value] of part.entries()) {
          fd.append(key, value)
        }
      }
      const res = await saveProjectPageDetails(fd)
      if (res && "error" in res && res.error) toast.error(res.error)
      else toast.success("Project updated")
    })
  }, [projectId])

  const value = useMemo(
    () => ({ register, unregister, saveAll, pending }),
    [register, unregister, saveAll, pending],
  )

  return (
    <ProjectDetailsSaveContext.Provider value={value}>
      {children}
    </ProjectDetailsSaveContext.Provider>
  )
}

export function useProjectSaveSection(id: string, collect: CollectFn) {
  const ctx = useContext(ProjectDetailsSaveContext)
  const collectRef = useRef(collect)
  collectRef.current = collect

  useEffect(() => {
    if (!ctx) return
    ctx.register(id, () => collectRef.current())
    return () => ctx.unregister(id)
  }, [id, ctx])

  return {
    grouped: ctx != null,
    pending: ctx?.pending ?? false,
  }
}

export function ProjectSaveBar({ placement }: { placement: "top" | "bottom" }) {
  const ctx = useContext(ProjectDetailsSaveContext)
  if (!ctx) return null

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-border/60 bg-card/95 p-4 shadow-premium backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between",
        placement === "top" && "md:sticky md:top-14 md:z-10",
        placement === "bottom" && "sticky bottom-20 z-10 md:static md:bottom-auto",
      )}
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold">Update project</p>
        <p className="text-xs text-muted-foreground">
          Saves custom fields, start date, drawing number, areas, and comments.
        </p>
      </div>
      <Button
        type="button"
        size="lg"
        disabled={ctx.pending}
        onClick={ctx.saveAll}
        className="shrink-0"
      >
        <Save className="size-4" />
        {ctx.pending ? "Saving..." : "Update Project"}
      </Button>
    </div>
  )
}

export function ProjectDetailsSaveShell({
  projectId,
  enabled,
  children,
}: {
  projectId: number
  enabled: boolean
  children: ReactNode
}) {
  if (!enabled) return children

  return (
    <ProjectDetailsSaveProvider projectId={projectId}>
      <div className="flex flex-col gap-6">
        <ProjectSaveBar placement="top" />
        {children}
        <ProjectSaveBar placement="bottom" />
      </div>
    </ProjectDetailsSaveProvider>
  )
}
