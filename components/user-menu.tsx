"use client"

import { LogOut } from "lucide-react"
import { logoutAction } from "@/lib/actions"
import type { AppUser } from "@/lib/types"
import { formatRolesLabel } from "@/lib/constants"
import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

export function UserMenu({
  user,
  className,
}: {
  user: AppUser
  className?: string
}) {
  return (
    <div className={cn("flex items-center gap-2 sm:gap-3", className)}>
      <div className="flex min-w-0 items-center gap-2 sm:gap-2.5">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
          {user.name.charAt(0)}
        </div>
        <div className="hidden min-w-0 leading-tight sm:block">
          <p className="max-w-[10rem] truncate text-sm font-medium md:max-w-[12rem]">
            {user.name}
          </p>
          <p className="truncate text-xs text-muted-foreground">{formatRolesLabel(user)}</p>
        </div>
      </div>
      <form action={logoutAction}>
        <button
          type="submit"
          suppressHydrationWarning
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "shrink-0 text-muted-foreground hover:text-foreground",
          )}
          title="Sign out"
        >
          <LogOut className="size-4 shrink-0" />
          <span className="hidden md:inline">Sign out</span>
        </button>
      </form>
    </div>
  )
}
