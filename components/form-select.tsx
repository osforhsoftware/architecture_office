"use client"

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react"
import { createPortal } from "react-dom"
import { Check, ChevronDown, Search } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export type FormSelectOption = {
  value: string
  label: React.ReactNode
}

type FormSelectProps = {
  name?: string
  options: FormSelectOption[]
  placeholder?: string
  searchPlaceholder?: string
  searchable?: boolean
  required?: boolean
  id?: string
  className?: string
  value?: string | null
  defaultValue?: string | null
  onValueChange?: (value: string | null) => void
  disabled?: boolean
  emptyMessage?: string
}

function optionLabelText(label: React.ReactNode, fallback: string): string {
  return typeof label === "string" ? label : fallback
}

function SearchableFormSelect({
  name,
  options,
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  required,
  id,
  className,
  value,
  defaultValue,
  onValueChange,
  disabled = false,
  emptyMessage = "No results found.",
}: FormSelectProps) {
  const listboxId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [highlight, setHighlight] = useState(0)
  const [uncontrolled, setUncontrolled] = useState<string | null>(defaultValue ?? null)
  const [menuStyle, setMenuStyle] = useState<CSSProperties | null>(null)
  const [mounted, setMounted] = useState(false)

  const isControlled = value !== undefined
  const selectedValue = isControlled ? (value ?? null) : uncontrolled

  const selectedOption = useMemo(
    () => options.find((option) => option.value === selectedValue) ?? null,
    [options, selectedValue],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((option) => {
      const label = optionLabelText(option.label, option.value).toLowerCase()
      return label.includes(q) || option.value.toLowerCase().includes(q)
    })
  }, [options, query])

  const selectValue = useCallback(
    (next: string) => {
      if (!isControlled) setUncontrolled(next)
      onValueChange?.(next)
      setOpen(false)
      setQuery("")
      setHighlight(0)
    },
    [isControlled, onValueChange],
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

  const updateMenuPosition = useCallback(() => {
    const root = rootRef.current
    if (!root) return
    const rect = root.getBoundingClientRect()
    const gutter = 16
    const available = window.innerWidth - gutter * 2
    // Prefer trigger width; expand up to 36rem so long labels (project codes) stay readable
    const width = Math.min(Math.max(rect.width, Math.min(36 * 16, available)), available)
    let left = rect.left
    if (left + width > window.innerWidth - gutter) {
      left = Math.max(gutter, window.innerWidth - gutter - width)
    }
    left = Math.max(gutter, Math.min(left, window.innerWidth - gutter - width))
    setMenuStyle({
      position: "fixed",
      top: rect.bottom + 4,
      left,
      width,
      zIndex: 70,
    })
  }, [])

  useEffect(() => {
    setMounted(true)
  }, [])

  useLayoutEffect(() => {
    if (!open) {
      setMenuStyle(null)
      return
    }
    updateMenuPosition()
    window.addEventListener("resize", updateMenuPosition)
    window.addEventListener("scroll", updateMenuPosition, true)
    return () => {
      window.removeEventListener("resize", updateMenuPosition)
      window.removeEventListener("scroll", updateMenuPosition, true)
    }
  }, [open, updateMenuPosition])

  useEffect(() => {
    if (!open) return
    const frame = requestAnimationFrame(() => searchRef.current?.focus())
    return () => cancelAnimationFrame(frame)
  }, [open])

  useEffect(() => {
    if (!open) return
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return
      closeDropdown()
    }
    document.addEventListener("pointerdown", onPointerDown)
    return () => document.removeEventListener("pointerdown", onPointerDown)
  }, [open, closeDropdown])

  useEffect(() => {
    setHighlight((prev) => Math.min(prev, Math.max(filtered.length - 1, 0)))
  }, [filtered.length])

  function onTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
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
      selectValue(filtered[highlight].value)
    }
  }

  const menu =
    open && menuStyle && mounted
      ? createPortal(
          <div
            ref={menuRef}
            style={menuStyle}
            className="overflow-hidden rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10"
            role="presentation"
          >
            <div className="border-b border-border p-2">
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  ref={searchRef}
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value)
                    setHighlight(0)
                  }}
                  onKeyDown={onSearchKeyDown}
                  placeholder={searchPlaceholder}
                  className="h-8 pl-8 text-sm"
                  aria-label={searchPlaceholder}
                />
              </div>
            </div>

            <ul
              id={listboxId}
              role="listbox"
              className="max-h-[280px] overflow-y-auto p-1"
            >
              {filtered.length > 0 ? (
                filtered.map((option, index) => {
                  const selected = option.value === selectedValue
                  const active = index === highlight
                  const labelText = optionLabelText(option.label, option.value)
                  return (
                    <li
                      key={option.value}
                      role="option"
                      aria-selected={selected}
                      title={labelText}
                      onMouseEnter={() => setHighlight(index)}
                      onClick={() => selectValue(option.value)}
                      className={cn(
                        "relative flex w-full cursor-pointer items-center gap-1.5 rounded-md py-1.5 pr-8 pl-1.5 text-sm outline-hidden select-none",
                        (active || selected) && "bg-accent text-accent-foreground",
                      )}
                    >
                      <span className="min-w-0 flex-1 break-words">{option.label}</span>
                      {selected ? (
                        <Check className="pointer-events-none absolute right-2 size-4 shrink-0" />
                      ) : null}
                    </li>
                  )
                })
              ) : (
                <li className="px-3 py-6 text-center text-sm text-muted-foreground">
                  {emptyMessage}
                </li>
              )}
            </ul>
          </div>,
          document.body,
        )
      : null

  return (
    <div ref={rootRef} className="relative w-full min-w-0">
      {name ? <input type="hidden" name={name} value={selectedValue ?? ""} /> : null}
      {required && !selectedValue ? (
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

      <button
        type="button"
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={open ? listboxId : undefined}
        disabled={disabled}
        onClick={() => {
          if (open) closeDropdown()
          else openDropdown()
        }}
        onKeyDown={onTriggerKeyDown}
        className={cn(
          "flex h-8 w-full min-w-0 items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent py-2 pr-2 pl-2.5 text-sm text-left transition-colors outline-none select-none",
          "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          "disabled:cursor-not-allowed disabled:opacity-50",
          !selectedOption && "text-muted-foreground",
          className,
        )}
      >
        <span className="min-w-0 flex-1 truncate">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>

      {menu}
    </div>
  )
}

/** Select with value/label mapping so the trigger shows labels, not raw IDs. */
export function FormSelect({
  name,
  options,
  placeholder,
  searchPlaceholder,
  searchable = false,
  required,
  id,
  className,
  value,
  defaultValue,
  onValueChange,
  disabled,
  emptyMessage,
}: FormSelectProps) {
  if (searchable) {
    return (
      <SearchableFormSelect
        name={name}
        options={options}
        placeholder={placeholder}
        searchPlaceholder={searchPlaceholder}
        required={required}
        id={id}
        className={className}
        value={value}
        defaultValue={defaultValue}
        onValueChange={onValueChange}
        disabled={disabled}
        emptyMessage={emptyMessage}
      />
    )
  }

  return (
    <Select
      name={name}
      required={required}
      disabled={disabled}
      items={options}
      value={value}
      defaultValue={defaultValue}
      onValueChange={onValueChange}
    >
      <SelectTrigger id={id} className={cn("w-full", className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent align="start" alignItemWithTrigger={false}>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
