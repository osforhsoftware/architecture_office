import { Suspense } from "react"
import { getCurrentUser } from "@/lib/auth"
import { getDepartmentNames } from "@/lib/departments"
import { listProjectServiceDefs } from "@/lib/project-services"
import { listDocumentTemplates, toDocumentOption } from "@/lib/document-templates"
import { getClients, getProjectsPaginated } from "@/lib/queries"
import {
  PROJECT_STATUSES,
  isSuperAdmin,
  userIsBillingStaff,
} from "@/lib/constants"
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
  const billingOnly = user ? userIsBillingStaff(user) && user.role === "Billing Staff" : false
  const isFullAdmin = user ? isSuperAdmin(user.role) : false

  const params = await searchParams
  const search = params.search ?? ""
  const status = params.status ?? "all"
  const section = billingOnly ? "Billing" : (params.section ?? "all")

  const [result, clients, departmentNames, services, documentRows] = await Promise.all([
    getProjectsPaginated({
      search,
      status,
      section,
      priority: params.priority,
      page: params.page,
      pageSize: params.pageSize,
    }),
    billingOnly ? Promise.resolve([]) : getClients(),
    getDepartmentNames(true),
    listProjectServiceDefs({ activeOnly: true }),
    billingOnly
      ? Promise.resolve([])
      : listDocumentTemplates({ activeOnly: true }),
  ])

  const documentTemplates = documentRows.map(toDocumentOption)

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
              : isFullAdmin
                ? "Manage project pipeline and assignments"
                : "Add new projects. Full project management requires Acmmo Admin."}
          </p>
        </div>
        {!billingOnly ? (
          <div className="flex flex-wrap gap-2">
            {isFullAdmin ? <ProjectsExportButton /> : null}
            <ProjectDialog
              clients={clients}
              services={services}
              documentTemplates={documentTemplates}
              canSetStartDate={isFullAdmin}
            />
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
          sectionOptions={billingOnly ? ["Billing"] : departmentNames}
          hideSectionFilter={billingOnly}
        />
      </Suspense>
    </div>
  )
}
