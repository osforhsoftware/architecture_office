"use client"

import { useEffect, useRef, useState } from "react"
import { Loader2, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { useTableParams } from "@/components/use-table-params"

const DEBOUNCE_MS = 400

export function DebouncedSearchInput({
  placeholder = "Search...",
  paramKey = "search",
}: {
  placeholder?: string
  paramKey?: string
}) {
  const { updateParams, isPending, searchParams } = useTableParams()
  const urlValue = searchParams.get(paramKey) ?? ""
  const [value, setValue] = useState("")
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isFirstRender = useRef(true)

  useEffect(() => {
    setValue(urlValue)
  }, [urlValue])

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }

    if (debounceRef.current) clearTimeout(debounceRef.current)

    debounceRef.current = setTimeout(() => {
      const current = searchParams.get(paramKey) ?? ""
      if (value === current) return
      updateParams({ [paramKey]: value || null }, { resetPage: true })
    }, DEBOUNCE_MS)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [value, paramKey, updateParams, searchParams])

  return (
    <div className="relative max-w-sm flex-1">
      <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="pl-9 pr-9"
      />
      {isPending ? (
        <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
      ) : null}
    </div>
  )
}
