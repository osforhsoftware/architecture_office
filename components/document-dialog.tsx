"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, Pencil } from "lucide-react"
import { toast } from "sonner"
import { Dialog, DialogTrigger } from "@/components/ui/dialog"
import {
  FormDialogBody,
  FormDialogFooter,
  FormDialogShell,
} from "@/components/form-dialog-shell"
import { FormSelect } from "@/components/form-select"
import { FormField, FormSection, formControlClass } from "@/components/form-section"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { createDocumentTemplate, updateDocumentTemplate } from "@/lib/actions"
import type { DocumentTemplateRow } from "@/lib/queries"

export function DocumentDialog({
  document,
  serviceOptions,
}: {
  document?: DocumentTemplateRow
  serviceOptions: { value: string; label: string }[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const isEdit = Boolean(document)
  const fieldId = document ? `doc-${document.id}` : "doc-new"

  const [label, setLabel] = useState("")
  const [serviceKey, setServiceKey] = useState(serviceOptions[0]?.value ?? "")
  const [sortOrder, setSortOrder] = useState("10")
  const [active, setActive] = useState(true)

  useEffect(() => {
    if (!open) return
    setLabel(document?.label ?? "")
    setServiceKey(document?.service_key ?? serviceOptions[0]?.value ?? "")
    setSortOrder(String(document?.sort_order ?? 10))
    setActive(document?.active ?? true)
    setError(null)
  }, [open, document, serviceOptions])

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (!label.trim()) {
      setError("Document name is required.")
      return
    }
    if (!serviceKey.trim()) {
      setError("Service is required.")
      return
    }

    const formData = new FormData()
    formData.set("label", label.trim())
    formData.set("service_key", serviceKey)
    if (isEdit) {
      formData.set("id", String(document!.id))
      formData.set("sort_order", sortOrder)
      formData.set("active", active ? "true" : "false")
    }

    startTransition(async () => {
      try {
        const res = isEdit
          ? await updateDocumentTemplate(formData)
          : await createDocumentTemplate(formData)
        if (res?.error) {
          setError(res.error)
          return
        }
        toast.success(isEdit ? "Document updated" : "Document added")
        setOpen(false)
        router.refresh()
      } catch (err) {
        console.error("[document-dialog] save failed:", err)
        setError("Could not save document. Please try again.")
        toast.error("Could not save document")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          isEdit ? (
            <Button variant="outline" size="sm">
              <Pencil className="size-4" /> Edit
            </Button>
          ) : (
            <Button>
              <Plus className="size-4" /> Add Document
            </Button>
          )
        }
      />
      <FormDialogShell
        title={isEdit ? "Edit Document" : "Add Document"}
        description={
          isEdit
            ? "Update the label, linked service, or visibility."
            : "New documents appear when creating projects for the linked service."
        }
      >
        {open ? (
          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
            <FormDialogBody>
              <div className="flex flex-col gap-5">
                <FormSection title="Document">
                  <div className="flex flex-col gap-3">
                    <FormField label="Name" htmlFor={`${fieldId}-label`}>
                      <Input
                        id={`${fieldId}-label`}
                        value={label}
                        onChange={(e) => setLabel(e.target.value)}
                        required
                        placeholder="e.g. Possession Certificate"
                        className={formControlClass}
                      />
                    </FormField>

                    <FormField label="Service" htmlFor={`${fieldId}-service`}>
                      <FormSelect
                        id={`${fieldId}-service`}
                        value={serviceKey}
                        onValueChange={(value) => setServiceKey(value ?? "")}
                        options={serviceOptions}
                        placeholder="Select service"
                        className={formControlClass}
                      />
                    </FormField>

                    {isEdit ? (
                      <FormField label="Sort order" htmlFor={`${fieldId}-sort`}>
                        <Input
                          id={`${fieldId}-sort`}
                          type="number"
                          value={sortOrder}
                          onChange={(e) => setSortOrder(e.target.value)}
                          className={formControlClass}
                        />
                        <p className="text-xs text-muted-foreground">
                          Lower numbers appear earlier in lists.
                        </p>
                      </FormField>
                    ) : null}

                    {isEdit ? (
                      <label className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={active}
                          onCheckedChange={(checked) => setActive(checked === true)}
                        />
                        Active (show when creating projects)
                      </label>
                    ) : null}
                  </div>
                </FormSection>

                {error ? <p className="text-sm text-destructive">{error}</p> : null}
              </div>
            </FormDialogBody>

            <FormDialogFooter
              submitLabel={pending ? "Saving..." : isEdit ? "Save Changes" : "Add Document"}
              pending={pending}
              submitDisabled={!label.trim() || !serviceKey.trim() || serviceOptions.length === 0}
            />
          </form>
        ) : null}
      </FormDialogShell>
    </Dialog>
  )
}
