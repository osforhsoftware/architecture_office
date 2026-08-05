/** Default office attendance center from Google Maps short link. */
export const DEFAULT_ATTENDANCE_SETTINGS = {
  latitude: 10.8957539,
  longitude: 76.0743256,
  radius_meters: 300,
  maps_url: "https://maps.app.goo.gl/nnHZSiLpAeA7vSNQ8",
  /** Office start time (HH:mm) in Asia/Kolkata */
  office_start_time: "09:30",
  /** Grace period after office start before Late Coming */
  buffer_minutes: 10,
} as const

export const ATTENDANCE_SETTINGS_KEY = "attendance_settings"

export const ATTENDANCE_STATUSES = ["Present", "Late Coming", "Absent"] as const

export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number]

export const OUTSIDE_OFFICE_MESSAGE =
  "You are outside the office attendance area (300 meters)."

export const LATE_COMING_ALERT_MESSAGE =
  "You are late. Office start time has passed the allowed buffer. Please check in — your attendance will be marked as Late Coming."
