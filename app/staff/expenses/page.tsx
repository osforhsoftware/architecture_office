import { getCurrentUser } from "@/lib/auth"
import { ClaimDialog } from "@/components/finance/claim-dialog"
import { StaffClaimsList } from "@/components/finance/staff-claims-list"
import { projectsToOptions } from "@/components/finance/finance-options"
import { getStaffClaimsPaginated } from "@/lib/finance/server"
import { getProjectsForUser } from "@/lib/queries"

export default async function StaffExpensesPage() {
  const user = await getCurrentUser()
  if (!user) return null

  const [result, projects] = await Promise.all([
    getStaffClaimsPaginated({
      staffId: String(user.id),
      pageSize: "all",
    }),
    getProjectsForUser(user.id),
  ])

  const projectOptions = projectsToOptions(projects)

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">My Expenses</h2>
          <p className="text-sm text-muted-foreground">
            Submit reimbursement claims for fuel, travel, and site visits.
          </p>
        </div>
        <ClaimDialog projects={projectOptions} staffId={user.id} />
      </div>

      <div className="rounded-xl border border-border/60 bg-card p-4 shadow-premium">
        <StaffClaimsList claims={result.rows} />
      </div>
    </div>
  )
}
