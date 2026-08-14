"use client"

import { Input } from "@/components/ui/input"
import { formControlClass } from "@/components/form-section"
import {
  additionalRequirementValueFieldName,
  type CustomFieldValueType,
} from "@/lib/additional-requirements-shared"
import { cn } from "@/lib/utils"

export function CustomFieldValueInput({
  fieldKey,
  id,
  label,
  valueType = "text",
  choiceOptions = [],
  defaultValue = "",
  disabled = false,
}: {
  fieldKey: string
  id: string
  label: string
  valueType?: CustomFieldValueType
  choiceOptions?: string[]
  defaultValue?: string
  disabled?: boolean
}) {
  const name = additionalRequirementValueFieldName(fieldKey)

  if (valueType === "yes_no") {
    return (
      <div className="flex flex-wrap gap-4 pt-1">
        {["Yes", "No"].map((option) => (
          <label key={option} className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="radio"
              name={name}
              value={option}
              defaultChecked={defaultValue === option}
              disabled={disabled}
              className="size-4 accent-primary"
            />
            {option}
          </label>
        ))}
      </div>
    )
  }

  if (valueType === "choice") {
    const options = choiceOptions.length ? choiceOptions : []
    if (!options.length) {
      return (
        <Input
          id={id}
          name={name}
          defaultValue={defaultValue}
          disabled={disabled}
          placeholder={`Enter ${label.toLowerCase()}`}
          className={formControlClass}
        />
      )
    }
    return (
      <div className="flex flex-col gap-2 pt-1">
        {options.map((option) => (
          <label key={option} className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="radio"
              name={name}
              value={option}
              defaultChecked={defaultValue === option}
              disabled={disabled}
              className="size-4 accent-primary"
            />
            {option}
          </label>
        ))}
      </div>
    )
  }

  return (
    <Input
      id={id}
      name={name}
      type={valueType === "number" ? "number" : valueType === "date" ? "date" : "text"}
      defaultValue={defaultValue}
      disabled={disabled}
      placeholder={`Enter ${label.toLowerCase()}`}
      className={cn(formControlClass)}
    />
  )
}
