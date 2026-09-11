"use client"

import { useMemo, useState, type ReactNode } from "react"
import { Download, FileSpreadsheet, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { FormSelect } from "@/components/form-select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { FinanceSelectOption } from "@/components/finance/finance-options"
import { apiFetch } from "@/lib/app-urls"
import type { LedgerScope } from "@/lib/finance/constants"

type ExportType = "all" | "income" | "expense" | "payments" | "profit"

const ALL = "all"

type FinanceReportDownloadProps = {
  scope?: LedgerScope
  projectId?: string | number
  type?: ExportType
  compact?: boolean
  label?: string
  clients?: FinanceSelectOption[]
  projects?: FinanceSelectOption[]
}

const PROJECT_REPORTS: { value: ExportType; label: string }[] = [
  { value: "all", label: "Monthly report" },
  { value: "payments", label: "Payment history" },
  { value: "income", label: "Project income" },
  { value: "expense", label: "Project expenses" },
  { value: "profit", label: "Project profit" },
]

const OFFICE_REPORTS: { value: ExportType; label: string }[] = [
  { value: "all", label: "Monthly report" },
  { value: "income", label: "Office income" },
  { value: "expense", label: "Office expenses" },
]

export function FinanceReportDownload({
  scope,
  projectId: lockedProjectId,
  type,
  compact = false,
  label,
  clients = [],
  projects = [],
}: FinanceReportDownloadProps) {
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [month, setMonth] = useState("")
  const [clientId, setClientId] = useState(ALL)
  const [selectedProjectId, setSelectedProjectId] = useState(
    lockedProjectId != null && lockedProjectId !== "" ? String(lockedProjectId) : ALL,
  )
  const [exportType, setExportType] = useState<ExportType>(type ?? "all")
  const [loading, setLoading] = useState<ExportType | null>(null)

  const showClientFilters = scope !== "office"
  const reportOptions = scope === "office" ? OFFICE_REPORTS : PROJECT_REPORTS
  const isBusy = loading !== null

  const clientOptions = useMemo(
    () => [{ value: ALL, label: "All clients" }, ...clients],
    [clients],
  )

  const projectOptions = useMemo(() => {
    const filtered =
      clientId !== ALL
        ? projects.filter((project) => project.clientId === clientId)
        : projects
    return [{ value: ALL, label: "All projects" }, ...filtered]
  }, [projects, clientId])

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

  function handleClientChange(value: string | null) {
    const next = value || ALL
    setClientId(next)
    if (lockedProjectId != null && lockedProjectId !== "") return
    if (selectedProjectId === ALL) return
    const project = projects.find((item) => item.value === selectedProjectId)
    if (next !== ALL && project?.clientId !== next) {
      setSelectedProjectId(ALL)
    }
  }

  async function download(nextType: ExportType) {
    setLoading(nextType)
    try {
      const qs = new URLSearchParams()
      qs.set("type", nextType)
      if (scope) qs.set("scope", scope)
      const projectId =
        lockedProjectId != null && lockedProjectId !== ""
          ? String(lockedProjectId)
          : selectedProjectId !== ALL
            ? selectedProjectId
            : ""
      if (projectId) qs.set("projectId", projectId)
      if (showClientFilters && clientId !== ALL) qs.set("clientId", clientId)
      if (from) qs.set("from", from)
      if (to) qs.set("to", to)

      const endpoint =
        nextType === "payments"
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
        fileNameMatch?.[1] ?? `Finance_Report_${new Date().toISOString().slice(0, 10)}.xlsx`

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

  const buttonLabel = label ?? (compact ? "Export Excel" : "Download Excel")

  if (compact || type) {
    const nextType = type ?? "all"
    return (
      <Button
        type="button"
        variant="outline"
        size={compact ? "sm" : "default"}
        disabled={isBusy}
        onClick={() => download(nextType)}
      >
        {isBusy ? <Loader2 className="animate-spin" /> : <FileSpreadsheet />}
        {buttonLabel}
      </Button>
    )
  }

  const selectedReport = reportOptions.find((option) => option.value === exportType)
  const selectedClient = clientOptions.find((option) => option.value === clientId)
  const selectedProject = projectOptions.find((option) => option.value === selectedProjectId)

  return (
    <div className="rounded-xl border border-border/60 bg-card p-5 shadow-premium">
      <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <FileSpreadsheet className="size-4" />
          </div>
          <div>
            <p className="text-sm font-semibold">Download reports</p>
            <p className="text-xs text-muted-foreground">
              {showClientFilters
                ? "Choose a client and report type, then download Excel"
                : "Choose a report type and date range, then download Excel"}
            </p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {selectedReport?.label}
          {showClientFilters ? ` · ${selectedClient?.label ?? "All clients"}` : ""}
          {showClientFilters && selectedProjectId !== ALL
            ? ` · ${selectedProject?.label ?? "Project"}`
            : ""}
        </p>
      </div>

      <div className={showClientFilters ? "grid gap-3 md:grid-cols-2 xl:grid-cols-3" : "grid gap-3 sm:grid-cols-2"}>
        {showClientFilters ? (
          <>
            <Field label="Client">
              <FormSelect
                options={clientOptions}
                value={clientId}
                onValueChange={handleClientChange}
                placeholder="All clients"
                searchable
                searchPlaceholder="Search client..."
                disabled={isBusy}
              />
            </Field>
            <Field label="Project">
              <FormSelect
                options={projectOptions}
                value={selectedProjectId}
                onValueChange={(value) => setSelectedProjectId(value || ALL)}
                placeholder="All projects"
                searchable
                searchPlaceholder="Search project..."
                disabled={isBusy || lockedProjectId != null}
                emptyMessage="No projects for this client"
              />
            </Field>
          </>
        ) : null}

        <Field label="Report">
          <FormSelect
            options={reportOptions}
            value={exportType}
            onValueChange={(value) => {
              if (value) setExportType(value as ExportType)
            }}
            placeholder="Select report"
            disabled={isBusy}
          />
        </Field>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto]">
        <Field label="Month">
          <Input
            type="month"
            value={month}
            onChange={(e) => applyMonth(e.target.value)}
            disabled={isBusy}
          />
        </Field>
        <Field label="From">
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            disabled={isBusy}
          />
        </Field>
        <Field label="To">
          <Input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            disabled={isBusy}
          />
        </Field>
        <div className="flex items-end">
          <Button
            type="button"
            className="w-full min-w-[10.5rem]"
            disabled={isBusy}
            onClick={() => download(exportType)}
          >
            {isBusy ? <Loader2 className="animate-spin" /> : <Download />}
            {buttonLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="mb-1 text-xs text-muted-foreground">{label}</p>
      {children}
    </div>
  )
}
