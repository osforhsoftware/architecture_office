import { Suspense } from "react"
import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import { isSuperAdmin } from "@/lib/constants"
import { getStaffRoleLabels } from "@/lib/departments"
import { getStaffUsers } from "@/lib/queries"
import { AttendanceDataTable } from "@/components/attendance/attendance-data-table"
import { AttendanceSettingsForm } from "@/components/attendance/attendance-settings-form"
import { AdminMarkAttendanceDialog } from "@/components/attendance/admin-mark-attendance-dialog"
import {
  ensureAttendanceSettings,
  getAttendanceReport,
  todayInOfficeTz,
} from "@/lib/attendance/queries"

export default async function AdminAttendancePage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string
    page?: string
    pageSize?: string
    staffId?: string
    department?: string
    date?: string
    month?: string
    from?: string
    to?: string
  }>
}) {
  const user = await getCurrentUser()
  if (!user || !isSuperAdmin(user.role)) redirect("/admin")

  const params = await searchParams
  const hasMonth = Boolean(params.month)
  const date = params.date ?? (hasMonth || params.from || params.to ? "" : todayInOfficeTz())
  const month = params.month ?? ""
  const staffId = params.staffId ?? ""
  const department = params.department ?? ""
  const search = params.search ?? ""

  const settings = await ensureAttendanceSettings()

  const [result, staff, roleLabels] = await Promise.all([
    getAttendanceReport({
      search,
      page: params.page,
      pageSize: params.pageSize,
      staffId: staffId || undefined,
      department: department || undefined,
      date: date || undefined,
      month: month || undefined,
      from: params.from,
      to: params.to,
      includeAbsent: !hasMonth && !params.from && !params.to,
    }),
    getStaffUsers(),
    getStaffRoleLabels(true),
  ])

  const staffOptions = staff.map((s) => ({ id: s.id, name: s.name }))
  const departments = roleLabels.length
    ? roleLabels
    : Array.from(new Set(staff.map((s) => s.role))).sort()

  const presentCount = result.rows.filter((r) => r.attendance_status === "Present").length
  const lateCount = result.rows.filter((r) => r.attendance_status === "Late Coming").length
  const absentCount = result.rows.filter((r) => r.attendance_status === "Absent").length

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">Workforce</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">Attendance</h2>
          <p className="text-sm text-muted-foreground">
            Office {settings.office_start_time} · Buffer {settings.buffer_minutes} min · Geofence{" "}
            {settings.radius_meters} m
          </p>
        </div>
        <div className="print:hidden">
          <AdminMarkAttendanceDialog staffOptions={staffOptions} />
        </div>
      </div>

      <AttendanceSettingsForm settings={settings} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 print:hidden">
        <div className="rounded-xl border border-border/60 bg-card p-4 shadow-premium">
          <p className="text-sm text-muted-foreground">Records</p>
          <p className="mt-1 text-2xl font-semibold">{result.total}</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-4 shadow-premium">
          <p className="text-sm text-muted-foreground">Present (page)</p>
          <p className="mt-1 text-2xl font-semibold">{presentCount}</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-4 shadow-premium">
          <p className="text-sm text-muted-foreground">Late Coming (page)</p>
          <p className="mt-1 text-2xl font-semibold">{lateCount}</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-4 shadow-premium">
          <p className="text-sm text-muted-foreground">Absent (page)</p>
          <p className="mt-1 text-2xl font-semibold">{absentCount}</p>
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-card p-4 shadow-premium sm:p-5">
        <Suspense>
          <AttendanceDataTable
            result={result}
            staffOptions={staffOptions}
            departments={departments}
            date={date}
            month={month}
            staffId={staffId}
            department={department}
          />
        </Suspense>
      </div>
    </div>
  )
}
