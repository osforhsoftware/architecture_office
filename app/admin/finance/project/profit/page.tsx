import { Suspense } from "react"
import { ProjectFinanceDataTable } from "@/components/finance/project-finance-data-table"
import { getProjectFinanceList } from "@/lib/finance/server"

export default async function ProjectProfitPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string; pageSize?: string }>
}) {
  const params = await searchParams
  const search = params.search ?? ""

  const result = await getProjectFinanceList({
    search,
    page: params.page,
    pageSize: params.pageSize,
  })

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">Project Finance</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">Profit Analysis</h2>
        <p className="text-sm text-muted-foreground">Compare net profit and margins across projects</p>
      </div>

      <div className="rounded-xl border border-border/60 bg-card p-5 shadow-premium">
        <Suspense>
          <ProjectFinanceDataTable result={result} search={search} />
        </Suspense>
      </div>
    </div>
  )
}
