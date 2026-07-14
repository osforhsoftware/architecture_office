-- Multi department roles per staff member (junction table).
-- app_users.role remains the primary/legacy role for portal routing.

CREATE TABLE IF NOT EXISTS staff_roles (
  user_id   INT NOT NULL,
  role_key  VARCHAR(50) NOT NULL,
  PRIMARY KEY (user_id, role_key),
  CONSTRAINT fk_staff_roles_user
    FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Backfill from existing single-role column (staff only).
INSERT IGNORE INTO staff_roles (user_id, role_key)
SELECT id,
  CASE role
    WHEN 'Planning Staff' THEN 'PLANNING_STAFF'
    WHEN 'Permit Staff' THEN 'PERMIT_STAFF'
    WHEN '3D Staff' THEN 'THREED_STAFF'
    WHEN 'Estimation Staff' THEN 'ESTIMATION_STAFF'
    WHEN 'Billing Staff' THEN 'BILLING_STAFF'
    ELSE NULL
  END
FROM app_users
WHERE role IN (
  'Planning Staff',
  'Permit Staff',
  '3D Staff',
  'Estimation Staff',
  'Billing Staff'
);
