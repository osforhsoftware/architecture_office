"use client"

import { useState, useTransition } from "react"
import { Pencil } from "lucide-react"
import { toast } from "sonner"
import { Dialog, DialogTrigger } from "@/components/ui/dialog"
import {
  FormDialogBody,
  FormDialogFooter,
  FormDialogShell,
} from "@/components/form-dialog-shell"
import { FormField, formControlClass, formTextareaClass } from "@/components/form-section"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { updatePayment } from "@/lib/actions"
import { formatCurrency, PAYMENT_METHODS } from "@/lib/constants"
import type { Payment } from "@/lib/types"

function getPaymentFormValues(payment: Payment) {
  return {
    amount: String(Number(payment.amount) || ""),
    method: payment.method || "UPI",
    note: payment.note ?? "",
  }
}

export function PaymentEditDialog({ payment }: { payment: Payment }) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState(() => getPaymentFormValues(payment))
  const [pending, startTransition] = useTransition()

  function onSubmit(formData: FormData) {
    setError(null)
    formData.set("id", String(payment.id))
    formData.set("method", form.method)
    startTransition(async () => {
      const res = await updatePayment(formData)
      if (res?.error) {
        setError(res.error)
        return
      }
      toast.success("Payment updated")
      setOpen(false)
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) setForm(getPaymentFormValues(payment))
        if (!next) setError(null)
      }}
    >
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            <Pencil className="size-4" /> Edit
          </Button>
        }
      />
      <FormDialogShell
        size="md"
        title="Edit Payment"
        description={
          <>
            Update this transaction. Current amount{" "}
            <span className="font-medium text-foreground">
              {formatCurrency(payment.amount)}
            </span>
            . Project totals recalculate after save.
          </>
        }
      >
        <form action={onSubmit} className="flex min-h-0 flex-1 flex-col">
          <FormDialogBody>
            <div className="flex flex-col gap-3">
              <FormField label="Amount (₹)" htmlFor={`payment-amount-${payment.id}`}>
                <Input
                  id={`payment-amount-${payment.id}`}
                  name="amount"
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                  className={formControlClass}
                />
              </FormField>

              <FormField label="Method" htmlFor={`payment-method-${payment.id}`}>
                <Select
                  value={form.method}
                  onValueChange={(value) =>
                    setForm((f) => ({ ...f, method: value ?? f.method }))
                  }
                >
                  <SelectTrigger
                    id={`payment-method-${payment.id}`}
                    className={formControlClass}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>

              <FormField label="Note" htmlFor={`payment-note-${payment.id}`}>
                <Textarea
                  id={`payment-note-${payment.id}`}
                  name="note"
                  value={form.note}
                  onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                  placeholder="Receipt reference, installment, etc."
                  className={formTextareaClass}
                />
              </FormField>

              {error ? <p className="text-sm text-destructive">{error}</p> : null}
            </div>
          </FormDialogBody>

          <FormDialogFooter
            submitLabel={pending ? "Saving..." : "Save Payment"}
            pending={pending}
          />
        </form>
      </FormDialogShell>
    </Dialog>
  )
}
