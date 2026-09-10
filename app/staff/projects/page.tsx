import { Suspense } from "react"
import { getCurrentUser } from "@/lib/auth"
import { getStaffProjectsFiltered } from "@/lib/queries"
import { StaffProjectsView } from "@/components/staff-projects-view"

export default async function StaffProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; filter?: string }>
}) {
  const user = await getCurrentUser()
  if (!user) return null

  const params = await searchParams
  const search = params.search ?? ""
  const filter = params.filter ?? "all"

  const projects = await getStaffProjectsFiltered(user.id, user.name, filter)

  return (
    <div className="flex w-full min-w-0 flex-col gap-4 md:gap-6">
      <div className="hidden md:block">
        <h2 className="text-xl font-semibold">My Projects</h2>
        <p className="text-sm text-muted-foreground">
          Pending and in-progress work appears first. Switch between grid and table views.
        </p>
      </div>

      <Suspense>
        <StaffProjectsView projects={projects} filter={filter} search={search} />
      </Suspense>
    </div>
  )
}
