import { Suspense } from "react"
import { ClaimsDataTable } from "@/components/finance/claims-data-table"
import { getStaffClaimsPaginated } from "@/lib/finance/server"

export default async function OfficeClaimsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string; pageSize?: string; status?: string }>
}) {
  const params = await searchParams
  const search = params.search ?? ""
  const status = params.status ?? ""

  const result = await getStaffClaimsPaginated({
    search,
    status,
    page: params.page,
    pageSize: params.pageSize,
  })

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">Office Finance</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">Staff Expense Claims</h2>
        <p className="text-sm text-muted-foreground">Review and approve staff reimbursement requests</p>
      </div>

      <div className="rounded-xl border border-border/60 bg-card p-5 shadow-premium">
        <Suspense>
          <ClaimsDataTable result={result} search={search} status={status} />
        </Suspense>
      </div>
    </div>
  )
}
