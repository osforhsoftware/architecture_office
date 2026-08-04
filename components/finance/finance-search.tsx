"use client"

import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { Search } from "lucide-react"
import { useTransition } from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export function FinanceSearch({ className }: { className?: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()
  const current = searchParams.get("search") ?? ""

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const q = String(fd.get("search") ?? "").trim()
    const params = new URLSearchParams(searchParams.toString())
    if (q) params.set("search", q)
    else params.delete("search")
    params.delete("page")
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`)
    })
  }

  return (
    <form onSubmit={onSubmit} className={cn("relative w-full max-w-md", className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        name="search"
        defaultValue={current}
        placeholder="Search finance records..."
        className="h-9 pl-9"
      />
    </form>
  )
}
