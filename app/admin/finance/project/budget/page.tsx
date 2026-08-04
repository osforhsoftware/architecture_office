import Link from "next/link"
import { notFound } from "next/navigation"
import { BudgetDialog } from "@/components/finance/budget-dialog"
import { projectsToOptions } from "@/components/finance/finance-options"
import { formatCurrency } from "@/lib/constants"
import { deleteProjectBudget } from "@/lib/finance/actions"
import { getProjectBudget } from "@/lib/finance/server"
import { getProjectsForInvoiceSelect } from "@/lib/queries"
import { Button } from "@/components/ui/button"

async function deleteBudgetAction(formData: FormData) {
  "use server"
  await deleteProjectBudget(formData)
}

export default async function ProjectBudgetPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string }>
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
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">Project Budget</h2>
          <p className="text-sm text-muted-foreground">Select a project to manage its budget lines</p>
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
          <Button type="submit" size="sm">Open budget</Button>
        </form>
      </div>
    )
  }

  const budget = await getProjectBudget(projectId)
  const project = projects.find((p) => p.id === projectId)
  if (!project) notFound()

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/admin/finance/project/budget" className="text-xs font-medium text-primary hover:underline">
            ← All projects
          </Link>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">Budget — {project.code ?? project.name}</h2>
          <p className="text-sm text-muted-foreground">{project.name}</p>
        </div>
        <BudgetDialog projectId={projectId} projects={projectOptions} />
      </div>

      <div className="rounded-xl border border-border/60 bg-card shadow-premium">
        {budget.length ? (
          <table className="w-full text-sm">
            <thead className="border-b border-border/60 bg-muted/40">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Category</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Estimated</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Spent</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {budget.map((line) => (
                <tr key={line.id} className="border-b border-border/40">
                  <td className="px-4 py-3 font-medium">{line.category}</td>
                  <td className="px-4 py-3 tabular-nums">{formatCurrency(line.estimated_amount)}</td>
                  <td className="px-4 py-3 tabular-nums">{formatCurrency(line.spent_amount ?? 0)}</td>
                  <td className="px-4 py-3 text-right">
                    <form action={deleteBudgetAction}>
                      <input type="hidden" name="id" value={line.id} />
                      <Button type="submit" variant="ghost" size="sm">Remove</Button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="px-4 py-12 text-center text-muted-foreground">No budget lines yet for this project.</p>
        )}
      </div>
    </div>
  )
}
