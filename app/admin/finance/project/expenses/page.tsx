import { Suspense } from "react"
import { ExpenseDataTable } from "@/components/finance/expense-data-table"
import {
  accountsToOptions,
  categoriesToOptions,
  projectsToOptions,
  vendorsToOptions,
} from "@/components/finance/finance-options"
import {
  getAllVendors,
  getExpenseCategories,
  getExpensesPaginated,
  getFinanceAccounts,
} from "@/lib/finance/server"
import { getProjectsForInvoiceSelect } from "@/lib/queries"

export default async function ProjectExpensesPage({
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

  const [result, vendors, projects, categories, accounts] = await Promise.all([
    getExpensesPaginated({
      scope: "project",
      search,
      status,
      projectId: params.projectId,
      page: params.page,
      pageSize: params.pageSize,
    }),
    getAllVendors(),
    getProjectsForInvoiceSelect(),
    getExpenseCategories(true, "project"),
    getFinanceAccounts(true),
  ])

  const dialogOptions = {
    vendors: vendorsToOptions(vendors),
    projects: projectsToOptions(projects),
    categories: categoriesToOptions(categories),
    accounts: accountsToOptions(accounts),
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">Project Finance</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">Project Expenses</h2>
        <p className="text-sm text-muted-foreground">Vendor bills and site costs allocated to projects</p>
      </div>

      <div className="rounded-xl border border-border/60 bg-card p-5 shadow-premium">
        <Suspense>
          <ExpenseDataTable
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
