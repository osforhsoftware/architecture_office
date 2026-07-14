import Link from "next/link"
import {
  Building2,
  Calendar,
  CheckCircle2,
  LogOut,
  Mail,
  Phone,
  User,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StaffProfileSettings } from "@/components/staff-profile-settings"
import { StaffProjectCard } from "@/components/staff-project-card"
import { getCurrentUser } from "@/lib/auth"
import { logoutAction } from "@/lib/actions"
import { departmentForRole, formatRolesLabel, rolesOf } from "@/lib/constants"
import { getStaffAllProjects, getStaffDashboardStats } from "@/lib/queries"
import { staffOwnsProject } from "@/lib/project-access"

function formatMemberSince(value?: string) {
  if (!value) return null
  return new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

export default async function StaffProfilePage() {
  const user = await getCurrentUser()
  if (!user) return null

  const roleLabel = formatRolesLabel(user)
  const departmentLabel =
    [...new Set(rolesOf(user).map((role) => departmentForRole(role)).filter(Boolean))].join(", ") ||
    null
  const memberSince = formatMemberSince(user.created_at)

  const [stats, projects] = await Promise.all([
    getStaffDashboardStats(user.id, user.name),
    getStaffAllProjects(user.id, user.name),
  ])

  const completedProjects = projects
    .filter(
      (p) =>
        staffOwnsProject(user, p) && ["Closed", "Completed"].includes(p.status),
    )
    .slice(0, 5)

  const statItems = [
    { label: "Active", value: stats.active },
    { label: "Completed", value: stats.completed },
    { label: "In Review", value: stats.submitted_review },
    { label: "Returned", value: stats.returned },
    { label: "Correction", value: stats.correction },
    { label: "Total", value: stats.total },
  ]

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <div className="flex flex-col items-center gap-3 pt-2 text-center">
        <div className="flex size-20 items-center justify-center rounded-full bg-primary/10 text-2xl font-semibold text-primary">
          {user.name.charAt(0)}
        </div>
        <div>
          <h2 className="text-xl font-semibold">{user.name}</h2>
          <p className="text-sm text-muted-foreground">{roleLabel}</p>
          {departmentLabel ? (
            <p className="text-xs text-muted-foreground">{departmentLabel}</p>
          ) : null}
        </div>
      </div>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">Work summary</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {statItems.map((item) => (
            <Card key={item.label} className="shadow-none">
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-semibold tabular-nums">{item.value}</p>
                <p className="text-xs text-muted-foreground">{item.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <Card className="shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Account details</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-border p-0">
          <div className="flex items-center gap-3 px-4 py-3">
            <User className="size-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Username</p>
              <p className="text-sm font-medium">{user.username}</p>
            </div>
          </div>
          {departmentLabel ? (
            <div className="flex items-center gap-3 px-4 py-3">
              <Building2 className="size-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Department</p>
                <p className="text-sm font-medium">{departmentLabel}</p>
              </div>
            </div>
          ) : null}
          <div className="flex items-center gap-3 px-4 py-3">
            <Mail className="size-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Email</p>
              <p className="text-sm font-medium">{user.email || "—"}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 px-4 py-3">
            <Phone className="size-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Phone</p>
              <p className="text-sm font-medium">{user.phone || "—"}</p>
            </div>
          </div>
          {memberSince ? (
            <div className="flex items-center gap-3 px-4 py-3">
              <Calendar className="size-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Member since</p>
                <p className="text-sm font-medium">{memberSince}</p>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <StaffProfileSettings user={user} />

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-muted-foreground" />
            <h3 className="text-sm font-medium">Completed work</h3>
          </div>
          <Link href="/staff/projects" className="text-xs text-primary hover:underline">
            View all projects
          </Link>
        </div>
        {completedProjects.length > 0 ? (
          <div className="flex flex-col gap-3">
            {completedProjects.map((p) => (
              <StaffProjectCard key={p.id} project={p} />
            ))}
          </div>
        ) : (
          <Card className="shadow-none">
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              No completed projects yet.
            </CardContent>
          </Card>
        )}
      </section>

      <form action={logoutAction}>
        <button
          type="submit"
          suppressHydrationWarning
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card py-3 text-sm font-medium text-destructive transition-colors active:bg-muted/50"
        >
          <LogOut className="size-4" />
          Sign out
        </button>
      </form>
    </div>
  )
}
