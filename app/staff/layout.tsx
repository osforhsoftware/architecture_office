import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import { isOfficeAdmin } from "@/lib/constants"
import { getNotifications } from "@/lib/queries"
import { StaffSidebar } from "@/components/staff-sidebar"
import { StaffTopbar } from "@/components/staff-topbar"
import { StaffBottomNav } from "@/components/staff-bottom-nav"
import { LateComingAlert } from "@/components/attendance/late-coming-alert"
import {
  ensureAttendanceSettings,
  getLateComingInfo,
  getTodayAttendanceForStaff,
  todayInOfficeTz,
} from "@/lib/attendance/queries"

export default async function StaffLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()
  if (!user) redirect("/login")
  if (isOfficeAdmin(user.role)) redirect("/admin")

  const officeDate = todayInOfficeTz()
  const [notifications, settings, todayRecord] = await Promise.all([
    getNotifications(user.id),
    ensureAttendanceSettings(),
    getTodayAttendanceForStaff(user.id, officeDate),
  ])

  const lateInfo = getLateComingInfo(settings, Boolean(todayRecord?.check_in))

  return (
    <div className="flex min-h-screen bg-background">
      <StaffSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <StaffTopbar user={user} notifications={notifications} />
        <main className="blueprint-bg flex-1 p-4 pb-24 md:pb-6 md:p-6">{children}</main>
      </div>
      <StaffBottomNav />
      <LateComingAlert lateInfo={lateInfo} officeDate={officeDate} />
    </div>
  )
}
