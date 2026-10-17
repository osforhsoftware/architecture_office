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
import { getFinanceClients, getProjectsForInvoiceSelect } from "@/lib/queries"

export async function ProjectFinanceQuickActions({
  projectId,
  clientId,
}: {
  projectId: number
  clientId: number
}) {
  const [financeClients, projects, incomeCategories, expenseCategories, accounts, vendors] =
    await Promise.all([
      getFinanceClients(),
      getProjectsForInvoiceSelect(),
      getIncomeCategories(true, "project"),
      getExpenseCategories(true, "project"),
      getFinanceAccounts(true),
      getAllVendors(),
    ])

  const clientInFinance = financeClients.some((client) => client.id === clientId)

  const incomeOptions = {
    clients: clientsToOptions(financeClients),
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
        defaultClientId={clientInFinance ? clientId : undefined}
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
