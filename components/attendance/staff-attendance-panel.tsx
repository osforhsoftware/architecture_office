"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2, Clock3, Loader2, LogIn, LogOut } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { LocationHelpModal } from "@/components/attendance/location-help-modal"
import { LocationStatusCard } from "@/components/attendance/location-status-card"
import { useStaffLocation } from "@/components/attendance/use-staff-location"
import { checkInAction, checkOutAction } from "@/lib/attendance/actions"
import { outsideOfficeMessage } from "@/lib/attendance/constants"
import { formatOfficeTime } from "@/lib/attendance/datetime"
import { formatDistanceLabel } from "@/lib/attendance/geo"
import { browserDeviceInfo } from "@/lib/attendance/location"
import type { AttendanceRecord, AttendanceSettings } from "@/lib/attendance/types"

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
  const [now, setNow] = useState<Date | null>(null)
  const [helpOpen, setHelpOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  const location = useStaffLocation({
    latitude: settings.latitude,
    longitude: settings.longitude,
    radiusMeters: settings.radius_meters,
  })

  useEffect(() => {
    setNow(new Date())
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const hasCheckIn = Boolean(todayRecord?.check_in)
  const hasCheckOut = Boolean(todayRecord?.check_out)
  const statusLabel = !hasCheckIn
    ? "Absent"
    : todayRecord?.status === "Late Coming"
      ? "Late Coming"
      : "Present"

  const canCheckIn = location.locationReady && !hasCheckIn && !pending && !location.checking
  const canCheckOut =
    location.locationReady && hasCheckIn && !hasCheckOut && !pending && !location.checking

  async function submitPunch(action: "in" | "out") {
    const fresh = await location.requestLocation("punch")
    if (!fresh.ok || !fresh.coords) {
      toast.error(
        fresh.message ||
          (fresh.state === "outside_geofence"
            ? outsideOfficeMessage(settings.radius_meters)
            : "GPS location is required for attendance."),
      )
      return
    }
    if (!fresh.insideGeofence) {
      toast.error(outsideOfficeMessage(settings.radius_meters))
      return
    }

    const fd = new FormData()
    fd.set("latitude", String(fresh.coords.lat))
    fd.set("longitude", String(fresh.coords.lng))
    fd.set("device_info", browserDeviceInfo())
    if (fresh.accuracy != null) fd.set("accuracy", String(fresh.accuracy))

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
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">
          Today&apos;s Attendance
        </p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">Check In / Out</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Location-verified office attendance. Manual entry is not allowed.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Office start {settings.office_start_time} · Buffer {settings.buffer_minutes} min · Radius{" "}
          {settings.radius_meters} m
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-border/50 bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">Current Date</p>
            <p className="mt-1 text-sm font-medium">
              {now ? formatDateLabel(now) : officeDate}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">{officeDate}</p>
          </div>
          <div className="rounded-lg border border-border/50 bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">Current Time</p>
            <p className="mt-1 flex items-center gap-2 text-lg font-semibold tabular-nums">
              <Clock3 className="size-4 text-primary" />
              {now ? formatClock(now) : "—"}
            </p>
          </div>
        </div>
      </div>

      <LocationStatusCard
        state={location.state}
        permission={location.permission}
        distance={location.distance}
        accuracy={location.accuracy}
        radiusMeters={settings.radius_meters}
        platform={location.platform}
        checking={location.checking}
        message={location.message}
        hasCheckIn={hasCheckIn}
        hasCheckOut={hasCheckOut}
        onCheckLocation={() => {
          void location.requestLocation("user")
        }}
        onOpenHelp={() => setHelpOpen(true)}
      />

      {hasCheckIn && !hasCheckOut ? (
        <div className="rounded-xl border border-border/60 bg-card p-5 shadow-premium">
          <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="size-4" />
            Checked In
          </p>
          <div className="mt-3 grid gap-2 text-sm">
            <p>
              Check-in time{" "}
              <span className="font-semibold">{formatOfficeTime(todayRecord?.check_in ?? null)}</span>
            </p>
            <p>
              Location{" "}
              <span className="font-semibold">
                {todayRecord?.distance_from_office != null
                  ? `${formatDistanceLabel(todayRecord.distance_from_office)} from office`
                  : "—"}
              </span>
            </p>
          </div>
          {canCheckOut ? (
            <Button
              type="button"
              size="lg"
              className="mt-4 h-12 w-full"
              onClick={() => void submitPunch("out")}
            >
              {pending ? <Loader2 className="animate-spin" /> : <LogOut />}
              Check Out
            </Button>
          ) : (
            <p className="mt-3 text-xs text-muted-foreground">
              Check Out is available only after your current location is verified inside the office
              area.
            </p>
          )}
        </div>
      ) : null}

      {!hasCheckIn ? (
        <div>
          <Button
            type="button"
            size="lg"
            className="h-12 w-full"
            disabled={!canCheckIn}
            onClick={() => void submitPunch("in")}
          >
            {pending ? <Loader2 className="animate-spin" /> : <LogIn />}
            Check In
          </Button>
          {!canCheckIn ? (
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Check In stays disabled until your location is verified inside the office area.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="rounded-xl border border-border/60 bg-card p-5 shadow-premium">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium">Today&apos;s record</p>
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

      <LocationHelpModal
        open={helpOpen}
        onOpenChange={setHelpOpen}
        platform={location.platform}
      />
    </div>
  )
}
