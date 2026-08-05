-- Attendance: Late Coming + office timing settings + admin manual mark fields

ALTER TABLE attendance
  ADD COLUMN status VARCHAR(50) NOT NULL DEFAULT 'Present' AFTER working_hours;

ALTER TABLE attendance
  ADD COLUMN is_manual TINYINT(1) NOT NULL DEFAULT 0 AFTER location_verified;

ALTER TABLE attendance
  ADD COLUMN marked_by INT NULL AFTER is_manual;

ALTER TABLE attendance
  ADD COLUMN admin_note VARCHAR(500) NULL AFTER marked_by;

ALTER TABLE attendance
  ADD CONSTRAINT fk_attendance_marked_by
    FOREIGN KEY (marked_by) REFERENCES app_users(id) ON DELETE SET NULL;

-- Merge office timing defaults into attendance_settings (keep existing coords).
UPDATE office_settings
SET value = JSON_SET(
  COALESCE(value, JSON_OBJECT()),
  '$.office_start_time',
  COALESCE(JSON_UNQUOTE(JSON_EXTRACT(value, '$.office_start_time')), '09:30'),
  '$.buffer_minutes',
  COALESCE(CAST(JSON_EXTRACT(value, '$.buffer_minutes') AS UNSIGNED), 10)
),
updated_at = CURRENT_TIMESTAMP
WHERE `key` = 'attendance_settings';

INSERT INTO office_settings (`key`, value, updated_at)
SELECT
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
WHERE NOT EXISTS (
  SELECT 1 FROM office_settings WHERE `key` = 'attendance_settings'
);
