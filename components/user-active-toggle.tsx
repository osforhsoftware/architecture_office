"use client"

import { useTransition } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { setUserActive } from "@/lib/actions"
import type { AppUser } from "@/lib/types"

export function UserActiveToggle({ user }: { user: AppUser }) {
  const [pending, startTransition] = useTransition()

  function toggle() {
    const fd = new FormData()
    fd.set("id", String(user.id))
    if (!user.active) fd.set("active", "true")

    startTransition(async () => {
      const res = await setUserActive(fd)
      if (res?.error) {
        toast.error(res.error)
        return
      }
      toast.success(user.active ? "User deactivated" : "User activated")
    })
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={toggle}
    >
      {pending ? "Saving..." : user.active ? "Deactivate" : "Activate"}
    </Button>
  )
}
