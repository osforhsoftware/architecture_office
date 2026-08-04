import { Suspense } from "react"
import { VendorsDataTable } from "@/components/finance/vendors-data-table"
import { getVendorsPaginated } from "@/lib/finance/server"

export default async function OfficeVendorsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string; pageSize?: string }>
}) {
  const params = await searchParams
  const search = params.search ?? ""

  const result = await getVendorsPaginated({
    search,
    page: params.page,
    pageSize: params.pageSize,
  })

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">Office Finance</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">Vendors</h2>
        <p className="text-sm text-muted-foreground">Suppliers, contractors, and payables</p>
      </div>

      <div className="rounded-xl border border-border/60 bg-card p-5 shadow-premium">
        <Suspense>
          <VendorsDataTable result={result} search={search} />
        </Suspense>
      </div>
    </div>
  )
}
