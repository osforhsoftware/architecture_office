import { Suspense } from "react"
import { SalaryDataTable } from "@/components/finance/salary-data-table"
import { accountsToOptions } from "@/components/finance/finance-options"
import { getFinanceAccounts, getSalaryPaginated } from "@/lib/finance/server"
import { getStaffUsers } from "@/lib/queries"

export default async function OfficeSalaryPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string; pageSize?: string; status?: string }>
}) {
  const params = await searchParams
  const search = params.search ?? ""
  const status = params.status ?? ""

  const [result, staff, accounts] = await Promise.all([
    getSalaryPaginated({ search, status, page: params.page, pageSize: params.pageSize }),
    getStaffUsers(),
    getFinanceAccounts(true),
  ])

  const dialogOptions = {
    staff: staff.map((u) => ({ value: String(u.id), label: u.name })),
    accounts: accountsToOptions(accounts),
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">Office Finance</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">Salary & Payroll</h2>
        <p className="text-sm text-muted-foreground">Staff salary — recorded in office ledger only, never project profit</p>
      </div>

      <div className="rounded-xl border border-border/60 bg-card p-5 shadow-premium">
        <Suspense>
          <SalaryDataTable result={result} search={search} dialogOptions={dialogOptions} />
        </Suspense>
      </div>
    </div>
  )
}
