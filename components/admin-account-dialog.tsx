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
import { FormField, FormSection, formControlClass } from "@/components/form-section"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { createAdminAccount, updateAdminAccount } from "@/lib/actions"
import type { AppUser } from "@/lib/types"

function getAdminFormValues(admin?: AppUser) {
  return {
    name: admin?.name ?? "",
    username: admin?.username ?? "",
    password: "",
    phone: admin?.phone ?? "",
    email: admin?.email ?? "",
    active: admin?.active ?? true,
  }
}

export function AdminAccountDialog({ admin }: { admin?: AppUser }) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState(() => getAdminFormValues(admin))
  const [pending, startTransition] = useTransition()
  const isEdit = Boolean(admin)

  function onSubmit(formData: FormData) {
    setError(null)
    if (form.active) {
      formData.set("active", "true")
    }
    startTransition(async () => {
      const res = isEdit
        ? await updateAdminAccount(formData)
        : await createAdminAccount(formData)
      if (res?.error) {
        setError(res.error)
        return
      }
      toast.success(isEdit ? "Admin updated" : "Admin created")
      setOpen(false)
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) setForm(getAdminFormValues(admin))
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
              <Plus className="size-4" /> Add Admin
            </Button>
          )
        }
      />
      <FormDialogShell
        title={isEdit ? "Edit Admin" : "Add Admin"}
        description={
          isEdit
            ? "Update office Admin account details."
            : "Create an office Admin account. Admins cannot manage system settings or other Admins."
        }
      >
        <form action={onSubmit} className="flex min-h-0 flex-1 flex-col">
          {isEdit ? <input type="hidden" name="id" value={admin!.id} /> : null}

          <FormDialogBody>
            <div className="flex flex-col gap-5">
              <FormSection title="Account Details">
                <div className="flex flex-col gap-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <FormField label="Full name" htmlFor="admin-name">
                      <Input
                        id="admin-name"
                        name="name"
                        value={form.name}
                        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                        required
                        className={formControlClass}
                      />
                    </FormField>
                    <FormField label="Username" htmlFor="admin-username">
                      <Input
                        id="admin-username"
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
                    htmlFor="admin-password"
                  >
                    <Input
                      id="admin-password"
                      name="password"
                      type="password"
                      value={form.password}
                      onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                      autoComplete="new-password"
                      required={!isEdit}
                      minLength={isEdit ? undefined : 8}
                      placeholder={isEdit ? "Leave blank to keep current" : "At least 8 characters"}
                      className={formControlClass}
                    />
                  </FormField>
                </div>
              </FormSection>

              <FormSection title="Contact">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <FormField label="Phone" htmlFor="admin-phone">
                    <Input
                      id="admin-phone"
                      name="phone"
                      value={form.phone}
                      onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                      className={formControlClass}
                    />
                  </FormField>
                  <FormField label="Email" htmlFor="admin-email">
                    <Input
                      id="admin-email"
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
                  id="admin-active"
                  checked={form.active}
                  onCheckedChange={(checked) =>
                    setForm((f) => ({ ...f, active: checked === true }))
                  }
                />
                <Label htmlFor="admin-active" className="cursor-pointer font-normal leading-snug">
                  Active account — can log in to the admin portal
                </Label>
              </div>

              {error ? <p className="text-sm text-destructive">{error}</p> : null}
            </div>
          </FormDialogBody>

          <FormDialogFooter
            submitLabel={pending ? "Saving..." : isEdit ? "Save Changes" : "Add Admin"}
            pending={pending}
          />
        </form>
      </FormDialogShell>
    </Dialog>
  )
}
