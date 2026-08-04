import { getCurrentUser } from "@/lib/auth"
import { FinanceSubNav } from "@/components/finance/finance-sub-nav"

export default async function FinanceLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  return (
    <div className="flex flex-col gap-6">
      <FinanceSubNav role={user?.role} />
      {children}
    </div>
  )
}
