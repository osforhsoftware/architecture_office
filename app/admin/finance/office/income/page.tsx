import { Suspense } from "react"
import { IncomeDataTable } from "@/components/finance/income-data-table"
import { accountsToOptions, categoriesToOptions } from "@/components/finance/finance-options"
import { getFinanceAccounts, getIncomeCategories, getIncomePaginated } from "@/lib/finance/server"

export default async function OfficeIncomePage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string; pageSize?: string; status?: string }>
}) {
  const params = await searchParams
  const search = params.search ?? ""
  const status = params.status ?? ""

  const [result, categories, accounts] = await Promise.all([
    getIncomePaginated({ scope: "office", search, status, page: params.page, pageSize: params.pageSize }),
    getIncomeCategories(true, "office"),
    getFinanceAccounts(true),
  ])

  const dialogOptions = {
    clients: [],
    projects: [],
    categories: categoriesToOptions(categories),
    accounts: accountsToOptions(accounts),
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">Office Finance</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">Office Income</h2>
        <p className="text-sm text-muted-foreground">Non-project income such as consultation and office services</p>
      </div>

      <div className="rounded-xl border border-border/60 bg-card p-5 shadow-premium">
        <Suspense>
          <IncomeDataTable
            result={result}
            search={search}
            status={status}
            scope="office"
            dialogOptions={dialogOptions}
          />
        </Suspense>
      </div>
    </div>
  )
}
