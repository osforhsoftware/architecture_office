"use client"

import { useEffect, useState, useTransition } from "react"
import { Plus, Pencil } from "lucide-react"
import { toast } from "sonner"
import { Dialog, DialogTrigger } from "@/components/ui/dialog"
import {
  FormDialogBody,
  FormDialogFooter,
  FormDialogShell,
} from "@/components/form-dialog-shell"
import { FormField, FormSection, formControlClass } from "@/components/form-section"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { createDepartment, updateDepartment } from "@/lib/actions"
import type { DepartmentRow } from "@/lib/queries"

export function DepartmentDialog({ department }: { department?: DepartmentRow }) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const isEdit = Boolean(department)
  const fieldId = department ? `dept-${department.id}` : "dept-new"

  const [name, setName] = useState("")
  const [roleLabel, setRoleLabel] = useState("")
  const [active, setActive] = useState(true)

  useEffect(() => {
    if (!open) return
    setName(department?.section ?? "")
    setRoleLabel(department?.role_label ?? "")
    setActive(department?.active_flag ?? true)
    setError(null)
  }, [open, department])

  function onSubmit(formData: FormData) {
    setError(null)
    if (isEdit && active) formData.set("active", "true")
    startTransition(async () => {
      const res = isEdit ? await updateDepartment(formData) : await createDepartment(formData)
      if (res?.error) {
        setError(res.error)
        return
      }
      toast.success(isEdit ? "Department updated" : "Department added")
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
              <Plus className="size-4" /> Add Department
            </Button>
          )
        }
      />
      <FormDialogShell
        title={isEdit ? "Edit Department" : "Add Department"}
        description={
          isEdit
            ? "Rename this department. Project sections and staff role labels update automatically."
            : "Create a department. It will appear in project and staff role options."
        }
      >
        {open ? (
          <form action={onSubmit} className="flex min-h-0 flex-1 flex-col">
            {isEdit ? <input type="hidden" name="id" value={department!.id} /> : null}

            <FormDialogBody>
              <div className="flex flex-col gap-5">
                <FormSection title="Department">
                  <div className="flex flex-col gap-3">
                    <FormField label="Name" htmlFor={`${fieldId}-name`}>
                      <Input
                        id={`${fieldId}-name`}
                        name="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        placeholder="e.g. Landscape Design"
                        className={formControlClass}
                      />
                    </FormField>

                    <FormField label="Staff role label" htmlFor={`${fieldId}-role`}>
                      <Input
                        id={`${fieldId}-role`}
                        name="role_label"
                        value={roleLabel}
                        onChange={(e) => setRoleLabel(e.target.value)}
                        placeholder={name ? `${name} Staff` : "e.g. Landscape Staff"}
                        className={formControlClass}
                      />
                      <p className="text-xs text-muted-foreground">
                        Used when assigning staff. Defaults to “{name || "Name"} Staff”.
                      </p>
                    </FormField>

                    {isEdit ? (
                      <label className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={active}
                          onCheckedChange={(checked) => setActive(checked === true)}
                        />
                        <input type="hidden" name="active" value={active ? "true" : "false"} />
                        Active (show in dropdowns)
                      </label>
                    ) : null}
                  </div>
                </FormSection>

                {error ? <p className="text-sm text-destructive">{error}</p> : null}
              </div>
            </FormDialogBody>

            <FormDialogFooter
              submitLabel={pending ? "Saving..." : isEdit ? "Save Changes" : "Add Department"}
              pending={pending}
            />
          </form>
        ) : null}
      </FormDialogShell>
    </Dialog>
  )
}
