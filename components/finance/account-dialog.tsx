"use client"

import { useEffect, useState, useTransition } from "react"
import { Pencil, Plus } from "lucide-react"
import { toast } from "sonner"
import { Dialog, DialogTrigger } from "@/components/ui/dialog"
import {
  FormDialogBody,
  FormDialogFooter,
  FormDialogShell,
} from "@/components/form-dialog-shell"
import { FormSelect } from "@/components/form-select"
import { FormField, FormSection, formControlClass, formTextareaClass } from "@/components/form-section"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ACCOUNT_TYPES } from "@/lib/finance/constants"
import { createAccount, updateAccount } from "@/lib/finance/actions"
import type { FinanceAccount } from "@/lib/finance/types"

export function AccountDialog({ account }: { account?: FinanceAccount }) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [accountType, setAccountType] = useState("bank")
  const isEdit = Boolean(account)
  const fieldId = account ? `account-${account.id}` : "account-new"

  useEffect(() => {
    if (!open) return
    setAccountType(account?.account_type ?? "bank")
    setError(null)
  }, [open, account])

  function onSubmit(formData: FormData) {
    setError(null)
    if (account) formData.set("id", String(account.id))
    formData.set("account_type", accountType)
    startTransition(async () => {
      const res = isEdit ? await updateAccount(formData) : await createAccount(formData)
      if (res && "error" in res) {
        setError(res.error)
        return
      }
      toast.success(isEdit ? "Account updated" : "Account created")
      setOpen(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          isEdit ? (
            <Button variant="outline" size="sm">
              <Pencil className="size-4" /> Edit
            </Button>
          ) : (
            <Button>
              <Plus className="size-4" /> Add Account
            </Button>
          )
        }
      />
      <FormDialogShell
        title={isEdit ? "Edit Account" : "Add Account"}
        description="Cash, petty cash, bank, or UPI accounts."
      >
        {open ? (
          <form action={onSubmit} className="flex min-h-0 flex-1 flex-col">
            <FormDialogBody>
              {error ? (
                <p className="mb-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              ) : null}
              <FormSection title="Account details">
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField label="Name" htmlFor={`${fieldId}-name`} className="sm:col-span-2">
                    <Input
                      id={`${fieldId}-name`}
                      name="name"
                      required
                      defaultValue={account?.name ?? ""}
                      className={formControlClass}
                    />
                  </FormField>
                  <FormField label="Type">
                    <FormSelect
                      name="account_type"
                      options={ACCOUNT_TYPES.map((t) => ({
                        value: t,
                        label: t.charAt(0).toUpperCase() + t.slice(1),
                      }))}
                      value={accountType}
                      onValueChange={(v) => setAccountType(v ?? "bank")}
                    />
                  </FormField>
                  {!isEdit ? (
                    <FormField label="Opening balance" htmlFor={`${fieldId}-opening`}>
                      <Input
                        id={`${fieldId}-opening`}
                        name="opening_balance"
                        type="number"
                        step="0.01"
                        defaultValue="0"
                        className={formControlClass}
                      />
                    </FormField>
                  ) : null}
                  <FormField label="Bank name" htmlFor={`${fieldId}-bank`}>
                    <Input
                      id={`${fieldId}-bank`}
                      name="bank_name"
                      defaultValue={account?.bank_name ?? ""}
                      className={formControlClass}
                    />
                  </FormField>
                  <FormField label="Account number" htmlFor={`${fieldId}-number`}>
                    <Input
                      id={`${fieldId}-number`}
                      name="account_number"
                      defaultValue={account?.account_number ?? ""}
                      className={formControlClass}
                    />
                  </FormField>
                  <FormField label="Notes" htmlFor={`${fieldId}-notes`} className="sm:col-span-2">
                    <Textarea
                      id={`${fieldId}-notes`}
                      name="notes"
                      defaultValue={account?.notes ?? ""}
                      className={formTextareaClass}
                    />
                  </FormField>
                </div>
              </FormSection>
            </FormDialogBody>
            <FormDialogFooter submitLabel={isEdit ? "Save changes" : "Create account"} pending={pending} />
          </form>
        ) : null}
      </FormDialogShell>
    </Dialog>
  )
}
