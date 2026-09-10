"use client"

import { useState } from "react"
import { FileSpreadsheet, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { apiFetch } from "@/lib/app-urls"
import type { LedgerScope } from "@/lib/finance/constants"

type ExportType = "all" | "income" | "expense" | "payments" | "profit"

type FinanceReportDownloadProps = {
  scope?: LedgerScope
  projectId?: string | number
  type?: ExportType
  compact?: boolean
  label?: string
}

export function FinanceReportDownload({
  scope,
  projectId,
  type,
  compact = false,
  label,
}: FinanceReportDownloadProps) {
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [month, setMonth] = useState("")
  const [loading, setLoading] = useState<ExportType | null>(null)

  function applyMonth(value: string) {
    setMonth(value)
    if (!value) return
    const [year, monthNum] = value.split("-").map(Number)
    if (!year || !monthNum) return
    const start = `${value}-01`
    const lastDay = new Date(year, monthNum, 0).getDate()
    const end = `${value}-${String(lastDay).padStart(2, "0")}`
    setFrom(start)
    setTo(end)
  }

  async function download(exportType: ExportType) {
    setLoading(exportType)
    try {
      const qs = new URLSearchParams()
      qs.set("type", exportType)
      if (scope) qs.set("scope", scope)
      if (projectId != null && projectId !== "") qs.set("projectId", String(projectId))
      if (from) qs.set("from", from)
      if (to) qs.set("to", to)

      const endpoint =
        exportType === "payments"
          ? `/api/admin/finance/payments-export?${qs.toString()}`
          : `/api/admin/finance/export?${qs.toString()}`
      const response = await apiFetch(endpoint)
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null
        throw new Error(data?.error ?? "Export failed")
      }

      const blob = await response.blob()
      const disposition = response.headers.get("Content-Disposition")
      const fileNameMatch = disposition?.match(/filename="(.+)"/)
      const fileName =
        fileNameMatch?.[1] ??
        `Finance_Report_${new Date().toISOString().slice(0, 10)}.xlsx`

      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = fileName
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
      toast.success("Report downloaded")
    } catch (error) {
      const isNetworkError =
        error instanceof TypeError && /failed to fetch|networkerror|load failed/i.test(error.message)
      toast.error(
        isNetworkError
          ? "Could not reach the server. Restart npm run dev and try again."
          : error instanceof Error
            ? error.message
            : "Failed to download report",
      )
    } finally {
      setLoading(null)
    }
  }

  const buttonLabel = label ?? (compact ? "Export Excel" : "Download Report")
  const isBusy = loading !== null

  if (compact || type) {
    const exportType = type ?? "all"
    return (
      <Button
        type="button"
        variant="outline"
        size={compact ? "sm" : "default"}
        disabled={isBusy}
        onClick={() => download(exportType)}
      >
        {isBusy ? <Loader2 className="animate-spin" /> : <FileSpreadsheet />}
        {buttonLabel}
      </Button>
    )
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
      <div>
        <p className="mb-1 text-xs text-muted-foreground">Month</p>
        <Input
          type="month"
          value={month}
          onChange={(e) => applyMonth(e.target.value)}
          className="w-[150px]"
        />
      </div>
      <div>
        <p className="mb-1 text-xs text-muted-foreground">From</p>
        <Input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="w-[150px]"
        />
      </div>
      <div>
        <p className="mb-1 text-xs text-muted-foreground">To</p>
        <Input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="w-[150px]"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={isBusy}
          onClick={() => download("payments")}
        >
          {loading === "payments" ? <Loader2 className="animate-spin" /> : <FileSpreadsheet />}
          Payment history
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={isBusy}
          onClick={() => download("all")}
        >
          {loading === "all" ? <Loader2 className="animate-spin" /> : <FileSpreadsheet />}
          Monthly report
        </Button>
        {scope !== "office" ? (
          <>
            <Button
              type="button"
              variant="outline"
              disabled={isBusy}
              onClick={() => download("income")}
            >
              {loading === "income" ? <Loader2 className="animate-spin" /> : <FileSpreadsheet />}
              Project income
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={isBusy}
              onClick={() => download("expense")}
            >
              {loading === "expense" ? <Loader2 className="animate-spin" /> : <FileSpreadsheet />}
              Project expenses
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={isBusy}
              onClick={() => download("profit")}
            >
              {loading === "profit" ? <Loader2 className="animate-spin" /> : <FileSpreadsheet />}
              Project profit
            </Button>
          </>
        ) : (
          <>
            <Button
              type="button"
              variant="outline"
              disabled={isBusy}
              onClick={() => download("income")}
            >
              {loading === "income" ? <Loader2 className="animate-spin" /> : <FileSpreadsheet />}
              Office income
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={isBusy}
              onClick={() => download("expense")}
            >
              {loading === "expense" ? <Loader2 className="animate-spin" /> : <FileSpreadsheet />}
              Office expenses
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
