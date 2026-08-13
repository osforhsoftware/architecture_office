"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
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
  FINANCE_INCOME_STATUSES,
  FINANCE_PAYMENT_METHODS,
} from "@/lib/finance/constants"
import { createIncome, updateIncome } from "@/lib/finance/actions"
import type { FinanceIncome } from "@/lib/finance/types"

export type IncomeDialogOptions = {
  clients: FinanceSelectOption[]
  projects: FinanceSelectOption[]
  categories: FinanceSelectOption[]
  accounts: FinanceSelectOption[]
}

type IncomeDialogProps = IncomeDialogOptions & {
  income?: FinanceIncome
  scope?: LedgerScope
  requireProject?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
  trigger?: React.ReactElement | null
}

export function IncomeDialog({
  income,
  scope = "project",
  requireProject = scope === "project",
  clients,
  projects,
  categories,
  accounts,
  open: controlledOpen,
  onOpenChange,
  trigger,
}: IncomeDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const open = controlledOpen ?? internalOpen
  const setOpen = onOpenChange ?? setInternalOpen
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const isEdit = Boolean(income)
  const fieldId = income ? `income-${income.id}` : "income-new"

  const [paymentMethod, setPaymentMethod] = useState("Cash")
  const [status, setStatus] = useState("Approved")
  const [clientId, setClientId] = useState<string | null>(null)
  const [projectId, setProjectId] = useState<string | null>(null)
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [accountId, setAccountId] = useState<string | null>(null)

  const clientProjects = useMemo(() => {
    if (!clientId) return []
    return projects.filter((project) => project.clientId === clientId)
  }, [projects, clientId])

  useEffect(() => {
    if (!open) return
    setPaymentMethod(income?.payment_method ?? "Cash")
    setStatus(income?.status ?? "Approved")
    setClientId(income?.client_id ? String(income.client_id) : null)
    setProjectId(income?.project_id ? String(income.project_id) : null)
    setCategoryId(income?.category_id ? String(income.category_id) : null)
    setAccountId(income?.account_id ? String(income.account_id) : null)
    setError(null)
  }, [open, income])

  function handleClientChange(nextClientId: string | null) {
    setClientId(nextClientId)
    if (!nextClientId) {
      setProjectId(null)
      return
    }
    const nextProjects = projects.filter((project) => project.clientId === nextClientId)
    const projectStillValid = Boolean(projectId && nextProjects.some((project) => project.value === projectId))
    if (projectStillValid) return
    setProjectId(nextProjects.length === 1 ? nextProjects[0].value : null)
  }

  function onSubmit(formData: FormData) {
    setError(null)
    if (income) formData.set("id", String(income.id))
    formData.set("ledger_scope", scope)
    formData.set("payment_method", paymentMethod)
    formData.set("status", status)
    if (requireProject && !formData.get("client_id")) {
      setError("Client is required")
      return
    }
    if (requireProject && !formData.get("project_id")) {
      setError("Project is required")
      return
    }
    startTransition(async () => {
      const res = isEdit ? await updateIncome(formData) : await createIncome(formData)
      if (res && "error" in res && res.error) {
        setError(res.error)
        return
      }
      toast.success(isEdit ? "Income updated" : "Income recorded")
      setOpen(false)
    })
  }

  const defaultTrigger = isEdit ? (
    <Button variant="ghost" size="sm" className="w-full justify-start px-1.5">
      <Pencil className="size-4" /> Edit
    </Button>
  ) : (
    <Button>
      <Plus className="size-4" /> Record Income
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
        title={isEdit ? "Edit Income" : "Record Income"}
        description={isEdit ? `Update ${income?.receipt_number}` : "Add a new income receipt."}
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
              <FormSection title="Receipt details">
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField label="Date" htmlFor={`${fieldId}-date`}>
                    <Input
                      id={`${fieldId}-date`}
                      name="income_date"
                      type="date"
                      required
                      defaultValue={
                        income?.income_date?.slice(0, 10) ??
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
                      defaultValue={income?.amount ?? ""}
                      className={formControlClass}
                    />
                  </FormField>
                  {scope === "project" ? (
                    <>
                      <FormField label="Client">
                        <FormSelect
                          name="client_id"
                          options={clients}
                          value={clientId}
                          onValueChange={handleClientChange}
                          placeholder="Select client"
                          searchable
                          required={requireProject}
                          searchPlaceholder="Search client..."
                        />
                      </FormField>
                      <FormField label="Project" htmlFor={`${fieldId}-project`}>
                        <FormSelect
                          name="project_id"
                          options={clientProjects}
                          value={projectId}
                          onValueChange={setProjectId}
                          placeholder={
                            !clientId
                              ? "Select client first"
                              : clientProjects.length === 0
                                ? "No projects for this client"
                                : "Select project"
                          }
                          searchable
                          required={requireProject}
                          disabled={!clientId || clientProjects.length === 0}
                          emptyMessage="No projects for this client"
                          searchPlaceholder="Search project..."
                        />
                        <p className="text-xs text-muted-foreground">
                          {!clientId
                            ? "Choose a client to load their projects."
                            : clientProjects.length === 0
                              ? "This client has no projects yet."
                              : `${clientProjects.length} project${clientProjects.length === 1 ? "" : "s"} for this client`}
                        </p>
                      </FormField>
                    </>
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
                      options={FINANCE_INCOME_STATUSES.map((s) => ({ value: s, label: s }))}
                      value={status}
                      onValueChange={(v) => setStatus(v ?? "Approved")}
                    />
                  </FormField>
                  <FormField label="Reference #" htmlFor={`${fieldId}-ref`} className="sm:col-span-2">
                    <Input
                      id={`${fieldId}-ref`}
                      name="reference_number"
                      defaultValue={income?.reference_number ?? ""}
                      className={formControlClass}
                    />
                  </FormField>
                  <FormField label="Notes" htmlFor={`${fieldId}-notes`} className="sm:col-span-2">
                    <Textarea
                      id={`${fieldId}-notes`}
                      name="notes"
                      defaultValue={income?.notes ?? ""}
                      className={formTextareaClass}
                    />
                  </FormField>
                </div>
              </FormSection>
            </FormDialogBody>
            <FormDialogFooter submitLabel={isEdit ? "Save changes" : "Record income"} pending={pending} />
          </form>
        ) : null}
      </FormDialogShell>
    </Dialog>
  )
}
