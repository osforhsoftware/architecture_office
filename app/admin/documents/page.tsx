import { Suspense } from "react"
import { listProjectServiceDefs } from "@/lib/project-services"
import { getDocumentTemplatesPaginated } from "@/lib/queries"
import { DocumentDialog } from "@/components/document-dialog"
import { DocumentsDataTable } from "@/components/documents-data-table"

export default async function AdminDocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string; pageSize?: string }>
}) {
  const params = await searchParams
  const search = params.search ?? ""

  const [result, services] = await Promise.all([
    getDocumentTemplatesPaginated({
      search,
      page: params.page,
      pageSize: params.pageSize,
    }),
    listProjectServiceDefs({ includeInactive: true }),
  ])

  const serviceOptions = services.map((s) => ({
    value: s.key,
    label: s.label,
  }))

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">Catalog</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">Documents</h2>
          <p className="text-sm text-muted-foreground">
            Manage checklist documents per service. Active documents appear when creating a project.
          </p>
        </div>
        <DocumentDialog serviceOptions={serviceOptions} />
      </div>

      <Suspense>
        <DocumentsDataTable
          result={result}
          search={search}
          serviceOptions={serviceOptions}
        />
      </Suspense>
    </div>
  )
}
