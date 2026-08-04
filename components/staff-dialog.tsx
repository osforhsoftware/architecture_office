"use client"

import { useRef, useState, useTransition } from "react"
import { Plus, Pencil, Upload, UserRound } from "lucide-react"
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
import { publicAssetUrl } from "@/lib/app-urls"
import { STAFF_ROLES, rolesOf } from "@/lib/constants"
import type { AppUser } from "@/lib/types"

function getStaffFormValues(staff?: AppUser) {
  return {
    name: staff?.name ?? "",
    username: staff?.username ?? "",
    password: "",
    roles: staff ? rolesOf(staff) : [],
    phone: staff?.phone ?? "",
    email: staff?.email ?? "",
    active: staff?.active ?? true,
    avatarPreview: publicAssetUrl(staff?.avatar_url) ?? null,
    removeAvatar: false,
  }
}

export function StaffDialog({
  staff,
  roleOptions,
}: {
  staff?: AppUser
  /** Dynamic department role labels from the departments table */
  roleOptions?: string[]
}) {
  const roles = roleOptions?.length ? roleOptions : [...STAFF_ROLES]
  const ROLE_OPTIONS = roles.map((role) => ({ value: role, label: role }))
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState(() => getStaffFormValues(staff))
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [pending, startTransition] = useTransition()
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const isEdit = Boolean(staff)

  function onSubmit(formData: FormData) {
    setError(null)
    if (form.active) {
      formData.set("active", "true")
    }
    if (form.removeAvatar) {
      formData.set("remove_avatar", "true")
    }
    if (avatarFile) {
      formData.set("avatar", avatarFile)
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

  function onAvatarChange(file: File | null) {
    if (!file) return
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.")
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Profile image must be under 2MB.")
      return
    }
    setAvatarFile(file)
    setForm((f) => ({
      ...f,
      avatarPreview: URL.createObjectURL(file),
      removeAvatar: false,
    }))
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) {
          setForm(getStaffFormValues(staff))
          setAvatarFile(null)
        }
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
              <FormSection title="Profile Photo">
                <div className="flex items-center gap-4">
                  {form.avatarPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={form.avatarPreview}
                      alt="Profile preview"
                      className="size-16 rounded-full border border-border object-cover"
                    />
                  ) : (
                    <div className="flex size-16 items-center justify-center rounded-full border border-dashed border-border bg-muted/30 text-muted-foreground">
                      <UserRound className="size-7" />
                    </div>
                  )}
                  <div>
                    <input
                      ref={avatarInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        onAvatarChange(e.target.files?.[0] ?? null)
                        e.target.value = ""
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={pending}
                      onClick={() => avatarInputRef.current?.click()}
                    >
                      <Upload className="size-4" />
                      {form.avatarPreview ? "Change photo" : "Upload photo"}
                    </Button>
                    {form.avatarPreview ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="ml-2"
                        disabled={pending}
                        onClick={() => {
                          setAvatarFile(null)
                          setForm((f) => ({
                            ...f,
                            avatarPreview: null,
                            removeAvatar: true,
                          }))
                        }}
                      >
                        Remove
                      </Button>
                    ) : null}
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      PNG, JPEG, or WebP. Max 2MB.
                    </p>
                  </div>
                </div>
              </FormSection>

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
