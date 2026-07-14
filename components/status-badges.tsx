import { cn } from "@/lib/utils"
import { invoiceStatusColor, paymentColor, priorityColor, statusColor } from "@/lib/constants"

function Pill({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium leading-none",
        className,
      )}
    >
      {children}
    </span>
  )
}

export function StatusBadge({ status }: { status: string }) {
  return <Pill className={statusColor(status)}>{status}</Pill>
}

export function PriorityBadge({ priority }: { priority: string }) {
  return <Pill className={priorityColor(priority)}>{priority}</Pill>
}

export function PaymentBadge({ status }: { status: string }) {
  return <Pill className={paymentColor(status)}>{status}</Pill>
}

export function InvoiceStatusBadge({ status }: { status: string }) {
  return <Pill className={invoiceStatusColor(status)}>{status}</Pill>
}
