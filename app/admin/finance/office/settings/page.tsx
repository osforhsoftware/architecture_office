import { CategoryManager } from "@/components/finance/category-manager"
import { FinanceSettingsForm } from "@/components/finance/finance-settings-form"
import { getExpenseCategories, getFinanceSettings, getIncomeCategories } from "@/lib/finance/server"

export default async function OfficeSettingsPage() {
  const [settings, incomeCategories, expenseCategories] = await Promise.all([
    getFinanceSettings(),
    getIncomeCategories(),
    getExpenseCategories(),
  ])
  const threshold = Number(settings.low_cash_threshold ?? 5000)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">Office Finance</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">Settings</h2>
        <p className="text-sm text-muted-foreground">Finance module configuration and categories</p>
      </div>

      <FinanceSettingsForm lowCashThreshold={Number.isFinite(threshold) ? threshold : 5000} />

      <div className="rounded-xl border border-border/60 bg-card p-5 shadow-premium">
        <h3 className="mb-4 text-sm font-semibold">Categories</h3>
        <CategoryManager
          incomeCategories={incomeCategories}
          expenseCategories={expenseCategories}
        />
      </div>
    </div>
  )
}
