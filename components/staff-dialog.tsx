"use client"

import { useState, useTransition } from "react"
import { Plus, Pencil } from "lucide-react"
import { toast } from "sonner"
import { Dialog, DialogTrigger } from "@/components/ui/dialog"
import {
  FormDialogBody,
  FormDialogFooter,
  FormDialogShell,
} from "@/components/form-dialog-shell"
import { FormMultiSelect } from "@/components/form-multi-select"
import { FormField, FormSection, formControlClass } from "@/components/form-section"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { createStaff, updateStaff } from "@/lib/actions"
import { STAFF_ROLES, rolesOf } from "@/lib/constants"
import type { AppUser } from "@/lib/types"

const ROLE_OPTIONS = STAFF_ROLES.map((role) => ({ value: role, label: role }))

function getStaffFormValues(staff?: AppUser) {
  return {
    name: staff?.name ?? "",
    username: staff?.username ?? "",
    password: "",
    roles: staff ? rolesOf(staff) : [],
    phone: staff?.phone ?? "",
    email: staff?.email ?? "",
    active: staff?.active ?? true,
  }
}

export function StaffDialog({ staff }: { staff?: AppUser }) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState(() => getStaffFormValues(staff))
  const [pending, startTransition] = useTransition()
  const isEdit = Boolean(staff)

  function onSubmit(formData: FormData) {
    setError(null)
    if (form.active) {
      formData.set("active", "true")
    }
    // `roles` already included via FormMultiSelect hidden inputs
    startTransition(async () => {
      const res = isEdit ? await updateStaff(formData) : await createStaff(formData)
      if (res?.error) {
        setError(res.error)
        return
      }
      toast.success(isEdit ? "Staff updated" : "Staff added")
      setOpen(false)
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) setForm(getStaffFormValues(staff))
        if (!next) setError(null)
      }}
    >
      <DialogTrigger
        render={
          isEdit ? (
            <Button variant="outline" size="sm">
              <Pencil className="size-4" /> Edit
            </Button>
          ) : (
            <Button>
              <Plus className="size-4" /> Add Staff
            </Button>
          )
        }
      />
      <FormDialogShell
        title={isEdit ? "Edit Staff" : "Add Staff"}
        description={
          isEdit
            ? "Update staff account details and department roles."
            : "Create a staff login with one or more department roles."
        }
      >
        <form action={onSubmit} className="flex min-h-0 flex-1 flex-col">
          {isEdit ? <input type="hidden" name="id" value={staff!.id} /> : null}

          <FormDialogBody>
            <div className="flex flex-col gap-5">
              <FormSection title="Account Details">
                <div className="flex flex-col gap-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <FormField label="Full name" htmlFor="staff-name">
                      <Input
                        id="staff-name"
                        name="name"
                        value={form.name}
                        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                        required
                        className={formControlClass}
                      />
                    </FormField>
                    <FormField label="Username" htmlFor="staff-username">
                      <Input
                        id="staff-username"
                        name="username"
                        value={form.username}
                        onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                        autoComplete="off"
                        required
                        className={formControlClass}
                      />
                    </FormField>
                  </div>

                  <FormField
                    label={isEdit ? "Password (optional)" : "Password"}
                    htmlFor="staff-password"
                  >
                    <Input
                      id="staff-password"
                      name="password"
                      type="password"
                      value={form.password}
                      onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                      autoComplete="new-password"
                      required={!isEdit}
                      placeholder={isEdit ? "Leave blank to keep current" : undefined}
                      className={formControlClass}
                    />
                  </FormField>

                  <FormField label="Department Roles" htmlFor="staff-roles">
                    <FormMultiSelect
                      key={`staff-roles-${staff?.id ?? "new"}-${open ? "open" : "closed"}`}
                      name="roles"
                      required
                      placeholder="Select one or more department roles..."
                      searchPlaceholder="Search roles..."
                      options={ROLE_OPTIONS}
                      defaultSelected={form.roles}
                      className={formControlClass}
                    />
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      Staff can belong to multiple departments (e.g. Planning Staff + Permit Staff).
                      The first selected role is used for portal home routing.
                    </p>
                  </FormField>
                </div>
              </FormSection>

              <FormSection title="Contact">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <FormField label="Phone" htmlFor="staff-phone">
                    <Input
                      id="staff-phone"
                      name="phone"
                      value={form.phone}
                      onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                      className={formControlClass}
                    />
                  </FormField>
                  <FormField label="Email" htmlFor="staff-email">
                    <Input
                      id="staff-email"
                      name="email"
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                      className={formControlClass}
                    />
                  </FormField>
                </div>
              </FormSection>

              <div className="flex min-h-11 items-center gap-3 rounded-[10px] border border-border/60 bg-muted/15 px-3 py-2">
                <Checkbox
                  id="staff-active"
                  checked={form.active}
                  onCheckedChange={(checked) =>
                    setForm((f) => ({ ...f, active: checked === true }))
                  }
                />
                <Label htmlFor="staff-active" className="cursor-pointer font-normal leading-snug">
                  Active account — can log in and receive assignments
                </Label>
              </div>

              {error ? <p className="text-sm text-destructive">{error}</p> : null}
            </div>
          </FormDialogBody>

          <FormDialogFooter
            submitLabel={pending ? "Saving..." : isEdit ? "Save Changes" : "Add Staff"}
            pending={pending}
          />
        </form>
      </FormDialogShell>
    </Dialog>
  )
}
