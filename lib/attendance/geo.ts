import { DEFAULT_ATTENDANCE_SETTINGS } from "./constants"

/**
 * Haversine distance in meters between two WGS84 coordinates.
 */
export function haversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const R = 6371000
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

export function isValidCoordinate(lat: unknown, lng: unknown): lat is number {
  if (typeof lat !== "number" || typeof lng !== "number") return false
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false
  if (lat < -90 || lat > 90) return false
  if (lng < -180 || lng > 180) return false
  return true
}

/** Cap for obviously unusable GPS. Indoor readings (~20–150 m) must still pass. */
export const MAX_GPS_ACCURACY_METERS = 1500

export function gpsAccuracyThresholdMeters(radiusMeters: number): number {
  const radius =
    Number.isFinite(radiusMeters) && radiusMeters > 0
      ? radiusMeters
      : DEFAULT_ATTENDANCE_SETTINGS.radius_meters
  return Math.min(MAX_GPS_ACCURACY_METERS, Math.max(250, radius * 2.5))
}

/** Missing accuracy is allowed. Only reject extremely poor readings. */
export function isGpsAccuracyTooPoor(
  accuracy: number | null | undefined,
  radiusMeters: number,
): boolean {
  if (accuracy == null || !Number.isFinite(accuracy) || accuracy <= 0) return false
  return accuracy > gpsAccuracyThresholdMeters(radiusMeters)
}

export function formatDistanceLabel(meters: number | null | undefined): string {
  if (meters == null || !Number.isFinite(meters)) return "—"
  if (meters >= 1000) {
    const km = Math.round((meters / 1000) * 10) / 10
    return `${km} km`
  }
  return `${Math.round(meters)} m`
}
