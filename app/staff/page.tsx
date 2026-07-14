import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StaffProjectCard } from "@/components/staff-project-card"
import { getCurrentUser } from "@/lib/auth"
import { formatRolesLabel, rolesOf } from "@/lib/constants"
import {
  getDepartmentQueueForRoles,
  getProjectsForUser,
  getStaffDashboardStats,
} from "@/lib/queries"

export default async function StaffHomePage() {
  const user = await getCurrentUser()
  if (!user) return null

  const [assigned, queue, stats] = await Promise.all([
    getProjectsForUser(user.id),
    getDepartmentQueueForRoles(rolesOf(user)),
    getStaffDashboardStats(user.id, user.name),
  ])

  const kpiItems = [
    { label: "My Assigned", value: stats.assigned },
    { label: "Awaiting Action", value: stats.awaiting_action },
    { label: "In Review", value: stats.submitted_review },
    { label: "Corrections", value: stats.correction },
    { label: "Overdue", value: stats.overdue },
    { label: "Completed", value: stats.completed },
  ]

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <div>
        <h2 className="text-xl font-semibold">Welcome, {user.name.split(" ")[0]}</h2>
        <p className="text-sm text-muted-foreground">
          {formatRolesLabel(user)} · {stats.active} active {stats.active === 1 ? "project" : "projects"}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {kpiItems.map((item) => (
          <Card key={item.label} className="shadow-none">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-semibold tabular-nums">{item.value}</p>
              <p className="text-xs text-muted-foreground">{item.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">Active work</h3>
          <Link href="/staff/projects" className="text-xs text-primary hover:underline">
            View all
          </Link>
        </div>
        {assigned.length > 0 ? (
          <div className="flex flex-col gap-3">
            {assigned.slice(0, 5).map((p) => (
              <StaffProjectCard key={p.id} project={p} />
            ))}
          </div>
        ) : (
          <Card className="shadow-none">
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              No active projects right now.
            </CardContent>
          </Card>
        )}
      </section>

      {queue.length > 0 ? (
        <Card className="shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Department queue ({queue.length})</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col divide-y divide-border pt-0">
            {queue.slice(0, 3).map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{p.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{p.code} · awaiting assignment</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
