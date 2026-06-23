import type { InvoiceLineItem, InvoiceStatus } from "./types"

/** Bounds for invoice line items and totals (prevents overflow / layout breakage). */
export const INVOICE_LIMITS = {
  maxLineItems: 50,
  maxDescriptionLength: 500,
  minQuantity: 0,
  maxQuantity: 99_999,
  minUnitPrice: 0,
  maxUnitPrice: 999_999_999,
  maxLineAmount: 999_999_999_999,
  maxInvoiceTotal: 999_999_999_999,
} as const

export interface LineItemInput {
  description: string
  quantity: number
  unit?: string
  unit_price: number
}

export function clampInvoiceNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}

export function sanitizeLineItemInput(item: LineItemInput): LineItemInput {
  const unit = (item.unit ?? "Nos").trim().slice(0, 24) || "Nos"
  return {
    description: item.description.slice(0, INVOICE_LIMITS.maxDescriptionLength),
    quantity: clampInvoiceNumber(
      Math.round(item.quantity * 100) / 100,
      INVOICE_LIMITS.minQuantity,
      INVOICE_LIMITS.maxQuantity,
    ),
    unit,
    unit_price: clampInvoiceNumber(
      Math.round(item.unit_price * 100) / 100,
      INVOICE_LIMITS.minUnitPrice,
      INVOICE_LIMITS.maxUnitPrice,
    ),
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

export function calculateInvoiceTotals(
  lineItems: LineItemInput[],
  taxPercent: number,
  discountPercent: number,
): InvoiceTotals {
  const subtotal = lineItems.reduce(
    (sum, item) => sum + lineItemAmount(item.quantity, item.unit_price),
    0,
  )
  const discountAmount = Math.round(subtotal * (discountPercent / 100) * 100) / 100
  const taxableBase = subtotal - discountAmount
  const taxAmount = Math.round(taxableBase * (taxPercent / 100) * 100) / 100
  const total = Math.round((taxableBase + taxAmount) * 100) / 100
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
    const amount = lineItemAmount(item.quantity, item.unit_price)
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
