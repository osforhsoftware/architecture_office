"use client"

import { useTransition } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
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
import { recordPayment } from "@/lib/actions"
import { PAYMENT_METHODS, balanceAmount, formatCurrency } from "@/lib/constants"
import { PaymentBadge } from "@/components/status-badges"
import type { Payment, Project } from "@/lib/types"

export function ProjectPaymentsPanel({
  project,
  payments,
}: {
  project: Project
  payments: Payment[]
}) {
  const [pending, startTransition] = useTransition()
  const balance = balanceAmount(project.project_amount, project.advance_received)

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      const res = await recordPayment(formData)
      if (res?.error) toast.error(res.error)
      else toast.success("Payment recorded")
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground">Invoice</p>
          <p className="font-medium">{project.invoice_number ?? "—"}</p>
        </div>
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground">Project amount</p>
          <p className="font-medium">{formatCurrency(project.project_amount)}</p>
        </div>
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground">Balance due</p>
          <p className="font-medium">{formatCurrency(balance)}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Status:</span>
        <PaymentBadge status={project.payment_status} />
        <span className="text-sm text-muted-foreground">
          Paid {formatCurrency(project.advance_received)}
        </span>
      </div>

      <form action={onSubmit} className="grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-2">
        <input type="hidden" name="project_id" value={project.id} />
        <div className="flex flex-col gap-2">
          <Label htmlFor="amount">Amount (₹)</Label>
          <Input id="amount" name="amount" type="number" min="1" step="1" required />
        </div>
        <div className="flex flex-col gap-2">
          <Label>Method</Label>
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
          <Label htmlFor="note">Note</Label>
          <Textarea id="note" name="note" placeholder="Receipt reference, installment, etc." />
        </div>
        <Button type="submit" disabled={pending} className="sm:col-span-2">
          {pending ? "Recording..." : "Record payment"}
        </Button>
      </form>

      <div>
        <p className="mb-2 text-sm font-medium">Payment history</p>
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
          {payments.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 p-3 text-sm">
              <div>
                <p className="font-medium">{formatCurrency(p.amount)} · {p.method}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(p.created_at).toLocaleDateString("en-IN")}
                  {p.recorder_name ? ` · ${p.recorder_name}` : ""}
                  {p.note ? ` · ${p.note}` : ""}
                </p>
              </div>
            </li>
          ))}
          {payments.length === 0 ? (
            <li className="p-4 text-center text-sm text-muted-foreground">No payments yet.</li>
          ) : null}
        </ul>
      </div>
    </div>
  )
}
