import { Suspense } from "react"
import Link from "next/link"
import { getCurrentUser } from "@/lib/auth"
import { isSuperAdmin } from "@/lib/constants"
import { getStaffRoleLabels } from "@/lib/departments"
import { getStaffPaginated, getUserActivity } from "@/lib/queries"
import { StaffDialog } from "@/components/staff-dialog"
import { StaffDataTable } from "@/components/staff-data-table"
import { UserActivityPanel } from "@/components/user-activity-panel"

export default async function AdminStaffPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string; pageSize?: string; staff?: string }>
}) {
  const user = await getCurrentUser()
  const canManageStaff = user ? isSuperAdmin(user.role) : false

  const params = await searchParams
  const search = params.search ?? ""
  const selectedStaffId = params.staff ? Number(params.staff) : null

  const [result, roleOptions] = await Promise.all([
    getStaffPaginated({
      search,
      page: params.page,
      pageSize: params.pageSize,
    }),
    getStaffRoleLabels(true),
  ])

  const selectedStaff = selectedStaffId
    ? result.rows.find((member) => member.id === selectedStaffId)
    : null
  const activity =
    selectedStaff != null
      ? await getUserActivity(selectedStaff.id, selectedStaff.name)
      : []

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">Teams</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">Staff</h2>
          <p className="text-sm text-muted-foreground">
            {`${result.total} staff member${result.total === 1 ? "" : "s"} in the directory.`}
          </p>
        </div>
        {canManageStaff ? <StaffDialog roleOptions={roleOptions} /> : null}
      </div>

      {selectedStaff ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Showing workflow & activity for <span className="font-medium text-foreground">{selectedStaff.name}</span>
            </p>
            <Link href="/admin/staff" className="text-xs text-primary hover:underline">
              Close
            </Link>
          </div>
          <UserActivityPanel events={activity} userName={selectedStaff.name} />
        </div>
      ) : null}

      <Suspense>
        <StaffDataTable
          result={result}
          search={search}
          canManageStaff={canManageStaff}
          roleOptions={roleOptions}
          selectedStaffId={selectedStaffId}
        />
      </Suspense>
    </div>
  )
}
