"use client"

import { useEffect, useState, useTransition } from "react"
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
import { STAFF_CLAIM_CATEGORIES } from "@/lib/finance/constants"
import { submitStaffClaim } from "@/lib/finance/actions"

type ClaimDialogProps = {
  projects: FinanceSelectOption[]
  staffId?: number
  triggerLabel?: string
}

export function ClaimDialog({ projects, staffId, triggerLabel = "Submit Claim" }: ClaimDialogProps) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [category, setCategory] = useState<string>("Fuel")
  const [projectId, setProjectId] = useState<string | null>(null)

  useEffect(() => {
    if (open) setError(null)
  }, [open])

  function onSubmit(formData: FormData) {
    setError(null)
    formData.set("category", category)
    if (staffId) formData.set("staff_id", String(staffId))
    startTransition(async () => {
      const res = await submitStaffClaim(formData)
      if (res && "error" in res) {
        setError(res.error)
        return
      }
      toast.success(`Claim ${res.claimNumber ?? "submitted"}`)
      setOpen(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button>
            <Plus className="size-4" /> {triggerLabel}
          </Button>
        }
      />
      <FormDialogShell title="Submit Expense Claim" description="Submit a reimbursement claim for approval.">
        {open ? (
          <form action={onSubmit} className="flex min-h-0 flex-1 flex-col">
            <FormDialogBody>
              {error ? (
                <p className="mb-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              ) : null}
              <FormSection title="Claim details">
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField label="Date" htmlFor="claim-date">
                    <Input
                      id="claim-date"
                      name="claim_date"
                      type="date"
                      required
                      defaultValue={new Date().toISOString().slice(0, 10)}
                      className={formControlClass}
                    />
                  </FormField>
                  <FormField label="Amount" htmlFor="claim-amount">
                    <Input
                      id="claim-amount"
                      name="amount"
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      className={formControlClass}
                    />
                  </FormField>
                  <FormField label="Category">
                    <FormSelect
                      name="category"
                      options={STAFF_CLAIM_CATEGORIES.map((c) => ({ value: c, label: c }))}
                      value={category}
                      onValueChange={(v) => setCategory(v ?? "Fuel")}
                    />
                  </FormField>
                  <FormField label="Project">
                    <FormSelect
                      name="project_id"
                      options={projects}
                      value={projectId}
                      onValueChange={setProjectId}
                      placeholder="Optional project"
                      searchable
                    />
                  </FormField>
                  <FormField label="Notes" htmlFor="claim-notes" className="sm:col-span-2">
                    <Textarea id="claim-notes" name="notes" className={formTextareaClass} />
                  </FormField>
                </div>
              </FormSection>
            </FormDialogBody>
            <FormDialogFooter submitLabel="Submit claim" pending={pending} />
          </form>
        ) : null}
      </FormDialogShell>
    </Dialog>
  )
}
