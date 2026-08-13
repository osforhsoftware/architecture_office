"use client"

import {
  CircleAlert,
  Loader2,
  MapPin,
  MapPinOff,
  Navigation,
  ShieldAlert,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatDistanceLabel } from "@/lib/attendance/geo"
import {
  locationButtonKind,
  locationButtonLabel,
  type GeolocationPermissionState,
  type LocationPlatform,
  type LocationState,
} from "@/lib/attendance/location"
import { cn } from "@/lib/utils"

function StatusIcon({ state, checking }: { state: LocationState; checking: boolean }) {
  if (checking || state === "requesting") {
    return <Loader2 className="size-5 shrink-0 animate-spin text-primary" />
  }
  if (state === "inside_geofence") {
    return <MapPin className="size-5 shrink-0 text-emerald-600" />
  }
  if (state === "outside_geofence" || state === "poor_accuracy") {
    return <MapPinOff className="size-5 shrink-0 text-amber-600" />
  }
  if (state === "denied" || state === "https_required" || state === "unsupported") {
    return <ShieldAlert className="size-5 shrink-0 text-destructive" />
  }
  return <CircleAlert className="size-5 shrink-0 text-destructive" />
}

function titleForState(
  state: LocationState,
  checking: boolean,
  checkedInOutside: boolean,
): string {
  if (checking || state === "requesting") return "Checking location…"
  switch (state) {
    case "inside_geofence":
      return "Location verified"
    case "outside_geofence":
      return checkedInOutside ? "You are outside the office" : "Outside Office"
    case "poor_accuracy":
      return "Location accuracy is too low"
    case "denied":
      return "Location permission is required"
    case "prompt":
      return "Allow Location Access"
    case "granted":
      return "Location permission allowed"
    case "unavailable":
      return "Unable to get your current location"
    case "timeout":
      return "Location request timed out"
    case "https_required":
      return "Secure connection required"
    case "unsupported":
      return "Location is not supported"
    case "initial":
      return "Location status"
    default:
      return "Location status"
  }
}

export function LocationStatusCard({
  state,
  permission,
  distance,
  accuracy,
  radiusMeters,
  platform,
  checking,
  message,
  hasCheckIn = false,
  hasCheckOut = false,
  onCheckLocation,
  onOpenHelp,
}: {
  state: LocationState
  permission: GeolocationPermissionState
  distance: number | null
  accuracy: number | null
  radiusMeters: number
  platform: LocationPlatform
  checking: boolean
  message: string | null
  hasCheckIn?: boolean
  hasCheckOut?: boolean
  onCheckLocation: () => void
  onOpenHelp: () => void
}) {
  const kind = locationButtonKind(state, checking)
  const buttonLabel = locationButtonLabel(kind)
  const checkedInOutside =
    hasCheckIn && !hasCheckOut && state === "outside_geofence" && distance != null
  const showHelp =
    state === "denied" ||
    state === "unavailable" ||
    state === "timeout" ||
    state === "poor_accuracy" ||
    state === "https_required" ||
    state === "unsupported" ||
    permission === "denied"

  const tone =
    state === "inside_geofence"
      ? "ok"
      : state === "outside_geofence" || state === "poor_accuracy"
        ? "warn"
        : state === "requesting" || state === "prompt" || state === "granted" || state === "initial"
          ? "neutral"
          : "error"

  return (
    <div className="rounded-xl border border-border/60 bg-card p-5 shadow-premium">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            Location Status
          </p>
          <div className="mt-2 flex items-start gap-2.5">
            <StatusIcon state={state} checking={checking} />
            <div className="min-w-0">
              <p
                className={cn(
                  "text-sm font-semibold",
                  tone === "ok" && "text-emerald-700 dark:text-emerald-400",
                  tone === "warn" && "text-amber-700 dark:text-amber-400",
                  tone === "error" && "text-destructive",
                )}
              >
                {titleForState(state, checking, checkedInOutside)}
              </p>
              {accuracy != null && (state === "inside_geofence" || state === "poor_accuracy") ? (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Accuracy ±{Math.round(accuracy)} m
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {state === "inside_geofence" && distance != null ? (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm dark:border-emerald-900/60 dark:bg-emerald-950/40">
          <p>
            Distance from office{" "}
            <span className="font-semibold tabular-nums">
              {Math.round(distance)} m / {radiusMeters} m
            </span>
          </p>
          <p className="mt-2 font-medium text-emerald-800 dark:text-emerald-300">
            You are inside the office area.
          </p>
        </div>
      ) : null}

      {checkedInOutside ? (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-900/60 dark:bg-amber-950/40">
          <p>
            Current distance:{" "}
            <span className="font-semibold tabular-nums">{formatDistanceLabel(distance)}</span>
          </p>
          <p className="mt-1">
            Allowed radius:{" "}
            <span className="font-semibold tabular-nums">{radiusMeters} m</span>
          </p>
          <p className="mt-2 font-medium text-amber-900 dark:text-amber-200">
            You cannot check out from this location.
          </p>
          <p className="mt-2 text-amber-900/90 dark:text-amber-200/90">
            If you have left the office for official work, please contact the administrator to
            complete your attendance.
          </p>
        </div>
      ) : null}

      {state === "outside_geofence" && distance != null && !checkedInOutside ? (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-900/60 dark:bg-amber-950/40">
          <p>
            Your distance:{" "}
            <span className="font-semibold tabular-nums">{formatDistanceLabel(distance)}</span>
          </p>
          <p className="mt-1">
            Allowed radius:{" "}
            <span className="font-semibold tabular-nums">{radiusMeters} m</span>
          </p>
          <p className="mt-2 text-amber-900 dark:text-amber-200">
            Move within the office area to continue.
          </p>
        </div>
      ) : null}

      {state === "poor_accuracy" ? (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-900/60 dark:bg-amber-950/40">
          <p className="font-medium text-amber-900 dark:text-amber-200">
            Your location accuracy is too low.
          </p>
          <p className="mt-2 text-amber-900/90 dark:text-amber-200/90">
            Please enable high-accuracy Location Services and try again.
          </p>
        </div>
      ) : null}

      {state === "denied" ? (
        <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
          <p className="text-muted-foreground">
            Your browser has not allowed this website to access your location.
          </p>
          <p className="mt-2 text-muted-foreground">
            Please allow Location permission for this website, and turn on Location/GPS in device
            settings.
          </p>
        </div>
      ) : null}

      {state === "prompt" || (state === "requesting" && permission === "prompt") ? (
        <div className="mt-4 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
          <p className="font-medium">Allow Location Access</p>
          <p className="mt-1 text-muted-foreground">
            Your browser needs permission to use your location for attendance. Choose Allow when
            prompted.
          </p>
        </div>
      ) : null}

      {state === "unavailable" ? (
        <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
          {message ? <p className="mb-2 text-muted-foreground">{message}</p> : null}
          <p className="text-muted-foreground">Please:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
            <li>Turn on Location/GPS</li>
            <li>Check browser location permission</li>
            <li>Move to an area with better GPS signal</li>
            {platform === "windows" || platform === "desktop" ? (
              <li>Enable Windows Location: Settings → Privacy &amp; security → Location</li>
            ) : null}
            <li>Try again</li>
          </ul>
        </div>
      ) : null}

      {state === "timeout" ? (
        <p className="mt-4 text-sm text-muted-foreground">
          {message ||
            "Location request timed out. Please move to an area with better GPS/network signal and try again."}
        </p>
      ) : null}

      {state === "https_required" ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Location access requires a secure connection (HTTPS). Please open this site using HTTPS.
        </p>
      ) : null}

      {state === "unsupported" ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Location is not supported by this browser. Please use Chrome, Edge, Safari, or another
          browser with location support.
        </p>
      ) : null}

      {state === "granted" && !checking ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Location permission is allowed. Tap Check Location to verify you are inside the office
          area.
        </p>
      ) : null}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          className="h-11 w-full sm:w-auto"
          disabled={checking}
          onClick={onCheckLocation}
        >
          {checking ? <Loader2 className="animate-spin" /> : <Navigation />}
          {buttonLabel}
        </Button>
        {showHelp ? (
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full sm:w-auto"
            onClick={onOpenHelp}
            disabled={checking}
          >
            How to Enable Location
          </Button>
        ) : null}
      </div>
    </div>
  )
}
