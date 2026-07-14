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
import { deleteAdminAccount } from "@/lib/actions"
import { staffDeleteConfirmationPhrase } from "@/lib/staff-utils"
import type { AppUser } from "@/lib/types"

export function AdminDeleteDialog({ admin }: { admin: AppUser }) {
  const [open, setOpen] = useState(false)
  const [confirmation, setConfirmation] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const expectedPhrase = staffDeleteConfirmationPhrase(admin.username)
  const canDelete = confirmation === expectedPhrase

  function handleDelete() {
    setError(null)
    const fd = new FormData()
    fd.set("id", String(admin.id))
    fd.set("confirmation", confirmation)

    startTransition(async () => {
      const res = await deleteAdminAccount(fd)
      if (res?.error) {
        setError(res.error)
        return
      }
      toast.success(`${admin.name} removed`)
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
          <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
            <Trash2 className="size-4" /> Remove
          </Button>
        }
      />
      <FormDialogShell
        size="md"
        title="Remove Admin Account"
        description={
          <>
            This permanently deletes Admin{" "}
            <span className="font-medium text-foreground">{admin.name}</span> (
            <span className="font-mono text-xs">{admin.username}</span>).
          </>
        }
      >
        <div className="flex min-h-0 flex-1 flex-col">
          <FormDialogBody>
            <FormField
              label={
                <>
                  Type{" "}
                  <span className="font-mono text-xs text-foreground">{expectedPhrase}</span> to
                  confirm
                </>
              }
              htmlFor="admin-delete-confirm"
            >
              <Input
                id="admin-delete-confirm"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                autoComplete="off"
                className={formControlClass}
              />
            </FormField>
            {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
          </FormDialogBody>
          <FormDialogFooter
            submitLabel={pending ? "Removing..." : "Remove Admin"}
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
