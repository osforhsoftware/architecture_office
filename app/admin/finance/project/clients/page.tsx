import { Suspense } from "react"
import { ClientDialog } from "@/components/client-dialog"
import { FinanceClientsDataTable } from "@/components/finance/finance-clients-data-table"
import { LinkFinanceClientDialog } from "@/components/link-finance-client-dialog"
import { getFinanceClientsPaginated, getLinkableOfficeClients } from "@/lib/queries"

export default async function FinanceClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string; pageSize?: string }>
}) {
  const params = await searchParams
  const search = params.search ?? ""

  const [result, linkableClients] = await Promise.all([
    getFinanceClientsPaginated({
      search,
      page: params.page,
      pageSize: params.pageSize,
    }),
    getLinkableOfficeClients(),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">Project Finance</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">Finance Clients</h2>
          <p className="text-sm text-muted-foreground">
            {result.total} client{result.total === 1 ? "" : "s"} created in Finance or linked from the office directory.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ClientDialog source="finance" triggerLabel="Add Finance Client" />
          <LinkFinanceClientDialog clients={linkableClients} />
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-card p-5 shadow-premium">
        <Suspense>
          <FinanceClientsDataTable result={result} search={search} />
        </Suspense>
      </div>
    </div>
  )
}
