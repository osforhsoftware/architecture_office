"use client"

import { publicAssetUrl } from "@/lib/app-urls"
import { cn } from "@/lib/utils"

export function UserAvatar({
  name,
  avatarUrl,
  className,
  textClassName,
}: {
  name: string
  avatarUrl?: string | null
  className?: string
  textClassName?: string
}) {
  const src = publicAssetUrl(avatarUrl)
  const initial = name.trim().charAt(0).toUpperCase() || "?"

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        className={cn("size-8 shrink-0 rounded-full object-cover", className)}
      />
    )
  }

  return (
    <div
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground",
        className,
        textClassName,
      )}
    >
      {initial}
    </div>
  )
}
