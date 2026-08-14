-- MySQL 8.0+ schema for ArchPermit Office
-- Converted from PostgreSQL: SERIAL→AUTO_INCREMENT, BOOLEAN→TINYINT(1),
-- TIMESTAMPTZ→DATETIME, JSONB→JSON, NUMERIC→DECIMAL.
-- Trigram / GIN indexes removed (MySQL uses LIKE on utf8mb4_unicode_ci).

SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS app_users (
  id          INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  username    VARCHAR(191) UNIQUE NOT NULL,
  password    VARCHAR(255) NOT NULL,
  role        VARCHAR(100) NOT NULL,
  name        VARCHAR(255) NOT NULL,
  email       VARCHAR(255),
  phone       VARCHAR(50),
  avatar_url  VARCHAR(500),
  active      TINYINT(1) NOT NULL DEFAULT 1,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Multiple department roles per staff member (app_users.role = primary/legacy).
CREATE TABLE IF NOT EXISTS staff_roles (
  user_id   INT NOT NULL,
  role_key  VARCHAR(50) NOT NULL,
  PRIMARY KEY (user_id, role_key),
  CONSTRAINT fk_staff_roles_user
    FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dynamic office departments (section names + linked staff role labels/keys).
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

CREATE TABLE IF NOT EXISTS clients (
  id               INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name             VARCHAR(500) NOT NULL,
  phone            VARCHAR(50) NOT NULL,
  email            VARCHAR(255),
  address          TEXT,
  street           VARCHAR(500),
  district         VARCHAR(100),
  aadhaar_numbers  JSON,
  linked_numbers   JSON,
  created_at       DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS projects (
  id               INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  code             VARCHAR(100) UNIQUE NOT NULL,
  name             VARCHAR(500) NOT NULL,
  client_id        INT NOT NULL,
  location         TEXT,
  type             VARCHAR(100),
  priority         VARCHAR(50)  DEFAULT 'Medium',
  status           VARCHAR(100) DEFAULT 'New',
  section          VARCHAR(100) DEFAULT 'Planning & Design',
  current_stage    INT          DEFAULT 0,
  assigned_to      INT,
  due_date         DATE,
  project_amount   DECIMAL(12,2) DEFAULT 0,
  advance_received DECIMAL(12,2) DEFAULT 0,
  invoice_number   VARCHAR(100),
  payment_status   VARCHAR(50)  DEFAULT 'Unpaid',
  review_note      TEXT,
  notes            TEXT,
  building_number  VARCHAR(100),
  building_permit_number VARCHAR(100),
  drawing_number   VARCHAR(100),
  edgebook_number  VARCHAR(100),
  refer_name       VARCHAR(255),
  req_architectural_plan TINYINT(1) DEFAULT 0,
  req_building_permit    TINYINT(1) DEFAULT 0,
  req_regularization     TINYINT(1) DEFAULT 0,
  project_package        VARCHAR(50) DEFAULT 'full',
  current_workflow_step_id INT,
  work_completed_at      DATETIME,
  created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_projects_client   FOREIGN KEY (client_id)   REFERENCES clients(id),
  CONSTRAINT fk_projects_assigned FOREIGN KEY (assigned_to) REFERENCES app_users(id),
  UNIQUE KEY uq_projects_drawing_number (drawing_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS project_assignees (
  project_id  INT NOT NULL,
  user_id     INT NOT NULL,
  stage_key   VARCHAR(100) NOT NULL DEFAULT 'site_visit',
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (project_id, user_id, stage_key),
  CONSTRAINT fk_pa_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  CONSTRAINT fk_pa_user FOREIGN KEY (user_id) REFERENCES app_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS services (
  id          INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  service_key VARCHAR(100) UNIQUE NOT NULL,
  label       VARCHAR(255) NOT NULL,
  section     VARCHAR(100) NOT NULL,
  role        VARCHAR(100) NOT NULL,
  sort_order  INT NOT NULL DEFAULT 0,
  active      TINYINT(1) NOT NULL DEFAULT 1,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO services (service_key, label, section, role, sort_order) VALUES
  ('site_survey', 'Site Survey / Measurement', 'Planning & Design', 'Planning Staff', 1),
  ('architecture_design', 'Architecture Design', 'Planning & Design', 'Planning Staff', 2),
  ('concept_design', 'Concept Design', 'Planning & Design', 'Planning Staff', 3),
  ('plot_sketch', 'Plot Sketch', 'Planning & Design', 'Planning Staff', 4),
  ('building_permit', 'Building Permit', 'Building Permit', 'Permit Staff', 5),
  ('permit_renewal', 'Permit Renewal', 'Building Permit', 'Permit Staff', 6),
  ('3d_elevation', '3D Elevation', '3D & Interior', '3D Staff', 7),
  ('interior_design', 'Interior Design', '3D & Interior', '3D Staff', 8),
  ('working_drawings', 'Working Drawings', 'Estimation & Construction', 'Estimation Staff', 9),
  ('estimation', 'Estimation', 'Estimation & Construction', 'Estimation Staff', 10),
  ('construction_supervision', 'Construction Supervision', 'Estimation & Construction', 'Estimation Staff', 11),
  ('valuation', 'Valuation Course', 'Estimation & Construction', 'Estimation Staff', 12);

CREATE TABLE IF NOT EXISTS project_services (
  project_id   INT NOT NULL,
  service_key  VARCHAR(100) NOT NULL,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (project_id, service_key),
  CONSTRAINT fk_ps_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS document_templates (
  id          INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  service_key VARCHAR(100) NOT NULL,
  label       VARCHAR(255) NOT NULL,
  sort_order  INT NOT NULL DEFAULT 0,
  active      TINYINT(1) NOT NULL DEFAULT 1,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_document_template (service_key, label),
  KEY idx_document_templates_service (service_key),
  KEY idx_document_templates_active (active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS additional_requirement_templates (
  id              INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  requirement_key VARCHAR(100) UNIQUE NOT NULL,
  label           VARCHAR(255) NOT NULL,
  value_type      VARCHAR(20) NOT NULL DEFAULT 'text',
  choice_options  JSON,
  sort_order      INT NOT NULL DEFAULT 0,
  active          TINYINT(1) NOT NULL DEFAULT 1,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_additional_requirement_label (label),
  KEY idx_additional_requirement_active (active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS project_additional_requirements (
  project_id      INT NOT NULL,
  requirement_key VARCHAR(100) NOT NULL,
  label           VARCHAR(255) NOT NULL,
  value           VARCHAR(500) NOT NULL DEFAULT '',
  value_type      VARCHAR(20) NOT NULL DEFAULT 'text',
  choice_options  JSON,
  sort_order      INT NOT NULL DEFAULT 0,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (project_id, requirement_key),
  CONSTRAINT fk_par_project
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS workflow_steps (
  id            INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  project_id    INT NOT NULL,
  step_type     VARCHAR(50) NOT NULL,
  step_key      VARCHAR(100) NOT NULL,
  label         VARCHAR(255) NOT NULL,
  section       VARCHAR(100) NOT NULL,
  service_key   VARCHAR(100),
  sort_order    INT NOT NULL,
  step_status   VARCHAR(50) NOT NULL DEFAULT 'pending',
  assigned_to   INT,
  started_at    DATETIME,
  completed_at  DATETIME,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_workflow_step (project_id, step_key),
  CONSTRAINT fk_ws_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  CONSTRAINT fk_ws_assignee FOREIGN KEY (assigned_to) REFERENCES app_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS workflow_reviews (
  id               INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  project_id       INT NOT NULL,
  workflow_step_id INT NOT NULL,
  decision         VARCHAR(50) NOT NULL,
  note             TEXT,
  reviewed_by      INT,
  created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_wr_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  CONSTRAINT fk_wr_step FOREIGN KEY (workflow_step_id) REFERENCES workflow_steps(id) ON DELETE CASCADE,
  CONSTRAINT fk_wr_reviewer FOREIGN KEY (reviewed_by) REFERENCES app_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS workflow_assignments (
  id               INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  project_id       INT NOT NULL,
  workflow_step_id INT NOT NULL,
  user_id          INT NOT NULL,
  assigned_by      INT,
  note             TEXT,
  created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_wa_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  CONSTRAINT fk_wa_step FOREIGN KEY (workflow_step_id) REFERENCES workflow_steps(id) ON DELETE CASCADE,
  CONSTRAINT fk_wa_user FOREIGN KEY (user_id) REFERENCES app_users(id),
  CONSTRAINT fk_wa_assigner FOREIGN KEY (assigned_by) REFERENCES app_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS checklist_items (
  id             INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  project_id     INT NOT NULL,
  item_key       VARCHAR(255) NOT NULL,
  service_key    VARCHAR(100),
  checked        TINYINT(1) DEFAULT 0,
  filed          TINYINT(1) DEFAULT 0,
  review_status  VARCHAR(50) DEFAULT 'Pending',
  UNIQUE KEY uq_checklist (project_id, item_key),
  CONSTRAINT fk_checklist_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS project_kmap_areas (
  id            INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  project_id    INT NOT NULL,
  floor_key     VARCHAR(50) NOT NULL,
  plinth_area   DECIMAL(12,2),
  floor_area    DECIMAL(12,2),
  UNIQUE KEY uq_kmap_floor (project_id, floor_key),
  CONSTRAINT fk_kmap_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS status_history (
  id          INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  project_id  INT NOT NULL,
  status      VARCHAR(100) NOT NULL,
  note        TEXT,
  created_by  VARCHAR(255),
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_status_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS return_history (
  id          INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  project_id  INT NOT NULL,
  reason      TEXT NOT NULL,
  notes       TEXT,
  created_by  VARCHAR(255),
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_return_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS project_files (
  id           INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  project_id   INT NOT NULL,
  name         VARCHAR(500) NOT NULL,
  file_type    VARCHAR(100),
  category     VARCHAR(100),
  uploaded_by  INT,
  version      INT DEFAULT 1,
  storage_path TEXT,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_files_project FOREIGN KEY (project_id)  REFERENCES projects(id)   ON DELETE CASCADE,
  CONSTRAINT fk_files_user    FOREIGN KEY (uploaded_by) REFERENCES app_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payments (
  id           INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  project_id   INT NOT NULL,
  amount       DECIMAL(12,2) NOT NULL,
  method       VARCHAR(100) NOT NULL,
  note         TEXT,
  recorded_by  INT,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_payments_project FOREIGN KEY (project_id)  REFERENCES projects(id)   ON DELETE CASCADE,
  CONSTRAINT fk_payments_user    FOREIGN KEY (recorded_by) REFERENCES app_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS notifications (
  id          INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NOT NULL,
  type        VARCHAR(100) NOT NULL,
  title       VARCHAR(500) NOT NULL,
  message     TEXT,
  `read`      TINYINT(1) DEFAULT 0,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS audit_logs (
  id           INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id      INT,
  role         VARCHAR(100),
  action       VARCHAR(255) NOT NULL,
  entity_type  VARCHAR(100) NOT NULL,
  entity_id    INT,
  details      JSON,
  ip_address   VARCHAR(100),
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES app_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS office_settings (
  `key`       VARCHAR(255) NOT NULL PRIMARY KEY,
  value       JSON NOT NULL,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS attendance (
  id                    INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  staff_id              INT NOT NULL,
  attendance_date       DATE NOT NULL,
  check_in              DATETIME NULL,
  check_out             DATETIME NULL,
  working_hours         DECIMAL(6,2) NULL,
  status                VARCHAR(50) NOT NULL DEFAULT 'Present',
  latitude              DECIMAL(10,7) NULL,
  longitude             DECIMAL(10,7) NULL,
  distance_from_office  DECIMAL(10,2) NULL,
  location_verified     TINYINT(1) NOT NULL DEFAULT 0,
  is_manual             TINYINT(1) NOT NULL DEFAULT 0,
  marked_by             INT NULL,
  admin_note            VARCHAR(500) NULL,
  device_info           VARCHAR(500) NULL,
  ip_address            VARCHAR(100) NULL,
  created_at            DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at            DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_attendance_staff_date (staff_id, attendance_date),
  KEY idx_attendance_date (attendance_date),
  KEY idx_attendance_staff (staff_id),
  CONSTRAINT fk_attendance_staff FOREIGN KEY (staff_id) REFERENCES app_users(id),
  CONSTRAINT fk_attendance_marked_by FOREIGN KEY (marked_by) REFERENCES app_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO office_settings (`key`, value) VALUES (
  'attendance_settings',
  JSON_OBJECT(
    'latitude', 10.8957539,
    'longitude', 76.0743256,
    'radius_meters', 300,
    'maps_url', 'https://maps.app.goo.gl/nnHZSiLpAeA7vSNQ8',
    'office_start_time', '09:30',
    'buffer_minutes', 10
  )
);

CREATE TABLE IF NOT EXISTS invoices (
  id               INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  project_id       INT,
  invoice_number   VARCHAR(100) UNIQUE NOT NULL,
  status           VARCHAR(50)  DEFAULT 'Draft',
  invoice_date     DATE NOT NULL,
  due_date         DATE,
  client_name      VARCHAR(500) NOT NULL,
  client_address   TEXT,
  client_email     VARCHAR(255),
  client_phone     VARCHAR(50),
  client_tax_id    VARCHAR(100),
  project_name     VARCHAR(500),
  notes            TEXT,
  terms            TEXT,
  subtotal         DECIMAL(12,2) DEFAULT 0,
  tax_percent      DECIMAL(5,2)  DEFAULT 0,
  tax_amount       DECIMAL(12,2) DEFAULT 0,
  discount_percent DECIMAL(5,2)  DEFAULT 0,
  discount_amount  DECIMAL(12,2) DEFAULT 0,
  total            DECIMAL(12,2) DEFAULT 0,
  amount_paid      DECIMAL(12,2) DEFAULT 0,
  balance          DECIMAL(12,2) DEFAULT 0,
  created_by       INT,
  created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_invoices_project FOREIGN KEY (project_id)  REFERENCES projects(id)   ON DELETE SET NULL,
  CONSTRAINT fk_invoices_creator FOREIGN KEY (created_by)  REFERENCES app_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS invoice_line_items (
  id               INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  invoice_id       INT NOT NULL,
  description      TEXT NOT NULL,
  quantity         DECIMAL(10,2) DEFAULT 1,
  unit             VARCHAR(50)   DEFAULT 'Nos',
  unit_price       DECIMAL(12,2) DEFAULT 0,
  discount_amount  DECIMAL(12,2) NOT NULL DEFAULT 0,
  discount_percent DECIMAL(5,2)  NOT NULL DEFAULT 0,
  amount           DECIMAL(12,2) DEFAULT 0,
  sort_order       INT DEFAULT 0,
  CONSTRAINT fk_line_items_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS invoice_payments (
  id            INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  invoice_id    INT NOT NULL,
  amount        DECIMAL(12,2) NOT NULL,
  payment_date  DATE NOT NULL,
  method        VARCHAR(100) NOT NULL,
  notes         TEXT,
  recorded_by   INT,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_inv_payments_invoice FOREIGN KEY (invoice_id)   REFERENCES invoices(id)   ON DELETE CASCADE,
  CONSTRAINT fk_inv_payments_user    FOREIGN KEY (recorded_by)  REFERENCES app_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Standard indexes (MySQL 8.0 supports CREATE INDEX IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS idx_projects_status      ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_section     ON projects(section);
CREATE INDEX IF NOT EXISTS idx_projects_assigned_to ON projects(assigned_to);
CREATE INDEX IF NOT EXISTS idx_projects_client_id   ON projects(client_id);
CREATE INDEX IF NOT EXISTS idx_projects_created_at  ON projects(created_at);
CREATE INDEX IF NOT EXISTS idx_projects_updated_at  ON projects(updated_at);
CREATE INDEX IF NOT EXISTS idx_projects_code        ON projects(code);
CREATE INDEX IF NOT EXISTS idx_projects_name        ON projects(name);
CREATE INDEX IF NOT EXISTS idx_clients_created_at   ON clients(created_at);
CREATE INDEX IF NOT EXISTS idx_clients_name         ON clients(name);
CREATE INDEX IF NOT EXISTS idx_clients_phone        ON clients(phone);
CREATE INDEX IF NOT EXISTS idx_clients_email        ON clients(email);
CREATE INDEX IF NOT EXISTS idx_payments_project_id  ON payments(project_id);
CREATE INDEX IF NOT EXISTS idx_payments_created_at  ON payments(created_at);
CREATE INDEX IF NOT EXISTS idx_payments_method      ON payments(method);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, `read`);
CREATE INDEX IF NOT EXISTS idx_status_history_project    ON status_history(project_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at     ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_invoices_project_id       ON invoices(project_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status           ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_date     ON invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date         ON invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at       ON invoices(created_at);
CREATE INDEX IF NOT EXISTS idx_invoice_line_items_inv    ON invoice_line_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_inv      ON invoice_payments(invoice_id);

-- ---------------------------------------------------------------------------
-- Finance & Expense Management (see also scripts/migrate-finance.sql)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS income_categories (
  id          INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(255) NOT NULL,
  icon        VARCHAR(100) DEFAULT 'CircleDollarSign',
  color       VARCHAR(50)  DEFAULT '#16a34a',
  active      TINYINT(1)   DEFAULT 1,
  sort_order  INT          DEFAULT 0,
  created_at  DATETIME     DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_income_categories_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS expense_categories (
  id          INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(255) NOT NULL,
  icon        VARCHAR(100) DEFAULT 'Receipt',
  color       VARCHAR(50)  DEFAULT '#dc2626',
  active      TINYINT(1)   DEFAULT 1,
  sort_order  INT          DEFAULT 0,
  created_at  DATETIME     DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_expense_categories_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS finance_accounts (
  id               INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name             VARCHAR(255) NOT NULL,
  account_type     VARCHAR(50)  NOT NULL DEFAULT 'bank',
  bank_name        VARCHAR(255),
  account_number   VARCHAR(100),
  opening_balance  DECIMAL(14,2) NOT NULL DEFAULT 0,
  current_balance  DECIMAL(14,2) NOT NULL DEFAULT 0,
  active           TINYINT(1)    DEFAULT 1,
  notes            TEXT,
  deleted_at       DATETIME,
  created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_finance_accounts_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS vendors (
  id                   INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name                 VARCHAR(500) NOT NULL,
  phone                VARCHAR(50),
  email                VARCHAR(255),
  gst                  VARCHAR(50),
  address              TEXT,
  notes                TEXT,
  outstanding_balance  DECIMAL(14,2) NOT NULL DEFAULT 0,
  active               TINYINT(1) DEFAULT 1,
  deleted_at           DATETIME,
  created_at           DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at           DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS finance_income (
  id                INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  receipt_number    VARCHAR(50)  NOT NULL,
  income_date       DATE         NOT NULL,
  client_id         INT,
  project_id        INT,
  invoice_id        INT,
  category_id       INT,
  account_id        INT,
  payment_method    VARCHAR(100) NOT NULL,
  amount            DECIMAL(14,2) NOT NULL,
  reference_number  VARCHAR(255),
  notes             TEXT,
  attachment_path   TEXT,
  status            VARCHAR(50)  NOT NULL DEFAULT 'Approved',
  created_by        INT,
  approved_by       INT,
  approved_at       DATETIME,
  deleted_at        DATETIME,
  created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_finance_income_receipt (receipt_number),
  CONSTRAINT fk_fi_client   FOREIGN KEY (client_id)   REFERENCES clients(id)            ON DELETE SET NULL,
  CONSTRAINT fk_fi_project  FOREIGN KEY (project_id)  REFERENCES projects(id)           ON DELETE SET NULL,
  CONSTRAINT fk_fi_invoice  FOREIGN KEY (invoice_id)  REFERENCES invoices(id)           ON DELETE SET NULL,
  CONSTRAINT fk_fi_category FOREIGN KEY (category_id) REFERENCES income_categories(id)  ON DELETE SET NULL,
  CONSTRAINT fk_fi_account  FOREIGN KEY (account_id)  REFERENCES finance_accounts(id)   ON DELETE SET NULL,
  CONSTRAINT fk_fi_creator  FOREIGN KEY (created_by)  REFERENCES app_users(id)          ON DELETE SET NULL,
  CONSTRAINT fk_fi_approver FOREIGN KEY (approved_by) REFERENCES app_users(id)          ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS finance_expenses (
  id                INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  expense_number    VARCHAR(50)  NOT NULL,
  expense_date      DATE         NOT NULL,
  vendor_id         INT,
  project_id        INT,
  category_id       INT,
  account_id        INT,
  amount            DECIMAL(14,2) NOT NULL,
  gst_amount        DECIMAL(14,2) NOT NULL DEFAULT 0,
  payment_method    VARCHAR(100) NOT NULL,
  reference_number  VARCHAR(255),
  notes             TEXT,
  bill_path         TEXT,
  status            VARCHAR(50)  NOT NULL DEFAULT 'Draft',
  created_by        INT,
  approved_by       INT,
  approved_at       DATETIME,
  paid_at           DATETIME,
  deleted_at        DATETIME,
  created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_finance_expenses_number (expense_number),
  CONSTRAINT fk_fe_vendor   FOREIGN KEY (vendor_id)   REFERENCES vendors(id)              ON DELETE SET NULL,
  CONSTRAINT fk_fe_project  FOREIGN KEY (project_id)  REFERENCES projects(id)             ON DELETE SET NULL,
  CONSTRAINT fk_fe_category FOREIGN KEY (category_id) REFERENCES expense_categories(id)   ON DELETE SET NULL,
  CONSTRAINT fk_fe_account  FOREIGN KEY (account_id)  REFERENCES finance_accounts(id)     ON DELETE SET NULL,
  CONSTRAINT fk_fe_creator  FOREIGN KEY (created_by)  REFERENCES app_users(id)            ON DELETE SET NULL,
  CONSTRAINT fk_fe_approver FOREIGN KEY (approved_by) REFERENCES app_users(id)            ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS staff_expenses (
  id                  INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  claim_number        VARCHAR(50)  NOT NULL,
  staff_id            INT NOT NULL,
  project_id          INT,
  category            VARCHAR(100) NOT NULL,
  amount              DECIMAL(14,2) NOT NULL,
  claim_date          DATE NOT NULL,
  receipt_path        TEXT,
  gps_lat             DECIMAL(10,7),
  gps_lng             DECIMAL(10,7),
  notes               TEXT,
  status              VARCHAR(50) NOT NULL DEFAULT 'Submitted',
  dept_reviewed_by    INT,
  dept_reviewed_at    DATETIME,
  admin_approved_by   INT,
  admin_approved_at   DATETIME,
  paid_by             INT,
  paid_at             DATETIME,
  account_id          INT,
  rejection_reason    TEXT,
  deleted_at          DATETIME,
  created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_staff_expenses_claim (claim_number),
  CONSTRAINT fk_se_staff    FOREIGN KEY (staff_id)          REFERENCES app_users(id)        ON DELETE CASCADE,
  CONSTRAINT fk_se_project  FOREIGN KEY (project_id)        REFERENCES projects(id)         ON DELETE SET NULL,
  CONSTRAINT fk_se_dept     FOREIGN KEY (dept_reviewed_by)  REFERENCES app_users(id)        ON DELETE SET NULL,
  CONSTRAINT fk_se_admin    FOREIGN KEY (admin_approved_by) REFERENCES app_users(id)        ON DELETE SET NULL,
  CONSTRAINT fk_se_paid     FOREIGN KEY (paid_by)           REFERENCES app_users(id)        ON DELETE SET NULL,
  CONSTRAINT fk_se_account  FOREIGN KEY (account_id)        REFERENCES finance_accounts(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS vendor_payments (
  id              INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  vendor_id       INT NOT NULL,
  expense_id      INT,
  amount          DECIMAL(14,2) NOT NULL,
  payment_date    DATE NOT NULL,
  payment_method  VARCHAR(100) NOT NULL,
  account_id      INT,
  reference       VARCHAR(255),
  notes           TEXT,
  created_by      INT,
  deleted_at      DATETIME,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_vp_vendor  FOREIGN KEY (vendor_id)  REFERENCES vendors(id)            ON DELETE CASCADE,
  CONSTRAINT fk_vp_expense FOREIGN KEY (expense_id) REFERENCES finance_expenses(id)   ON DELETE SET NULL,
  CONSTRAINT fk_vp_account FOREIGN KEY (account_id) REFERENCES finance_accounts(id)   ON DELETE SET NULL,
  CONSTRAINT fk_vp_creator FOREIGN KEY (created_by) REFERENCES app_users(id)          ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS bank_transfers (
  id                INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  transfer_number   VARCHAR(50) NOT NULL,
  from_account_id   INT NOT NULL,
  to_account_id     INT NOT NULL,
  amount            DECIMAL(14,2) NOT NULL,
  transfer_date     DATE NOT NULL,
  reference         VARCHAR(255),
  notes             TEXT,
  created_by        INT,
  deleted_at        DATETIME,
  created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_bank_transfers_number (transfer_number),
  CONSTRAINT fk_bt_from    FOREIGN KEY (from_account_id) REFERENCES finance_accounts(id),
  CONSTRAINT fk_bt_to      FOREIGN KEY (to_account_id)   REFERENCES finance_accounts(id),
  CONSTRAINT fk_bt_creator FOREIGN KEY (created_by)      REFERENCES app_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS finance_transactions (
  id                  INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  transaction_number  VARCHAR(50)  NOT NULL,
  transaction_date    DATE         NOT NULL,
  txn_type            VARCHAR(50)  NOT NULL,
  account_id          INT,
  amount              DECIMAL(14,2) NOT NULL,
  direction           VARCHAR(10)  NOT NULL,
  payment_method      VARCHAR(100),
  project_id          INT,
  description         TEXT,
  ref_type            VARCHAR(50),
  ref_id              INT,
  created_by          INT,
  deleted_at          DATETIME,
  created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_finance_txn_number (transaction_number),
  CONSTRAINT fk_ft_account FOREIGN KEY (account_id)  REFERENCES finance_accounts(id) ON DELETE SET NULL,
  CONSTRAINT fk_ft_project FOREIGN KEY (project_id)  REFERENCES projects(id)         ON DELETE SET NULL,
  CONSTRAINT fk_ft_creator FOREIGN KEY (created_by)  REFERENCES app_users(id)        ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cash_book (
  id               INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  entry_date       DATE NOT NULL,
  transaction_id   VARCHAR(50) NOT NULL,
  income_amount    DECIMAL(14,2) NOT NULL DEFAULT 0,
  expense_amount   DECIMAL(14,2) NOT NULL DEFAULT 0,
  balance          DECIMAL(14,2) NOT NULL DEFAULT 0,
  account_id       INT,
  payment_method   VARCHAR(100),
  project_id       INT,
  description      TEXT,
  entry_type       VARCHAR(50) NOT NULL DEFAULT 'transaction',
  ref_type         VARCHAR(50),
  ref_id           INT,
  created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_cb_account FOREIGN KEY (account_id) REFERENCES finance_accounts(id) ON DELETE SET NULL,
  CONSTRAINT fk_cb_project FOREIGN KEY (project_id) REFERENCES projects(id)         ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS project_finance (
  id                 INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  project_id         INT NOT NULL,
  project_value      DECIMAL(14,2) NOT NULL DEFAULT 0,
  total_income       DECIMAL(14,2) NOT NULL DEFAULT 0,
  total_expense      DECIMAL(14,2) NOT NULL DEFAULT 0,
  advance_received   DECIMAL(14,2) NOT NULL DEFAULT 0,
  balance_amount     DECIMAL(14,2) NOT NULL DEFAULT 0,
  net_profit         DECIMAL(14,2) NOT NULL DEFAULT 0,
  profit_percent     DECIMAL(8,2)  NOT NULL DEFAULT 0,
  updated_at         DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_project_finance_project (project_id),
  CONSTRAINT fk_pf_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS finance_attachments (
  id           INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  entity_type  VARCHAR(50)  NOT NULL,
  entity_id    INT          NOT NULL,
  file_name    VARCHAR(500) NOT NULL,
  file_path    TEXT         NOT NULL,
  mime_type    VARCHAR(100),
  uploaded_by  INT,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_fa_uploader FOREIGN KEY (uploaded_by) REFERENCES app_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS approval_logs (
  id           INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  entity_type  VARCHAR(50)  NOT NULL,
  entity_id    INT          NOT NULL,
  action       VARCHAR(100) NOT NULL,
  from_status  VARCHAR(50),
  to_status    VARCHAR(50),
  user_id      INT,
  comment      TEXT,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_al_user FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS finance_notifications (
  id           INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id      INT NOT NULL,
  type         VARCHAR(100) NOT NULL,
  title        VARCHAR(500) NOT NULL,
  message      TEXT,
  entity_type  VARCHAR(50),
  entity_id    INT,
  `read`       TINYINT(1) DEFAULT 0,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_fn_user FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS finance_settings (
  `key`       VARCHAR(255) NOT NULL PRIMARY KEY,
  value       JSON NOT NULL,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX IF NOT EXISTS idx_fi_date        ON finance_income(income_date);
CREATE INDEX IF NOT EXISTS idx_fi_status      ON finance_income(status);
CREATE INDEX IF NOT EXISTS idx_fe_date        ON finance_expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_fe_status      ON finance_expenses(status);
CREATE INDEX IF NOT EXISTS idx_se_staff       ON staff_expenses(staff_id);
CREATE INDEX IF NOT EXISTS idx_ft_date        ON finance_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_cb_date        ON cash_book(entry_date);
CREATE INDEX IF NOT EXISTS idx_vendors_name   ON vendors(name);
CREATE INDEX IF NOT EXISTS idx_fn_user_read   ON finance_notifications(user_id, `read`);

SET FOREIGN_KEY_CHECKS = 1;
