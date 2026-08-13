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
import { FINANCE_PAYMENT_METHODS, SALARY_STATUSES } from "@/lib/finance/constants"
import { createSalary, updateSalary } from "@/lib/finance/actions"
import type { SalaryPayroll } from "@/lib/finance/types"

type SalaryDialogProps = {
  staff: FinanceSelectOption[]
  accounts: FinanceSelectOption[]
  salary?: SalaryPayroll
  open?: boolean
  onOpenChange?: (open: boolean) => void
  trigger?: React.ReactElement | null
}

export function SalaryDialog({
  staff,
  accounts,
  salary,
  open: controlledOpen,
  onOpenChange,
  trigger,
}: SalaryDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const open = controlledOpen ?? internalOpen
  const setOpen = onOpenChange ?? setInternalOpen
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const isEdit = Boolean(salary)
  const [staffId, setStaffId] = useState<string | null>(null)
  const [accountId, setAccountId] = useState<string | null>(null)
  const [paymentMethod, setPaymentMethod] = useState("Bank Transfer")
  const [status, setStatus] = useState("Draft")

  useEffect(() => {
    if (!open) return
    setStaffId(salary?.staff_id ? String(salary.staff_id) : null)
    setAccountId(salary?.account_id ? String(salary.account_id) : null)
    setPaymentMethod(salary?.payment_method ?? "Bank Transfer")
    setStatus(salary?.status ?? "Draft")
    setError(null)
  }, [open, salary])

  function onSubmit(formData: FormData) {
    setError(null)
    if (salary) formData.set("id", String(salary.id))
    startTransition(async () => {
      const res = isEdit ? await updateSalary(formData) : await createSalary(formData)
      if (res && "error" in res) {
        setError(res.error)
        return
      }
      toast.success(isEdit ? "Salary updated" : "Salary record created")
      setOpen(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger !== undefined ? (
        trigger ? <DialogTrigger render={trigger} /> : null
      ) : (
        <DialogTrigger
          render={
            <Button>
              <Plus className="size-4" /> Add Salary
            </Button>
          }
        />
      )}
      <FormDialogShell
        title={isEdit ? "Edit Salary" : "Add Salary"}
        description={isEdit ? `Update ${salary?.payslip_number}` : "Create a staff salary payslip."}
      >
        {open ? (
          <form action={onSubmit} className="flex min-h-0 flex-1 flex-col">
            <FormDialogBody>
              {error ? (
                <p className="mb-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              ) : null}
              <FormSection title="Payslip details">
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField label="Staff">
                    <FormSelect
                      name="staff_id"
                      options={staff}
                      value={staffId}
                      onValueChange={setStaffId}
                      placeholder="Select staff"
                      searchable
                    />
                  </FormField>
                  <FormField label="Pay period" htmlFor="salary-period">
                    <Input
                      id="salary-period"
                      name="pay_period"
                      placeholder="2026-08"
                      required
                      defaultValue={salary?.pay_period ?? ""}
                      className={formControlClass}
                    />
                  </FormField>
                  <FormField label="Pay date" htmlFor="salary-date">
                    <Input
                      id="salary-date"
                      name="pay_date"
                      type="date"
                      required
                      defaultValue={salary?.pay_date?.slice(0, 10) ?? new Date().toISOString().slice(0, 10)}
                      className={formControlClass}
                    />
                  </FormField>
                  <FormField label="Basic salary" htmlFor="salary-basic">
                    <Input id="salary-basic" name="basic_salary" type="number" step="0.01" min="0" required defaultValue={salary?.basic_salary ?? ""} className={formControlClass} />
                  </FormField>
                  <FormField label="Allowances" htmlFor="salary-allowances">
                    <Input id="salary-allowances" name="allowances" type="number" step="0.01" min="0" defaultValue={salary?.allowances ?? "0"} className={formControlClass} />
                  </FormField>
                  <FormField label="Bonus" htmlFor="salary-bonus">
                    <Input id="salary-bonus" name="bonus" type="number" step="0.01" min="0" defaultValue={salary?.bonus ?? "0"} className={formControlClass} />
                  </FormField>
                  <FormField label="Overtime" htmlFor="salary-overtime">
                    <Input id="salary-overtime" name="overtime" type="number" step="0.01" min="0" defaultValue={salary?.overtime ?? "0"} className={formControlClass} />
                  </FormField>
                  <FormField label="Deductions" htmlFor="salary-deductions">
                    <Input id="salary-deductions" name="deductions" type="number" step="0.01" min="0" defaultValue={salary?.deductions ?? "0"} className={formControlClass} />
                  </FormField>
                  <FormField label="Payment method">
                    <FormSelect
                      name="payment_method"
                      options={FINANCE_PAYMENT_METHODS.map((m) => ({ value: m, label: m }))}
                      value={paymentMethod}
                      onValueChange={(v) => setPaymentMethod(v ?? "Bank Transfer")}
                    />
                  </FormField>
                  <FormField label="Account">
                    <FormSelect
                      name="account_id"
                      options={accounts}
                      value={accountId}
                      onValueChange={setAccountId}
                      placeholder="Select account"
                    />
                  </FormField>
                  <FormField label="Status">
                    <FormSelect
                      name="status"
                      options={SALARY_STATUSES.map((s) => ({ value: s, label: s }))}
                      value={status}
                      onValueChange={(v) => setStatus(v ?? "Draft")}
                    />
                  </FormField>
                  <FormField label="Notes" htmlFor="salary-notes" className="sm:col-span-2">
                    <Textarea id="salary-notes" name="notes" defaultValue={salary?.notes ?? ""} className={formTextareaClass} />
                  </FormField>
                </div>
              </FormSection>
            </FormDialogBody>
            <FormDialogFooter submitLabel={isEdit ? "Save changes" : "Create payslip"} pending={pending} />
          </form>
        ) : null}
      </FormDialogShell>
    </Dialog>
  )
}
