import type { InvoiceLineItem, InvoiceStatus } from "./types"
import { PROJECT_SERVICES, type ProjectServiceDef } from "./workflow"

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
  maxProjectLocationLength: 500,
  maxNotesLength: 5000,
  maxTermsLength: 5000,
  minPaymentAmount: 0.01,
  maxPaymentAmount: 9_999_999_999.99,
  maxPaymentNotesLength: 2000,
} as const

export type InvoiceServicePreset = {
  key: string
  label: string
  defaultRate: number
  defaultUnit: string
}

/** Build invoice line presets from the (dynamic) project services catalog. */
export function invoiceServicePresets(
  catalog: readonly ProjectServiceDef[] = PROJECT_SERVICES,
): InvoiceServicePreset[] {
  return catalog.map((s) => ({
    key: s.key,
    label: s.label,
    defaultRate: 0,
    defaultUnit: "Nos",
  }))
}

/** @deprecated Prefer `invoiceServicePresets(await listProjectServiceDefs())` from server pages. */
export const INVOICE_SERVICE_PRESETS = invoiceServicePresets(PROJECT_SERVICES)

export interface InvoiceFormFields {
  invoiceNumber: string
  clientName: string
  clientAddress: string
  clientEmail: string
  clientPhone: string
  clientTaxId: string
  projectName: string
  projectLocation: string
  notes: string
  terms: string
}

export interface LineItemInput {
  description: string
  quantity: number
  unit?: string
  /** Original / list rate before discount */
  unit_price: number
  /** Per-unit discount in ₹ (absolute). Prefer this over percent when both set. */
  discount_amount: number
  /** Optional percent of rate; used to derive discount_amount when editing by %. */
  discount_percent: number
  /** Rate after discount — Rate − Discount */
  final_rate: number
  /** Final Rate × Quantity */
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
    projectLocation: sanitizeInvoiceText(
      raw.projectLocation,
      INVOICE_LIMITS.maxProjectLocationLength,
    ),
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

function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.round(value * 100) / 100
}

/** Final Rate = Rate − Discount (clamped ≥ 0). */
export function lineItemFinalRate(unitPrice: number, discountAmount: number): number {
  const rate = clampInvoiceNumber(unitPrice, INVOICE_LIMITS.minUnitPrice, INVOICE_LIMITS.maxUnitPrice)
  const discount = clampInvoiceNumber(discountAmount, 0, INVOICE_LIMITS.maxUnitPrice)
  return clampInvoiceNumber(roundMoney(rate - discount), 0, INVOICE_LIMITS.maxUnitPrice)
}

/** Amount = Final Rate × Quantity */
export function lineItemAmount(quantity: number, finalRate: number): number {
  const q = clampInvoiceNumber(quantity, INVOICE_LIMITS.minQuantity, INVOICE_LIMITS.maxQuantity)
  const p = clampInvoiceNumber(finalRate, INVOICE_LIMITS.minUnitPrice, INVOICE_LIMITS.maxUnitPrice)
  const raw = q * p
  if (!Number.isFinite(raw)) return 0
  return Math.min(INVOICE_LIMITS.maxLineAmount, roundMoney(raw))
}

/** Unit label for storage/display; empty values fall back to Nos. */
export function normalizeInvoiceUnit(unit: string | null | undefined): string {
  return sanitizeInvoiceText(unit ?? "Nos", INVOICE_LIMITS.maxUnitLength).trim() || "Nos"
}

export function sanitizeLineItemInput(
  item: Partial<LineItemInput> & { description?: string },
): LineItemInput {
  // Keep empty string while editing so the client can clear and type Nos / sqft.
  // Callers that persist should use normalizeInvoiceUnit().
  const unit =
    item.unit === undefined || item.unit === null
      ? "Nos"
      : sanitizeInvoiceText(item.unit, INVOICE_LIMITS.maxUnitLength)
  const quantity = clampInvoiceNumber(
    roundMoney(Number(item.quantity) || 0),
    INVOICE_LIMITS.minQuantity,
    INVOICE_LIMITS.maxQuantity,
  )
  const unit_price = clampInvoiceNumber(
    roundMoney(Number(item.unit_price) || 0),
    INVOICE_LIMITS.minUnitPrice,
    INVOICE_LIMITS.maxUnitPrice,
  )

  let discount_amount = roundMoney(Number(item.discount_amount) || 0)
  let discount_percent = sanitizeInvoicePercent(Number(item.discount_percent) || 0)

  // Prefer absolute discount when both present; otherwise derive from percent.
  if (discount_amount <= 0 && discount_percent > 0 && unit_price > 0) {
    discount_amount = roundMoney(unit_price * (discount_percent / 100))
  } else if (discount_amount > 0 && unit_price > 0) {
    discount_percent = sanitizeInvoicePercent(roundMoney((discount_amount / unit_price) * 100))
  } else if (discount_amount <= 0) {
    discount_percent = 0
  }

  discount_amount = clampInvoiceNumber(discount_amount, 0, unit_price)
  const final_rate = lineItemFinalRate(unit_price, discount_amount)

  return {
    description: sanitizeInvoiceText(item.description ?? "", INVOICE_LIMITS.maxDescriptionLength),
    quantity,
    unit,
    unit_price,
    discount_amount,
    discount_percent,
    final_rate,
    amount: lineItemAmount(quantity, final_rate),
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
    if (sanitized.unit_price < 0) return "Rate cannot be negative."
    if (sanitized.discount_amount > sanitized.unit_price) {
      return "Discount cannot exceed the rate."
    }
    if (sanitized.amount > INVOICE_LIMITS.maxLineAmount) {
      return `Line item amount cannot exceed ₹${INVOICE_LIMITS.maxLineAmount.toLocaleString("en-IN")}.`
    }
  }
  return null
}

export interface InvoiceTotals {
  /** Σ (Rate × Qty) before line discounts */
  subtotal: number
  /** Σ (Discount × Qty) */
  discountAmount: number
  /** Subtotal − Discount Total */
  taxableAmount: number
  taxAmount: number
  total: number
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
  return Math.min(INVOICE_LIMITS.maxInvoiceTotal, Math.max(0, roundMoney(value)))
}

/**
 * Live invoice totals.
 * Amounts use Final Rate × Qty. Discount is per-line (not invoice-level %).
 * Invoice-level discountPercent is kept for backward compat but applied as 0
 * when line discounts are used (pass 0 from the editor).
 */
export function calculateInvoiceTotals(
  lineItems: LineItemInput[],
  taxPercent: number,
  _invoiceDiscountPercent = 0,
): InvoiceTotals {
  const safeTaxPercent = sanitizeInvoicePercent(taxPercent)

  let gross = 0
  let lineDiscount = 0
  let taxableFromLines = 0

  for (const raw of lineItems) {
    const item = sanitizeLineItemInput(raw)
    if (!item.description.trim() && item.quantity <= 0) continue
    gross += item.unit_price * item.quantity
    lineDiscount += item.discount_amount * item.quantity
    taxableFromLines += item.amount
  }

  const subtotal = safeMoneyAmount(gross)
  const discountAmount = safeMoneyAmount(Math.min(subtotal, lineDiscount))
  const taxableAmount = safeMoneyAmount(
    Math.max(0, taxableFromLines > 0 ? taxableFromLines : subtotal - discountAmount),
  )
  const taxAmount = safeMoneyAmount(taxableAmount * (safeTaxPercent / 100))
  const total = safeMoneyAmount(taxableAmount + taxAmount)

  return { subtotal, discountAmount, taxableAmount, taxAmount, total }
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
          discount_amount: Number(item.discount_amount) || 0,
          discount_percent: Number(item.discount_percent) || 0,
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
    const sanitized = sanitizeLineItemInput(item)
    return {
      description: sanitized.description,
      quantity: String(sanitized.quantity),
      unit: normalizeInvoiceUnit(sanitized.unit),
      unit_price: String(sanitized.unit_price),
      discount_amount: String(sanitized.discount_amount),
      discount_percent: String(sanitized.discount_percent),
      amount: String(sanitized.amount),
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
