"use server"

import { revalidatePath } from "next/cache"
import { headers } from "next/headers"
import { sql } from "@/lib/db"
import { logAudit } from "@/lib/project-access"
import { requireStaffAccess, requireSuperAdmin } from "@/lib/permissions"
import { outsideOfficeMessage, type AttendanceStatus } from "./constants"
import { haversineDistanceMeters, isGpsAccuracyTooPoor, isValidCoordinate } from "./geo"
import {
  formatMysqlDateTimeIst,
  normalizeTimeHm,
  parseOfficeDateTime,
  workingHoursBetween,
} from "./datetime"
import {
  ensureAttendanceSettings,
  getTodayAttendanceForStaff,
  normalizeAttendanceSettings,
  resolveCheckInStatus,
  saveAttendanceSettingsValue,
  todayInOfficeTz,
} from "./queries"
import type { AttendanceSettings } from "./types"

async function clientIpAddress(): Promise<string | null> {
  try {
    const h = await headers()
    const forwarded = h.get("x-forwarded-for")
    if (forwarded) return forwarded.split(",")[0]?.trim() || null
    return h.get("x-real-ip")
  } catch {
    return null
  }
}

function parseCoords(formData: FormData): { latitude: number; longitude: number } | { error: string } {
  const latitude = Number(formData.get("latitude"))
  const longitude = Number(formData.get("longitude"))
  if (!isValidCoordinate(latitude, longitude)) {
    return { error: "GPS location is required for attendance." }
  }
  return { latitude, longitude }
}

function parseAccuracy(formData: FormData): number | null {
  const raw = formData.get("accuracy")
  if (raw == null || String(raw).trim() === "") return null
  const accuracy = Number(raw)
  if (!Number.isFinite(accuracy) || accuracy <= 0) return null
  return accuracy
}

async function validateGeofence(
  latitude: number,
  longitude: number,
  accuracy: number | null,
) {
  const settings = await ensureAttendanceSettings()
  if (isGpsAccuracyTooPoor(accuracy, settings.radius_meters)) {
    return {
      ok: false as const,
      distance: null,
      error:
        "Your location accuracy is too low. Please enable high-accuracy Location Services and try again.",
    }
  }
  const distance = haversineDistanceMeters(
    latitude,
    longitude,
    settings.latitude,
    settings.longitude,
  )
  const rounded = Math.round(distance * 100) / 100
  if (rounded > settings.radius_meters) {
    return {
      ok: false as const,
      distance: rounded,
      error: outsideOfficeMessage(settings.radius_meters),
    }
  }
  return { ok: true as const, distance: rounded, settings }
}

function revalidateAttendance() {
  revalidatePath("/staff/attendance")
  revalidatePath("/staff")
  revalidatePath("/admin/attendance")
}

export async function checkInAction(formData: FormData) {
  try {
    const user = await requireStaffAccess()
    const coords = parseCoords(formData)
    if ("error" in coords) return { error: coords.error }
    const accuracy = parseAccuracy(formData)

    const geo = await validateGeofence(coords.latitude, coords.longitude, accuracy)
    if (!geo.ok) return { error: geo.error, distance: geo.distance }

    const today = todayInOfficeTz()
    const existing = await getTodayAttendanceForStaff(user.id, today)
    if (existing?.check_in) {
      return { error: "You have already checked in today." }
    }

    const nowDate = new Date()
    const now = formatMysqlDateTimeIst(nowDate)
    const status = resolveCheckInStatus(nowDate, today, geo.settings)
    const deviceInfo = String(formData.get("device_info") || "").slice(0, 500) || null
    const ip = await clientIpAddress()

    if (existing) {
      await sql`
        UPDATE attendance
        SET check_in = ${now},
            status = ${status},
            latitude = ${coords.latitude},
            longitude = ${coords.longitude},
            distance_from_office = ${geo.distance},
            location_verified = 1,
            is_manual = 0,
            device_info = ${deviceInfo},
            ip_address = ${ip},
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${existing.id}
      `
    } else {
      await sql`
        INSERT INTO attendance (
          staff_id, attendance_date, check_in, status,
          latitude, longitude, distance_from_office, location_verified,
          is_manual, device_info, ip_address
        ) VALUES (
          ${user.id}, ${today}, ${now}, ${status},
          ${coords.latitude}, ${coords.longitude}, ${geo.distance}, 1,
          0, ${deviceInfo}, ${ip}
        )
      `
    }

    await logAudit(user.id, "attendance.check_in", "attendance", user.id, {
      date: today,
      status,
      distance: geo.distance,
      latitude: coords.latitude,
      longitude: coords.longitude,
      accuracy,
      location_verified: true,
      is_manual: false,
    }, { ipAddress: ip })

    revalidateAttendance()
    return { success: true, checkIn: now, distance: geo.distance, status }
  } catch (error) {
    console.error("[attendance] check-in failed:", error)
    return { error: "Unable to check in. Please try again." }
  }
}

export async function checkOutAction(formData: FormData) {
  try {
    const user = await requireStaffAccess()
    const coords = parseCoords(formData)
    if ("error" in coords) return { error: coords.error }
    const accuracy = parseAccuracy(formData)

    const geo = await validateGeofence(coords.latitude, coords.longitude, accuracy)
    if (!geo.ok) return { error: geo.error, distance: geo.distance }

    const today = todayInOfficeTz()
    const existing = await getTodayAttendanceForStaff(user.id, today)
    if (!existing?.check_in) {
      return { error: "You must check in before checking out." }
    }
    if (existing.check_out) {
      return { error: "You have already checked out today." }
    }

    const nowDate = new Date()
    const now = formatMysqlDateTimeIst(nowDate)
    const hours = workingHoursBetween(existing.check_in, nowDate)
    const deviceInfo = String(formData.get("device_info") || "").slice(0, 500) || null
    const ip = await clientIpAddress()

    await sql`
      UPDATE attendance
      SET check_out = ${now},
          working_hours = ${hours},
          latitude = ${coords.latitude},
          longitude = ${coords.longitude},
          distance_from_office = ${geo.distance},
          location_verified = 1,
          device_info = COALESCE(${deviceInfo}, device_info),
          ip_address = COALESCE(${ip}, ip_address),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${existing.id}
    `

    await logAudit(user.id, "attendance.check_out", "attendance", user.id, {
      date: today,
      distance: geo.distance,
      working_hours: hours,
      latitude: coords.latitude,
      longitude: coords.longitude,
      accuracy,
      location_verified: true,
      is_manual: false,
    }, { ipAddress: ip })

    revalidateAttendance()
    return { success: true, checkOut: now, workingHours: hours, distance: geo.distance }
  } catch (error) {
    console.error("[attendance] check-out failed:", error)
    return { error: "Unable to check out. Please try again." }
  }
}

export async function saveAttendanceSettingsAction(formData: FormData) {
  try {
    const admin = await requireSuperAdmin()
    const current = await ensureAttendanceSettings()

    const officeStart = normalizeTimeHm(
      String(formData.get("office_start_time") || ""),
      current.office_start_time,
    )
    const bufferRaw = Number(formData.get("buffer_minutes"))
    const bufferMinutes =
      Number.isFinite(bufferRaw) && bufferRaw >= 0 && bufferRaw <= 180
        ? Math.trunc(bufferRaw)
        : current.buffer_minutes

    const radiusRaw = Number(formData.get("radius_meters"))
    const radiusMeters =
      Number.isFinite(radiusRaw) && radiusRaw > 0 && radiusRaw <= 5000
        ? Math.trunc(radiusRaw)
        : current.radius_meters

    const next: AttendanceSettings = normalizeAttendanceSettings({
      ...current,
      office_start_time: officeStart,
      buffer_minutes: bufferMinutes,
      radius_meters: radiusMeters,
      latitude: Number(formData.get("latitude")) || current.latitude,
      longitude: Number(formData.get("longitude")) || current.longitude,
    })

    await saveAttendanceSettingsValue(next)
    await logAudit(admin.id, "attendance.settings_update", "attendance", 0, {
      office_start_time: next.office_start_time,
      buffer_minutes: next.buffer_minutes,
      radius_meters: next.radius_meters,
      latitude: next.latitude,
      longitude: next.longitude,
    })

    revalidateAttendance()
    return { success: true, settings: next }
  } catch (error) {
    console.error("[attendance] settings save failed:", error)
    return { error: "Unable to save attendance settings." }
  }
}

/**
 * Super Admin manual attendance for staff outside office / special cases.
 * Skips GPS geofence. Still prevents duplicate check-in/out unless updating times.
 */
export async function adminMarkAttendanceAction(formData: FormData) {
  try {
    const admin = await requireSuperAdmin()
    const staffId = Number(formData.get("staff_id"))
    if (!Number.isFinite(staffId) || staffId <= 0) {
      return { error: "Select a staff member." }
    }

    const attendanceDate =
      String(formData.get("attendance_date") || "").trim() || todayInOfficeTz()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(attendanceDate)) {
      return { error: "Invalid attendance date." }
    }

    const checkInRaw = String(formData.get("check_in") || "").trim()
    const checkOutRaw = String(formData.get("check_out") || "").trim()
    const statusRaw = String(formData.get("status") || "Present").trim()
    const note = String(formData.get("admin_note") || "").trim().slice(0, 500) || null
    if (statusRaw !== "Absent" && !note) {
      return { error: "Admin note is required for a manual attendance override." }
    }

    const allowedStatus: AttendanceStatus[] = ["Present", "Late Coming", "Absent"]
    if (!allowedStatus.includes(statusRaw as AttendanceStatus)) {
      return { error: "Invalid attendance status." }
    }
    const status = statusRaw as AttendanceStatus

    if (status === "Absent") {
      const existing = await getTodayAttendanceForStaff(staffId, attendanceDate)
      if (existing) {
        await sql`DELETE FROM attendance WHERE id = ${existing.id}`
      }
      await logAudit(admin.id, "attendance.admin_mark_absent", "attendance", staffId, {
        date: attendanceDate,
        note,
      })
      revalidateAttendance()
      return { success: true }
    }

    if (!checkInRaw) {
      return { error: "Check-in time is required for Present / Late Coming." }
    }

    const checkInHm = normalizeTimeHm(checkInRaw, "")
    if (!checkInHm) return { error: "Invalid check-in time." }
    const checkIn = `${attendanceDate} ${checkInHm}:00`

    let checkOut: string | null = null
    let workingHours: number | null = null
    if (checkOutRaw) {
      const checkOutHm = normalizeTimeHm(checkOutRaw, "")
      if (!checkOutHm) return { error: "Invalid check-out time." }
      checkOut = `${attendanceDate} ${checkOutHm}:00`
      workingHours = workingHoursBetween(checkIn, parseOfficeDateTime(checkOut))
    }

    const settings = await ensureAttendanceSettings()
    const computed =
      status === "Late Coming" || status === "Present"
        ? status
        : resolveCheckInStatus(parseOfficeDateTime(checkIn), attendanceDate, settings)

    const existing = await getTodayAttendanceForStaff(staffId, attendanceDate)
    const ip = await clientIpAddress()

    if (existing) {
      await sql`
        UPDATE attendance
        SET check_in = ${checkIn},
            check_out = ${checkOut},
            working_hours = ${workingHours},
            status = ${computed},
            location_verified = 0,
            is_manual = 1,
            marked_by = ${admin.id},
            admin_note = ${note},
            latitude = NULL,
            longitude = NULL,
            distance_from_office = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${existing.id}
      `
    } else {
      await sql`
        INSERT INTO attendance (
          staff_id, attendance_date, check_in, check_out, working_hours, status,
          location_verified, is_manual, marked_by, admin_note,
          latitude, longitude, distance_from_office, ip_address, device_info
        ) VALUES (
          ${staffId}, ${attendanceDate}, ${checkIn}, ${checkOut}, ${workingHours}, ${computed},
          0, 1, ${admin.id}, ${note},
          NULL, NULL, NULL, ${ip}, ${"Manual mark by Acmmo Admin"}
        )
      `
    }

    await logAudit(admin.id, "attendance.admin_mark", "attendance", staffId, {
      date: attendanceDate,
      status: computed,
      check_in: checkIn,
      check_out: checkOut,
      note,
      override: true,
      manual_checkout: Boolean(checkOut),
      location_verified: false,
      is_manual: true,
      marked_by: admin.id,
    }, { ipAddress: ip })

    revalidateAttendance()
    return { success: true, status: computed }
  } catch (error) {
    console.error("[attendance] admin mark failed:", error)
    return { error: "Unable to mark attendance." }
  }
}
