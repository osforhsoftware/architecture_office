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
import { deleteStaff } from "@/lib/actions"
import { staffDeleteConfirmationPhrase } from "@/lib/staff-utils"
import type { AppUser } from "@/lib/types"

export function StaffDeleteDialog({ staff }: { staff: AppUser }) {
  const [open, setOpen] = useState(false)
  const [confirmation, setConfirmation] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const expectedPhrase = staffDeleteConfirmationPhrase(staff.username)
  const canDelete = confirmation === expectedPhrase

  function handleDelete() {
    setError(null)
    const fd = new FormData()
    fd.set("id", String(staff.id))
    fd.set("confirmation", confirmation)

    startTransition(async () => {
      const res = await deleteStaff(fd)
      if (res?.error) {
        setError(res.error)
        return
      }
      toast.success(`${staff.name} removed`)
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
        title="Remove Staff Member"
        description={
          <>
            This permanently deletes{" "}
            <span className="font-medium text-foreground">{staff.name}</span> (
            <span className="font-mono text-xs">{staff.username}</span>). Project assignments
            will be unlinked, but historical data is kept.
          </>
        }
      >
        <div className="flex min-h-0 flex-1 flex-col">
          <FormDialogBody>
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
              htmlFor={`staff-delete-confirm-${staff.id}`}
            >
              <Input
                id={`staff-delete-confirm-${staff.id}`}
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
            submitLabel={pending ? "Removing..." : "Remove Staff"}
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
