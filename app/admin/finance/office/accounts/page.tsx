import { formatCurrency } from "@/lib/constants"
import { isCashAccountType, isBankAccountType } from "@/lib/finance/constants"
import { AccountDialog } from "@/components/finance/account-dialog"
import { TransferDialog } from "@/components/finance/transfer-dialog"
import { accountsToOptions } from "@/components/finance/finance-options"
import { getFinanceAccounts } from "@/lib/finance/server"
import { Badge } from "@/components/ui/badge"

export default async function OfficeAccountsPage() {
  const accounts = await getFinanceAccounts(false)
  const accountOptions = accountsToOptions(accounts.filter((a) => a.active))

  let cashTotal = 0
  let bankTotal = 0
  for (const a of accounts) {
    const bal = Number(a.current_balance)
    if (isCashAccountType(String(a.account_type))) cashTotal += bal
    else if (isBankAccountType(String(a.account_type))) bankTotal += bal
    else bankTotal += bal
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">Office Finance</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">Accounts</h2>
          <p className="text-sm text-muted-foreground">Cash, bank, and UPI account balances</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <TransferDialog accounts={accountOptions} />
          <AccountDialog />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-border/60 bg-card p-4 shadow-premium">
          <p className="text-xs text-muted-foreground">Total Cash</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">{formatCurrency(cashTotal)}</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-4 shadow-premium">
          <p className="text-xs text-muted-foreground">Total Bank / UPI</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">{formatCurrency(bankTotal)}</p>
        </div>
      </div>

      {accounts.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {accounts.map((account) => (
            <div key={account.id} className="rounded-xl border border-border/60 bg-card p-5 shadow-premium">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold">{account.name}</h3>
                  <p className="text-xs capitalize text-muted-foreground">{account.account_type}</p>
                </div>
                {account.active ? <Badge variant="secondary">Active</Badge> : <Badge variant="outline">Inactive</Badge>}
              </div>
              <p className="mt-4 text-2xl font-semibold tabular-nums">{formatCurrency(account.current_balance)}</p>
              {account.bank_name ? <p className="mt-1 text-xs text-muted-foreground">{account.bank_name}</p> : null}
              <div className="mt-4">
                <AccountDialog account={account} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border/60 bg-card p-12 text-center shadow-premium">
          <p className="text-muted-foreground">No accounts yet. Add your first cash or bank account.</p>
        </div>
      )}
    </div>
  )
}
