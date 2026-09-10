import { Suspense } from "react"
import { getCurrentUser } from "@/lib/auth"
import { FinanceSubNav } from "@/components/finance/finance-sub-nav"
import { ProjectFinanceHubActions } from "@/components/project-finance-hub-actions"

export default async function FinanceLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  return (
    <div className="flex flex-col gap-6">
      <FinanceSubNav role={user?.role}>
        <Suspense fallback={null}>
          <ProjectFinanceHubActions />
        </Suspense>
      </FinanceSubNav>
      {children}
    </div>
  )
}
