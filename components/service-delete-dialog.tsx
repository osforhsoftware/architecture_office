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
import { deleteProjectService } from "@/lib/actions"
import type { ServiceRow } from "@/lib/queries"

export function ServiceDeleteDialog({ service }: { service: ServiceRow }) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleDelete() {
    setError(null)
    const fd = new FormData()
    fd.set("id", String(service.id))

    startTransition(async () => {
      const res = await deleteProjectService(fd)
      if (res?.error) {
        setError(res.error)
        return
      }
      toast.success(`${service.label} removed`)
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
        title="Delete Service"
        description={
          <>
            Remove <span className="font-medium text-foreground">{service.label}</span> from the
            catalog. Only allowed when no projects use it.
          </>
        }
      >
        <div className="flex min-h-0 flex-1 flex-col">
          <FormDialogBody>
            <p className="text-sm text-muted-foreground">
              Prefer hiding unused services with Edit → Active off if projects already reference
              them.
            </p>
            {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}
          </FormDialogBody>

          <FormDialogFooter
            submitLabel={pending ? "Deleting..." : "Delete Service"}
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
