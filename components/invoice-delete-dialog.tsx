"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Check, Copy, Trash2 } from "lucide-react"
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
import { deleteInvoice } from "@/lib/actions"
import { formatCurrency } from "@/lib/constants"
import { invoiceDeleteConfirmationPhrase } from "@/lib/invoice-utils"
import { cn } from "@/lib/utils"

export function InvoiceDeleteDialog({
  invoiceId,
  invoiceNumber,
  clientName,
  total,
  amountPaid,
  paymentCount = 0,
  redirectTo = "/admin/invoices",
  triggerVariant = "outline",
  triggerSize = "sm",
  triggerClassName,
  iconOnly = false,
}: {
  invoiceId: number
  invoiceNumber: string
  clientName: string
  total: string
  amountPaid?: string
  paymentCount?: number
  redirectTo?: string | null
  triggerVariant?: "outline" | "ghost"
  triggerSize?: "sm" | "icon-sm" | "xs"
  triggerClassName?: string
  iconOnly?: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [confirmation, setConfirmation] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [pending, startTransition] = useTransition()

  const expectedPhrase = invoiceDeleteConfirmationPhrase(invoiceId)
  const canDelete = confirmation === expectedPhrase
  const paid = Number(amountPaid ?? 0)

  async function handleCopyPhrase() {
    try {
      await navigator.clipboard.writeText(expectedPhrase)
      setCopied(true)
      toast.success("Confirmation text copied")
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error("Could not copy text")
    }
  }

  function handleDelete() {
    setError(null)
    const fd = new FormData()
    fd.set("id", String(invoiceId))
    fd.set("confirmation", confirmation)

    startTransition(async () => {
      const res = await deleteInvoice(fd)
      if (res?.error) {
        setError(res.error)
        return
      }
      toast.success("Invoice permanently deleted")
      setOpen(false)
      if (redirectTo) router.push(redirectTo)
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
          setCopied(false)
        }
      }}
    >
      <DialogTrigger
        render={
          <Button
            variant={triggerVariant}
            size={triggerSize}
            className={cn(
              "text-destructive hover:text-destructive",
              triggerClassName,
            )}
            title="Delete invoice"
            aria-label={`Delete invoice ${invoiceNumber}`}
          >
            <Trash2 className="size-4" />
            {iconOnly ? null : "Delete"}
          </Button>
        }
      />
      <FormDialogShell
        size="md"
        title="Delete Invoice"
        description={
          <>
            This is a <span className="font-medium text-foreground">hard delete</span>. Invoice{" "}
            <span className="font-medium text-foreground">{invoiceNumber}</span> and its line
            items
            {paymentCount > 0
              ? ` and ${paymentCount} payment${paymentCount === 1 ? "" : "s"}`
              : ""}{" "}
            will be permanently removed and cannot be recovered. Linked finance income records
            will keep their history but the invoice link will be cleared.
          </>
        }
      >
        <div className="flex min-h-0 flex-1 flex-col">
          <FormDialogBody>
            <div className="mb-4 rounded-lg border border-border/60 bg-muted/40 px-3 py-2.5 text-sm">
              <p className="font-medium">{invoiceNumber}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{clientName}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Total {formatCurrency(total)}
                {paid > 0 ? ` · Paid ${formatCurrency(amountPaid ?? "0")}` : ""}
              </p>
              <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                Invoice ID #{invoiceId}
              </p>
            </div>

            <p className="mb-4 text-sm text-muted-foreground">
              Only delete if this invoice was created by mistake. This action cannot be undone.
            </p>

            <FormField
              label={
                <span className="inline-flex flex-wrap items-center gap-1.5">
                  <span>
                    Type{" "}
                    <span className="font-mono text-xs font-semibold text-foreground">
                      {expectedPhrase}
                    </span>{" "}
                    to confirm hard delete
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    className="shrink-0 text-muted-foreground hover:text-foreground"
                    onClick={handleCopyPhrase}
                    aria-label="Copy confirmation text"
                    title="Copy confirmation text"
                  >
                    {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                  </Button>
                </span>
              }
              htmlFor={`invoice-delete-confirm-${invoiceId}`}
            >
              <Input
                id={`invoice-delete-confirm-${invoiceId}`}
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
