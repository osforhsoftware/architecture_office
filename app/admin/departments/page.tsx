import { Suspense } from "react"
import { getDepartmentsPaginated } from "@/lib/queries"
import { DepartmentsDataTable } from "@/components/departments-data-table"

export default async function AdminDepartmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string; pageSize?: string }>
}) {
  const params = await searchParams
  const search = params.search ?? ""

  const result = await getDepartmentsPaginated({
    search,
    page: params.page,
    pageSize: params.pageSize,
  })

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">Teams</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">Departments</h2>
        <p className="text-sm text-muted-foreground">
          Workflow distribution across {result.total} office department
          {result.total === 1 ? "" : "s"}.
        </p>
      </div>

      <Suspense>
        <DepartmentsDataTable result={result} search={search} />
      </Suspense>
    </div>
  )
}
