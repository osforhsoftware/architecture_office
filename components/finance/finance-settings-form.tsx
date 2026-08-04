"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { FormField, formControlClass } from "@/components/form-section"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { rebuildProjectFinance, saveFinanceSettings } from "@/lib/finance/actions"

export function FinanceSettingsForm({
  lowCashThreshold,
}: {
  lowCashThreshold: number
}) {
  const [pending, startTransition] = useTransition()
  const [rebuildPending, startRebuild] = useTransition()

  function onSave(formData: FormData) {
    startTransition(async () => {
      await saveFinanceSettings(formData)
      toast.success("Settings saved")
    })
  }

  function onRebuild() {
    startRebuild(async () => {
      const res = await rebuildProjectFinance()
      toast.success(`Recalculated ${res.count ?? 0} projects`)
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <form action={onSave} className="rounded-xl border border-border/60 bg-card p-5 shadow-premium">
        <h3 className="text-sm font-semibold">Alerts</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Notify finance managers when cash balance drops below this threshold.
        </p>
        <div className="mt-4 max-w-xs">
          <FormField label="Low cash threshold (₹)" htmlFor="low_cash_threshold">
            <Input
              id="low_cash_threshold"
              name="low_cash_threshold"
              type="number"
              step="100"
              min="0"
              defaultValue={String(lowCashThreshold)}
              className={formControlClass}
            />
          </FormField>
        </div>
        <Button type="submit" disabled={pending} className="mt-4">
          Save settings
        </Button>
      </form>

      <div className="rounded-xl border border-border/60 bg-card p-5 shadow-premium">
        <h3 className="text-sm font-semibold">Maintenance</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Recalculate project finance summaries from income and expense records.
        </p>
        <Button
          type="button"
          variant="outline"
          disabled={rebuildPending}
          className="mt-4"
          onClick={onRebuild}
        >
          Rebuild project finance
        </Button>
      </div>
    </div>
  )
}
