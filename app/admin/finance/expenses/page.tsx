import { redirect } from "next/navigation"

export default function LegacyFinanceExpensesPage() {
  redirect("/admin/finance/project/expenses")
}
