import { Suspense } from "react"
import { getCurrentUser } from "@/lib/auth"
import { getClients, getProjectsPaginated } from "@/lib/queries"
import { PROJECT_STATUSES, SECTIONS, isBillingStaff } from "@/lib/constants"
import { ProjectDialog } from "@/components/project-dialog"
import { ProjectsDataTable } from "@/components/projects-data-table"
import { ProjectsExportButton } from "@/components/projects-export-button"

export default async function AdminProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string
    status?: string
    section?: string
    priority?: string
    page?: string
    pageSize?: string
  }>
}) {
  const user = await getCurrentUser()
  const billingOnly = user ? isBillingStaff(user.role) : false

  const params = await searchParams
  const search = params.search ?? ""
  const status = params.status ?? "all"
  const section = billingOnly ? "Billing" : (params.section ?? "all")

  const [result, clients] = await Promise.all([
    getProjectsPaginated({
      search,
      status,
      section,
      priority: params.priority,
      page: params.page,
      pageSize: params.pageSize,
    }),
    billingOnly ? Promise.resolve([]) : getClients(),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            {billingOnly ? "Billing" : "Projects"}
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">
            {billingOnly ? "Billing Projects" : "All Projects"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {billingOnly
              ? "Projects in the billing stage — generate invoices and record payments"
              : "Manage project pipeline and assignments"}
          </p>
        </div>
        {!billingOnly ? (
          <div className="flex flex-wrap gap-2">
            <ProjectsExportButton />
            <ProjectDialog clients={clients} />
          </div>
        ) : null}
      </div>

      <Suspense>
        <ProjectsDataTable
          result={result}
          search={search}
          status={status}
          section={section}
          statusOptions={[...PROJECT_STATUSES]}
          sectionOptions={billingOnly ? ["Billing"] : [...SECTIONS]}
          hideSectionFilter={billingOnly}
        />
      </Suspense>
    </div>
  )
}
