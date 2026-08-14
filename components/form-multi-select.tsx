"use client"

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react"
import { ChevronDown, Search, User, X } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { UserAvatar } from "@/components/user-avatar"
import { cn } from "@/lib/utils"

export type FormMultiSelectOption = {
  value: string
  label: React.ReactNode
  /** Secondary line, e.g. role or department */
  description?: string
  /** Staff profile image path/URL when available */
  avatarUrl?: string | null
}

type FormMultiSelectProps = {
  name: string
  options: FormMultiSelectOption[]
  defaultSelected?: string[]
  required?: boolean
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  className?: string
  disabled?: boolean
  /** Avatar + person icons. Keep on for staff; hide for catalogs like requirements. */
  showAvatars?: boolean
  onSelectedChange?: (selected: string[]) => void
}

function optionLabelText(label: React.ReactNode, fallback: string): string {
  return typeof label === "string" ? label : fallback
}

export function FormMultiSelect({
  name,
  options,
  defaultSelected = [],
  required,
  placeholder = "Search or select staff...",
  searchPlaceholder = "Search staff...",
  emptyMessage = "No staff match your search.",
  className,
  disabled = false,
  showAvatars = true,
  onSelectedChange,
}: FormMultiSelectProps) {
  const listboxId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [highlight, setHighlight] = useState(0)
  const [selected, setSelected] = useState<Set<string>>(() => new Set(defaultSelected))
  const onSelectedChangeRef = useRef(onSelectedChange)
  onSelectedChangeRef.current = onSelectedChange

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((option) => {
      const label = optionLabelText(option.label, option.value).toLowerCase()
      const description = option.description?.toLowerCase() ?? ""
      return label.includes(q) || description.includes(q)
    })
  }, [options, query])

  const selectedOptions = useMemo(
    () => options.filter((option) => selected.has(option.value)),
    [options, selected],
  )

  useEffect(() => {
    onSelectedChangeRef.current?.(Array.from(selected))
  }, [selected])

  const toggle = useCallback((value: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) next.add(value)
      else next.delete(value)
      return next
    })
  }, [])

  const removeChip = useCallback(
    (value: string, event: React.MouseEvent) => {
      event.preventDefault()
      event.stopPropagation()
      toggle(value, false)
    },
    [toggle],
  )

  const openDropdown = useCallback(() => {
    if (disabled) return
    setOpen(true)
    setHighlight(0)
  }, [disabled])

  const closeDropdown = useCallback(() => {
    setOpen(false)
    setQuery("")
    setHighlight(0)
  }, [])

  useEffect(() => {
    if (!open) return
    const frame = requestAnimationFrame(() => searchRef.current?.focus())
    return () => cancelAnimationFrame(frame)
  }, [open])

  useEffect(() => {
    if (!open) return
    function onPointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        closeDropdown()
      }
    }
    document.addEventListener("pointerdown", onPointerDown)
    return () => document.removeEventListener("pointerdown", onPointerDown)
  }, [open, closeDropdown])

  useEffect(() => {
    setHighlight((prev) => Math.min(prev, Math.max(filtered.length - 1, 0)))
  }, [filtered.length])

  function onTriggerKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (disabled) return
    if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      openDropdown()
    }
  }

  function onSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault()
      closeDropdown()
      return
    }
    if (event.key === "ArrowDown") {
      event.preventDefault()
      setHighlight((prev) => Math.min(prev + 1, filtered.length - 1))
      return
    }
    if (event.key === "ArrowUp") {
      event.preventDefault()
      setHighlight((prev) => Math.max(prev - 1, 0))
      return
    }
    if (event.key === "Enter" && filtered[highlight]) {
      event.preventDefault()
      const value = filtered[highlight].value
      toggle(value, !selected.has(value))
    }
  }

  return (
    <div ref={rootRef} className={cn("relative w-full", className)}>
      {Array.from(selected).map((value) => (
        <input key={value} type="hidden" name={name} value={value} />
      ))}
      {required && selected.size === 0 ? (
        <input
          type="text"
          required
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          value=""
          readOnly
        />
      ) : null}

      <div
        role="combobox"
        tabIndex={disabled ? -1 : 0}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={open ? listboxId : undefined}
        aria-disabled={disabled}
        onClick={() => {
          if (disabled) return
          if (open) closeDropdown()
          else openDropdown()
        }}
        onKeyDown={onTriggerKeyDown}
        className={cn(
          "flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-left shadow-sm transition-all duration-200",
          "hover:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20",
          disabled && "cursor-not-allowed opacity-50",
          open && "border-primary/40 ring-2 ring-primary/15",
          "dark:border-border dark:bg-card",
        )}
      >
        <div className="flex min-h-7 flex-1 flex-wrap items-center gap-1.5">
          {selectedOptions.length > 0 ? (
            selectedOptions.map((option) => {
              const nameText = optionLabelText(option.label, option.value)
              return (
                <span
                  key={option.value}
                  className={cn(
                    "inline-flex max-w-full items-center gap-1.5 rounded-full border border-primary/15 bg-primary/10 py-1 pr-1 text-xs font-medium text-primary transition-colors duration-200",
                    showAvatars ? "pl-1.5" : "pl-2.5",
                  )}
                  onClick={(event) => event.stopPropagation()}
                >
                  {showAvatars ? (
                    <UserAvatar
                      name={nameText}
                      avatarUrl={option.avatarUrl}
                      className="size-5"
                      textClassName="bg-primary/15 text-[10px] font-semibold text-primary"
                    />
                  ) : null}
                  <span className="truncate">{nameText}</span>
                  <button
                    type="button"
                    aria-label={`Remove ${nameText}`}
                    onClick={(event) => removeChip(option.value, event)}
                    className="inline-flex size-5 shrink-0 items-center justify-center rounded-full text-primary/70 transition-colors duration-200 hover:bg-primary/15 hover:text-primary"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              )
            })
          ) : (
            <span className="px-0.5 text-sm text-muted-foreground">{placeholder}</span>
          )}
        </div>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </div>

      <div
        className={cn(
          "absolute top-[calc(100%+6px)] z-50 w-full origin-top overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-lg transition-all duration-200 dark:border-border dark:bg-card",
          open
            ? "pointer-events-auto scale-100 opacity-100"
            : "pointer-events-none scale-[0.98] opacity-0",
        )}
        aria-hidden={!open}
      >
        <div className="border-b border-[#E5E7EB] p-3 dark:border-border">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchRef}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setHighlight(0)
              }}
              onKeyDown={onSearchKeyDown}
              placeholder={searchPlaceholder}
              className="h-10 rounded-lg border-[#E5E7EB] bg-muted/30 pl-9 text-sm focus-visible:ring-primary/20 dark:border-border"
              aria-label={searchPlaceholder}
            />
          </div>
        </div>

        <ul
          id={listboxId}
          role="listbox"
          aria-multiselectable="true"
          className="max-h-[280px] overflow-y-auto p-2"
        >
          {filtered.length > 0 ? (
            filtered.map((option, index) => {
              const checked = selected.has(option.value)
              const nameText = optionLabelText(option.label, option.value)
              const active = index === highlight
              return (
                <li
                  key={option.value}
                  role="option"
                  aria-selected={checked}
                  onMouseEnter={() => setHighlight(index)}
                  onClick={() => toggle(option.value, !checked)}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 transition-colors duration-200",
                    checked && "bg-primary/10",
                    active && !checked && "bg-muted/60",
                    active && checked && "bg-primary/15",
                    !checked && !active && "hover:bg-muted/50",
                  )}
                >
                  <Checkbox
                    checked={checked}
                    tabIndex={-1}
                    aria-hidden
                    className="pointer-events-none"
                  />
                  {showAvatars ? (
                    <UserAvatar
                      name={nameText}
                      avatarUrl={option.avatarUrl}
                      className="size-8"
                      textClassName={cn(
                        "text-xs font-semibold",
                        checked
                          ? "bg-primary/15 text-primary"
                          : "bg-muted text-muted-foreground",
                      )}
                    />
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{nameText}</p>
                    {option.description ? (
                      <p className="truncate text-xs text-muted-foreground">{option.description}</p>
                    ) : null}
                  </div>
                  {showAvatars ? (
                    <User className="size-3.5 shrink-0 text-muted-foreground/50" aria-hidden />
                  ) : null}
                </li>
              )
            })
          ) : (
            <li className="px-3 py-8 text-center text-sm text-muted-foreground">
              {emptyMessage}
            </li>
          )}
        </ul>
      </div>
    </div>
  )
}
