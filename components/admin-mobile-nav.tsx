"use client"

import Link from "next/link"
import { createPortal } from "react-dom"
import { useEffect, useState } from "react"
import { LogOut, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { logoutAction } from "@/lib/actions"
import { adminNavForRole } from "@/lib/admin-nav"
import { BrandLogoHeader } from "@/components/brand-logo"
import type { AppUser } from "@/lib/types"

export function AdminMobileNav({
  open,
  onOpenChange,
  pathname,
  role = "Admin",
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  pathname: string
  role?: AppUser["role"]
}) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [open, onOpenChange])

  if (!mounted || !open) return null

  const nav = adminNavForRole(role)

  return createPortal(
    <>
      <button
        type="button"
        aria-label="Close menu"
        className="fixed inset-0 z-[100] bg-black/50 md:hidden"
        onClick={() => onOpenChange(false)}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Admin navigation"
        className="fixed inset-y-0 left-0 z-[101] flex w-[min(18rem,85vw)] flex-col bg-sidebar text-sidebar-foreground shadow-xl md:hidden"
      >
        <BrandLogoHeader className="border-sidebar-border px-5 py-3">
          <button
            type="button"
            aria-label="Close menu"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-foreground/70 hover:bg-muted"
            onClick={() => onOpenChange(false)}
          >
            <X className="size-5" />
          </button>
        </BrandLogoHeader>

        <nav className="flex-1 overflow-y-auto px-3 py-3">
          <ul className="flex flex-col gap-0.5">
            {nav.flatMap((item) => {
              const top = (
                <li key={item.href + item.label}>
                  <Link
                    href={item.href}
                    onClick={() => onOpenChange(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      (item.exact ? pathname === item.href : pathname.startsWith(item.href))
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50",
                    )}
                  >
                    <item.icon className="size-4 shrink-0" />
                    {item.label}
                  </Link>
                </li>
              )
              if (!item.children?.length) return [top]
              return [
                top,
                ...item.children.map((child) => (
                  <li key={child.href}>
                    <Link
                      href={child.href}
                      onClick={() => onOpenChange(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-lg py-2 pl-10 pr-3 text-[13px] font-medium transition-colors",
                        (child.exact
                          ? pathname === child.href
                          : pathname === child.href || pathname.startsWith(`${child.href}/`))
                          ? "bg-sidebar-accent/70 text-sidebar-accent-foreground"
                          : "text-sidebar-foreground/60 hover:bg-sidebar-accent/40",
                      )}
                    >
                      {child.label}
                    </Link>
                  </li>
                )),
              ]
            })}
          </ul>
        </nav>

        <div className="border-t border-sidebar-border p-3">
          <form
            action={logoutAction}
            onSubmit={() => onOpenChange(false)}
          >
            <button
              type="submit"
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent/50"
            >
              <LogOut className="size-4 shrink-0" />
              Sign out
            </button>
          </form>
        </div>
      </aside>
    </>,
    document.body,
  )
}
