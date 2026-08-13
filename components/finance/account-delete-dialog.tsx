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
import { deleteAccount } from "@/lib/finance/actions"
import { formatCurrency } from "@/lib/constants"
import type { FinanceAccount } from "@/lib/finance/types"

export function AccountDeleteDialog({ account }: { account: FinanceAccount }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [confirmation, setConfirmation] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const canDelete = confirmation === account.name

  function handleDelete() {
    setError(null)
    const fd = new FormData()
    fd.set("id", String(account.id))
    fd.set("confirmation", confirmation)

    startTransition(async () => {
      const res = await deleteAccount(fd)
      if (res && "error" in res && res.error) {
        setError(res.error)
        return
      }
      toast.success("Account permanently deleted")
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
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="size-4" /> Delete
          </Button>
        }
      />
      <FormDialogShell
        size="md"
        title="Delete Account"
        description={
          <>
            This is a <span className="font-medium text-foreground">hard delete</span>.{" "}
            <span className="font-medium text-foreground">{account.name}</span> will be
            permanently removed and cannot be recovered.
          </>
        }
      >
        <div className="flex min-h-0 flex-1 flex-col">
          <FormDialogBody>
            <div className="mb-4 rounded-lg border border-border/60 bg-muted/40 px-3 py-2.5 text-sm">
              <p className="font-medium">{account.name}</p>
              <p className="mt-0.5 text-xs capitalize text-muted-foreground">
                {account.account_type}
                {account.bank_name ? ` · ${account.bank_name}` : ""}
              </p>
              <p className="mt-1 tabular-nums text-muted-foreground">
                Balance {formatCurrency(account.current_balance)}
              </p>
            </div>

            <p className="mb-4 text-sm text-muted-foreground">
              Balance must be zero and the account must have no bank transfers. Default Cash and
              Petty Cash accounts cannot be deleted.
            </p>

            <FormField
              label={
                <>
                  Type{" "}
                  <span className="font-mono text-xs font-semibold text-foreground">
                    {account.name}
                  </span>{" "}
                  to confirm hard delete
                </>
              }
              htmlFor={`account-delete-confirm-${account.id}`}
            >
              <Input
                id={`account-delete-confirm-${account.id}`}
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                autoComplete="off"
                placeholder={account.name}
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
