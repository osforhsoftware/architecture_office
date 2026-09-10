"use client"

import { useTransition } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { updateSuperAdminPassword } from "@/lib/actions"

export function SuperAdminPasswordForm() {
  const [pending, startTransition] = useTransition()

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      const res = await updateSuperAdminPassword(formData)
      if (res?.error) {
        toast.error(res.error)
        return
      }
      toast.success("Super Admin password updated")
    })
  }

  return (
    <form action={onSubmit} className="space-y-3">
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">
          Current password
        </label>
        <Input name="current_password" type="password" required autoComplete="current-password" />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">New password</label>
        <Input name="new_password" type="password" required minLength={8} autoComplete="new-password" />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">
          Confirm new password
        </label>
        <Input name="confirm_password" type="password" required minLength={8} autoComplete="new-password" />
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Updating..." : "Change Super Admin password"}
      </Button>
    </form>
  )
}
