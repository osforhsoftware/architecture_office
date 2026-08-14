import { Suspense } from "react"
import { getAdditionalRequirementTemplatesPaginated } from "@/lib/additional-requirements"
import { RequirementDialog } from "@/components/requirement-dialog"
import { RequirementsDataTable } from "@/components/requirements-data-table"

export default async function AdminRequirementsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string; pageSize?: string }>
}) {
  const params = await searchParams
  const search = params.search ?? ""

  const result = await getAdditionalRequirementTemplatesPaginated({
    search,
    page: params.page,
    pageSize: params.pageSize,
  })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">Catalog</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">Custom Fields</h2>
          <p className="text-sm text-muted-foreground">
            Add fields such as Ward Number or Area Code. Choose a value type, then they appear when
            creating a project.
          </p>
        </div>
        <RequirementDialog />
      </div>

      <Suspense>
        <RequirementsDataTable result={result} search={search} />
      </Suspense>
    </div>
  )
}
