"use client"

import { useState, useTransition } from "react"
import { ArrowLeftRight } from "lucide-react"
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
import type { FinanceSelectOption } from "@/components/finance/finance-options"
import { transferBetweenAccounts } from "@/lib/finance/actions"

export function TransferDialog({ accounts }: { accounts: FinanceSelectOption[] }) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [fromId, setFromId] = useState<string | null>(null)
  const [toId, setToId] = useState<string | null>(null)

  function onSubmit(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const res = await transferBetweenAccounts(formData)
      if (res && "error" in res && res.error) {
        setError(res.error)
        return
      }
      toast.success(`Transfer ${res.transferNumber ?? "completed"}`)
      setOpen(false)
      setFromId(null)
      setToId(null)
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline">
            <ArrowLeftRight className="size-4" /> Transfer
          </Button>
        }
      />
      <FormDialogShell title="Transfer Between Accounts" description="Move funds between accounts.">
        {open ? (
          <form action={onSubmit} className="flex min-h-0 flex-1 flex-col">
            <FormDialogBody>
              {error ? (
                <p className="mb-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              ) : null}
              <FormSection title="Transfer details">
                <div className="grid gap-3">
                  <FormField label="From account">
                    <FormSelect
                      name="from_account_id"
                      options={accounts}
                      value={fromId}
                      onValueChange={setFromId}
                      placeholder="Source account"
                      required
                    />
                  </FormField>
                  <FormField label="To account">
                    <FormSelect
                      name="to_account_id"
                      options={accounts}
                      value={toId}
                      onValueChange={setToId}
                      placeholder="Destination account"
                      required
                    />
                  </FormField>
                  <FormField label="Amount" htmlFor="transfer-amount">
                    <Input
                      id="transfer-amount"
                      name="amount"
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      className={formControlClass}
                    />
                  </FormField>
                  <FormField label="Date" htmlFor="transfer-date">
                    <Input
                      id="transfer-date"
                      name="transfer_date"
                      type="date"
                      required
                      defaultValue={new Date().toISOString().slice(0, 10)}
                      className={formControlClass}
                    />
                  </FormField>
                  <FormField label="Reference" htmlFor="transfer-ref">
                    <Input id="transfer-ref" name="reference" className={formControlClass} />
                  </FormField>
                  <FormField label="Notes" htmlFor="transfer-notes">
                    <Textarea id="transfer-notes" name="notes" className={formTextareaClass} />
                  </FormField>
                </div>
              </FormSection>
            </FormDialogBody>
            <FormDialogFooter submitLabel="Transfer funds" pending={pending} />
          </form>
        ) : null}
      </FormDialogShell>
    </Dialog>
  )
}
