"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export type FormSelectOption = {
  value: string
  label: React.ReactNode
}

type FormSelectProps = {
  name?: string
  options: FormSelectOption[]
  placeholder?: string
  required?: boolean
  id?: string
  className?: string
  value?: string | null
  defaultValue?: string | null
  onValueChange?: (value: string | null) => void
  disabled?: boolean
}

/** Select with value/label mapping so the trigger shows labels, not raw IDs. */
export function FormSelect({
  name,
  options,
  placeholder,
  required,
  id,
  className,
  value,
  defaultValue,
  onValueChange,
  disabled,
}: FormSelectProps) {
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
      <SelectTrigger id={id} className={className ?? "w-full"}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
