"use client"

import { Loader2 } from "lucide-react"
import { useTableParams } from "@/components/use-table-params"

export function TableLoadingOverlay({ children }: { children: React.ReactNode }) {
  const { isPending } = useTableParams()

  return (
    <div className="relative">
      {isPending ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center rounded-xl bg-background/60 backdrop-blur-[1px]">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      ) : null}
      <div className={isPending ? "pointer-events-none opacity-60" : undefined}>{children}</div>
    </div>
  )
}
