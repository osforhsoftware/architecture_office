import { Suspense } from "react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ProjectLedgerTable } from "@/components/finance/project-ledger-table"
import { projectsToOptions } from "@/components/finance/finance-options"
import { getProjectLedgerPaginated } from "@/lib/finance/server"
import { getProjectsForInvoiceSelect } from "@/lib/queries"
import { Button } from "@/components/ui/button"

export default async function ProjectLedgerPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string; search?: string; page?: string; pageSize?: string }>
}) {
  const params = await searchParams
  const projectId = Number(params.projectId)
  const projects = await getProjectsForInvoiceSelect()
  const projectOptions = projectsToOptions(projects)

  if (!projectId) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">Project Finance</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">Project Ledger</h2>
          <p className="text-sm text-muted-foreground">Running balance of project income and expenses</p>
        </div>
        <form method="get" className="flex flex-wrap items-end gap-3 rounded-xl border border-border/60 bg-card p-4 shadow-premium">
          <div className="flex flex-col gap-1">
            <label htmlFor="projectId" className="text-xs font-medium text-muted-foreground">Project</label>
            <select id="projectId" name="projectId" required className="h-9 min-w-[220px] rounded-lg border border-input px-2 text-sm">
              <option value="">Select project</option>
              {projectOptions.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
          <Button type="submit" size="sm">View ledger</Button>
        </form>
      </div>
    )
  }

  const project = projects.find((p) => p.id === projectId)
  if (!project) notFound()

  const result = await getProjectLedgerPaginated(projectId, {
    search: params.search,
    page: params.page,
    pageSize: params.pageSize,
  })

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin/finance/project/ledger" className="text-xs font-medium text-primary hover:underline">
          ← All projects
        </Link>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight">Ledger — {project.code ?? project.name}</h2>
      </div>
      <div className="rounded-xl border border-border/60 bg-card p-5 shadow-premium">
        <Suspense>
          <ProjectLedgerTable result={result} search={params.search ?? ""} />
        </Suspense>
      </div>
    </div>
  )
}
