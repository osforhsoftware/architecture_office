import { Plus } from "lucide-react"
import { IncomeDialog } from "@/components/finance/income-dialog"
import { ExpenseDialog } from "@/components/finance/expense-dialog"
import {
  accountsToOptions,
  categoriesToOptions,
  clientsToOptions,
  projectsToOptions,
  vendorsToOptions,
} from "@/components/finance/finance-options"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  getAllVendors,
  getExpenseCategories,
  getFinanceAccounts,
  getIncomeCategories,
} from "@/lib/finance/server"
import { getClients, getProjectsForInvoiceSelect } from "@/lib/queries"

export async function ProjectFinanceQuickActions({
  projectId,
  clientId,
}: {
  projectId: number
  clientId: number
}) {
  const [clients, projects, incomeCategories, expenseCategories, accounts, vendors] =
    await Promise.all([
      getClients(),
      getProjectsForInvoiceSelect(),
      getIncomeCategories(true, "project"),
      getExpenseCategories(true, "project"),
      getFinanceAccounts(true),
      getAllVendors(),
    ])

  const incomeOptions = {
    clients: clientsToOptions(clients),
    projects: projectsToOptions(projects),
    categories: categoriesToOptions(incomeCategories),
    accounts: accountsToOptions(accounts),
  }
  const expenseOptions = {
    vendors: vendorsToOptions(vendors),
    projects: projectsToOptions(projects),
    categories: categoriesToOptions(expenseCategories),
    accounts: accountsToOptions(accounts),
  }

  return (
    <div className="flex flex-wrap gap-2">
      <IncomeDialog
        {...incomeOptions}
        scope="project"
        defaultClientId={clientId}
        defaultProjectId={projectId}
        trigger={
          <button type="button" className={cn(buttonVariants({ variant: "default", size: "sm" }))}>
            <Plus className="size-4" /> Add Income
          </button>
        }
      />
      <ExpenseDialog
        {...expenseOptions}
        scope="project"
        defaultProjectId={projectId}
        trigger={
          <button type="button" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            <Plus className="size-4" /> Add Expense
          </button>
        }
      />
    </div>
  )
}
