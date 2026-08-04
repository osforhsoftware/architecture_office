"use client"

import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formControlClass } from "@/components/form-section"
import { cn } from "@/lib/utils"

export type IdentityPair = {
  aadhaar: string
  linked: string
}

type IdentityPairFieldsProps = {
  values: IdentityPair[]
  onChange: (values: IdentityPair[]) => void
  className?: string
}

export function zipIdentityPairs(
  aadhaarNumbers: string[] = [],
  linkedNumbers: string[] = [],
): IdentityPair[] {
  const len = Math.max(aadhaarNumbers.length, linkedNumbers.length, 1)
  return Array.from({ length: len }, (_, i) => ({
    aadhaar: aadhaarNumbers[i] ?? "",
    linked: linkedNumbers[i] ?? "",
  }))
}

export function splitIdentityPairs(pairs: IdentityPair[]) {
  const filled = pairs.filter((p) => p.aadhaar.trim() || p.linked.trim())
  return {
    aadhaarNumbers: filled.map((p) => p.aadhaar.trim()),
    linkedNumbers: filled.map((p) => p.linked.trim()),
  }
}

export function IdentityPairFields({ values, onChange, className }: IdentityPairFieldsProps) {
  function update(index: number, field: keyof IdentityPair, value: string) {
    onChange(values.map((item, i) => (i === index ? { ...item, [field]: value } : item)))
  }

  function add() {
    onChange([...values, { aadhaar: "", linked: "" }])
  }

  function remove(index: number) {
    onChange(
      values.length <= 1
        ? [{ aadhaar: "", linked: "" }]
        : values.filter((_, i) => i !== index),
    )
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">Aadhaar & linked number</p>
          <p className="text-xs text-muted-foreground">
            Each entry pairs one Aadhaar number with its linked phone number.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" className="min-h-9 shrink-0" onClick={add}>
          <Plus className="size-4" />
          Add
        </Button>
      </div>

      <div className="flex flex-col gap-4">
        {values.map((pair, index) => (
          <div key={index} className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium tabular-nums">{index + 1}.</p>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-9 shrink-0"
                onClick={() => remove(index)}
                disabled={values.length <= 1}
                aria-label={`Remove identity entry ${index + 1}`}
              >
                <Trash2 className="size-4 text-muted-foreground" />
              </Button>
            </div>
            <div className="flex flex-col gap-2 pl-1">
              <Input
                value={pair.aadhaar}
                onChange={(e) => update(index, "aadhaar", e.target.value)}
                placeholder="Aadhaar number"
                inputMode="numeric"
                maxLength={12}
                className={formControlClass}
                aria-label={`Aadhaar number ${index + 1}`}
              />
              <Input
                value={pair.linked}
                onChange={(e) => update(index, "linked", e.target.value)}
                placeholder="Linked phone number"
                inputMode="tel"
                maxLength={20}
                className={formControlClass}
                aria-label={`Linked phone number ${index + 1}`}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
