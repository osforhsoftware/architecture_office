import { getCurrentUser } from "@/lib/auth"
import { getStaffAllProjects } from "@/lib/queries"
import { StaffProjectCard } from "@/components/staff-project-card"
import { Card, CardContent } from "@/components/ui/card"

export default async function StaffProjectsPage() {
  const user = await getCurrentUser()
  if (!user) return null

  const projects = await getStaffAllProjects(user.id, user.name)
  const active = projects.filter(
    (p) =>
      p.assigned_to === user.id &&
      !["Closed", "Completed", "Returned"].includes(p.status),
  )
  const returned = projects.filter(
    (p) => p.assigned_to === user.id && p.status === "Returned",
  )
  const past = projects.filter(
    (p) =>
      p.assigned_to !== user.id ||
      ["Closed", "Completed", "Pending Review"].includes(p.status),
  )

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold">My Projects</h2>
        <p className="text-sm text-muted-foreground">
          All projects you worked on — active, returned, and completed.
        </p>
      </div>

      {active.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-medium text-muted-foreground">Active ({active.length})</h3>
          {active.map((p) => (
            <StaffProjectCard key={p.id} project={p} />
          ))}
        </section>
      ) : null}

      {returned.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-medium text-muted-foreground">
            Returned to office ({returned.length})
          </h3>
          <p className="text-xs text-muted-foreground">
            These stay in your list so you can track status and view your work details.
          </p>
          {returned.map((p) => (
            <StaffProjectCard key={p.id} project={p} />
          ))}
        </section>
      ) : null}

      {past.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-medium text-muted-foreground">
            Submitted & past ({past.length})
          </h3>
          {past.map((p) => (
            <StaffProjectCard key={p.id} project={p} />
          ))}
        </section>
      ) : null}

      {projects.length === 0 ? (
        <Card className="shadow-none">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No projects yet. Check the department queue on Home for new work.
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
