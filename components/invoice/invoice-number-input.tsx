"use client"

import { useEffect, useState } from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

const DRAFT_RE = /^-?\d*\.?\d*$/

function formatCommitted(value: number): string {
  if (!Number.isFinite(value)) return ""
  return String(value)
}

function parseDraft(raw: string): number | null {
  const trimmed = raw.trim().replace(/,/g, "")
  if (!trimmed || trimmed === "-" || trimmed === "." || trimmed === "-.") return null
  const n = Number.parseFloat(trimmed)
  return Number.isFinite(n) ? n : null
}

function clampNumber(n: number, min?: number, max?: number): number {
  let next = n
  if (min != null) next = Math.max(min, next)
  if (max != null) next = Math.min(max, next)
  return next
}

export function InvoiceNumberInput({
  value,
  onValueChange,
  min,
  max,
  className,
  "aria-label": ariaLabel,
}: {
  value: number
  onValueChange: (value: number) => void
  min?: number
  max?: number
  className?: string
  "aria-label"?: string
}) {
  const [focused, setFocused] = useState(false)
  const [draft, setDraft] = useState(() => formatCommitted(value))

  useEffect(() => {
    if (!focused) setDraft(formatCommitted(value))
  }, [value, focused])

  return (
    <Input
      type="text"
      inputMode="decimal"
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="off"
      spellCheck={false}
      enterKeyHint="done"
      aria-label={ariaLabel}
      value={focused ? draft : formatCommitted(value)}
      onFocus={(e) => {
        setFocused(true)
        // Empty a lone 0 so typing "10" cannot become "010" on tablets.
        setDraft(value === 0 ? "" : formatCommitted(value))
        const el = e.currentTarget
        requestAnimationFrame(() => {
          try {
            el.select()
            el.setSelectionRange(0, el.value.length)
          } catch {
            // Some mobile browsers reject selection APIs on the current input mode.
          }
        })
      }}
      onChange={(e) => {
        const raw = e.target.value.replace(/,/g, "")
        if (raw !== "" && !DRAFT_RE.test(raw)) return
        setDraft(raw)
        const parsed = parseDraft(raw)
        if (parsed != null) onValueChange(clampNumber(parsed, min, max))
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur()
      }}
      onBlur={() => {
        const parsed = parseDraft(draft)
        onValueChange(parsed == null ? (min ?? 0) : clampNumber(parsed, min, max))
        setFocused(false)
      }}
      className={cn("text-base tabular-nums md:text-base", className)}
    />
  )
}
