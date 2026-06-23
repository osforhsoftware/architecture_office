"use client"

import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { useTransition } from "react"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"

export function SearchBox({ placeholder = "Search..." }: { placeholder?: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [, startTransition] = useTransition()

  function onChange(value: string) {
    const next = new URLSearchParams(params.toString())
    if (value) next.set("search", value)
    else next.delete("search")
    startTransition(() => {
      router.replace(`${pathname}?${next.toString()}`)
    })
  }

  return (
    <div className="relative w-full sm:max-w-xs">
      <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        defaultValue={params.get("search") ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-9"
      />
    </div>
  )
}
