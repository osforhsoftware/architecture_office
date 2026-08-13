"use client"

import { useEffect, useState, useTransition } from "react"
import { Pencil, Plus } from "lucide-react"
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
import type { LedgerScope } from "@/lib/finance/constants"
import {
  FINANCE_EXPENSE_STATUSES,
  FINANCE_PAYMENT_METHODS,
} from "@/lib/finance/constants"
import { createExpense, updateExpense } from "@/lib/finance/actions"
import type { FinanceExpense } from "@/lib/finance/types"

export type ExpenseDialogOptions = {
  vendors: FinanceSelectOption[]
  projects: FinanceSelectOption[]
  categories: FinanceSelectOption[]
  accounts: FinanceSelectOption[]
}

type ExpenseDialogProps = ExpenseDialogOptions & {
  expense?: FinanceExpense
  scope?: LedgerScope
  requireProject?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
  trigger?: React.ReactElement | null
}

export function ExpenseDialog({
  expense,
  scope = "project",
  requireProject = scope === "project",
  vendors,
  projects,
  categories,
  accounts,
  open: controlledOpen,
  onOpenChange,
  trigger,
}: ExpenseDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const open = controlledOpen ?? internalOpen
  const setOpen = onOpenChange ?? setInternalOpen
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const isEdit = Boolean(expense)
  const fieldId = expense ? `expense-${expense.id}` : "expense-new"

  const [paymentMethod, setPaymentMethod] = useState("Cash")
  const [status, setStatus] = useState("Draft")
  const [vendorId, setVendorId] = useState<string | null>(null)
  const [projectId, setProjectId] = useState<string | null>(null)
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [accountId, setAccountId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setPaymentMethod(expense?.payment_method ?? "Cash")
    setStatus(expense?.status ?? "Draft")
    setVendorId(expense?.vendor_id ? String(expense.vendor_id) : null)
    setProjectId(expense?.project_id ? String(expense.project_id) : null)
    setCategoryId(expense?.category_id ? String(expense.category_id) : null)
    setAccountId(expense?.account_id ? String(expense.account_id) : null)
    setError(null)
  }, [open, expense])

  function onSubmit(formData: FormData) {
    setError(null)
    if (expense) formData.set("id", String(expense.id))
    formData.set("ledger_scope", scope)
    formData.set("payment_method", paymentMethod)
    formData.set("status", status)
    if (requireProject && !formData.get("project_id")) {
      setError("Project is required")
      return
    }
    startTransition(async () => {
      const res = isEdit ? await updateExpense(formData) : await createExpense(formData)
      if (res && "error" in res && res.error) {
        setError(res.error)
        return
      }
      toast.success(isEdit ? "Expense updated" : "Expense created")
      setOpen(false)
    })
  }

  const defaultTrigger = isEdit ? (
    <Button variant="ghost" size="sm" className="w-full justify-start px-1.5">
      <Pencil className="size-4" /> Edit
    </Button>
  ) : (
    <Button>
      <Plus className="size-4" /> Add Expense
    </Button>
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger !== undefined ? (
        trigger ? <DialogTrigger render={trigger} /> : null
      ) : (
        <DialogTrigger render={defaultTrigger} />
      )}
      <FormDialogShell
        title={isEdit ? "Edit Expense" : "Add Expense"}
        description={isEdit ? `Update ${expense?.expense_number}` : "Record a new office expense."}
      >
        {open ? (
          <form action={onSubmit} className="flex min-h-0 flex-1 flex-col">
            <input type="hidden" name="ledger_scope" value={scope} />
            <FormDialogBody>
              {error ? (
                <p className="mb-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              ) : null}
              <FormSection title="Expense details">
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField label="Date" htmlFor={`${fieldId}-date`}>
                    <Input
                      id={`${fieldId}-date`}
                      name="expense_date"
                      type="date"
                      required
                      defaultValue={
                        expense?.expense_date?.slice(0, 10) ??
                        new Date().toISOString().slice(0, 10)
                      }
                      className={formControlClass}
                    />
                  </FormField>
                  <FormField label="Amount" htmlFor={`${fieldId}-amount`}>
                    <Input
                      id={`${fieldId}-amount`}
                      name="amount"
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      defaultValue={expense?.amount ?? ""}
                      className={formControlClass}
                    />
                  </FormField>
                  <FormField label="GST" htmlFor={`${fieldId}-gst`}>
                    <Input
                      id={`${fieldId}-gst`}
                      name="gst_amount"
                      type="number"
                      step="0.01"
                      min="0"
                      defaultValue={expense?.gst_amount ?? "0"}
                      className={formControlClass}
                    />
                  </FormField>
                  <FormField label="Vendor">
                    <FormSelect
                      name="vendor_id"
                      options={vendors}
                      value={vendorId}
                      onValueChange={setVendorId}
                      placeholder="Select vendor"
                      searchable
                    />
                  </FormField>
                  {scope === "project" ? (
                    <FormField label="Project">
                      <FormSelect
                        name="project_id"
                        options={projects}
                        value={projectId}
                        onValueChange={setProjectId}
                        placeholder="Select project"
                        searchable
                      />
                    </FormField>
                  ) : null}
                  <FormField label="Category">
                    <FormSelect
                      name="category_id"
                      options={categories}
                      value={categoryId}
                      onValueChange={setCategoryId}
                      placeholder="Select category"
                      searchable
                      searchPlaceholder="Search category..."
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
                  <FormField label="Payment method">
                    <FormSelect
                      name="payment_method"
                      options={FINANCE_PAYMENT_METHODS.map((m) => ({ value: m, label: m }))}
                      value={paymentMethod}
                      onValueChange={(v) => setPaymentMethod(v ?? "Cash")}
                    />
                  </FormField>
                  <FormField label="Status">
                    <FormSelect
                      name="status"
                      options={FINANCE_EXPENSE_STATUSES.map((s) => ({ value: s, label: s }))}
                      value={status}
                      onValueChange={(v) => setStatus(v ?? "Draft")}
                    />
                  </FormField>
                  <FormField label="Reference #" htmlFor={`${fieldId}-ref`} className="sm:col-span-2">
                    <Input
                      id={`${fieldId}-ref`}
                      name="reference_number"
                      defaultValue={expense?.reference_number ?? ""}
                      className={formControlClass}
                    />
                  </FormField>
                  <FormField label="Notes" htmlFor={`${fieldId}-notes`} className="sm:col-span-2">
                    <Textarea
                      id={`${fieldId}-notes`}
                      name="notes"
                      defaultValue={expense?.notes ?? ""}
                      className={formTextareaClass}
                    />
                  </FormField>
                </div>
              </FormSection>
            </FormDialogBody>
            <FormDialogFooter submitLabel={isEdit ? "Save changes" : "Create expense"} pending={pending} />
          </form>
        ) : null}
      </FormDialogShell>
    </Dialog>
  )
}
