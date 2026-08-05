import "server-only"

import { sql } from "@/lib/db"
import {
  buildSearchPattern,
  clampPage,
  pageOffset,
  parsePage,
  parsePageSize,
  toPaginatedResult,
  type PaginatedResult,
  type PaginationParams,
} from "@/lib/pagination"
import { toSafeNumber } from "@/lib/utils"
import {
  ATTENDANCE_SETTINGS_KEY,
  DEFAULT_ATTENDANCE_SETTINGS,
  LATE_COMING_ALERT_MESSAGE,
  type AttendanceStatus,
} from "./constants"
import {
  formatHmFromMs,
  isAfterOfficeBuffer,
  normalizeTimeHm,
  officeDeadlineMs,
} from "./datetime"
import type {
  AttendanceRecord,
  AttendanceReportRow,
  AttendanceSettings,
  LateComingInfo,
} from "./types"

/** Calendar date in Asia/Kolkata (YYYY-MM-DD). */
export function todayInOfficeTz(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date)
}

export function monthBounds(month: string): { from: string; to: string } | null {
  if (!/^\d{4}-\d{2}$/.test(month)) return null
  const [y, m] = month.split("-").map(Number)
  if (!y || !m || m < 1 || m > 12) return null
  const from = `${month}-01`
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const to = `${month}-${String(lastDay).padStart(2, "0")}`
  return { from, to }
}

export function normalizeAttendanceSettings(raw: unknown): AttendanceSettings {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_ATTENDANCE_SETTINGS }
  const obj = raw as Record<string, unknown>
  const latitude = Number(obj.latitude)
  const longitude = Number(obj.longitude)
  const radius = Number(obj.radius_meters)
  const buffer = Number(obj.buffer_minutes)
  return {
    latitude: Number.isFinite(latitude) ? latitude : DEFAULT_ATTENDANCE_SETTINGS.latitude,
    longitude: Number.isFinite(longitude) ? longitude : DEFAULT_ATTENDANCE_SETTINGS.longitude,
    radius_meters:
      Number.isFinite(radius) && radius > 0
        ? radius
        : DEFAULT_ATTENDANCE_SETTINGS.radius_meters,
    maps_url:
      typeof obj.maps_url === "string" && obj.maps_url
        ? obj.maps_url
        : DEFAULT_ATTENDANCE_SETTINGS.maps_url,
    office_start_time: normalizeTimeHm(
      typeof obj.office_start_time === "string"
        ? obj.office_start_time
        : DEFAULT_ATTENDANCE_SETTINGS.office_start_time,
      DEFAULT_ATTENDANCE_SETTINGS.office_start_time,
    ),
    buffer_minutes:
      Number.isFinite(buffer) && buffer >= 0
        ? Math.trunc(buffer)
        : DEFAULT_ATTENDANCE_SETTINGS.buffer_minutes,
  }
}

function normalizeSettings(raw: unknown): AttendanceSettings {
  return normalizeAttendanceSettings(raw)
}

export function resolveCheckInStatus(
  checkInAt: Date,
  dateYmd: string,
  settings: Pick<AttendanceSettings, "office_start_time" | "buffer_minutes">,
): Extract<AttendanceStatus, "Present" | "Late Coming"> {
  return isAfterOfficeBuffer(
    checkInAt,
    dateYmd,
    settings.office_start_time,
    settings.buffer_minutes,
  )
    ? "Late Coming"
    : "Present"
}

export function getLateComingInfo(
  settings: AttendanceSettings,
  hasCheckedIn: boolean,
  now = new Date(),
  dateYmd = todayInOfficeTz(now),
): LateComingInfo {
  const lateAfterMs = officeDeadlineMs(
    dateYmd,
    settings.office_start_time,
    settings.buffer_minutes,
  )
  const isLateWindow = !hasCheckedIn && now.getTime() > lateAfterMs
  return {
    isLateWindow,
    officeStartTime: settings.office_start_time,
    bufferMinutes: settings.buffer_minutes,
    lateAfterTime: formatHmFromMs(lateAfterMs),
    message: LATE_COMING_ALERT_MESSAGE,
  }
}

export async function getAttendanceSettings(): Promise<AttendanceSettings> {
  try {
    const rows = (await sql`
      SELECT value FROM office_settings WHERE \`key\` = ${ATTENDANCE_SETTINGS_KEY} LIMIT 1
    `) as { value: unknown }[]
    if (rows[0]?.value) return normalizeSettings(rows[0].value)
  } catch {
    /* table/key may not exist yet */
  }
  return { ...DEFAULT_ATTENDANCE_SETTINGS }
}

export async function ensureAttendanceSettings(): Promise<AttendanceSettings> {
  const existing = await getAttendanceSettings()
  await sql`
    INSERT INTO office_settings (\`key\`, value, updated_at)
    VALUES (${ATTENDANCE_SETTINGS_KEY}, ${sql.json(existing)}, CURRENT_TIMESTAMP)
    ON DUPLICATE KEY UPDATE
      value = JSON_SET(
        value,
        '$.office_start_time',
        COALESCE(JSON_UNQUOTE(JSON_EXTRACT(value, '$.office_start_time')), ${existing.office_start_time}),
        '$.buffer_minutes',
        COALESCE(CAST(JSON_EXTRACT(value, '$.buffer_minutes') AS UNSIGNED), ${existing.buffer_minutes})
      ),
      updated_at = CURRENT_TIMESTAMP
  `
  return getAttendanceSettings()
}

export async function saveAttendanceSettingsValue(
  settings: AttendanceSettings,
): Promise<void> {
  await sql`
    INSERT INTO office_settings (\`key\`, value, updated_at)
    VALUES (${ATTENDANCE_SETTINGS_KEY}, ${sql.json(settings)}, CURRENT_TIMESTAMP)
    ON DUPLICATE KEY UPDATE
      value = ${sql.json(settings)},
      updated_at = CURRENT_TIMESTAMP
  `
}

export async function getTodayAttendanceForStaff(
  staffId: number,
  date = todayInOfficeTz(),
): Promise<AttendanceRecord | null> {
  const rows = (await sql`
    SELECT
      id, staff_id, attendance_date, check_in, check_out, working_hours,
      status, latitude, longitude, distance_from_office, location_verified,
      is_manual, marked_by, admin_note,
      device_info, ip_address, created_at, updated_at
    FROM attendance
    WHERE staff_id = ${staffId} AND attendance_date = ${date}
    LIMIT 1
  `) as AttendanceRecord[]
  const row = rows[0]
  if (!row) return null
  return {
    ...row,
    status: (row.status as AttendanceStatus) || (row.check_in ? "Present" : "Absent"),
  }
}

export interface AttendanceFilterParams extends PaginationParams {
  staffId?: string
  department?: string
  date?: string
  month?: string
  from?: string
  to?: string
  /** When true (default for single-day views), include staff with no record as Absent */
  includeAbsent?: boolean
}

function resolveDateRange(params: AttendanceFilterParams): {
  from: string | null
  to: string | null
  singleDay: string | null
} {
  if (params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date)) {
    return { from: params.date, to: params.date, singleDay: params.date }
  }
  if (params.month) {
    const bounds = monthBounds(params.month)
    if (bounds) return { from: bounds.from, to: bounds.to, singleDay: null }
  }
  if (params.from || params.to) {
    return {
      from: params.from && /^\d{4}-\d{2}-\d{2}$/.test(params.from) ? params.from : null,
      to: params.to && /^\d{4}-\d{2}-\d{2}$/.test(params.to) ? params.to : null,
      singleDay: null,
    }
  }
  const today = todayInOfficeTz()
  return { from: today, to: today, singleDay: today }
}

function toReportRow(row: Record<string, unknown>): AttendanceReportRow {
  const checkIn = (row.check_in as string | null) ?? null
  const stored = typeof row.status === "string" ? row.status : null
  let status: AttendanceStatus = "Absent"
  if (checkIn) {
    if (stored === "Late Coming" || stored === "Present") status = stored
    else status = "Present"
  }
  return {
    date: String(row.attendance_date ?? row.date ?? ""),
    staff_id: toSafeNumber(row.staff_id),
    staff_name: String(row.staff_name ?? ""),
    department: String(row.department ?? row.role ?? ""),
    check_in: checkIn,
    check_out: (row.check_out as string | null) ?? null,
    working_hours:
      row.working_hours === null || row.working_hours === undefined
        ? null
        : toSafeNumber(row.working_hours),
    attendance_status: status,
    location_verified: Boolean(row.location_verified),
    is_manual: Boolean(row.is_manual),
    distance_from_office:
      row.distance_from_office === null || row.distance_from_office === undefined
        ? null
        : toSafeNumber(row.distance_from_office),
    latitude:
      row.latitude === null || row.latitude === undefined ? null : toSafeNumber(row.latitude),
    longitude:
      row.longitude === null || row.longitude === undefined ? null : toSafeNumber(row.longitude),
    admin_note: (row.admin_note as string | null) ?? null,
  }
}

/** Single-day roster: all active staff with Present/Absent. */
async function getDayRoster(
  day: string,
  params: AttendanceFilterParams,
): Promise<PaginatedResult<AttendanceReportRow>> {
  const requestedPage = parsePage(params.page)
  const pageSize = parsePageSize(params.pageSize)
  const search = buildSearchPattern(params.search)
  const staffIdRaw = params.staffId ? Number.parseInt(params.staffId, 10) : NaN
  const staffId = Number.isFinite(staffIdRaw) ? staffIdRaw : null
  const department = params.department?.trim() || null

  const countRows = (await sql`
    SELECT COUNT(*) AS count
    FROM app_users u
    WHERE u.active = true
      AND u.role NOT IN ('Super Admin', 'Admin')
      AND (${staffId} IS NULL OR u.id = ${staffId})
      AND (${department} IS NULL OR u.role = ${department})
      AND (${search} IS NULL OR
        u.name LIKE ${search} OR
        u.username LIKE ${search} OR
        u.role LIKE ${search})
  `) as { count: number }[]

  const total = toSafeNumber(countRows[0]?.count)
  const page = clampPage(requestedPage, total, pageSize)
  const offset = pageOffset(page, pageSize)

  const rows =
    pageSize === -1
      ? ((await sql`
          SELECT
            ${day} AS attendance_date,
            u.id AS staff_id,
            u.name AS staff_name,
            u.role AS department,
            a.check_in,
            a.check_out,
            a.working_hours,
            a.status,
            a.location_verified,
            a.is_manual,
            a.admin_note,
            a.distance_from_office,
            a.latitude,
            a.longitude
          FROM app_users u
          LEFT JOIN attendance a
            ON a.staff_id = u.id AND a.attendance_date = ${day}
          WHERE u.active = true
            AND u.role NOT IN ('Super Admin', 'Admin')
            AND (${staffId} IS NULL OR u.id = ${staffId})
            AND (${department} IS NULL OR u.role = ${department})
            AND (${search} IS NULL OR
              u.name LIKE ${search} OR
              u.username LIKE ${search} OR
              u.role LIKE ${search})
          ORDER BY u.name ASC
        `) as Record<string, unknown>[])
      : ((await sql`
          SELECT
            ${day} AS attendance_date,
            u.id AS staff_id,
            u.name AS staff_name,
            u.role AS department,
            a.check_in,
            a.check_out,
            a.working_hours,
            a.status,
            a.location_verified,
            a.is_manual,
            a.admin_note,
            a.distance_from_office,
            a.latitude,
            a.longitude
          FROM app_users u
          LEFT JOIN attendance a
            ON a.staff_id = u.id AND a.attendance_date = ${day}
          WHERE u.active = true
            AND u.role NOT IN ('Super Admin', 'Admin')
            AND (${staffId} IS NULL OR u.id = ${staffId})
            AND (${department} IS NULL OR u.role = ${department})
            AND (${search} IS NULL OR
              u.name LIKE ${search} OR
              u.username LIKE ${search} OR
              u.role LIKE ${search})
          ORDER BY u.name ASC
          LIMIT ${pageSize} OFFSET ${offset}
        `) as Record<string, unknown>[])

  return toPaginatedResult(rows.map(toReportRow), total, page, pageSize)
}

/** Date-range records only (Present rows). */
async function getAttendanceRecords(
  from: string | null,
  to: string | null,
  params: AttendanceFilterParams,
): Promise<PaginatedResult<AttendanceReportRow>> {
  const requestedPage = parsePage(params.page)
  const pageSize = parsePageSize(params.pageSize)
  const search = buildSearchPattern(params.search)
  const staffIdRaw = params.staffId ? Number.parseInt(params.staffId, 10) : NaN
  const staffId = Number.isFinite(staffIdRaw) ? staffIdRaw : null
  const department = params.department?.trim() || null

  const countRows = (await sql`
    SELECT COUNT(*) AS count
    FROM attendance a
    INNER JOIN app_users u ON u.id = a.staff_id
    WHERE u.role NOT IN ('Super Admin', 'Admin')
      AND (${from} IS NULL OR a.attendance_date >= ${from})
      AND (${to} IS NULL OR a.attendance_date <= ${to})
      AND (${staffId} IS NULL OR a.staff_id = ${staffId})
      AND (${department} IS NULL OR u.role = ${department})
      AND (${search} IS NULL OR
        u.name LIKE ${search} OR
        u.username LIKE ${search} OR
        u.role LIKE ${search})
  `) as { count: number }[]

  const total = toSafeNumber(countRows[0]?.count)
  const page = clampPage(requestedPage, total, pageSize)
  const offset = pageOffset(page, pageSize)

  const rows =
    pageSize === -1
      ? ((await sql`
          SELECT
            a.attendance_date,
            a.staff_id,
            u.name AS staff_name,
            u.role AS department,
            a.check_in,
            a.check_out,
            a.working_hours,
            a.status,
            a.location_verified,
            a.is_manual,
            a.admin_note,
            a.distance_from_office,
            a.latitude,
            a.longitude
          FROM attendance a
          INNER JOIN app_users u ON u.id = a.staff_id
          WHERE u.role NOT IN ('Super Admin', 'Admin')
            AND (${from} IS NULL OR a.attendance_date >= ${from})
            AND (${to} IS NULL OR a.attendance_date <= ${to})
            AND (${staffId} IS NULL OR a.staff_id = ${staffId})
            AND (${department} IS NULL OR u.role = ${department})
            AND (${search} IS NULL OR
              u.name LIKE ${search} OR
              u.username LIKE ${search} OR
              u.role LIKE ${search})
          ORDER BY a.attendance_date DESC, u.name ASC
        `) as Record<string, unknown>[])
      : ((await sql`
          SELECT
            a.attendance_date,
            a.staff_id,
            u.name AS staff_name,
            u.role AS department,
            a.check_in,
            a.check_out,
            a.working_hours,
            a.status,
            a.location_verified,
            a.is_manual,
            a.admin_note,
            a.distance_from_office,
            a.latitude,
            a.longitude
          FROM attendance a
          INNER JOIN app_users u ON u.id = a.staff_id
          WHERE u.role NOT IN ('Super Admin', 'Admin')
            AND (${from} IS NULL OR a.attendance_date >= ${from})
            AND (${to} IS NULL OR a.attendance_date <= ${to})
            AND (${staffId} IS NULL OR a.staff_id = ${staffId})
            AND (${department} IS NULL OR u.role = ${department})
            AND (${search} IS NULL OR
              u.name LIKE ${search} OR
              u.username LIKE ${search} OR
              u.role LIKE ${search})
          ORDER BY a.attendance_date DESC, u.name ASC
          LIMIT ${pageSize} OFFSET ${offset}
        `) as Record<string, unknown>[])

  return toPaginatedResult(rows.map(toReportRow), total, page, pageSize)
}

export async function getAttendanceReport(
  params: AttendanceFilterParams = {},
): Promise<PaginatedResult<AttendanceReportRow>> {
  const range = resolveDateRange(params)
  const includeAbsent = params.includeAbsent !== false && Boolean(range.singleDay)

  if (includeAbsent && range.singleDay) {
    return getDayRoster(range.singleDay, params)
  }
  return getAttendanceRecords(range.from, range.to, params)
}

export async function getAttendanceExportRows(
  params: AttendanceFilterParams = {},
): Promise<AttendanceReportRow[]> {
  const result = await getAttendanceReport({
    ...params,
    page: "1",
    pageSize: "all",
  })
  return result.rows
}
