"use client"

import { useMemo, useRef, useState, useTransition } from "react"
import { flushSync } from "react-dom"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Download, Mail, Printer, Save } from "lucide-react"
import { toast } from "sonner"
import { InvoiceLineItemsTable } from "@/components/invoice/invoice-line-items-table"
import { InvoiceNumberInput } from "@/components/invoice/invoice-number-input"
import {
  InvoiceFooterPreview,
  InvoiceNotesSection,
  InvoicePaymentDetails,
  InvoiceTermsSection,
} from "@/components/invoice/invoice-sections"
import { InvoiceTotalsPanel } from "@/components/invoice/invoice-totals-panel"
import { InvoicePaymentDeleteDialog } from "@/components/invoice-payment-delete-dialog"
import { InvoiceStatusBadge } from "@/components/status-badges"
import { FormSelect } from "@/components/form-select"
import { Button, buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  markInvoiceSent,
  recordInvoicePayment,
  saveInvoice,
  updateInvoiceStatus,
} from "@/lib/actions"
import { INVOICE_STATUSES, PAYMENT_METHODS, formatCurrency } from "@/lib/constants"
import { apiUrl } from "@/lib/app-urls"
import {
  calculateInvoiceTotals,
  INVOICE_LIMITS,
  sanitizeInvoiceFormFields,
  sanitizeInvoicePercent,
  sanitizeInvoiceText,
  sanitizeLineItemInput,
  toDateInputValue,
  type InvoiceServicePreset,
  type LineItemInput,
} from "@/lib/invoice-utils"
import type { InvoicePayment, InvoiceStatus, InvoiceWithDetails, OfficeProfile } from "@/lib/types"
import type { InvoiceProjectOption } from "@/lib/queries"

function emptyLineItem(): LineItemInput {
  return sanitizeLineItemInput({
    description: "",
    quantity: 1,
    unit: "Nos",
    unit_price: 0,
    discount_amount: 0,
    discount_percent: 0,
  })
}

function applyProjectToForm(project: InvoiceProjectOption): Pick<
  InvoiceFormState,
  | "projectId"
  | "projectName"
  | "projectLocation"
  | "clientName"
  | "clientPhone"
  | "clientEmail"
  | "clientAddress"
  | "clientTaxId"
> {
  return {
    projectId: project.id,
    projectName: sanitizeInvoiceText(project.name, INVOICE_LIMITS.maxProjectNameLength),
    projectLocation: sanitizeInvoiceText(
      project.location ?? "",
      INVOICE_LIMITS.maxProjectLocationLength,
    ),
    clientName: sanitizeInvoiceText(project.client_name, INVOICE_LIMITS.maxClientNameLength),
    clientPhone: sanitizeInvoiceText(project.client_phone, INVOICE_LIMITS.maxClientPhoneLength),
    clientEmail: sanitizeInvoiceText(project.client_email, INVOICE_LIMITS.maxClientEmailLength),
    clientAddress: sanitizeInvoiceText(
      project.client_address,
      INVOICE_LIMITS.maxClientAddressLength,
    ),
    clientTaxId: "",
  }
}

interface InvoiceFormState {
  invoiceNumber: string
  invoiceDate: string
  dueDate: string
  clientName: string
  clientAddress: string
  clientEmail: string
  clientPhone: string
  clientTaxId: string
  projectName: string
  projectLocation: string
  notes: string
  terms: string
  taxPercent: number
  status: InvoiceStatus
  projectId: number | null
}

function buildInitialForm(
  invoice: InvoiceWithDetails | undefined,
  profile: OfficeProfile,
  suggestedInvoiceNumber: string | undefined,
  preselectedProject: InvoiceProjectOption | null | undefined,
): InvoiceFormState {
  if (invoice) {
    const fields = sanitizeInvoiceFormFields({
      invoiceNumber: invoice.invoice_number ?? suggestedInvoiceNumber ?? "",
      clientName: invoice.client_name ?? "",
      clientAddress: invoice.client_address ?? "",
      clientEmail: invoice.client_email ?? "",
      clientPhone: invoice.client_phone ?? "",
      clientTaxId: invoice.client_tax_id ?? "",
      projectName: invoice.project_name ?? "",
      projectLocation: invoice.project_location ?? "",
      notes: invoice.notes ?? "",
      terms: invoice.terms ?? profile.termsAndConditions,
    })
    return {
      invoiceNumber: fields.invoiceNumber,
      invoiceDate: toDateInputValue(invoice.invoice_date) || new Date().toISOString().slice(0, 10),
      dueDate: toDateInputValue(invoice.due_date),
      clientName: fields.clientName,
      clientAddress: fields.clientAddress,
      clientEmail: fields.clientEmail,
      clientPhone: fields.clientPhone,
      clientTaxId: fields.clientTaxId,
      projectName: fields.projectName,
      projectLocation: fields.projectLocation,
      notes: fields.notes,
      terms: fields.terms,
      taxPercent: sanitizeInvoicePercent(invoice.tax_percent ?? 18),
      status: invoice.status ?? "Draft",
      projectId: invoice.project_id ?? null,
    }
  }
  if (preselectedProject) {
    const fields = sanitizeInvoiceFormFields({
      ...applyProjectToForm(preselectedProject),
      notes: "",
      terms: profile.termsAndConditions,
    })
    return {
      invoiceNumber: suggestedInvoiceNumber ?? "",
      invoiceDate: new Date().toISOString().slice(0, 10),
      dueDate: "",
      notes: fields.notes,
      terms: fields.terms,
      taxPercent: 18,
      status: "Draft",
      clientName: fields.clientName,
      clientAddress: fields.clientAddress,
      clientEmail: fields.clientEmail,
      clientPhone: fields.clientPhone,
      clientTaxId: fields.clientTaxId,
      projectName: fields.projectName,
      projectLocation: fields.projectLocation,
      projectId: preselectedProject.id,
    }
  }
  const emptyFields = sanitizeInvoiceFormFields({})
  return {
    invoiceNumber: suggestedInvoiceNumber ?? "",
    invoiceDate: new Date().toISOString().slice(0, 10),
    dueDate: "",
    clientName: emptyFields.clientName,
    clientAddress: emptyFields.clientAddress,
    clientEmail: emptyFields.clientEmail,
    clientPhone: emptyFields.clientPhone,
    clientTaxId: emptyFields.clientTaxId,
    projectName: emptyFields.projectName,
    projectLocation: emptyFields.projectLocation,
    notes: emptyFields.notes,
    terms: profile.termsAndConditions.slice(0, INVOICE_LIMITS.maxTermsLength),
    taxPercent: 18,
    status: "Draft",
    projectId: null,
  }
}

export function InvoiceEditor({
  invoice,
  profile,
  suggestedInvoiceNumber,
  projects = [],
  initialProjectId,
  servicePresets,
}: {
  invoice?: InvoiceWithDetails
  profile: OfficeProfile
  suggestedInvoiceNumber?: string
  projects?: InvoiceProjectOption[]
  initialProjectId?: number
  servicePresets?: InvoiceServicePreset[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const isNew = !invoice

  const preselectedProject =
    !invoice && initialProjectId
      ? projects.find((p) => p.id === initialProjectId)
      : invoice?.project_id
        ? projects.find((p) => p.id === invoice.project_id)
        : null

  const [lineItems, setLineItems] = useState<LineItemInput[]>(() => {
    if (invoice?.line_items.length) {
      return invoice.line_items.map((item) =>
        sanitizeLineItemInput({
          description: item.description,
          quantity: Number(item.quantity) || 1,
          unit: item.unit ?? "Nos",
          unit_price: Number(item.unit_price) || 0,
          discount_amount: Number(item.discount_amount) || 0,
          discount_percent: Number(item.discount_percent) || 0,
        }),
      )
    }
    if (preselectedProject && Number(preselectedProject.project_amount) > 0) {
      return [
        sanitizeLineItemInput({
          description: `Architectural services — ${preselectedProject.name}`,
          quantity: 1,
          unit_price: Number(preselectedProject.project_amount),
        }),
      ]
    }
    return [emptyLineItem()]
  })

  const [form, setForm] = useState<InvoiceFormState>(() =>
    buildInitialForm(invoice, profile, suggestedInvoiceNumber, preselectedProject),
  )
  const [pdfNonce, setPdfNonce] = useState(0)
  const lineItemsRef = useRef(lineItems)
  const formRef = useRef(form)
  lineItemsRef.current = lineItems
  formRef.current = form

  const projectOptions = useMemo(
    () => [
      { value: "none", label: "No project" },
      ...projects.map((p) => ({
        value: String(p.id),
        label: `${p.code} — ${p.name} (${p.client_name})`,
      })),
    ],
    [projects],
  )

  function handleProjectChange(value: string) {
    if (value === "none") {
      setForm((f) => ({ ...f, projectId: null, projectName: "", projectLocation: "" }))
      return
    }
    const project = projects.find((p) => String(p.id) === value)
    if (!project) return
    setForm((f) => ({
      ...f,
      ...applyProjectToForm(project),
    }))
    const amount = Number(project.project_amount)
    if (amount > 0) {
      setLineItems([
        sanitizeLineItemInput({
          description: `Architectural services — ${project.name}`,
          quantity: 1,
          unit_price: amount,
        }),
      ])
    }
  }

  const totals = useMemo(
    () => calculateInvoiceTotals(lineItems, form.taxPercent, 0),
    [lineItems, form.taxPercent],
  )

  const amountPaid = Number(invoice?.amount_paid ?? 0)

  function updateLineItem(index: number, patch: Partial<LineItemInput>) {
    setLineItems((items) =>
      items.map((item, i) => {
        if (i !== index) return item
        return sanitizeLineItemInput({ ...item, ...patch })
      }),
    )
  }

  function addLineItem() {
    setLineItems((items) =>
      items.length >= INVOICE_LIMITS.maxLineItems ? items : [...items, emptyLineItem()],
    )
  }

  function removeLineItem(index: number) {
    setLineItems((items) => (items.length <= 1 ? items : items.filter((_, i) => i !== index)))
  }

  function handleSave() {
    flushSync(() => {
      const active = document.activeElement
      if (active instanceof HTMLElement) active.blur()
    })
    const currentForm = formRef.current
    const currentItems = lineItemsRef.current
    startTransition(async () => {
      const fd = new FormData()
      if (invoice?.id) fd.set("id", String(invoice.id))
      fd.set("project_id", currentForm.projectId ? String(currentForm.projectId) : "")
      fd.set("invoice_number", currentForm.invoiceNumber)
      fd.set("invoice_date", currentForm.invoiceDate)
      fd.set("due_date", currentForm.dueDate)
      fd.set("client_name", currentForm.clientName)
      fd.set("client_address", currentForm.clientAddress)
      fd.set("client_email", currentForm.clientEmail)
      fd.set("client_phone", currentForm.clientPhone)
      fd.set("client_tax_id", currentForm.clientTaxId)
      fd.set("project_name", currentForm.projectName)
      fd.set("project_location", currentForm.projectLocation)
      fd.set("notes", currentForm.notes)
      fd.set("terms", currentForm.terms)
      fd.set("tax_percent", String(currentForm.taxPercent))
      fd.set("discount_percent", "0")
      fd.set("status", currentForm.status)
      fd.set("line_items", JSON.stringify(currentItems.filter((i) => i.description.trim())))

      const res = await saveInvoice(fd)
      if (res?.error) {
        toast.error(res.error)
        return
      }
      toast.success(isNew ? "Invoice created" : "Invoice saved")
      setPdfNonce(Date.now())
      if (isNew && res.invoiceId) router.push(`/admin/invoices/${res.invoiceId}`)
      else router.refresh()
    })
  }

  function handlePaymentSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!invoice?.id) return
    const fd = new FormData(e.currentTarget)
    fd.set("invoice_id", String(invoice.id))
    startTransition(async () => {
      const res = await recordInvoicePayment(fd)
      if (res?.error) toast.error(res.error)
      else {
        toast.success("Payment recorded")
        router.refresh()
      }
    })
  }

  const pdfUrl = invoice?.id
    ? `${apiUrl(`/api/admin/invoices/${invoice.id}/pdf`)}?v=${encodeURIComponent(String(invoice.updated_at ?? ""))}&n=${pdfNonce}`
    : null

  function openInvoicePdf(print = false) {
    if (!invoice?.id) return
    const url = `${apiUrl(`/api/admin/invoices/${invoice.id}/pdf`)}?t=${Date.now()}`
    const w = window.open(url, "_blank", "noopener,noreferrer")
    if (print) w?.addEventListener("load", () => w.print())
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="invoice-editor-toolbar flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold tracking-tight">
              {isNew ? "New Invoice" : invoice.invoice_number}
            </h2>
            {invoice ? <InvoiceStatusBadge status={invoice.status} /> : null}
          </div>
          {invoice?.project_code ? (
            <p className="mt-1 text-sm text-muted-foreground">
              Project: {invoice.project_code}
              {invoice.project_id ? (
                <>
                  {" "}
                  ·{" "}
                  <Link
                    href={`/admin/projects/${invoice.project_id}`}
                    className="text-primary hover:underline"
                  >
                    View project
                  </Link>
                </>
              ) : null}
            </p>
          ) : isNew ? (
            <p className="mt-1 text-sm text-muted-foreground">
              Premium architecture invoice — live totals update as you edit.
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          {pdfUrl ? (
            <>
              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  e.preventDefault()
                  openInvoicePdf()
                }}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                <Download className="size-4" /> Download PDF
              </a>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => openInvoicePdf(true)}
              >
                <Printer className="size-4" /> Print
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  if (!invoice?.client_email) {
                    toast.error("Add client email to send invoice.")
                    return
                  }
                  const subject = encodeURIComponent(
                    `Invoice ${invoice.invoice_number} from ${profile.companyName}`,
                  )
                  const body = encodeURIComponent(
                    `Dear ${invoice.client_name},\n\nPlease find your invoice ${invoice.invoice_number} attached.\n\nDownload: ${window.location.origin}${pdfUrl}\n\nThank you,\n${profile.companyName}`,
                  )
                  window.location.href = `mailto:${invoice.client_email}?subject=${subject}&body=${body}`
                }}
              >
                <Mail className="size-4" /> Send Email
              </Button>
            </>
          ) : null}
          <Button type="button" onClick={handleSave} disabled={pending} size="sm">
            <Save className="size-4" />
            {pending ? "Saving..." : isNew ? "Create Invoice" : "Save Changes"}
          </Button>
        </div>
      </div>

      <div className="invoice-editor-form grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-4">
          {/* Header meta */}
          <section className="border border-neutral-900/15 bg-white p-5">
            <div className="flex flex-col gap-4 border-b border-neutral-900/10 pb-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-neutral-900">
                  {profile.companyName || "Architecture Studio"}
                </p>
                <p className="mt-1 text-xs text-neutral-500">
                  {profile.tagline || "Architecture • Interiors • Planning"}
                </p>
                {profile.phone?.trim() ? (
                  <p className="mt-1 text-xs font-medium text-neutral-700">
                    {profile.phone.trim().toLowerCase().startsWith("mob")
                      ? profile.phone.trim()
                      : `Mob: ${profile.phone.trim()}`}
                  </p>
                ) : null}
              </div>
              <div className="sm:text-right">
                <p className="text-2xl font-semibold tracking-[0.08em] text-neutral-900">INVOICE</p>
                <div className="mt-1 h-0.5 w-full bg-[#19B5D8] sm:ml-auto sm:w-28" />
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-2 sm:col-span-2">
                <Label className="text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-500">
                  Project
                </Label>
                <FormSelect
                  value={form.projectId ? String(form.projectId) : "none"}
                  onValueChange={(value) => value && handleProjectChange(value)}
                  placeholder="Select a project"
                  searchPlaceholder="Search projects..."
                  searchable
                  emptyMessage="No projects match your search."
                  options={projectOptions}
                  className="rounded-none border-neutral-900/15"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label className="text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-500">
                  Invoice Number
                </Label>
                <Input
                  value={form.invoiceNumber}
                  maxLength={INVOICE_LIMITS.maxInvoiceNumberLength}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      invoiceNumber: sanitizeInvoiceText(
                        e.target.value,
                        INVOICE_LIMITS.maxInvoiceNumberLength,
                      ),
                    }))
                  }
                  placeholder="Auto-generated"
                  readOnly={!isNew}
                  className="rounded-none border-neutral-900/15"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label className="text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-500">
                  Status
                </Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => {
                    if (!v) return
                    const nextStatus = v as InvoiceStatus
                    setForm((f) => ({ ...f, status: nextStatus }))
                    if (invoice?.id) {
                      const fd = new FormData()
                      fd.set("id", String(invoice.id))
                      fd.set("status", nextStatus)
                      startTransition(async () => {
                        await updateInvoiceStatus(fd)
                        router.refresh()
                      })
                    }
                  }}
                >
                  <SelectTrigger className="rounded-none border-neutral-900/15">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INVOICE_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label className="text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-500">
                  Invoice Date
                </Label>
                <Input
                  type="date"
                  value={form.invoiceDate}
                  onChange={(e) => setForm((f) => ({ ...f, invoiceDate: e.target.value }))}
                  className="rounded-none border-neutral-900/15"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label className="text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-500">
                  Due Date
                </Label>
                <Input
                  type="date"
                  value={form.dueDate}
                  onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
                  className="rounded-none border-neutral-900/15"
                />
              </div>
            </div>
          </section>

          {/* Bill To / Project */}
          <section className="grid border border-neutral-900/15 bg-white sm:grid-cols-2">
            <div className="border-b border-neutral-900/10 p-5 sm:border-b-0 sm:border-r">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-900">
                Bill To
              </h3>
              <div className="mt-4 grid gap-3">
                {(
                  [
                    ["clientName", "Client Name", "text", INVOICE_LIMITS.maxClientNameLength],
                    ["clientPhone", "Phone", "tel", INVOICE_LIMITS.maxClientPhoneLength],
                    ["clientEmail", "Email", "email", INVOICE_LIMITS.maxClientEmailLength],
                    ["clientTaxId", "GST Number", "text", INVOICE_LIMITS.maxClientTaxIdLength],
                  ] as const
                ).map(([key, label, type, maxLength]) => (
                  <div key={key} className="flex flex-col gap-1.5">
                    <Label className="text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-500">
                      {label}
                    </Label>
                    <Input
                      type={type}
                      maxLength={maxLength}
                      value={form[key]}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          [key]: sanitizeInvoiceText(e.target.value, maxLength),
                        }))
                      }
                      className="rounded-none border-neutral-900/15"
                    />
                  </div>
                ))}
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-500">
                    Address
                  </Label>
                  <Textarea
                    value={form.clientAddress}
                    maxLength={INVOICE_LIMITS.maxClientAddressLength}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        clientAddress: sanitizeInvoiceText(
                          e.target.value,
                          INVOICE_LIMITS.maxClientAddressLength,
                        ),
                      }))
                    }
                    rows={2}
                    className="rounded-none border-neutral-900/15"
                  />
                </div>
              </div>
            </div>
            <div className="p-5">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-900">
                Project Information
              </h3>
              <div className="mt-4 grid gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-500">
                    Project Name
                  </Label>
                  <Input
                    value={form.projectName}
                    maxLength={INVOICE_LIMITS.maxProjectNameLength}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        projectName: sanitizeInvoiceText(
                          e.target.value,
                          INVOICE_LIMITS.maxProjectNameLength,
                        ),
                      }))
                    }
                    className="rounded-none border-neutral-900/15"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-500">
                    Location
                  </Label>
                  <Input
                    value={form.projectLocation}
                    maxLength={INVOICE_LIMITS.maxProjectLocationLength}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        projectLocation: sanitizeInvoiceText(
                          e.target.value,
                          INVOICE_LIMITS.maxProjectLocationLength,
                        ),
                      }))
                    }
                    className="rounded-none border-neutral-900/15"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-500">
                    GST / Tax (%)
                  </Label>
                  <InvoiceNumberInput
                    aria-label="GST / Tax percent"
                    min={0}
                    max={100}
                    value={form.taxPercent}
                    onValueChange={(taxPercent) =>
                      setForm((f) => ({
                        ...f,
                        taxPercent: sanitizeInvoicePercent(taxPercent),
                      }))
                    }
                    className="rounded-none border-neutral-900/15"
                  />
                </div>
              </div>
            </div>
          </section>

          <InvoiceLineItemsTable
            lineItems={lineItems}
            onChange={updateLineItem}
            onAdd={addLineItem}
            onRemove={removeLineItem}
            servicePresets={servicePresets}
          />

          <InvoicePaymentDetails profile={profile} />
          <InvoiceNotesSection
            notes={form.notes}
            maxLength={INVOICE_LIMITS.maxNotesLength}
            onChange={(notes) =>
              setForm((f) => ({
                ...f,
                notes: sanitizeInvoiceText(notes, INVOICE_LIMITS.maxNotesLength),
              }))
            }
          />
          <InvoiceTermsSection
            terms={form.terms}
            maxLength={INVOICE_LIMITS.maxTermsLength}
            onChange={(terms) =>
              setForm((f) => ({
                ...f,
                terms: sanitizeInvoiceText(terms, INVOICE_LIMITS.maxTermsLength),
              }))
            }
          />
          <InvoiceFooterPreview profile={profile} />

          <div className="lg:hidden">
            <InvoiceTotalsPanel
              totals={totals}
              taxPercent={form.taxPercent}
              amountPaid={amountPaid}
              sticky={false}
            />
          </div>

          {invoice?.id && invoice.status === "Draft" ? (
            <Button
              variant="secondary"
              className="rounded-none"
              onClick={() => {
                startTransition(async () => {
                  const res = await markInvoiceSent(invoice.id)
                  if (res?.error) toast.error(res.error)
                  else {
                    toast.success("Invoice marked as sent")
                    router.refresh()
                  }
                })
              }}
              disabled={pending}
            >
              Mark as Sent
            </Button>
          ) : null}

          {invoice?.id ? (
            <InvoicePaymentsSection
              invoiceId={invoice.id}
              payments={invoice.payments}
              pending={pending}
              onSubmit={handlePaymentSubmit}
            />
          ) : null}
        </div>

        <div className="hidden lg:block">
          <InvoiceTotalsPanel
            totals={totals}
            taxPercent={form.taxPercent}
            amountPaid={amountPaid}
            sticky
          />
        </div>
      </div>
    </div>
  )
}

function InvoicePaymentsSection({
  invoiceId,
  payments,
  pending,
  onSubmit,
}: {
  invoiceId: number
  payments: InvoicePayment[]
  pending: boolean
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void
}) {
  return (
    <section className="border border-neutral-900/15 bg-white p-5">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-900">
        Payment Tracking
      </h3>
      <form onSubmit={onSubmit} className="mt-4 grid gap-3 sm:grid-cols-2">
        <input type="hidden" name="invoice_id" value={invoiceId} />
        <div className="flex flex-col gap-1.5">
          <Label className="text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-500">
            Amount Paid
          </Label>
          <Input
            name="amount"
            type="number"
            min={INVOICE_LIMITS.minPaymentAmount}
            max={INVOICE_LIMITS.maxPaymentAmount}
            step="0.01"
            required
            className="rounded-none border-neutral-900/15"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-500">
            Payment Date
          </Label>
          <Input
            name="payment_date"
            type="date"
            defaultValue={new Date().toISOString().slice(0, 10)}
            className="rounded-none border-neutral-900/15"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-500">
            Payment Method
          </Label>
          <Select name="method" defaultValue="UPI">
            <SelectTrigger className="rounded-none border-neutral-900/15">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAYMENT_METHODS.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label className="text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-500">
            Payment Notes
          </Label>
          <Textarea
            name="notes"
            maxLength={INVOICE_LIMITS.maxPaymentNotesLength}
            placeholder="Transaction reference, etc."
            className="rounded-none border-neutral-900/15"
          />
        </div>
        <Button type="submit" disabled={pending} className="rounded-none sm:col-span-2">
          {pending ? "Recording..." : "Record Payment"}
        </Button>
      </form>
      {payments.length > 0 ? (
        <ul className="mt-4 divide-y divide-neutral-900/10 border border-neutral-900/10">
          {payments.map((p) => (
            <li
              key={p.id}
              className="flex flex-col gap-3 p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="font-medium">
                  {formatCurrency(p.amount)} · {p.method}
                </p>
                <p className="text-xs text-neutral-500">
                  {new Date(p.payment_date).toLocaleDateString("en-IN")}
                  {p.notes ? ` · ${p.notes}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <InvoicePaymentDeleteDialog payment={p} />
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
