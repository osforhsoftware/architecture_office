import { Suspense } from "react"
import { IncomeDataTable } from "@/components/finance/income-data-table"
import {
  accountsToOptions,
  categoriesToOptions,
  clientsToOptions,
  projectsToOptions,
} from "@/components/finance/finance-options"
import {
  getFinanceAccounts,
  getIncomeCategories,
  getIncomePaginated,
} from "@/lib/finance/server"
import { getClients, getProjectsForInvoiceSelect } from "@/lib/queries"

export default async function ProjectIncomePage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string
    page?: string
    pageSize?: string
    status?: string
    projectId?: string
  }>
}) {
  const params = await searchParams
  const search = params.search ?? ""
  const status = params.status ?? ""
  const projectId = params.projectId ?? ""

  const [result, clients, projects, categories, accounts] = await Promise.all([
    getIncomePaginated({
      scope: "project",
      search,
      status,
      projectId: projectId || undefined,
      page: params.page,
      pageSize: params.pageSize,
    }),
    getClients(),
    getProjectsForInvoiceSelect(),
    getIncomeCategories(true, "project"),
    getFinanceAccounts(true),
  ])

  const dialogOptions = {
    clients: clientsToOptions(clients),
    projects: projectsToOptions(projects),
    categories: categoriesToOptions(categories),
    accounts: accountsToOptions(accounts),
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">Project Finance</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">Project Income</h2>
        <p className="text-sm text-muted-foreground">Client payments and receipts linked to projects</p>
      </div>

      <div className="rounded-xl border border-border/60 bg-card p-5 shadow-premium">
        <Suspense>
          <IncomeDataTable
            result={result}
            search={search}
            status={status}
            scope="project"
            dialogOptions={dialogOptions}
          />
        </Suspense>
      </div>
    </div>
  )
}
