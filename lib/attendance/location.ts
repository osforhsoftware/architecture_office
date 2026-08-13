/**
 * Client-only GPS / location helpers for staff attendance.
 * Do not import from server code.
 */

import { haversineDistanceMeters, isGpsAccuracyTooPoor, isValidCoordinate } from "./geo"

export const GEO_OPTIONS = {
  enableHighAccuracy: true,
  timeout: 15_000,
  maximumAge: 0,
} as const satisfies PositionOptions

/** Extra watchdog beyond the Geolocation timeout in case a browser never settles. */
const GEO_WATCHDOG_MS = 16_000

export type LocationState =
  | "initial"
  | "requesting"
  | "granted"
  | "denied"
  | "prompt"
  | "unavailable"
  | "timeout"
  | "outside_geofence"
  | "inside_geofence"
  | "poor_accuracy"
  | "unsupported"
  | "https_required"

export type GeolocationPermissionState = "granted" | "denied" | "prompt" | "unknown"

export type LocationPlatform = "android" | "ios" | "windows" | "desktop" | "unknown"

export type LocationButtonKind = "check" | "checking" | "ready" | "retry"

export type LocationRequestReason =
  | "auto"
  | "user"
  | "permission-change"
  | "visibility"
  | "punch"

export interface LocationCoords {
  lat: number
  lng: number
}

export interface LocationFix {
  coords: LocationCoords
  accuracy: number | null
  distance: number
  insideGeofence: boolean
  accuracyTooPoor: boolean
}

export function isGeolocationSupported(): boolean {
  return typeof navigator !== "undefined" && "geolocation" in navigator && !!navigator.geolocation
}

/** localhost HTTP counts as secure; LAN IP HTTP does not. */
export function isSecureLocationContext(): boolean {
  return typeof window !== "undefined" && window.isSecureContext === true
}

export function detectLocationPlatform(): LocationPlatform {
  if (typeof navigator === "undefined") return "unknown"
  const ua = navigator.userAgent || ""
  if (/android/i.test(ua)) return "android"
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios"
  if (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1) return "ios"
  if (/Windows/i.test(ua)) return "windows"
  if (/Mac OS X|Linux/i.test(ua)) return "desktop"
  return "unknown"
}

export function browserDeviceInfo(): string {
  if (typeof navigator === "undefined") return ""
  return navigator.userAgent.slice(0, 500)
}

export async function queryGeolocationPermission(): Promise<GeolocationPermissionState> {
  try {
    if (typeof navigator === "undefined" || !navigator.permissions?.query) {
      return "unknown"
    }
    const status = await navigator.permissions.query({ name: "geolocation" })
    if (status.state === "granted" || status.state === "denied" || status.state === "prompt") {
      return status.state
    }
    return "unknown"
  } catch {
    return "unknown"
  }
}

export async function subscribeGeolocationPermission(
  onChange: (state: GeolocationPermissionState) => void,
): Promise<() => void> {
  try {
    if (typeof navigator === "undefined" || !navigator.permissions?.query) {
      return () => undefined
    }
    const status = await navigator.permissions.query({ name: "geolocation" })
    const handler = () => {
      if (status.state === "granted" || status.state === "denied" || status.state === "prompt") {
        onChange(status.state)
      } else {
        onChange("unknown")
      }
    }
    status.onchange = handler
    return () => {
      if (status.onchange === handler) status.onchange = null
    }
  } catch {
    return () => undefined
  }
}

export function getFreshPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!isGeolocationSupported()) {
      reject(makeGeoError(0, "Location is not supported by this browser."))
      return
    }

    let settled = false
    const finish = (cb: () => void) => {
      if (settled) return
      settled = true
      window.clearTimeout(watchdog)
      cb()
    }

    const watchdog = window.setTimeout(() => {
      finish(() => reject(makeGeoError(3, "Location request timed out.")))
    }, GEO_WATCHDOG_MS)

    navigator.geolocation.getCurrentPosition(
      (pos) => finish(() => resolve(pos)),
      (err) => finish(() => reject(err)),
      GEO_OPTIONS,
    )
  })
}

export function evaluateFix(
  latitude: number,
  longitude: number,
  accuracy: number | null,
  officeLat: number,
  officeLng: number,
  radiusMeters: number,
): LocationFix | null {
  if (!isValidCoordinate(latitude, longitude)) return null
  const meters = haversineDistanceMeters(latitude, longitude, officeLat, officeLng)
  const distance = Math.round(meters * 100) / 100
  const resolvedAccuracy = accuracy != null && Number.isFinite(accuracy) ? accuracy : null
  const accuracyTooPoor = isGpsAccuracyTooPoor(resolvedAccuracy, radiusMeters)
  return {
    coords: { lat: latitude, lng: longitude },
    accuracy: resolvedAccuracy,
    distance,
    accuracyTooPoor,
    insideGeofence: !accuracyTooPoor && distance <= radiusMeters,
  }
}

export function mapGeolocationError(
  error: unknown,
  platform: LocationPlatform,
): { state: Extract<LocationState, "denied" | "unavailable" | "timeout">; message: string } {
  const code = geoErrorCode(error)

  if (code === 1) {
    return {
      state: "denied",
      message: "Location permission was denied. Please allow location access and try again.",
    }
  }

  if (code === 3) {
    return {
      state: "timeout",
      message:
        "Location request timed out. Please move to an area with better GPS/network signal and try again.",
    }
  }

  // code 2 POSITION_UNAVAILABLE, or unknown
  if (platform === "windows" || platform === "desktop") {
    return {
      state: "unavailable",
      message:
        "Unable to determine your current location. Please enable Windows Location Services and browser location permission, then try again.",
    }
  }

  return {
    state: "unavailable",
    message:
      "Your current location could not be determined. Please enable GPS/Location Services and try again.",
  }
}

export function locationButtonKind(
  state: LocationState,
  checking: boolean,
): LocationButtonKind {
  if (checking || state === "requesting") return "checking"
  if (state === "inside_geofence") return "ready"
  if (
    state === "denied" ||
    state === "unavailable" ||
    state === "timeout" ||
    state === "poor_accuracy" ||
    state === "https_required" ||
    state === "unsupported"
  ) {
    return "retry"
  }
  return "check"
}

export function locationButtonLabel(kind: LocationButtonKind): string {
  switch (kind) {
    case "checking":
      return "Checking Location..."
    case "ready":
      return "Location Ready"
    case "retry":
      return "Try Again"
    default:
      return "Check Location"
  }
}

export function logLocationDebug(info: {
  permission: GeolocationPermissionState
  hasLat: boolean
  hasLng: boolean
  accuracy: number | null
  distance: number | null
  geofence: "inside" | "outside" | "n/a"
  state: LocationState
}): void {
  if (process.env.NODE_ENV !== "development") return
  console.info("[attendance-location]", {
    "Location permission": info.permission,
    Latitude: info.hasLat ? "available" : "unavailable",
    Longitude: info.hasLng ? "available" : "unavailable",
    Accuracy: info.accuracy != null ? `${Math.round(info.accuracy)}m` : "n/a",
    Distance: info.distance != null ? `${Math.round(info.distance)}m` : "n/a",
    Geofence: info.geofence,
    State: info.state,
  })
}

function geoErrorCode(error: unknown): number {
  if (error && typeof error === "object" && "code" in error) {
    const code = Number((error as { code: unknown }).code)
    if (Number.isFinite(code)) return code
  }
  return 2
}

function makeGeoError(code: number, message: string): GeolocationPositionError {
  const err = new Error(message) as Error & { code: number; PERMISSION_DENIED: number; POSITION_UNAVAILABLE: number; TIMEOUT: number }
  err.code = code
  err.PERMISSION_DENIED = 1
  err.POSITION_UNAVAILABLE = 2
  err.TIMEOUT = 3
  return err as GeolocationPositionError
}
