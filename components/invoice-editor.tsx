"use client"

import { useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Download,
  Mail,
  Plus,
  Printer,
  Save,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"
import { InvoicePreview, type InvoicePreviewData } from "@/components/invoice-preview"
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
  lineItemAmount,
  sanitizeLineItemInput,
  toDateInputValue,
  type LineItemInput,
} from "@/lib/invoice-utils"
import type { InvoicePayment, InvoiceStatus, InvoiceWithDetails, OfficeProfile } from "@/lib/types"
import type { InvoiceProjectOption } from "@/lib/queries"

function emptyLineItem(): LineItemInput {
  return { description: "", quantity: 1, unit: "Nos", unit_price: 0 }
}

function applyProjectToForm(project: InvoiceProjectOption): Pick<
  InvoiceFormState,
  "projectId" | "projectName" | "clientName" | "clientPhone" | "clientEmail" | "clientAddress" | "clientTaxId"
> {
  return {
    projectId: project.id,
    projectName: project.name,
    clientName: project.client_name,
    clientPhone: project.client_phone,
    clientEmail: project.client_email ?? "",
    clientAddress: project.client_address ?? "",
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
  notes: string
  terms: string
  taxPercent: number
  discountPercent: number
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
    return {
      invoiceNumber: invoice.invoice_number ?? suggestedInvoiceNumber ?? "",
      invoiceDate: toDateInputValue(invoice.invoice_date) || new Date().toISOString().slice(0, 10),
      dueDate: toDateInputValue(invoice.due_date),
      clientName: invoice.client_name ?? "",
      clientAddress: invoice.client_address ?? "",
      clientEmail: invoice.client_email ?? "",
      clientPhone: invoice.client_phone ?? "",
      clientTaxId: invoice.client_tax_id ?? "",
      projectName: invoice.project_name ?? "",
      notes: invoice.notes ?? "",
      terms: invoice.terms ?? profile.termsAndConditions,
      taxPercent: Number(invoice.tax_percent ?? 18),
      discountPercent: Number(invoice.discount_percent ?? 0),
      status: invoice.status ?? "Draft",
      projectId: invoice.project_id ?? null,
    }
  }
  if (preselectedProject) {
    return {
      invoiceNumber: suggestedInvoiceNumber ?? "",
      invoiceDate: new Date().toISOString().slice(0, 10),
      dueDate: "",
      notes: "",
      terms: profile.termsAndConditions,
      taxPercent: 18,
      discountPercent: 0,
      status: "Draft",
      ...applyProjectToForm(preselectedProject),
    }
  }
  return {
    invoiceNumber: suggestedInvoiceNumber ?? "",
    invoiceDate: new Date().toISOString().slice(0, 10),
    dueDate: "",
    clientName: "",
    clientAddress: "",
    clientEmail: "",
    clientPhone: "",
    clientTaxId: "",
    projectName: "",
    notes: "",
    terms: profile.termsAndConditions,
    taxPercent: 18,
    discountPercent: 0,
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
}: {
  invoice?: InvoiceWithDetails
  profile: OfficeProfile
  suggestedInvoiceNumber?: string
  projects?: InvoiceProjectOption[]
  initialProjectId?: number
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
      setForm((f) => ({ ...f, projectId: null, projectName: "" }))
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
    () => calculateInvoiceTotals(lineItems, form.taxPercent, form.discountPercent),
    [lineItems, form.taxPercent, form.discountPercent],
  )

  const linkedProject = form.projectId
    ? projects.find((p) => p.id === form.projectId)
    : null

  const previewData: InvoicePreviewData = {
    invoiceNumber: form.invoiceNumber,
    invoiceDate: form.invoiceDate,
    dueDate: form.dueDate,
    clientName: form.clientName,
    clientAddress: form.clientAddress,
    clientEmail: form.clientEmail,
    clientPhone: form.clientPhone,
    clientTaxId: form.clientTaxId,
    projectName: form.projectName,
    notes: form.notes,
    terms: form.terms,
    taxPercent: form.taxPercent,
    discountPercent: form.discountPercent,
    projectCode: invoice?.project_code ?? linkedProject?.code,
    lineItems: lineItems.filter((i) => i.description.trim()),
    amountPaid: invoice ? Number(invoice.amount_paid) : 0,
  }

  function updateLineItem(index: number, patch: Partial<LineItemInput>) {
    setLineItems((items) =>
      items.map((item, i) =>
        i === index ? sanitizeLineItemInput({ ...item, ...patch }) : item,
      ),
    )
  }

  function addLineItem() {
    setLineItems((items) =>
      items.length >= INVOICE_LIMITS.maxLineItems
        ? items
        : [...items, emptyLineItem()],
    )
  }

  function removeLineItem(index: number) {
    setLineItems((items) => (items.length <= 1 ? items : items.filter((_, i) => i !== index)))
  }

  function handleSave() {
    startTransition(async () => {
      const fd = new FormData()
      if (invoice?.id) fd.set("id", String(invoice.id))
      fd.set("project_id", form.projectId ? String(form.projectId) : "")
      fd.set("invoice_number", form.invoiceNumber)
      fd.set("invoice_date", form.invoiceDate)
      fd.set("due_date", form.dueDate)
      fd.set("client_name", form.clientName)
      fd.set("client_address", form.clientAddress)
      fd.set("client_email", form.clientEmail)
      fd.set("client_phone", form.clientPhone)
      fd.set("client_tax_id", form.clientTaxId)
      fd.set("project_name", form.projectName)
      fd.set("notes", form.notes)
      fd.set("terms", form.terms)
      fd.set("tax_percent", String(form.taxPercent))
      fd.set("discount_percent", String(form.discountPercent))
      fd.set("status", form.status)
      fd.set("line_items", JSON.stringify(lineItems.filter((i) => i.description.trim())))

      const res = await saveInvoice(fd)
      if (res?.error) {
        toast.error(res.error)
        return
      }
      toast.success(isNew ? "Invoice created" : "Invoice saved")
      if (res.invoiceId) router.push(`/admin/invoices/${res.invoiceId}`)
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

  const pdfUrl = invoice?.id ? apiUrl(`/api/admin/invoices/${invoice.id}/pdf`) : null

  return (
    <div className="flex flex-col gap-6 print:block print:gap-0">
      <div className="invoice-editor-toolbar flex flex-wrap items-center justify-between gap-3 print:hidden">
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
                  <Link href={`/admin/projects/${invoice.project_id}`} className="text-primary hover:underline">
                    View project
                  </Link>
                </>
              ) : null}
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
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                <Download className="size-4" /> Download PDF
              </a>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (!pdfUrl) return
                  const w = window.open(pdfUrl, "_blank")
                  w?.addEventListener("load", () => w.print())
                }}
              >
                <Printer className="size-4" /> Print
              </Button>
              <Button
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
          <Button onClick={handleSave} disabled={pending}>
            <Save className="size-4" />
            {pending ? "Saving..." : isNew ? "Create Invoice" : "Save Changes"}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2 print:block print:gap-0">
        <div className="invoice-editor-form flex flex-col gap-4 print:hidden">
          <div className="rounded-xl border border-border/60 bg-card p-5 shadow-premium">
            <h3 className="text-sm font-semibold">Invoice Details</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-2 sm:col-span-2">
                <Label>Project</Label>
                <FormSelect
                  value={form.projectId ? String(form.projectId) : "none"}
                  onValueChange={(value) => value && handleProjectChange(value)}
                  placeholder="Select a project"
                  options={projectOptions}
                />
                {form.projectId ? (
                  <p className="text-xs text-muted-foreground">
                    Linked to project · appears in project billing history ·{" "}
                    <Link
                      href={`/admin/projects/${form.projectId}`}
                      className="text-primary hover:underline"
                    >
                      View project
                    </Link>
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Select a project to auto-fill client details and link this invoice
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Label>Invoice Number</Label>
                <Input
                  value={form.invoiceNumber}
                  onChange={(e) => setForm((f) => ({ ...f, invoiceNumber: e.target.value }))}
                  placeholder="Auto-generated"
                  readOnly={!isNew}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Status</Label>
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
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {INVOICE_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Invoice Date</Label>
                <Input
                  type="date"
                  value={form.invoiceDate}
                  onChange={(e) => setForm((f) => ({ ...f, invoiceDate: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Due Date</Label>
                <Input
                  type="date"
                  value={form.dueDate}
                  onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
                />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border/60 bg-card p-5 shadow-premium">
            <h3 className="text-sm font-semibold">Client Information</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                ["clientName", "Client Name", "text"],
                ["clientPhone", "Phone", "text"],
                ["clientEmail", "Email", "email"],
                ["clientTaxId", "GST Number", "text"],
              ].map(([key, label, type]) => (
                <div key={key} className="flex flex-col gap-2">
                  <Label>{label}</Label>
                  <Input
                    type={type}
                    value={form[key as keyof typeof form] as string}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, [key]: e.target.value }))
                    }
                  />
                </div>
              ))}
              <div className="flex flex-col gap-2 sm:col-span-2">
                <Label>Address</Label>
                <Textarea
                  value={form.clientAddress}
                  onChange={(e) => setForm((f) => ({ ...f, clientAddress: e.target.value }))}
                  rows={2}
                />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border/60 bg-card p-5 shadow-premium">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Line Items</h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addLineItem}
                disabled={lineItems.length >= INVOICE_LIMITS.maxLineItems}
              >
                <Plus className="size-4" /> Add Item
              </Button>
            </div>
            <div className="mt-4 space-y-3">
              {lineItems.map((item, index) => (
                <div key={index} className="grid gap-2 rounded-lg border border-border/50 p-3 sm:grid-cols-12">
                  <div className="sm:col-span-4">
                    <Label className="text-xs">Service Description</Label>
                    <Input
                      value={item.description}
                      maxLength={INVOICE_LIMITS.maxDescriptionLength}
                      onChange={(e) => updateLineItem(index, { description: e.target.value })}
                      placeholder="e.g. Architectural Planning & Design"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label className="text-xs">Unit Rate (₹)</Label>
                    <Input
                      type="number"
                      min={INVOICE_LIMITS.minUnitPrice}
                      max={INVOICE_LIMITS.maxUnitPrice}
                      step="0.01"
                      value={item.unit_price}
                      onChange={(e) =>
                        updateLineItem(index, { unit_price: Number(e.target.value) || 0 })
                      }
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label className="text-xs">Quantity</Label>
                    <Input
                      type="number"
                      min={INVOICE_LIMITS.minQuantity}
                      max={INVOICE_LIMITS.maxQuantity}
                      step="0.01"
                      value={item.quantity}
                      onChange={(e) =>
                        updateLineItem(index, { quantity: Number(e.target.value) || 0 })
                      }
                    />
                  </div>
                  <div className="sm:col-span-1">
                    <Label className="text-xs">Unit</Label>
                    <Input
                      value={item.unit ?? "Nos"}
                      maxLength={24}
                      onChange={(e) => updateLineItem(index, { unit: e.target.value })}
                      placeholder="Nos"
                    />
                  </div>
                  <div className="flex items-end justify-between gap-2 sm:col-span-3">
                    <div className="min-w-0 flex-1">
                      <Label className="text-xs">Total Amount</Label>
                      <p className="truncate py-2 text-sm font-medium tabular-nums">
                        {formatCurrency(lineItemAmount(item.quantity, item.unit_price))}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => removeLineItem(index)}
                      disabled={lineItems.length <= 1}
                    >
                      <Trash2 className="size-4 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border/60 bg-card p-5 shadow-premium">
            <h3 className="text-sm font-semibold">Tax & Discount</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label>GST / VAT (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={form.taxPercent}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, taxPercent: Number(e.target.value) || 0 }))
                  }
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Discount (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={form.discountPercent}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, discountPercent: Number(e.target.value) || 0 }))
                  }
                />
              </div>
            </div>
            <div className="mt-4 space-y-1 rounded-lg bg-muted/40 p-3 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="truncate tabular-nums">{formatCurrency(totals.subtotal)}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Tax</span>
                <span className="truncate tabular-nums">{formatCurrency(totals.taxAmount)}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Discount</span>
                <span className="truncate tabular-nums">-{formatCurrency(totals.discountAmount)}</span>
              </div>
              <div className="flex justify-between gap-4 border-t border-border/50 pt-2 font-semibold">
                <span>Grand Total</span>
                <span className="truncate tabular-nums">{formatCurrency(totals.total)}</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border/60 bg-card p-5 shadow-premium">
            <h3 className="text-sm font-semibold">Notes & Terms</h3>
            <div className="mt-4 grid gap-3">
              <div className="flex flex-col gap-2">
                <Label>Notes</Label>
                <Textarea
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={3}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Terms & Conditions</Label>
                <Textarea
                  value={form.terms}
                  onChange={(e) => setForm((f) => ({ ...f, terms: e.target.value }))}
                  rows={3}
                />
              </div>
            </div>
          </div>

          {invoice?.id && invoice.status === "Draft" ? (
            <Button
              variant="secondary"
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

        <div className="h-fit xl:sticky xl:top-4 xl:self-start print:static">
          <div className="mb-3 flex items-center justify-between print:hidden">
            <h3 className="text-sm font-semibold">Live Preview</h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              className="print:hidden"
            >
              <Printer className="size-4" /> Print Preview
            </Button>
          </div>
          <div className="invoice-preview-wrapper h-fit overflow-auto rounded-xl border border-border/60 bg-muted/30 p-4 print:overflow-visible print:border-0 print:bg-white print:p-0">
            <InvoicePreview data={previewData} profile={profile} />
          </div>
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
    <div className="rounded-xl border border-border/60 bg-card p-5 shadow-premium">
      <h3 className="text-sm font-semibold">Payment Tracking</h3>
      <form onSubmit={onSubmit} className="mt-4 grid gap-3 sm:grid-cols-2">
        <input type="hidden" name="invoice_id" value={invoiceId} />
        <div className="flex flex-col gap-2">
          <Label>Amount Paid</Label>
          <Input name="amount" type="number" min="1" step="0.01" required />
        </div>
        <div className="flex flex-col gap-2">
          <Label>Payment Date</Label>
          <Input
            name="payment_date"
            type="date"
            defaultValue={new Date().toISOString().slice(0, 10)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label>Payment Method</Label>
          <Select name="method" defaultValue="UPI">
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {PAYMENT_METHODS.map((m) => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label>Payment Notes</Label>
          <Textarea name="notes" placeholder="Transaction reference, etc." />
        </div>
        <Button type="submit" disabled={pending} className="sm:col-span-2">
          {pending ? "Recording..." : "Record Payment"}
        </Button>
      </form>
      {payments.length > 0 ? (
        <ul className="mt-4 divide-y divide-border rounded-lg border border-border">
          {payments.map((p) => (
            <li key={p.id} className="flex justify-between p-3 text-sm">
              <div>
                <p className="font-medium">₹{Number(p.amount).toLocaleString("en-IN")} · {p.method}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(p.payment_date).toLocaleDateString("en-IN")}
                  {p.notes ? ` · ${p.notes}` : ""}
                </p>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
