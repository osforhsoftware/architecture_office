"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
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
import { deleteInvoicePayment } from "@/lib/actions"
import { formatCurrency } from "@/lib/constants"
import { invoicePaymentDeleteConfirmationPhrase } from "@/lib/payment-utils"
import type { InvoicePayment } from "@/lib/types"

export function InvoicePaymentDeleteDialog({ payment }: { payment: InvoicePayment }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [confirmation, setConfirmation] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const expectedPhrase = invoicePaymentDeleteConfirmationPhrase(payment.id)
  const canDelete = confirmation === expectedPhrase

  function handleDelete() {
    setError(null)
    const fd = new FormData()
    fd.set("id", String(payment.id))
    fd.set("confirmation", confirmation)

    startTransition(async () => {
      const res = await deleteInvoicePayment(fd)
      if (res?.error) {
        setError(res.error)
        return
      }
      toast.success("Payment permanently deleted")
      setOpen(false)
      router.refresh()
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
            className="rounded-none text-destructive hover:text-destructive"
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
            This is a <span className="font-medium text-foreground">hard delete</span>. The{" "}
            <span className="font-medium text-foreground">
              {formatCurrency(payment.amount)}
            </span>{" "}
            · {payment.method} payment will be permanently removed from this invoice and cannot be
            recovered. Invoice amount paid, balance, and payment status will recalculate
            automatically.
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
                {new Date(payment.payment_date).toLocaleDateString("en-IN")}
                {payment.notes ? ` · ${payment.notes}` : ""}
              </p>
              <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                Payment ID #{payment.id}
              </p>
            </div>

            <p className="mb-4 text-sm text-muted-foreground">
              Only delete if this payment was recorded by mistake. This action cannot be undone.
            </p>

            <FormField
              label={
                <>
                  Type{" "}
                  <span className="font-mono text-xs font-semibold text-foreground">
                    {expectedPhrase}
                  </span>{" "}
                  to confirm hard delete
                </>
              }
              htmlFor={`invoice-payment-delete-confirm-${payment.id}`}
            >
              <Input
                id={`invoice-payment-delete-confirm-${payment.id}`}
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
            submitLabel={pending ? "Deleting..." : "Permanently Delete"}
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
