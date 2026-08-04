"use client"

import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Pencil, Upload, UserRound } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FormField, FormSection, formControlClass } from "@/components/form-section"
import { updateOwnProfile } from "@/lib/actions"
import { publicAssetUrl } from "@/lib/app-urls"
import type { AppUser } from "@/lib/types"

function buildForm(user: AppUser) {
  return {
    name: user.name,
    email: user.email ?? "",
    phone: user.phone ?? "",
    currentPassword: "",
    newPassword: "",
    avatarPreview: publicAssetUrl(user.avatar_url) ?? null,
    removeAvatar: false,
  }
}

export function StaffProfileSettings({ user }: { user: AppUser }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(() => buildForm(user))
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [pending, startTransition] = useTransition()
  const avatarInputRef = useRef<HTMLInputElement>(null)

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

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData()
    fd.set("name", form.name)
    fd.set("email", form.email)
    fd.set("phone", form.phone)
    fd.set("current_password", form.currentPassword)
    fd.set("new_password", form.newPassword)
    if (form.removeAvatar) fd.set("remove_avatar", "true")
    if (avatarFile) fd.set("avatar", avatarFile)

    startTransition(async () => {
      const res = await updateOwnProfile(fd)
      if (res?.error) {
        toast.error(res.error)
        return
      }
      toast.success("Profile updated")
      setEditing(false)
      setAvatarFile(null)
      setForm((prev) => ({
        ...buildForm({
          ...user,
          name: prev.name,
          email: prev.email || null,
          phone: prev.phone || null,
          avatar_url: prev.removeAvatar
            ? null
            : prev.avatarPreview?.startsWith("blob:")
              ? user.avatar_url
              : prev.avatarPreview,
        }),
        currentPassword: "",
        newPassword: "",
      }))
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
              setAvatarFile(null)
              setEditing(true)
            }}
          >
            <Pencil className="size-4" />
            Edit
          </Button>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Update your photo, name, contact details, or password.
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
          <FormSection title="Profile photo">
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
                setAvatarFile(null)
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
