"use client"

import { useEffect, useState, useTransition } from "react"
import { Pencil, Plus } from "lucide-react"
import { toast } from "sonner"
import { Dialog, DialogTrigger } from "@/components/ui/dialog"
import {
  FormDialogBody,
  FormDialogFooter,
  FormDialogShell,
} from "@/components/form-dialog-shell"
import { FormField, FormSection, formControlClass, formTextareaClass } from "@/components/form-section"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { createVendor, updateVendor } from "@/lib/finance/actions"
import type { Vendor } from "@/lib/finance/types"

export function VendorDialog({ vendor }: { vendor?: Vendor }) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const isEdit = Boolean(vendor)
  const fieldId = vendor ? `vendor-${vendor.id}` : "vendor-new"

  useEffect(() => {
    if (open) setError(null)
  }, [open])

  function onSubmit(formData: FormData) {
    setError(null)
    if (vendor) formData.set("id", String(vendor.id))
    startTransition(async () => {
      const res = isEdit ? await updateVendor(formData) : await createVendor(formData)
      if (res?.error) {
        setError(res.error)
        return
      }
      toast.success(isEdit ? "Vendor updated" : "Vendor added")
      setOpen(false)
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
              <Plus className="size-4" /> Add Vendor
            </Button>
          )
        }
      />
      <FormDialogShell
        title={isEdit ? "Edit Vendor" : "Add Vendor"}
        description="Manage vendor contact and billing details."
      >
        {open ? (
          <form action={onSubmit} className="flex min-h-0 flex-1 flex-col">
            <FormDialogBody>
              {error ? (
                <p className="mb-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              ) : null}
              <FormSection title="Vendor details">
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField label="Name" htmlFor={`${fieldId}-name`} className="sm:col-span-2">
                    <Input
                      id={`${fieldId}-name`}
                      name="name"
                      required
                      defaultValue={vendor?.name ?? ""}
                      className={formControlClass}
                    />
                  </FormField>
                  <FormField label="Phone" htmlFor={`${fieldId}-phone`}>
                    <Input
                      id={`${fieldId}-phone`}
                      name="phone"
                      defaultValue={vendor?.phone ?? ""}
                      className={formControlClass}
                    />
                  </FormField>
                  <FormField label="Email" htmlFor={`${fieldId}-email`}>
                    <Input
                      id={`${fieldId}-email`}
                      name="email"
                      type="email"
                      defaultValue={vendor?.email ?? ""}
                      className={formControlClass}
                    />
                  </FormField>
                  <FormField label="GST" htmlFor={`${fieldId}-gst`}>
                    <Input
                      id={`${fieldId}-gst`}
                      name="gst"
                      defaultValue={vendor?.gst ?? ""}
                      className={formControlClass}
                    />
                  </FormField>
                  <FormField label="Address" htmlFor={`${fieldId}-address`} className="sm:col-span-2">
                    <Textarea
                      id={`${fieldId}-address`}
                      name="address"
                      defaultValue={vendor?.address ?? ""}
                      className={formTextareaClass}
                    />
                  </FormField>
                  <FormField label="Notes" htmlFor={`${fieldId}-notes`} className="sm:col-span-2">
                    <Textarea
                      id={`${fieldId}-notes`}
                      name="notes"
                      defaultValue={vendor?.notes ?? ""}
                      className={formTextareaClass}
                    />
                  </FormField>
                </div>
              </FormSection>
            </FormDialogBody>
            <FormDialogFooter submitLabel={isEdit ? "Save changes" : "Add vendor"} pending={pending} />
          </form>
        ) : null}
      </FormDialogShell>
    </Dialog>
  )
}
