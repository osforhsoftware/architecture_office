import { Suspense } from "react"
import { getCurrentUser } from "@/lib/auth"
import { isSuperAdmin } from "@/lib/constants"
import { getStaffPaginated } from "@/lib/queries"
import { StaffDialog } from "@/components/staff-dialog"
import { StaffDataTable } from "@/components/staff-data-table"

export default async function AdminStaffPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string; pageSize?: string }>
}) {
  const user = await getCurrentUser()
  const canManageStaff = user ? isSuperAdmin(user.role) : false

  const params = await searchParams
  const search = params.search ?? ""

  const result = await getStaffPaginated({
    search,
    page: params.page,
    pageSize: params.pageSize,
  })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">Teams</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">Staff</h2>
          <p className="text-sm text-muted-foreground">
            {canManageStaff
              ? `${result.total} staff member${result.total === 1 ? "" : "s"} in the directory.`
              : "Add new staff accounts. Editing and removal require Super Admin."}
          </p>
        </div>
        <StaffDialog />
      </div>

      <Suspense>
        <StaffDataTable
          result={result}
          search={search}
          canManageStaff={canManageStaff}
        />
      </Suspense>
    </div>
  )
}
