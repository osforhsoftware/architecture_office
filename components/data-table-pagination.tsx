"use client"

import { useMemo } from "react"
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { FormSelect } from "@/components/form-select"
import { PAGE_SIZE_OPTIONS } from "@/lib/pagination"
import { useTableParams } from "@/components/use-table-params"

interface DataTablePaginationProps {
  total: number
  page: number
  pageSize: number
  totalPages: number
  entityLabel?: string
  searchActive?: boolean
}

export function DataTablePagination({
  total,
  page,
  pageSize,
  totalPages,
  entityLabel = "record",
  searchActive = false,
}: DataTablePaginationProps) {
  const { updateParams, isPending } = useTableParams()
  const pageSizeOptions = useMemo(
    () =>
      PAGE_SIZE_OPTIONS.map((size) => ({
        value: String(size),
        label: size === "all" ? "All" : `${size} / page`,
      })),
    [],
  )
  const plural = total === 1 ? entityLabel : `${entityLabel}s`
  const countLabel = searchActive
    ? `${total} matching ${plural}`
    : `${total} total ${plural}`

  function onPageSizeChange(next: string | null) {
    if (!next) return
    updateParams({ pageSize: next, page: "1" })
  }

  function goToPage(nextPage: number) {
    updateParams({ page: String(nextPage) })
  }

  return (
    <div className="flex flex-col gap-3 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {isPending ? (
          <span className="inline-flex items-center gap-1.5 text-primary">
            <Loader2 className="size-3.5 animate-spin" />
            Loading…
          </span>
        ) : null}
        <span>{countLabel}</span>
        <span aria-hidden="true">·</span>
        <span>
          Page {page} of {totalPages}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <FormSelect
          className="h-8 w-[110px] text-xs"
          value={pageSize === -1 ? "all" : String(pageSize)}
          onValueChange={onPageSizeChange}
          placeholder="Page size"
          options={pageSizeOptions}
        />

        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() => goToPage(page - 1)}
            disabled={page <= 1 || isPending}
            aria-label="Previous page"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() => goToPage(page + 1)}
            disabled={page >= totalPages || isPending}
            aria-label="Next page"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
