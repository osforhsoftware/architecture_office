import type { AttendanceStatus } from "./constants"

export interface AttendanceSettings {
  latitude: number
  longitude: number
  radius_meters: number
  maps_url: string
  office_start_time: string
  buffer_minutes: number
}

export interface AttendanceRecord {
  id: number
  staff_id: number
  attendance_date: string
  check_in: string | null
  check_out: string | null
  working_hours: number | null
  status: AttendanceStatus
  latitude: number | null
  longitude: number | null
  distance_from_office: number | null
  location_verified: boolean
  is_manual: boolean
  marked_by: number | null
  admin_note: string | null
  device_info: string | null
  ip_address: string | null
  created_at: string
  updated_at: string
  staff_name?: string
  department?: string
  attendance_status?: AttendanceStatus
}

export interface AttendanceReportRow {
  date: string
  staff_id: number
  staff_name: string
  department: string
  check_in: string | null
  check_out: string | null
  working_hours: number | null
  attendance_status: AttendanceStatus
  location_verified: boolean
  is_manual: boolean
  distance_from_office: number | null
  latitude: number | null
  longitude: number | null
  admin_note: string | null
  marked_by_name: string | null
}

export interface AttendancePunchInput {
  latitude: number
  longitude: number
  deviceInfo?: string
}

export interface LateComingInfo {
  isLateWindow: boolean
  officeStartTime: string
  bufferMinutes: number
  lateAfterTime: string
  message: string
}
