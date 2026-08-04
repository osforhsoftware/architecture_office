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
import { createProjectService, updateProjectService } from "@/lib/actions"
import type { ServiceRow } from "@/lib/queries"

export function ServiceDialog({
  service,
  departmentOptions,
}: {
  service?: ServiceRow
  departmentOptions: { value: string; label: string; role: string }[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const isEdit = Boolean(service)
  const fieldId = service ? `svc-${service.id}` : "svc-new"

  const [label, setLabel] = useState("")
  const [section, setSection] = useState(departmentOptions[0]?.value ?? "")
  const [sortOrder, setSortOrder] = useState("10")
  const [active, setActive] = useState(true)

  const sectionOptions = useMemo(
    () => departmentOptions.map((d) => ({ value: d.value, label: d.label })),
    [departmentOptions],
  )

  useEffect(() => {
    if (!open) return
    setLabel(service?.label ?? "")
    setSection(service?.section ?? departmentOptions[0]?.value ?? "")
    setSortOrder(String(service?.sort_order ?? 10))
    setActive(service?.active ?? true)
    setError(null)
  }, [open, service, departmentOptions])

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (!label.trim()) {
      setError("Service name is required.")
      return
    }
    if (!section.trim()) {
      setError("Department is required.")
      return
    }

    const dept = departmentOptions.find((d) => d.value === section)
    const formData = new FormData()
    formData.set("label", label.trim())
    formData.set("section", section)
    formData.set("role", dept?.role ?? "")
    if (isEdit) {
      formData.set("id", String(service!.id))
      formData.set("sort_order", sortOrder)
      formData.set("active", active ? "true" : "false")
    }

    startTransition(async () => {
      try {
        const res = isEdit
          ? await updateProjectService(formData)
          : await createProjectService(formData)
        if (res?.error) {
          setError(res.error)
          return
        }
        toast.success(isEdit ? "Service updated" : "Service added")
        setOpen(false)
        router.refresh()
      } catch (err) {
        console.error("[service-dialog] save failed:", err)
        setError("Could not save service. Please try again.")
        toast.error("Could not save service")
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
              <Plus className="size-4" /> Add Service
            </Button>
          )
        }
      />
      <FormDialogShell
        title={isEdit ? "Edit Service" : "Add Service"}
        description={
          isEdit
            ? "Update the label, department, or order. The internal key stays the same so existing projects keep working."
            : "New services appear in project custom-package and invoice pickers."
        }
      >
        {open ? (
          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
            <FormDialogBody>
              <div className="flex flex-col gap-5">
                <FormSection title="Service">
                  <div className="flex flex-col gap-3">
                    <FormField label="Name" htmlFor={`${fieldId}-label`}>
                      <Input
                        id={`${fieldId}-label`}
                        value={label}
                        onChange={(e) => setLabel(e.target.value)}
                        required
                        placeholder="e.g. Landscape Design"
                        className={formControlClass}
                      />
                    </FormField>

                    {isEdit ? (
                      <p className="text-xs text-muted-foreground">
                        Key:{" "}
                        <span className="font-mono text-foreground">{service!.service_key}</span>
                      </p>
                    ) : null}

                    <FormField label="Department" htmlFor={`${fieldId}-section`}>
                      <FormSelect
                        id={`${fieldId}-section`}
                        value={section}
                        onValueChange={(value) => setSection(value ?? "")}
                        options={sectionOptions}
                        placeholder="Select department"
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
                          Lower numbers appear earlier in the workflow.
                        </p>
                      </FormField>
                    ) : null}

                    {isEdit ? (
                      <label className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={active}
                          onCheckedChange={(checked) => setActive(checked === true)}
                        />
                        Active (show in dropdowns)
                      </label>
                    ) : null}
                  </div>
                </FormSection>

                {error ? <p className="text-sm text-destructive">{error}</p> : null}
              </div>
            </FormDialogBody>

            <FormDialogFooter
              submitLabel={pending ? "Saving..." : isEdit ? "Save Changes" : "Add Service"}
              pending={pending}
              submitDisabled={!label.trim() || !section.trim() || departmentOptions.length === 0}
            />
          </form>
        ) : null}
      </FormDialogShell>
    </Dialog>
  )
}
