"use client"

import { formatCurrency } from "@/lib/constants"
import { calculateInvoiceTotals, formatInvoiceDate, lineItemAmount, type LineItemInput } from "@/lib/invoice-utils"
import type { OfficeProfile } from "@/lib/types"

export interface InvoicePreviewData {
  invoiceNumber: string
  invoiceDate: string
  dueDate: string
  clientName: string
  clientAddress: string
  clientEmail: string
  clientPhone: string
  clientTaxId: string
  projectName: string
  projectCode?: string
  notes: string
  terms: string
  taxPercent: number
  discountPercent: number
  lineItems: LineItemInput[]
  amountPaid?: number
}

export function InvoicePreview({
  data,
  profile,
  className,
}: {
  data: InvoicePreviewData
  profile: OfficeProfile
  className?: string
}) {
  const totals = calculateInvoiceTotals(data.lineItems, data.taxPercent, data.discountPercent)
  const paid = data.amountPaid ?? 0
  const balance = Math.max(0, totals.total - paid)

  return (
    <div
      className={`mx-auto h-fit w-full max-w-[210mm] bg-white text-slate-800 shadow-lg print:mx-0 print:max-w-none print:shadow-none ${className ?? ""}`}
      id="invoice-preview"
    >
      <div className="h-fit border border-slate-200 p-8 print:border-0 print:p-0">
        <div className="flex items-start justify-between gap-6 border-b border-slate-200 pb-6">
          <div className="flex gap-4">
            {profile.logoDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.logoDataUrl}
                alt="Company logo"
                className="size-14 rounded-lg object-contain"
              />
            ) : (
              <div className="flex size-14 items-center justify-center rounded-lg bg-slate-100 text-xs font-semibold text-slate-500">
                LOGO
              </div>
            )}
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {profile.companyName || "Company Name"}
              </h2>
              {profile.address ? (
                <p className="mt-1 text-xs text-slate-600">{profile.address}</p>
              ) : null}
              <p className="mt-1 text-xs text-slate-600">
                {[profile.phone, profile.email, profile.website].filter(Boolean).join(" · ")}
              </p>
              {profile.gstNumber ? (
                <p className="mt-1 text-xs text-slate-600">GST: {profile.gstNumber}</p>
              ) : null}
            </div>
          </div>
          <div className="text-right">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">INVOICE</h1>
            <p className="mt-2 text-sm font-medium text-slate-700">#{data.invoiceNumber || "—"}</p>
            <p className="mt-1 text-xs text-slate-600">
              Date: {formatInvoiceDate(data.invoiceDate || null)}
            </p>
            {data.dueDate ? (
              <p className="text-xs text-slate-600">
                Due: {formatInvoiceDate(data.dueDate)}
              </p>
            ) : null}
            {data.projectCode ? (
              <p className="text-xs text-slate-600">Project: {data.projectCode}</p>
            ) : null}
          </div>
        </div>

        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Bill To</p>
            <p className="mt-2 font-semibold text-slate-900">{data.clientName || "—"}</p>
            {data.clientAddress ? (
              <p className="mt-1 text-sm text-slate-600">{data.clientAddress}</p>
            ) : null}
            <p className="mt-1 text-sm text-slate-600">
              {[data.clientPhone, data.clientEmail].filter(Boolean).join(" · ")}
            </p>
            {data.clientTaxId ? (
              <p className="mt-1 text-sm text-slate-600">GST: {data.clientTaxId}</p>
            ) : null}
          </div>
          {data.projectName ? (
            <div className="sm:text-right">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Project</p>
              <p className="mt-2 font-medium text-slate-900">{data.projectName}</p>
            </div>
          ) : null}
        </div>

        <div className="mt-8 overflow-hidden rounded-lg border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Description</th>
                <th className="px-4 py-3 text-center font-semibold text-slate-600">Qty</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-600">Unit Price</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-600">Amount</th>
              </tr>
            </thead>
            <tbody>
              {data.lineItems.length ? (
                data.lineItems.map((item, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="max-w-[200px] truncate px-4 py-3 text-slate-800">{item.description}</td>
                    <td className="px-4 py-3 text-center tabular-nums text-slate-700">
                      {Number.isFinite(item.quantity)
                        ? item.quantity.toLocaleString("en-IN", { maximumFractionDigits: 2 })
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                      {formatCurrency(item.unit_price)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium text-slate-900">
                      {formatCurrency(lineItemAmount(item.quantity, item.unit_price))}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                    No line items added
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-6 flex justify-end">
          <div className="w-full max-w-xs space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground text-slate-600">Subtotal</span>
              <span className="truncate tabular-nums">{formatCurrency(totals.subtotal)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-slate-600">Tax ({data.taxPercent}%)</span>
              <span className="truncate tabular-nums">{formatCurrency(totals.taxAmount)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-slate-600">Discount ({data.discountPercent}%)</span>
              <span className="truncate tabular-nums">-{formatCurrency(totals.discountAmount)}</span>
            </div>
            <div className="flex justify-between gap-4 border-t border-slate-200 pt-2 text-base font-bold text-slate-900">
              <span>Total</span>
              <span className="truncate tabular-nums">{formatCurrency(totals.total)}</span>
            </div>
            {paid > 0 ? (
              <>
                <div className="flex justify-between gap-4 text-emerald-700">
                  <span>Amount Paid</span>
                  <span className="truncate tabular-nums">{formatCurrency(paid)}</span>
                </div>
                <div className="flex justify-between gap-4 font-medium text-slate-800">
                  <span>Balance Due</span>
                  <span className="truncate tabular-nums">{formatCurrency(balance)}</span>
                </div>
              </>
            ) : null}
          </div>
        </div>

        {data.notes ? (
          <div className="mt-8 border-t border-slate-200 pt-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Notes</p>
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{data.notes}</p>
          </div>
        ) : null}

        {(data.terms || profile.termsAndConditions) ? (
          <div className="mt-6 border-t border-slate-200 pt-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Terms & Conditions
            </p>
            <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-slate-600">
              {data.terms || profile.termsAndConditions}
            </p>
          </div>
        ) : null}

        <div className="mt-6 border-t border-slate-200 pt-4 text-center text-xs text-slate-500">
          {[profile.companyName, profile.phone, profile.email].filter(Boolean).join(" · ")}
        </div>
      </div>
    </div>
  )
}
