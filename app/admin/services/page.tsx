import { Suspense } from "react"
import { listDepartments } from "@/lib/departments"
import { getServicesPaginated } from "@/lib/queries"
import { ServiceDialog } from "@/components/service-dialog"
import { ServicesDataTable } from "@/components/services-data-table"

export default async function AdminServicesPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string; pageSize?: string }>
}) {
  const params = await searchParams
  const search = params.search ?? ""

  const [result, departments] = await Promise.all([
    getServicesPaginated({
      search,
      page: params.page,
      pageSize: params.pageSize,
    }),
    listDepartments({ activeOnly: true }),
  ])

  const departmentOptions = departments.map((d) => ({
    value: d.name,
    label: d.name,
    role: d.role_label,
  }))

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">Catalog</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">Project Services</h2>
          <p className="text-sm text-muted-foreground">
            Add, edit, reorder, or hide services. Active services appear in project packages and
            invoice line pickers.
          </p>
        </div>
        <ServiceDialog departmentOptions={departmentOptions} />
      </div>

      <Suspense>
        <ServicesDataTable
          result={result}
          search={search}
          departmentOptions={departmentOptions}
        />
      </Suspense>
    </div>
  )
}
