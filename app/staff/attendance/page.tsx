import { getCurrentUser } from "@/lib/auth"
import { StaffAttendancePanel } from "@/components/attendance/staff-attendance-panel"
import {
  ensureAttendanceSettings,
  getTodayAttendanceForStaff,
  todayInOfficeTz,
} from "@/lib/attendance/queries"

export default async function StaffAttendancePage() {
  const user = await getCurrentUser()
  if (!user) return null

  const officeDate = todayInOfficeTz()
  const [settings, todayRecord] = await Promise.all([
    ensureAttendanceSettings(),
    getTodayAttendanceForStaff(user.id, officeDate),
  ])

  return (
    <StaffAttendancePanel
      settings={settings}
      todayRecord={todayRecord}
      officeDate={officeDate}
    />
  )
}
