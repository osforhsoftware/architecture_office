"use client"

import { formatInvoiceCurrency } from "@/lib/invoice-utils"
import type { InvoiceTotals } from "@/lib/invoice-utils"

const ACCENT = "#19B5D8"

export function InvoiceTotalsPanel({
  totals,
  taxPercent,
  amountPaid = 0,
  sticky = true,
}: {
  totals: InvoiceTotals
  taxPercent: number
  amountPaid?: number
  sticky?: boolean
}) {
  const balanceDue = Math.max(0, totals.total - amountPaid)

  const rows: { label: string; value: string; emphasize?: boolean; muted?: boolean }[] = [
    { label: "Subtotal", value: formatInvoiceCurrency(totals.subtotal), muted: true },
    {
      label: "Discount Total",
      value:
        totals.discountAmount > 0
          ? `−${formatInvoiceCurrency(totals.discountAmount)}`
          : formatInvoiceCurrency(0),
      muted: true,
    },
    { label: "Taxable Amount", value: formatInvoiceCurrency(totals.taxableAmount) },
    {
      label: `GST (${taxPercent}%)`,
      value: formatInvoiceCurrency(totals.taxAmount),
      muted: true,
    },
    { label: "Grand Total", value: formatInvoiceCurrency(totals.total), emphasize: true },
    { label: "Amount Paid", value: formatInvoiceCurrency(amountPaid), muted: true },
    { label: "Balance Due", value: formatInvoiceCurrency(balanceDue), emphasize: true },
  ]

  return (
    <aside
      className={
        sticky
          ? "sticky top-4 border border-neutral-900/15 bg-white p-5"
          : "border border-neutral-900/15 bg-white p-5"
      }
    >
      <p
        className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-900"
        style={{ borderBottom: `2px solid ${ACCENT}`, paddingBottom: 8, marginBottom: 16 }}
      >
        Invoice Summary
      </p>
      <dl className="space-y-2.5">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-4">
            <dt
              className={
                row.emphasize
                  ? "text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-900"
                  : "text-[11px] font-medium uppercase tracking-[0.06em] text-neutral-500"
              }
            >
              {row.label}
            </dt>
            <dd
              className={
                row.emphasize
                  ? "text-base font-semibold tabular-nums text-neutral-900"
                  : "text-sm tabular-nums text-neutral-800"
              }
            >
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </aside>
  )
}
