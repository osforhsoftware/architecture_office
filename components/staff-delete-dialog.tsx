"use client"

import { useState, useTransition } from "react"
import { Trash2 } from "lucide-react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Remove staff member</DialogTitle>
          <DialogDescription>
            This permanently deletes <span className="font-medium text-foreground">{staff.name}</span> (
            <span className="font-mono text-xs">{staff.username}</span>). Project assignments and
            related records will be unlinked, but historical data is kept.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <Label htmlFor={`staff-delete-confirm-${staff.id}`}>
            Type{" "}
            <span className="font-mono text-xs font-semibold text-foreground">{expectedPhrase}</span>{" "}
            to confirm
          </Label>
          <Input
            id={`staff-delete-confirm-${staff.id}`}
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            autoComplete="off"
            placeholder={expectedPhrase}
            aria-invalid={confirmation.length > 0 && !canDelete}
          />
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={!canDelete || pending}
            onClick={handleDelete}
          >
            {pending ? "Removing..." : "Remove staff"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
