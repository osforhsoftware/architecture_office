"use client"

import { useState, useTransition } from "react"
import { Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Dialog, DialogTrigger } from "@/components/ui/dialog"
import {
  FormDialogBody,
  FormDialogFooter,
  FormDialogShell,
} from "@/components/form-dialog-shell"
import { FormField, formControlClass } from "@/components/form-section"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { deletePayment } from "@/lib/actions"
import { formatCurrency } from "@/lib/constants"
import { paymentDeleteConfirmationPhrase } from "@/lib/payment-utils"
import type { Payment } from "@/lib/types"

export function PaymentDeleteDialog({ payment }: { payment: Payment }) {
  const [open, setOpen] = useState(false)
  const [confirmation, setConfirmation] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const expectedPhrase = paymentDeleteConfirmationPhrase(payment.id)
  const canDelete = confirmation === expectedPhrase

  function handleDelete() {
    setError(null)
    const fd = new FormData()
    fd.set("id", String(payment.id))
    fd.set("confirmation", confirmation)

    startTransition(async () => {
      const res = await deletePayment(fd)
      if (res?.error) {
        setError(res.error)
        return
      }
      toast.success("Payment deleted")
      setOpen(false)
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) {
          setConfirmation("")
          setError(null)
        }
      }}
    >
      <DialogTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="size-4" /> Delete
          </Button>
        }
      />
      <FormDialogShell
        size="md"
        title="Delete Payment"
        description={
          <>
            Permanently remove this{" "}
            <span className="font-medium text-foreground">
              {formatCurrency(payment.amount)}
            </span>{" "}
            · {payment.method} transaction. Project totals and payment status will
            recalculate automatically.
          </>
        }
      >
        <div className="flex min-h-0 flex-1 flex-col">
          <FormDialogBody>
            <div className="mb-4 rounded-lg border border-border/60 bg-muted/40 px-3 py-2.5 text-sm">
              <p className="font-medium">
                {formatCurrency(payment.amount)} · {payment.method}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {new Date(payment.created_at).toLocaleDateString("en-IN")}
                {payment.note ? ` · ${payment.note}` : ""}
              </p>
              <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                Payment ID #{payment.id}
              </p>
            </div>

            <FormField
              label={
                <>
                  Type{" "}
                  <span className="font-mono text-xs font-semibold text-foreground">
                    {expectedPhrase}
                  </span>{" "}
                  to confirm
                </>
              }
              htmlFor={`payment-delete-confirm-${payment.id}`}
            >
              <Input
                id={`payment-delete-confirm-${payment.id}`}
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                autoComplete="off"
                placeholder={expectedPhrase}
                aria-invalid={confirmation.length > 0 && !canDelete}
                className={formControlClass}
              />
            </FormField>

            {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}
          </FormDialogBody>

          <FormDialogFooter
            submitLabel={pending ? "Deleting..." : "Delete Payment"}
            submitVariant="destructive"
            submitType="button"
            submitDisabled={!canDelete}
            pending={pending}
            onSubmit={handleDelete}
          />
        </div>
      </FormDialogShell>
    </Dialog>
  )
}
