import { Suspense } from "react"
import { getDepartmentsPaginated } from "@/lib/queries"
import { DepartmentDialog } from "@/components/department-dialog"
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
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">Teams</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">Departments</h2>
          <p className="text-sm text-muted-foreground">
            Add, edit, or remove departments. New departments appear in project and staff role
            options.
          </p>
        </div>
        <DepartmentDialog />
      </div>

      <Suspense>
        <DepartmentsDataTable result={result} search={search} />
      </Suspense>
    </div>
  )
}
