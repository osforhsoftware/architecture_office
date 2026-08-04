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
import { Button } from "@/components/ui/button"
import { deleteDepartment } from "@/lib/actions"
import type { DepartmentRow } from "@/lib/queries"

export function DepartmentDeleteDialog({ department }: { department: DepartmentRow }) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleDelete() {
    setError(null)
    const fd = new FormData()
    fd.set("id", String(department.id))

    startTransition(async () => {
      const res = await deleteDepartment(fd)
      if (res?.error) {
        setError(res.error)
        return
      }
      toast.success(`${department.section} removed`)
      setOpen(false)
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setError(null)
      }}
    >
      <DialogTrigger
        render={
          <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
            <Trash2 className="size-4" /> Delete
          </Button>
        }
      />
      <FormDialogShell
        size="md"
        title="Delete Department"
        description={
          <>
            Remove{" "}
            <span className="font-medium text-foreground">{department.section}</span> from the
            office. This is only allowed when no projects or staff use it.
          </>
        }
      >
        <div className="flex min-h-0 flex-1 flex-col">
          <FormDialogBody>
            <p className="text-sm text-muted-foreground">
              Staff role <span className="font-medium text-foreground">{department.role_label}</span>{" "}
              will also be removed from the department list.
            </p>
            {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}
          </FormDialogBody>

          <FormDialogFooter
            submitLabel={pending ? "Deleting..." : "Delete Department"}
            submitVariant="destructive"
            submitType="button"
            pending={pending}
            onSubmit={handleDelete}
          />
        </div>
      </FormDialogShell>
    </Dialog>
  )
}
