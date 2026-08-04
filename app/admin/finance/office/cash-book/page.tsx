import { Suspense } from "react"
import { CashBookDataTable } from "@/components/finance/cash-book-data-table"
import { getCashBookPaginated, getFinanceAccounts } from "@/lib/finance/server"

export default async function OfficeCashBookPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string
    page?: string
    pageSize?: string
    accountId?: string
    from?: string
    to?: string
  }>
}) {
  const params = await searchParams
  const search = params.search ?? ""

  const [result, accounts] = await Promise.all([
    getCashBookPaginated({
      search,
      page: params.page,
      pageSize: params.pageSize,
      accountId: params.accountId,
      from: params.from,
      to: params.to,
    }),
    getFinanceAccounts(true),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">Office Finance</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">Cash Book</h2>
        <p className="text-sm text-muted-foreground">
          Office ledger only — project transactions appear in project ledger
        </p>
      </div>

      <div className="rounded-xl border border-border/60 bg-card p-5 shadow-premium">
        <Suspense>
          <CashBookDataTable result={result} search={search} />
        </Suspense>
      </div>
    </div>
  )
}
