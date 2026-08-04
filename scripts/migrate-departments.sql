-- Dynamic departments (add / edit / delete)
-- Safe to re-run: CREATE IF NOT EXISTS + INSERT IGNORE

CREATE TABLE IF NOT EXISTS departments (
  id          INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  role_label  VARCHAR(100) NOT NULL,
  role_key    VARCHAR(50)  NOT NULL,
  sort_order  INT NOT NULL DEFAULT 0,
  active      TINYINT(1) NOT NULL DEFAULT 1,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_departments_name (name),
  UNIQUE KEY uq_departments_role_key (role_key),
  UNIQUE KEY uq_departments_role_label (role_label)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO departments (name, role_label, role_key, sort_order, active) VALUES
  ('Planning & Design', 'Planning Staff', 'PLANNING_STAFF', 10, 1),
  ('Building Permit', 'Permit Staff', 'PERMIT_STAFF', 20, 1),
  ('3D & Interior', '3D Staff', 'THREED_STAFF', 30, 1),
  ('Estimation & Construction', 'Estimation Staff', 'ESTIMATION_STAFF', 40, 1),
  ('Billing', 'Billing Staff', 'BILLING_STAFF', 50, 1);

CREATE INDEX IF NOT EXISTS idx_departments_active_sort ON departments(active, sort_order);
