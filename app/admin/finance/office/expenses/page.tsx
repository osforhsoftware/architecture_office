import { Suspense } from "react"
import { ExpenseDataTable } from "@/components/finance/expense-data-table"
import {
  accountsToOptions,
  categoriesToOptions,
  vendorsToOptions,
} from "@/components/finance/finance-options"
import {
  getAllVendors,
  getExpenseCategories,
  getExpensesPaginated,
  getFinanceAccounts,
} from "@/lib/finance/server"

export default async function OfficeExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string; pageSize?: string; status?: string }>
}) {
  const params = await searchParams
  const search = params.search ?? ""
  const status = params.status ?? ""

  const [result, vendors, categories, accounts] = await Promise.all([
    getExpensesPaginated({ scope: "office", search, status, page: params.page, pageSize: params.pageSize }),
    getAllVendors(),
    getExpenseCategories(true, "office"),
    getFinanceAccounts(true),
  ])

  const dialogOptions = {
    vendors: vendorsToOptions(vendors),
    projects: [],
    categories: categoriesToOptions(categories),
    accounts: accountsToOptions(accounts),
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">Office Finance</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">Office Expenses</h2>
        <p className="text-sm text-muted-foreground">Rent, salary, utilities, and other office operating costs</p>
      </div>

      <div className="rounded-xl border border-border/60 bg-card p-5 shadow-premium">
        <Suspense>
          <ExpenseDataTable
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
