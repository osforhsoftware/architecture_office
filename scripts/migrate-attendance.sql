-- Staff Attendance module (MySQL)
-- Check In / Check Out only, with office geofence settings.

CREATE TABLE IF NOT EXISTS attendance (
  id                    INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  staff_id              INT NOT NULL,
  attendance_date       DATE NOT NULL,
  check_in              DATETIME NULL,
  check_out             DATETIME NULL,
  working_hours         DECIMAL(6,2) NULL,
  latitude              DECIMAL(10,7) NULL,
  longitude             DECIMAL(10,7) NULL,
  distance_from_office  DECIMAL(10,2) NULL,
  location_verified     TINYINT(1) NOT NULL DEFAULT 0,
  device_info           VARCHAR(500) NULL,
  ip_address            VARCHAR(100) NULL,
  created_at            DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at            DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_attendance_staff_date (staff_id, attendance_date),
  KEY idx_attendance_date (attendance_date),
  KEY idx_attendance_staff (staff_id),
  CONSTRAINT fk_attendance_staff FOREIGN KEY (staff_id) REFERENCES app_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Office attendance center (Google Maps short link resolved to lat/lng).
INSERT INTO office_settings (`key`, value, updated_at)
VALUES (
  'attendance_settings',
  JSON_OBJECT(
    'latitude', 10.8957539,
    'longitude', 76.0743256,
    'radius_meters', 300,
    'maps_url', 'https://maps.app.goo.gl/nnHZSiLpAeA7vSNQ8',
    'office_start_time', '09:30',
    'buffer_minutes', 10
  ),
  CURRENT_TIMESTAMP
)
ON DUPLICATE KEY UPDATE
  value = IF(
    JSON_EXTRACT(value, '$.latitude') IS NULL,
    VALUES(value),
    value
  );
