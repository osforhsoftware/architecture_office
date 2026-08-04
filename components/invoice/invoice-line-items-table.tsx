"use client"

import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  formatInvoiceCurrency,
  INVOICE_LIMITS,
  INVOICE_SERVICE_PRESETS,
  parseInvoiceInputNumber,
  sanitizeInvoiceText,
  type InvoiceServicePreset,
  type LineItemInput,
} from "@/lib/invoice-utils"

const COLS =
  "grid-cols-[2rem_minmax(10rem,1.6fr)_6.5rem_5.5rem_5rem_6rem_5rem_minmax(6.5rem,auto)_2rem]"

export function InvoiceLineItemsTable({
  lineItems,
  onChange,
  onAdd,
  onRemove,
  servicePresets = INVOICE_SERVICE_PRESETS,
}: {
  lineItems: LineItemInput[]
  onChange: (index: number, patch: Partial<LineItemInput>) => void
  onAdd: () => void
  onRemove: (index: number) => void
  servicePresets?: InvoiceServicePreset[]
}) {
  function applyServicePreset(index: number, key: string) {
    if (key === "custom") return
    const preset = servicePresets.find((s) => s.key === key)
    if (!preset) return
    onChange(index, {
      description: preset.label,
      unit: preset.defaultUnit,
      unit_price: preset.defaultRate,
      discount_amount: 0,
      discount_percent: 0,
    })
  }

  return (
    <section className="border border-neutral-900/15 bg-white">
      <div className="flex items-center justify-between border-b border-neutral-900/10 px-5 py-4">
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-900">
            Services
          </h3>
          <p className="mt-1 text-xs text-neutral-500">
            Amount = Final Rate × Qty. Final Rate = Rate − Discount.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onAdd}
          disabled={lineItems.length >= INVOICE_LIMITS.maxLineItems}
          className="rounded-none border-neutral-900/20"
        >
          <Plus className="size-4" /> Add Service
        </Button>
      </div>

      <div className="overflow-x-auto px-3 pb-4 pt-2">
        <div className="min-w-[56rem] space-y-0">
          <div
            className={`hidden border-b border-[#19B5D8] px-2 pb-2 sm:grid sm:items-end sm:gap-x-2 ${COLS}`}
          >
            <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-500">
              #
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-500">
              Service Description
            </span>
            <span className="text-right text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-500">
              Rate (₹)
            </span>
            <span className="text-right text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-500">
              Disc. (₹)
            </span>
            <span className="text-right text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-500">
              Disc. %
            </span>
            <span className="text-right text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-500">
              Final Rate
            </span>
            <span className="text-right text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-500">
              Qty / Sq.ft
            </span>
            <span className="text-right text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-500">
              Amount (₹)
            </span>
            <span className="sr-only">Remove</span>
          </div>

          {lineItems.map((item, index) => (
            <div
              key={index}
              className={`grid gap-2 border-b border-neutral-900/8 px-2 py-3 sm:grid sm:items-end sm:gap-x-2 ${COLS}`}
            >
              <div className="pb-2 text-xs tabular-nums text-neutral-400">{index + 1}</div>

              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase tracking-wide text-neutral-500 sm:sr-only">
                  Service
                </Label>
                <Select
                  value={
                    servicePresets.find((s) => s.label === item.description)?.key ?? "custom"
                  }
                  onValueChange={(v) => v && applyServicePreset(index, v)}
                >
                  <SelectTrigger className="h-8 rounded-none border-neutral-900/15 text-xs">
                    <SelectValue placeholder="Select service" />
                  </SelectTrigger>
                  <SelectContent
                    alignItemWithTrigger={false}
                    align="start"
                    className="w-auto min-w-(--anchor-width)"
                  >
                    <SelectItem value="custom">Custom / edit below</SelectItem>
                    {servicePresets.map((s) => (
                      <SelectItem key={s.key} value={s.key}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  value={item.description}
                  maxLength={INVOICE_LIMITS.maxDescriptionLength}
                  onChange={(e) => onChange(index, { description: e.target.value })}
                  placeholder="Service description"
                  className="h-9 rounded-none border-neutral-900/15"
                />
              </div>

              <div>
                <Label className="text-[10px] uppercase tracking-wide text-neutral-500 sm:sr-only">
                  Rate
                </Label>
                <Input
                  type="number"
                  min={0}
                  max={INVOICE_LIMITS.maxUnitPrice}
                  step="0.01"
                  value={item.unit_price}
                  onChange={(e) =>
                    onChange(index, { unit_price: parseInvoiceInputNumber(e.target.value) })
                  }
                  className="h-9 rounded-none border-neutral-900/15 text-right tabular-nums"
                />
              </div>

              <div>
                <Label className="text-[10px] uppercase tracking-wide text-neutral-500 sm:sr-only">
                  Discount ₹
                </Label>
                <Input
                  type="number"
                  min={0}
                  max={item.unit_price}
                  step="0.01"
                  value={item.discount_amount}
                  onChange={(e) =>
                    onChange(index, {
                      discount_amount: parseInvoiceInputNumber(e.target.value),
                      discount_percent: 0,
                    })
                  }
                  className="h-9 rounded-none border-neutral-900/15 text-right tabular-nums"
                />
              </div>

              <div>
                <Label className="text-[10px] uppercase tracking-wide text-neutral-500 sm:sr-only">
                  Discount %
                </Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={item.discount_percent}
                  onChange={(e) => {
                    const discount_percent = parseInvoiceInputNumber(e.target.value)
                    const discount_amount =
                      item.unit_price > 0
                        ? Math.round(item.unit_price * (discount_percent / 100) * 100) / 100
                        : 0
                    onChange(index, { discount_percent, discount_amount })
                  }}
                  className="h-9 rounded-none border-neutral-900/15 text-right tabular-nums"
                />
              </div>

              <div className="pb-2 text-right text-sm font-medium tabular-nums text-neutral-900">
                <Label className="text-[10px] uppercase tracking-wide text-neutral-500 sm:sr-only">
                  Final Rate
                </Label>
                {formatInvoiceCurrency(item.final_rate)}
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] uppercase tracking-wide text-neutral-500 sm:sr-only">
                  Qty
                </Label>
                <Input
                  type="number"
                  min={0}
                  max={INVOICE_LIMITS.maxQuantity}
                  step="0.01"
                  value={item.quantity}
                  onChange={(e) =>
                    onChange(index, { quantity: parseInvoiceInputNumber(e.target.value) })
                  }
                  className="h-9 rounded-none border-neutral-900/15 text-right tabular-nums"
                />
                <Input
                  value={item.unit ?? ""}
                  maxLength={INVOICE_LIMITS.maxUnitLength}
                  onChange={(e) =>
                    onChange(index, {
                      unit: sanitizeInvoiceText(e.target.value, INVOICE_LIMITS.maxUnitLength),
                    })
                  }
                  onBlur={() => {
                    if (!(item.unit ?? "").trim()) {
                      onChange(index, { unit: "Nos" })
                    }
                  }}
                  placeholder="Nos / sqft"
                  className="h-7 rounded-none border-neutral-900/10 text-[11px] text-neutral-500"
                />
              </div>

              <div className="pb-2 text-right text-sm font-semibold tabular-nums text-neutral-900">
                <Label className="text-[10px] uppercase tracking-wide text-neutral-500 sm:sr-only">
                  Amount
                </Label>
                {formatInvoiceCurrency(item.amount)}
              </div>

              <div className="flex justify-end pb-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => onRemove(index)}
                  disabled={lineItems.length <= 1}
                  aria-label="Remove line item"
                  className="rounded-none"
                >
                  <Trash2 className="size-4 text-neutral-400" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
