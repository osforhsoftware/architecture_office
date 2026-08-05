"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import type { LateComingInfo } from "@/lib/attendance/types"

const SESSION_KEY = "ao_late_alert_dismissed"

export function LateComingAlert({
  lateInfo,
  officeDate,
}: {
  lateInfo: LateComingInfo
  officeDate: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!lateInfo.isLateWindow) {
      setOpen(false)
      return
    }
    try {
      const dismissed = sessionStorage.getItem(SESSION_KEY)
      if (dismissed === officeDate) {
        setOpen(false)
        return
      }
    } catch {
      /* ignore */
    }
    setOpen(true)
  }, [lateInfo.isLateWindow, officeDate])

  function dismiss() {
    try {
      sessionStorage.setItem(SESSION_KEY, officeDate)
    } catch {
      /* ignore */
    }
    setOpen(false)
  }

  if (!lateInfo.isLateWindow) return null

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : dismiss())}>
      <DialogContent className="sm:max-w-md" showCloseButton>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="size-5" />
            Late Coming
          </DialogTitle>
          <DialogDescription className="text-left">
            {lateInfo.message}
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-sm">
          <p>
            Office start: <span className="font-medium">{lateInfo.officeStartTime}</span>
          </p>
          <p className="mt-1">
            Buffer: <span className="font-medium">{lateInfo.bufferMinutes} min</span>
          </p>
          <p className="mt-1">
            Late after: <span className="font-medium">{lateInfo.lateAfterTime}</span>
          </p>
        </div>
        <DialogFooter className="gap-2 sm:justify-end">
          <Button type="button" variant="outline" onClick={dismiss}>
            Dismiss
          </Button>
          <Button
            type="button"
            onClick={() => {
              dismiss()
              router.push("/staff/attendance")
            }}
          >
            Go to Attendance
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
