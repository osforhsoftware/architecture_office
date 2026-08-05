"use client"

import { useCallback, useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  CheckCircle2,
  Clock3,
  Loader2,
  MapPin,
  MapPinOff,
  LogIn,
  LogOut,
  Navigation,
} from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { checkInAction, checkOutAction } from "@/lib/attendance/actions"
import { haversineDistanceMeters } from "@/lib/attendance/geo"
import { OUTSIDE_OFFICE_MESSAGE } from "@/lib/attendance/constants"
import { formatOfficeTime } from "@/lib/attendance/datetime"
import type { AttendanceRecord, AttendanceSettings } from "@/lib/attendance/types"
import { cn } from "@/lib/utils"

type GpsStatus = "idle" | "requesting" | "ready" | "denied" | "error" | "unsupported"

function deviceInfo(): string {
  if (typeof navigator === "undefined") return ""
  return navigator.userAgent.slice(0, 500)
}

function formatClock(date: Date): string {
  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  })
}

function formatDateLabel(date: Date): string {
  return date.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  })
}

function gpsLabel(status: GpsStatus): string {
  switch (status) {
    case "requesting":
      return "Requesting permission…"
    case "ready":
      return "GPS ready"
    case "denied":
      return "Permission denied"
    case "error":
      return "GPS unavailable"
    case "unsupported":
      return "Not supported"
    default:
      return "Waiting…"
  }
}

export function StaffAttendancePanel({
  settings,
  todayRecord,
  officeDate,
}: {
  settings: AttendanceSettings
  todayRecord: AttendanceRecord | null
  officeDate: string
}) {
  const router = useRouter()
  const [now, setNow] = useState(() => new Date())
  const [gpsStatus, setGpsStatus] = useState<GpsStatus>("idle")
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [distance, setDistance] = useState<number | null>(null)
  const [accuracy, setAccuracy] = useState<number | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const refreshGps = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGpsStatus("unsupported")
      setCoords(null)
      setDistance(null)
      return
    }

    setGpsStatus("requesting")
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        const meters = haversineDistanceMeters(
          lat,
          lng,
          settings.latitude,
          settings.longitude,
        )
        setCoords({ lat, lng })
        setDistance(Math.round(meters * 100) / 100)
        setAccuracy(pos.coords.accuracy)
        setGpsStatus("ready")
      },
      (err) => {
        setCoords(null)
        setDistance(null)
        setAccuracy(null)
        setGpsStatus(err.code === err.PERMISSION_DENIED ? "denied" : "error")
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    )
  }, [settings.latitude, settings.longitude])

  useEffect(() => {
    refreshGps()
  }, [refreshGps])

  const withinRange =
    distance !== null && distance <= settings.radius_meters && gpsStatus === "ready"
  const hasCheckIn = Boolean(todayRecord?.check_in)
  const hasCheckOut = Boolean(todayRecord?.check_out)
  const statusLabel = !hasCheckIn
    ? "Absent"
    : todayRecord?.status === "Late Coming"
      ? "Late Coming"
      : "Present"

  function submitPunch(action: "in" | "out") {
    if (!coords) {
      toast.error("GPS location is required for attendance.")
      refreshGps()
      return
    }
    if (!withinRange) {
      toast.error(OUTSIDE_OFFICE_MESSAGE)
      return
    }

    const fd = new FormData()
    fd.set("latitude", String(coords.lat))
    fd.set("longitude", String(coords.lng))
    fd.set("device_info", deviceInfo())

    startTransition(async () => {
      const result = action === "in" ? await checkInAction(fd) : await checkOutAction(fd)
      if (result?.error) {
        toast.error(result.error)
        return
      }
      if (action === "in" && "status" in result && result.status === "Late Coming") {
        toast.warning("Checked in — marked as Late Coming")
      } else {
        toast.success(action === "in" ? "Checked in successfully" : "Checked out successfully")
      }
      router.refresh()
    })
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4">
      <div className="rounded-xl border border-border/60 bg-card p-5 shadow-premium">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">Attendance</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">Check In / Out</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Location-verified office attendance. Manual entry is not allowed.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Office start {settings.office_start_time} · Buffer {settings.buffer_minutes} min
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-border/50 bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">Current Date</p>
            <p className="mt-1 text-sm font-medium">{formatDateLabel(now)}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{officeDate}</p>
          </div>
          <div className="rounded-lg border border-border/50 bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">Current Time</p>
            <p className="mt-1 flex items-center gap-2 text-lg font-semibold tabular-nums">
              <Clock3 className="size-4 text-primary" />
              {formatClock(now)}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-card p-5 shadow-premium">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium">GPS Status</p>
            <p
              className={cn(
                "mt-1 text-sm",
                gpsStatus === "ready" ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground",
              )}
            >
              {gpsLabel(gpsStatus)}
              {accuracy != null && gpsStatus === "ready"
                ? ` · ±${Math.round(accuracy)} m`
                : null}
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={refreshGps} disabled={pending}>
            <Navigation className="size-3.5" />
            Refresh
          </Button>
        </div>

        <div className="mt-4 flex items-center gap-3 rounded-lg border border-border/50 bg-muted/20 p-3">
          {withinRange ? (
            <MapPin className="size-5 shrink-0 text-emerald-600" />
          ) : (
            <MapPinOff className="size-5 shrink-0 text-destructive" />
          )}
          <div className="min-w-0">
            <p className="text-sm font-medium">Office Distance</p>
            <p className="text-sm text-muted-foreground">
              {distance === null
                ? "—"
                : `${distance.toFixed(0)} m (allowed ${settings.radius_meters} m)`}
            </p>
          </div>
        </div>

        {!withinRange && gpsStatus === "ready" ? (
          <p className="mt-3 text-sm text-destructive">{OUTSIDE_OFFICE_MESSAGE}</p>
        ) : null}
        {gpsStatus === "denied" ? (
          <p className="mt-3 text-sm text-destructive">
            Enable location permission in your browser to mark attendance.
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Button
          type="button"
          size="lg"
          className="h-12"
          disabled={pending || !withinRange || hasCheckIn}
          onClick={() => submitPunch("in")}
        >
          {pending ? <Loader2 className="animate-spin" /> : <LogIn />}
          Check In
        </Button>
        <Button
          type="button"
          size="lg"
          variant="outline"
          className="h-12"
          disabled={pending || !withinRange || !hasCheckIn || hasCheckOut}
          onClick={() => submitPunch("out")}
        >
          {pending ? <Loader2 className="animate-spin" /> : <LogOut />}
          Check Out
        </Button>
      </div>

      <div className="rounded-xl border border-border/60 bg-card p-5 shadow-premium">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium">Today&apos;s Attendance</p>
          <Badge
            variant={
              statusLabel === "Late Coming"
                ? "destructive"
                : hasCheckIn
                  ? "default"
                  : "secondary"
            }
          >
            {statusLabel}
          </Badge>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-border/50 p-3">
            <p className="text-xs text-muted-foreground">Check In Time</p>
            <p className="mt-1 flex items-center gap-2 text-sm font-semibold">
              {hasCheckIn ? <CheckCircle2 className="size-4 text-emerald-600" /> : null}
              {formatOfficeTime(todayRecord?.check_in ?? null)}
            </p>
          </div>
          <div className="rounded-lg border border-border/50 p-3">
            <p className="text-xs text-muted-foreground">Check Out Time</p>
            <p className="mt-1 text-sm font-semibold">
              {formatOfficeTime(todayRecord?.check_out ?? null)}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
