"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Pencil } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FormField, FormSection, formControlClass } from "@/components/form-section"
import { updateOwnProfile } from "@/lib/actions"
import type { AppUser } from "@/lib/types"

function buildForm(user: AppUser) {
  return {
    name: user.name,
    email: user.email ?? "",
    phone: user.phone ?? "",
    currentPassword: "",
    newPassword: "",
  }
}

export function StaffProfileSettings({ user }: { user: AppUser }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(() => buildForm(user))
  const [pending, startTransition] = useTransition()

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData()
    fd.set("name", form.name)
    fd.set("email", form.email)
    fd.set("phone", form.phone)
    fd.set("current_password", form.currentPassword)
    fd.set("new_password", form.newPassword)

    startTransition(async () => {
      const res = await updateOwnProfile(fd)
      if (res?.error) {
        toast.error(res.error)
        return
      }
      toast.success("Profile updated")
      setEditing(false)
      setForm((prev) => ({ ...buildForm({ ...user, ...prev }), currentPassword: "", newPassword: "" }))
      router.refresh()
    })
  }

  if (!editing) {
    return (
      <Card className="shadow-none">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base">Edit profile</CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setForm(buildForm(user))
              setEditing(true)
            }}
          >
            <Pencil className="size-4" />
            Edit
          </Button>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Update your name, contact details, or password.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="shadow-none">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Edit profile</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <FormSection title="Contact">
            <FormField label="Name">
              <Input
                className={formControlClass}
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
            </FormField>
            <FormField label="Email">
              <Input
                type="email"
                className={formControlClass}
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </FormField>
            <FormField label="Phone">
              <Input
                type="tel"
                className={formControlClass}
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </FormField>
          </FormSection>

          <FormSection title="Change password" description="Leave blank to keep your current password.">
            <FormField label="Current password">
              <Input
                type="password"
                autoComplete="current-password"
                className={formControlClass}
                value={form.currentPassword}
                onChange={(e) => setForm((f) => ({ ...f, currentPassword: e.target.value }))}
              />
            </FormField>
            <FormField label="New password">
              <Input
                type="password"
                autoComplete="new-password"
                className={formControlClass}
                value={form.newPassword}
                onChange={(e) => setForm((f) => ({ ...f, newPassword: e.target.value }))}
              />
            </FormField>
          </FormSection>

          <div className="flex gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save changes"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => {
                setForm(buildForm(user))
                setEditing(false)
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
