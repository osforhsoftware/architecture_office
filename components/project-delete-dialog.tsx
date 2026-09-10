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
import { deleteProject } from "@/lib/actions"
import { projectDeleteConfirmationPhrase, type ProjectDeleteBlocker } from "@/lib/project-utils"

export function ProjectDeleteDialog({
  projectId,
  projectName,
  projectCode,
  blockers,
}: {
  projectId: number
  projectName: string
  projectCode: string
  blockers: ProjectDeleteBlocker[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [confirmation, setConfirmation] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const hasRelated = blockers.length > 0
  const expectedPhrase = projectDeleteConfirmationPhrase(projectCode)
  const canConfirm = confirmation === expectedPhrase

  function handleDelete() {
    setError(null)
    const fd = new FormData()
    fd.set("id", String(projectId))
    fd.set("confirmation", confirmation)

    startTransition(async () => {
      const res = await deleteProject(fd)
      if (res?.error) {
        setError(res.error)
        return
      }
      toast.success("Project and related records deleted")
      setOpen(false)
      router.push("/admin/projects")
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
          <Button variant="outline" size="xs" className="text-destructive hover:text-destructive">
            <Trash2 className="size-3" /> Delete
          </Button>
        }
      />
      <FormDialogShell
        size="md"
        title="Delete Project"
        description={
          <>
            This permanently removes{" "}
            <span className="font-medium text-foreground">{projectName}</span>{" "}
            <span className="font-mono text-xs">({projectCode})</span>
            {hasRelated ? " and all related records listed below." : "."} This cannot be undone.
          </>
        }
      >
        <div className="flex min-h-0 flex-1 flex-col">
          <FormDialogBody>
            <div className="mb-4 rounded-lg border border-border/60 bg-muted/40 px-3 py-2.5 text-sm">
              <p className="font-medium">{projectName}</p>
              <p className="mt-0.5 font-mono text-xs text-muted-foreground">{projectCode}</p>
            </div>

            {hasRelated ? (
              <>
                <p className="mb-2 text-sm font-medium text-destructive">
                  The following related data will also be deleted:
                </p>
                <ul className="mb-4 list-disc space-y-1 pl-4 text-sm text-muted-foreground">
                  {blockers.map((item) => (
                    <li key={item.key}>
                      {item.count} {item.count === 1 ? item.singular : item.plural}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="mb-4 text-sm text-muted-foreground">
                No invoices, payments, or finance records are linked to this project.
              </p>
            )}

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
              htmlFor={`project-delete-confirm-${projectId}`}
            >
              <Input
                id={`project-delete-confirm-${projectId}`}
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                autoComplete="off"
                placeholder={expectedPhrase}
                aria-invalid={confirmation.length > 0 && !canConfirm}
                className={formControlClass}
              />
            </FormField>

            {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}
          </FormDialogBody>

          <FormDialogFooter
            submitLabel={pending ? "Deleting..." : "Permanently Delete"}
            submitVariant="destructive"
            submitType="button"
            submitDisabled={!canConfirm}
            pending={pending}
            onSubmit={handleDelete}
          />
        </div>
      </FormDialogShell>
    </Dialog>
  )
}
