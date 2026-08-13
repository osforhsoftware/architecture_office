"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  detectLocationPlatform,
  evaluateFix,
  getFreshPosition,
  isGeolocationSupported,
  isSecureLocationContext,
  logLocationDebug,
  mapGeolocationError,
  queryGeolocationPermission,
  subscribeGeolocationPermission,
  type GeolocationPermissionState,
  type LocationCoords,
  type LocationFix,
  type LocationPlatform,
  type LocationRequestReason,
  type LocationState,
} from "@/lib/attendance/location"

export interface StaffLocationSnapshot {
  ok: boolean
  state: LocationState
  coords: LocationCoords | null
  distance: number | null
  accuracy: number | null
  insideGeofence: boolean
  message: string | null
}

function snapshotOf(
  state: LocationState,
  coords: LocationCoords | null,
  distance: number | null,
  accuracy: number | null,
  message: string | null,
): StaffLocationSnapshot {
  return {
    ok: state === "inside_geofence" && coords !== null,
    state,
    coords,
    distance,
    accuracy,
    insideGeofence: state === "inside_geofence",
    message,
  }
}

export function useStaffLocation(office: {
  latitude: number
  longitude: number
  radiusMeters: number
}) {
  const [state, setState] = useState<LocationState>("initial")
  const [permission, setPermission] = useState<GeolocationPermissionState>("unknown")
  const [coords, setCoords] = useState<LocationCoords | null>(null)
  const [distance, setDistance] = useState<number | null>(null)
  const [accuracy, setAccuracy] = useState<number | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const [platform, setPlatform] = useState<LocationPlatform>("unknown")

  const officeRef = useRef(office)
  officeRef.current = office

  const stateRef = useRef(state)
  stateRef.current = state
  const permissionRef = useRef(permission)
  permissionRef.current = permission
  const coordsRef = useRef(coords)
  coordsRef.current = coords
  const distanceRef = useRef(distance)
  distanceRef.current = distance
  const accuracyRef = useRef(accuracy)
  accuracyRef.current = accuracy
  const messageRef = useRef(message)
  messageRef.current = message

  const requestIdRef = useRef(0)
  const inFlightRef = useRef(false)
  const autoRequestedRef = useRef(false)
  const platformRef = useRef(platform)
  platformRef.current = platform

  const currentSnapshot = useCallback(
    (): StaffLocationSnapshot =>
      snapshotOf(
        stateRef.current,
        coordsRef.current,
        distanceRef.current,
        accuracyRef.current,
        messageRef.current,
      ),
    [],
  )

  const applyFix = useCallback((fix: LocationFix) => {
    const next: LocationState = fix.accuracyTooPoor
      ? "poor_accuracy"
      : fix.insideGeofence
        ? "inside_geofence"
        : "outside_geofence"
    const nextMessage = fix.accuracyTooPoor
      ? "Your location accuracy is too low. Please enable high-accuracy Location Services and try again."
      : null
    setCoords(fix.coords)
    setDistance(fix.distance)
    setAccuracy(fix.accuracy)
    setMessage(nextMessage)
    setState(next)
    coordsRef.current = fix.coords
    distanceRef.current = fix.distance
    accuracyRef.current = fix.accuracy
    messageRef.current = nextMessage
    stateRef.current = next
    logLocationDebug({
      permission: permissionRef.current,
      hasLat: true,
      hasLng: true,
      accuracy: fix.accuracy,
      distance: fix.distance,
      geofence: fix.insideGeofence ? "inside" : "outside",
      state: next,
    })
  }, [])

  const clearFix = useCallback(() => {
    setCoords(null)
    setDistance(null)
    setAccuracy(null)
    coordsRef.current = null
    distanceRef.current = null
    accuracyRef.current = null
  }, [])

  const requestLocation = useCallback(
    async (reason: LocationRequestReason = "user"): Promise<StaffLocationSnapshot> => {
      if (inFlightRef.current && reason !== "punch") {
        return currentSnapshot()
      }

      const requestId = ++requestIdRef.current

      const fail = (nextState: LocationState, nextMessage: string): StaffLocationSnapshot => {
        if (requestId !== requestIdRef.current) return currentSnapshot()
        clearFix()
        setState(nextState)
        setMessage(nextMessage)
        stateRef.current = nextState
        messageRef.current = nextMessage
        logLocationDebug({
          permission: permissionRef.current,
          hasLat: false,
          hasLng: false,
          accuracy: null,
          distance: null,
          geofence: "n/a",
          state: nextState,
        })
        return snapshotOf(nextState, null, null, null, nextMessage)
      }

      if (!isGeolocationSupported()) {
        return fail(
          "unsupported",
          "Location is not supported by this browser. Please use Chrome, Edge, Safari, or another browser with location support.",
        )
      }

      if (!isSecureLocationContext()) {
        return fail(
          "https_required",
          "Location access requires a secure connection (HTTPS). Please open this site using HTTPS.",
        )
      }

      const perm = await queryGeolocationPermission()
      if (requestId !== requestIdRef.current) return currentSnapshot()
      permissionRef.current = perm
      setPermission(perm)

      if (perm === "denied" && reason !== "user" && reason !== "punch") {
        return fail(
          "denied",
          "Location permission is blocked. Please allow location access for this website.",
        )
      }

      if (perm === "prompt") {
        setState("prompt")
        setMessage("Allow Location Access")
        stateRef.current = "prompt"
        messageRef.current = "Allow Location Access"
      } else if (perm === "granted") {
        setState("granted")
        stateRef.current = "granted"
      }

      inFlightRef.current = true
      setChecking(true)
      setState("requesting")
      stateRef.current = "requesting"
      if (perm === "prompt") {
        setMessage("Allow Location Access")
        messageRef.current = "Allow Location Access"
      } else {
        setMessage(null)
        messageRef.current = null
      }

      try {
        const pos = await getFreshPosition()
        if (requestId !== requestIdRef.current) return currentSnapshot()

        permissionRef.current = "granted"
        setPermission("granted")

        const officeNow = officeRef.current
        const fix = evaluateFix(
          pos.coords.latitude,
          pos.coords.longitude,
          pos.coords.accuracy,
          officeNow.latitude,
          officeNow.longitude,
          officeNow.radiusMeters,
        )

        if (!fix) {
          return fail(
            "unavailable",
            "Your current location could not be determined. Please enable GPS/Location Services and try again.",
          )
        }

        applyFix(fix)
        const nextState: LocationState = fix.accuracyTooPoor
          ? "poor_accuracy"
          : fix.insideGeofence
            ? "inside_geofence"
            : "outside_geofence"
        return snapshotOf(
          nextState,
          fix.coords,
          fix.distance,
          fix.accuracy,
          fix.accuracyTooPoor
            ? "Your location accuracy is too low. Please enable high-accuracy Location Services and try again."
            : null,
        )
      } catch (error) {
        const currentPlatform = detectLocationPlatform()
        platformRef.current = currentPlatform
        setPlatform(currentPlatform)
        const mapped = mapGeolocationError(error, currentPlatform)
        if (mapped.state === "denied") {
          permissionRef.current = "denied"
          setPermission("denied")
        }
        return fail(mapped.state, mapped.message)
      } finally {
        if (requestId === requestIdRef.current) {
          inFlightRef.current = false
          setChecking(false)
        }
      }
    },
    [applyFix, clearFix, currentSnapshot],
  )

  const requestLocationRef = useRef(requestLocation)
  requestLocationRef.current = requestLocation

  const refreshLocationPermission = useCallback(async () => {
    if (!isGeolocationSupported()) {
      clearFix()
      setState("unsupported")
      setMessage(
        "Location is not supported by this browser. Please use Chrome, Edge, Safari, or another browser with location support.",
      )
      stateRef.current = "unsupported"
      return
    }
    if (!isSecureLocationContext()) {
      clearFix()
      setState("https_required")
      setMessage("Location access requires a secure connection (HTTPS). Please open this site using HTTPS.")
      stateRef.current = "https_required"
      return
    }

    const prev = permissionRef.current
    const perm = await queryGeolocationPermission()
    permissionRef.current = perm
    setPermission(perm)

    if (perm === "denied") {
      clearFix()
      setState("denied")
      setMessage("Location permission is blocked. Please allow location access for this website.")
      stateRef.current = "denied"
      logLocationDebug({
        permission: perm,
        hasLat: false,
        hasLng: false,
        accuracy: null,
        distance: null,
        geofence: "n/a",
        state: "denied",
      })
      return
    }

    if (prev === "denied" && perm === "granted") {
      setState("granted")
      setMessage(null)
      stateRef.current = "granted"
      await requestLocationRef.current("permission-change")
      return
    }

    if (perm === "granted" && !coordsRef.current) {
      setState("granted")
      stateRef.current = "granted"
    }
  }, [clearFix])

  useEffect(() => {
    let cancelled = false
    let unsubscribe: (() => void) | undefined

    async function init() {
      const detected = detectLocationPlatform()
      platformRef.current = detected
      setPlatform(detected)

      if (!isGeolocationSupported()) {
        if (!cancelled) {
          setState("unsupported")
          setMessage(
            "Location is not supported by this browser. Please use Chrome, Edge, Safari, or another browser with location support.",
          )
          stateRef.current = "unsupported"
        }
        return
      }

      if (!isSecureLocationContext()) {
        if (!cancelled) {
          setState("https_required")
          setMessage(
            "Location access requires a secure connection (HTTPS). Please open this site using HTTPS.",
          )
          stateRef.current = "https_required"
          if (process.env.NODE_ENV === "development") {
            console.info(
              "[attendance-location] Insecure context. GPS is blocked on LAN HTTP. Use https:// or http://localhost.",
            )
          }
        }
        return
      }

      const perm = await queryGeolocationPermission()
      if (cancelled) return
      permissionRef.current = perm
      setPermission(perm)

      unsubscribe = await subscribeGeolocationPermission((next) => {
        if (cancelled) return
        const prev = permissionRef.current
        permissionRef.current = next
        setPermission(next)
        if (next === "denied") {
          clearFix()
          setState("denied")
          setMessage("Location permission is blocked. Please allow location access for this website.")
          stateRef.current = "denied"
          return
        }
        if (prev === "denied" && next === "granted") {
          setState("granted")
          setMessage(null)
          stateRef.current = "granted"
          void requestLocationRef.current("permission-change")
          return
        }
        if (next === "prompt") {
          setState("prompt")
          setMessage("Allow Location Access")
          stateRef.current = "prompt"
        }
      })

      if (cancelled) return

      if (perm === "denied") {
        setState("denied")
        setMessage("Location permission is blocked. Please allow location access for this website.")
        stateRef.current = "denied"
        return
      }

      if (perm === "prompt") {
        setState("prompt")
        setMessage("Allow Location Access")
        stateRef.current = "prompt"
      }

      if (!autoRequestedRef.current) {
        autoRequestedRef.current = true
        await requestLocationRef.current("auto")
      }
    }

    void init()

    function onVisibility() {
      if (document.visibilityState !== "visible") return
      void (async () => {
        await refreshLocationPermission()
        if (permissionRef.current === "denied") return
        const current = stateRef.current
        if (
          current === "denied" ||
          current === "unavailable" ||
          current === "timeout" ||
          current === "prompt" ||
          current === "granted" ||
          current === "initial"
        ) {
          await requestLocationRef.current("visibility")
        }
      })()
    }

    document.addEventListener("visibilitychange", onVisibility)

    return () => {
      cancelled = true
      document.removeEventListener("visibilitychange", onVisibility)
      unsubscribe?.()
    }
  }, [clearFix, refreshLocationPermission])

  return {
    state,
    permission,
    coords,
    distance,
    accuracy,
    message,
    checking,
    platform,
    locationReady: state === "inside_geofence" && coords !== null,
    requestLocation,
    refreshLocationPermission,
  }
}
