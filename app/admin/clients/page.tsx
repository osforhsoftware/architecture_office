import { Suspense } from "react"
import { getClientsPaginated } from "@/lib/queries"
import { listAdditionalRequirementTemplates, toAdditionalRequirementOption } from "@/lib/additional-requirements"
import { ClientDialog } from "@/components/client-dialog"
import { RegisterClientProjectDialog } from "@/components/register-client-project-dialog"
import { ClientsDataTable } from "@/components/clients-data-table"

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string
    district?: string
    hasProjects?: string
    source?: string
    page?: string
    pageSize?: string
  }>
}) {
  const params = await searchParams
  const search = params.search ?? ""
  const district = params.district ?? "all"
  const hasProjects = params.hasProjects ?? "all"
  const source = params.source ?? "all"

  const [result, requirementTemplates] = await Promise.all([
    getClientsPaginated({
      search,
      district,
      hasProjects,
      source,
      page: params.page,
      pageSize: params.pageSize,
    }),
    listAdditionalRequirementTemplates({ activeOnly: true }),
  ])

  const additionalRequirementOptions = requirementTemplates.map(toAdditionalRequirementOption)

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-semibold">Clients</h2>
          <p className="text-sm text-muted-foreground">
            {result.total} client{result.total === 1 ? "" : "s"} in the directory.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <RegisterClientProjectDialog
            additionalRequirementOptions={additionalRequirementOptions}
          />
          <ClientDialog />
        </div>
      </div>

      <Suspense>
        <ClientsDataTable
          result={result}
          search={search}
          district={district}
          hasProjects={hasProjects}
          source={source}
        />
      </Suspense>
    </div>
  )
}
