"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { Pencil, Plus, UserPlus } from "lucide-react"
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
import { createClient } from "@/lib/actions"
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
  defaultClientId?: string | number
  defaultProjectId?: string | number
  open?: boolean
  onOpenChange?: (open: boolean) => void
  trigger?: React.ReactElement | null
}

export function IncomeDialog({
  income,
  scope = "project",
  requireProject = false,
  defaultClientId,
  defaultProjectId,
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
  const [creatingClient, setCreatingClient] = useState(false)
  const [newClientName, setNewClientName] = useState("")
  const [newClientPhone, setNewClientPhone] = useState("")
  const [newClientAddress, setNewClientAddress] = useState("")
  const [clientOptions, setClientOptions] = useState(clients)
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
    const matched = projects.filter(
      (project) => String(project.clientId ?? "") === String(clientId),
    )
    if (matched.length > 0) return matched
    const hasClientMeta = projects.some(
      (project) => project.clientId != null && String(project.clientId) !== "",
    )
    return hasClientMeta ? [] : projects
  }, [projects, clientId])

  useEffect(() => {
    setClientOptions(clients)
  }, [clients])

  useEffect(() => {
    if (!open) return
    setPaymentMethod(income?.payment_method ?? "Cash")
    setStatus(income?.status ?? "Approved")
    setClientId(
      income?.client_id
        ? String(income.client_id)
        : defaultClientId != null
          ? String(defaultClientId)
          : null,
    )
    setProjectId(
      income?.project_id
        ? String(income.project_id)
        : defaultProjectId != null
          ? String(defaultProjectId)
          : null,
    )
    setCategoryId(income?.category_id ? String(income.category_id) : null)
    setAccountId(income?.account_id ? String(income.account_id) : null)
    setCreatingClient(false)
    setNewClientName("")
    setNewClientPhone("")
    setNewClientAddress("")
    setError(null)
  }, [open, income, defaultClientId, defaultProjectId])

  function handleClientChange(nextClientId: string | null) {
    setClientId(nextClientId)
    if (!nextClientId) {
      setProjectId(null)
      return
    }
    const nextProjects = projects.filter(
      (project) => String(project.clientId ?? "") === String(nextClientId),
    )
    const projectStillValid = Boolean(
      projectId && nextProjects.some((project) => project.value === projectId),
    )
    if (projectStillValid) return
    setProjectId(nextProjects.length === 1 ? nextProjects[0].value : null)
  }

  function handleCreateClient() {
    const name = newClientName.trim()
    if (!name) {
      setError("Client name is required.")
      return
    }
    setError(null)
    const fd = new FormData()
    fd.set("name", name)
    fd.set("phone", newClientPhone.trim())
    fd.set("address", newClientAddress.trim())
    fd.set("source", "finance")
    startTransition(async () => {
      const res = await createClient(fd)
      if (res && "error" in res && res.error) {
        setError(res.error)
        return
      }
      if (!res || !("clientId" in res) || !res.clientId) {
        setError("Client was not created.")
        return
      }
      const id = String(res.clientId)
      setClientOptions((prev) =>
        prev.some((option) => option.value === id)
          ? prev
          : [...prev, { value: id, label: name }],
      )
      handleClientChange(id)
      setCreatingClient(false)
      setNewClientName("")
      setNewClientPhone("")
      setNewClientAddress("")
      toast.success("Client created")
    })
  }

  function onSubmit(formData: FormData) {
    setError(null)
    if (income) formData.set("id", String(income.id))
    formData.set("ledger_scope", scope)
    formData.set("payment_method", paymentMethod)
    formData.set("status", status)
    if (clientId) formData.set("client_id", clientId)
    else formData.delete("client_id")
    if (projectId) formData.set("project_id", projectId)
    else formData.delete("project_id")
    if (categoryId) formData.set("category_id", categoryId)
    else formData.delete("category_id")
    if (accountId) formData.set("account_id", accountId)
    else formData.delete("account_id")
    if (scope === "project" && !clientId) {
      setError("Client is required")
      return
    }
    if (requireProject && !projectId) {
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
        className="sm:max-w-xl"
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
                <div className="grid grid-cols-2 gap-3">
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
                      <FormField label="Client" className="min-w-0">
                        <FormSelect
                          name="client_id"
                          options={clientOptions}
                          value={clientId}
                          onValueChange={handleClientChange}
                          placeholder="Select client"
                          searchable
                          required={scope === "project"}
                          searchPlaceholder="Search client..."
                        />
                        <button
                          type="button"
                          className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                          onClick={() => {
                            setCreatingClient((openForm) => !openForm)
                            setError(null)
                          }}
                        >
                          <UserPlus className="size-3.5" />
                          {creatingClient ? "Cancel new client" : "Create new client"}
                        </button>
                      </FormField>
                      <FormField label="Project" htmlFor={`${fieldId}-project`} className="min-w-0">
                        <FormSelect
                          name="project_id"
                          options={clientProjects}
                          value={projectId}
                          onValueChange={setProjectId}
                          placeholder={
                            !clientId
                              ? "Select client first"
                              : clientProjects.length === 0
                                ? "No project (optional)"
                                : "Select project (optional)"
                          }
                          searchable
                          required={requireProject}
                          disabled={!clientId}
                          emptyMessage="No projects for this client"
                          searchPlaceholder="Search project..."
                        />
                        <p className="text-xs text-muted-foreground">
                          {!clientId
                            ? "Choose a client. Project is optional."
                            : clientProjects.length === 0
                              ? "This client has no project yet — you can record income without one."
                              : `${clientProjects.length} project${clientProjects.length === 1 ? "" : "s"} for this client. Leave empty if this payment is not tied to a project.`}
                        </p>
                      </FormField>
                      {creatingClient ? (
                        <div className="col-span-full flex w-full flex-col gap-3 rounded-lg border border-border/60 bg-muted/30 p-3">
                          <FormField label="Name" htmlFor={`${fieldId}-new-client-name`} className="w-full">
                            <Input
                              id={`${fieldId}-new-client-name`}
                              value={newClientName}
                              onChange={(e) => setNewClientName(e.target.value)}
                              className={formControlClass}
                            />
                          </FormField>
                          <FormField label="Phone" htmlFor={`${fieldId}-new-client-phone`} className="w-full">
                            <Input
                              id={`${fieldId}-new-client-phone`}
                              value={newClientPhone}
                              onChange={(e) => setNewClientPhone(e.target.value)}
                              className={formControlClass}
                            />
                          </FormField>
                          <FormField label="Address" htmlFor={`${fieldId}-new-client-address`} className="w-full">
                            <Textarea
                              id={`${fieldId}-new-client-address`}
                              value={newClientAddress}
                              onChange={(e) => setNewClientAddress(e.target.value)}
                              className={formTextareaClass}
                            />
                          </FormField>
                          <Button
                            type="button"
                            size="sm"
                            className="w-full"
                            disabled={pending}
                            onClick={handleCreateClient}
                          >
                            Save client
                          </Button>
                        </div>
                      ) : null}
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
                  <FormField label="Reference #" htmlFor={`${fieldId}-ref`} className="col-span-full">
                    <Input
                      id={`${fieldId}-ref`}
                      name="reference_number"
                      defaultValue={income?.reference_number ?? ""}
                      className={formControlClass}
                    />
                  </FormField>
                  <FormField label="Notes" htmlFor={`${fieldId}-notes`} className="col-span-full">
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
