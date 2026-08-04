"use client"

import { useState, useTransition } from "react"
import { Plus } from "lucide-react"
import { toast } from "sonner"
import { Dialog, DialogTrigger } from "@/components/ui/dialog"
import {
  FormDialogBody,
  FormDialogFooter,
  FormDialogShell,
} from "@/components/form-dialog-shell"
import { FormSelect } from "@/components/form-select"
import { FormField, FormSection, formControlClass, formTextareaClass } from "@/components/form-section"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import type { FinanceSelectOption } from "@/components/finance/finance-options"
import { PROJECT_BUDGET_CATEGORIES } from "@/lib/finance/constants"
import { saveProjectBudget } from "@/lib/finance/actions"
import type { ProjectBudget } from "@/lib/finance/types"

type BudgetDialogProps = {
  projectId: number
  projects?: FinanceSelectOption[]
  budget?: ProjectBudget
  open?: boolean
  onOpenChange?: (open: boolean) => void
  trigger?: React.ReactElement | null
}

export function BudgetDialog({
  projectId,
  projects,
  budget,
  open: controlledOpen,
  onOpenChange,
  trigger,
}: BudgetDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const open = controlledOpen ?? internalOpen
  const setOpen = onOpenChange ?? setInternalOpen
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const isEdit = Boolean(budget)
  const [category, setCategory] = useState(budget?.category ?? "")

  function onSubmit(formData: FormData) {
    setError(null)
    formData.set("project_id", String(projectId))
    if (budget) formData.set("id", String(budget.id))
    startTransition(async () => {
      const res = await saveProjectBudget(formData)
      if (res?.error) {
        setError(res.error)
        return
      }
      toast.success(isEdit ? "Budget updated" : "Budget line added")
      setOpen(false)
    })
  }

  const categoryOptions = PROJECT_BUDGET_CATEGORIES.map((c) => ({ value: c, label: c }))

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger !== undefined ? (
        trigger ? <DialogTrigger render={trigger} /> : null
      ) : (
        <DialogTrigger
          render={
            <Button>
              <Plus className="size-4" /> Add Budget Line
            </Button>
          }
        />
      )}
      <FormDialogShell
        title={isEdit ? "Edit Budget Line" : "Add Budget Line"}
        description="Set estimated spending by category for this project."
      >
        {open ? (
          <form action={onSubmit} className="flex min-h-0 flex-1 flex-col">
            <FormDialogBody>
              {error ? (
                <p className="mb-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              ) : null}
              <FormSection title="Budget details">
                <div className="grid gap-3 sm:grid-cols-2">
                  {projects?.length ? (
                    <FormField label="Project" className="sm:col-span-2">
                      <FormSelect
                        name="project_id"
                        options={projects}
                        value={String(projectId)}
                        onValueChange={() => {}}
                        disabled
                      />
                    </FormField>
                  ) : null}
                  <FormField label="Category">
                    <FormSelect
                      name="category"
                      options={categoryOptions}
                      value={category || null}
                      onValueChange={(v) => setCategory(v ?? "")}
                      placeholder="Select category"
                    />
                  </FormField>
                  <FormField label="Estimated amount" htmlFor="budget-amount">
                    <Input
                      id="budget-amount"
                      name="estimated_amount"
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      defaultValue={budget?.estimated_amount ?? ""}
                      className={formControlClass}
                    />
                  </FormField>
                  <FormField label="Notes" htmlFor="budget-notes" className="sm:col-span-2">
                    <Textarea
                      id="budget-notes"
                      name="notes"
                      defaultValue={budget?.notes ?? ""}
                      className={formTextareaClass}
                    />
                  </FormField>
                </div>
              </FormSection>
            </FormDialogBody>
            <FormDialogFooter submitLabel={isEdit ? "Save changes" : "Add budget line"} pending={pending} />
          </form>
        ) : null}
      </FormDialogShell>
    </Dialog>
  )
}
