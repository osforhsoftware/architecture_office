import { Suspense } from "react"
import { getClientsPaginated } from "@/lib/queries"
import { getCurrentUser } from "@/lib/auth"
import { isSuperAdmin } from "@/lib/constants"
import { ClientDialog } from "@/components/client-dialog"
import { RegisterClientProjectDialog } from "@/components/register-client-project-dialog"
import { ClientsDataTable } from "@/components/clients-data-table"

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string; pageSize?: string }>
}) {
  const user = await getCurrentUser()
  const canSetStartDate = user ? isSuperAdmin(user.role) : false
  const params = await searchParams
  const search = params.search ?? ""

  const result = await getClientsPaginated({
    search,
    page: params.page,
    pageSize: params.pageSize,
  })

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-semibold">Clients</h2>
          <p className="text-sm text-muted-foreground">
            {result.total} client{result.total === 1 ? "" : "s"} in the directory.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <RegisterClientProjectDialog canSetStartDate={canSetStartDate} />
          <ClientDialog />
        </div>
      </div>

      <Suspense>
        <ClientsDataTable result={result} search={search} />
      </Suspense>
    </div>
  )
}
