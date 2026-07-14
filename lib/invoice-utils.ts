import type { InvoiceLineItem, InvoiceStatus } from "./types"

/** Bounds for invoice line items, totals, and form fields (prevents overflow / DB errors). */
export const INVOICE_LIMITS = {
  maxLineItems: 50,
  maxDescriptionLength: 500,
  maxUnitLength: 50,
  minQuantity: 0,
  maxQuantity: 99_999,
  minUnitPrice: 0,
  /** Matches MySQL DECIMAL(12,2) on invoice_line_items.unit_price */
  maxUnitPrice: 9_999_999_999.99,
  maxLineAmount: 9_999_999_999.99,
  maxInvoiceTotal: 9_999_999_999.99,
  minTaxPercent: 0,
  maxTaxPercent: 100,
  minDiscountPercent: 0,
  maxDiscountPercent: 100,
  maxInvoiceNumberLength: 100,
  maxClientNameLength: 500,
  maxClientAddressLength: 2000,
  maxClientEmailLength: 255,
  maxClientPhoneLength: 50,
  maxClientTaxIdLength: 100,
  maxProjectNameLength: 500,
  maxNotesLength: 5000,
  maxTermsLength: 5000,
  minPaymentAmount: 0.01,
  maxPaymentAmount: 9_999_999_999.99,
  maxPaymentNotesLength: 2000,
} as const

export interface InvoiceFormFields {
  invoiceNumber: string
  clientName: string
  clientAddress: string
  clientEmail: string
  clientPhone: string
  clientTaxId: string
  projectName: string
  notes: string
  terms: string
}

export interface LineItemInput {
  description: string
  quantity: number
  unit?: string
  unit_price: number
  amount: number
}

export function sanitizeInvoiceText(value: string | null | undefined, maxLength: number): string {
  return String(value ?? "").slice(0, maxLength)
}

export function sanitizeInvoiceFormFields(raw: Partial<InvoiceFormFields>): InvoiceFormFields {
  return {
    invoiceNumber: sanitizeInvoiceText(raw.invoiceNumber, INVOICE_LIMITS.maxInvoiceNumberLength),
    clientName: sanitizeInvoiceText(raw.clientName, INVOICE_LIMITS.maxClientNameLength),
    clientAddress: sanitizeInvoiceText(raw.clientAddress, INVOICE_LIMITS.maxClientAddressLength),
    clientEmail: sanitizeInvoiceText(raw.clientEmail, INVOICE_LIMITS.maxClientEmailLength),
    clientPhone: sanitizeInvoiceText(raw.clientPhone, INVOICE_LIMITS.maxClientPhoneLength),
    clientTaxId: sanitizeInvoiceText(raw.clientTaxId, INVOICE_LIMITS.maxClientTaxIdLength),
    projectName: sanitizeInvoiceText(raw.projectName, INVOICE_LIMITS.maxProjectNameLength),
    notes: sanitizeInvoiceText(raw.notes, INVOICE_LIMITS.maxNotesLength),
    terms: sanitizeInvoiceText(raw.terms, INVOICE_LIMITS.maxTermsLength),
  }
}

export function validateInvoiceForm(fields: InvoiceFormFields): string | null {
  if (!fields.clientName.trim()) return "Client name is required."
  if (fields.clientName.trim().length > INVOICE_LIMITS.maxClientNameLength) {
    return `Client name cannot exceed ${INVOICE_LIMITS.maxClientNameLength} characters.`
  }
  return null
}

export function sanitizePaymentAmount(value: number | string): number {
  return clampInvoiceNumber(value, INVOICE_LIMITS.minPaymentAmount, INVOICE_LIMITS.maxPaymentAmount)
}

export function parseInvoiceInputNumber(raw: string): number {
  const n = Number.parseFloat(raw)
  return Number.isFinite(n) ? n : 0
}

export function clampInvoiceNumber(value: number | string, min: number, max: number): number {
  const n = typeof value === "string" ? Number.parseFloat(value) : value
  if (!Number.isFinite(n)) return min
  return Math.min(max, Math.max(min, n))
}

export function sanitizeInvoicePercent(value: number | string): number {
  return clampInvoiceNumber(value, INVOICE_LIMITS.minTaxPercent, INVOICE_LIMITS.maxTaxPercent)
}

export function formatInvoicePercent(value: number | string): string {
  const n = sanitizeInvoicePercent(value)
  return n.toLocaleString("en-IN", { maximumFractionDigits: 2 })
}

export function sanitizeLineItemInput(
  item: Omit<LineItemInput, "amount"> & { amount?: number },
): LineItemInput {
  const unit = sanitizeInvoiceText(item.unit ?? "Nos", INVOICE_LIMITS.maxUnitLength).trim() || "Nos"
  const quantity = clampInvoiceNumber(
    Math.round(Number(item.quantity) * 100) / 100,
    INVOICE_LIMITS.minQuantity,
    INVOICE_LIMITS.maxQuantity,
  )
  const unit_price = clampInvoiceNumber(
    Math.round(Number(item.unit_price) * 100) / 100,
    INVOICE_LIMITS.minUnitPrice,
    INVOICE_LIMITS.maxUnitPrice,
  )
  return {
    description: item.description.slice(0, INVOICE_LIMITS.maxDescriptionLength),
    quantity,
    unit,
    unit_price,
    amount: lineItemAmount(quantity, unit_price),
  }
}

export function validateInvoiceLineItems(lineItems: LineItemInput[]): string | null {
  if (!lineItems.length) return "Add at least one line item."
  if (lineItems.length > INVOICE_LIMITS.maxLineItems) {
    return `Maximum ${INVOICE_LIMITS.maxLineItems} line items allowed.`
  }
  for (const item of lineItems) {
    if (!item.description.trim()) continue
    const sanitized = sanitizeLineItemInput(item)
    if (sanitized.quantity <= 0) return "Each line item must have a quantity greater than 0."
    if (sanitized.unit_price < 0) return "Unit price cannot be negative."
    if (lineItemAmount(sanitized.quantity, sanitized.unit_price) > INVOICE_LIMITS.maxLineAmount) {
      return `Line item amount cannot exceed ₹${INVOICE_LIMITS.maxLineAmount.toLocaleString("en-IN")}.`
    }
  }
  return null
}

export interface InvoiceTotals {
  subtotal: number
  discountAmount: number
  taxAmount: number
  total: number
}

export function lineItemAmount(quantity: number, unitPrice: number): number {
  const q = clampInvoiceNumber(quantity, INVOICE_LIMITS.minQuantity, INVOICE_LIMITS.maxQuantity)
  const p = clampInvoiceNumber(unitPrice, INVOICE_LIMITS.minUnitPrice, INVOICE_LIMITS.maxUnitPrice)
  const raw = q * p
  if (!Number.isFinite(raw)) return 0
  return Math.min(
    INVOICE_LIMITS.maxLineAmount,
    Math.round(raw * 100) / 100,
  )
}

function formatInvoiceDecimal(value: number): string {
  if (!Number.isFinite(value)) return "0.00"
  return value.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/** Currency with 2 decimal places for invoice line items (e.g. ₹13,919.10). */
export function formatInvoiceCurrency(value: number | string): string {
  const n = typeof value === "string" ? Number.parseFloat(value) : value
  return `₹${formatInvoiceDecimal(Number.isFinite(n) ? n : 0)}`
}

function safeMoneyAmount(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(INVOICE_LIMITS.maxInvoiceTotal, Math.max(0, Math.round(value * 100) / 100))
}

export function calculateInvoiceTotals(
  lineItems: LineItemInput[],
  taxPercent: number,
  discountPercent: number,
): InvoiceTotals {
  const safeTaxPercent = sanitizeInvoicePercent(taxPercent)
  const safeDiscountPercent = sanitizeInvoicePercent(discountPercent)

  const subtotal = safeMoneyAmount(
    lineItems.reduce(
      (sum, item) =>
        sum + (Number.isFinite(item.amount) ? item.amount : lineItemAmount(item.quantity, item.unit_price)),
      0,
    ),
  )

  const discountAmount = safeMoneyAmount(
    Math.min(subtotal, subtotal * (safeDiscountPercent / 100)),
  )
  const taxableBase = safeMoneyAmount(subtotal - discountAmount)
  const taxAmount = safeMoneyAmount(taxableBase * (safeTaxPercent / 100))
  const total = safeMoneyAmount(taxableBase + taxAmount)

  return { subtotal, discountAmount, taxAmount, total }
}

export function deriveInvoiceStatus(
  storedStatus: InvoiceStatus,
  total: number,
  amountPaid: number,
  dueDate: string | Date | null,
): InvoiceStatus {
  if (storedStatus === "Cancelled" || storedStatus === "Draft") return storedStatus
  if (total > 0 && amountPaid >= total) return "Paid"
  if (amountPaid > 0) return "Partially Paid"
  if (
    dueDate &&
    storedStatus !== "Paid" &&
    new Date(dueDate) < new Date(new Date().toDateString())
  ) {
    return "Overdue"
  }
  return storedStatus
}

export function parseLineItemsJson(raw: string): LineItemInput[] {
  try {
    const parsed = JSON.parse(raw) as LineItemInput[]
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((item) =>
        sanitizeLineItemInput({
          description: String(item.description ?? "").trim(),
          quantity: Number(item.quantity) || 0,
          unit: String(item.unit ?? "Nos"),
          unit_price: Number(item.unit_price) || 0,
        }),
      )
      .filter((item) => item.description && item.quantity > 0)
      .slice(0, INVOICE_LIMITS.maxLineItems)
  } catch {
    return []
  }
}

export function toStoredLineItems(items: LineItemInput[]): Omit<InvoiceLineItem, "id" | "invoice_id">[] {
  return items.map((item, index) => {
    const amount = Number.isFinite(item.amount)
      ? item.amount
      : lineItemAmount(item.quantity, item.unit_price)
    return {
      description: item.description,
      quantity: String(item.quantity),
      unit: item.unit ?? "Nos",
      unit_price: String(item.unit_price),
      amount: String(amount),
      sort_order: index,
    }
  })
}

export function formatInvoiceDate(value: string | Date | null | undefined): string {
  if (!value) return "—"
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

/** Normalize DB date values (string or Date) for HTML date inputs. */
export function toDateInputValue(value: string | Date | null | undefined): string {
  if (!value) return ""
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return ""
    return value.toISOString().slice(0, 10)
  }
  const str = String(value)
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10)
  const parsed = new Date(str)
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10)
}

/** Normalize DB date values to ISO date strings for app types. */
export function normalizeDateField(value: string | Date | null | undefined): string | null {
  if (!value) return null
  const input = toDateInputValue(value)
  return input || null
}
