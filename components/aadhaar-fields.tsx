"use client"

import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formControlClass } from "@/components/form-section"
import { cn } from "@/lib/utils"

const MAX_AADHAAR = 5

type AadhaarFieldsProps = {
  values: string[]
  onChange: (values: string[]) => void
  className?: string
}

export function AadhaarFields({ values, onChange, className }: AadhaarFieldsProps) {
  function update(index: number, value: string) {
    onChange(values.map((item, i) => (i === index ? value : item)))
  }

  function add() {
    if (values.length >= MAX_AADHAAR) return
    onChange([...values, ""])
  }

  function remove(index: number) {
    onChange(values.length <= 1 ? [""] : values.filter((_, i) => i !== index))
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">Aadhaar number</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-9"
          onClick={add}
          disabled={values.length >= MAX_AADHAAR}
        >
          <Plus className="size-4" />
        </Button>
      </div>
      <div className="flex flex-col gap-2">
        {values.map((number, index) => (
          <div key={index} className="flex items-center gap-2">
            <Input
              value={number}
              onChange={(e) => update(index, e.target.value)}
              placeholder={`Aadhaar number ${index + 1}`}
              inputMode="numeric"
              maxLength={12}
              className={formControlClass}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-11 shrink-0"
              onClick={() => remove(index)}
              disabled={values.length <= 1}
              aria-label={`Remove Aadhaar number ${index + 1}`}
            >
              <Trash2 className="size-4 text-muted-foreground" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}
