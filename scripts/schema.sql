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

CREATE TABLE IF NOT EXISTS clients (
  id               INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name             VARCHAR(500) NOT NULL,
  phone            VARCHAR(50) NOT NULL,
  email            VARCHAR(255),
  address          TEXT,
  street           VARCHAR(500),
  district         VARCHAR(100),
  aadhaar_numbers  JSON,
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
  building_number  VARCHAR(100),
  building_permit_number VARCHAR(100),
  drawing_number   VARCHAR(100),
  req_architectural_plan TINYINT(1) DEFAULT 0,
  req_building_permit    TINYINT(1) DEFAULT 0,
  req_regularization     TINYINT(1) DEFAULT 0,
  project_package        VARCHAR(50) DEFAULT 'full',
  current_workflow_step_id INT,
  work_completed_at      DATETIME,
  created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_projects_client   FOREIGN KEY (client_id)   REFERENCES clients(id),
  CONSTRAINT fk_projects_assigned FOREIGN KEY (assigned_to) REFERENCES app_users(id)
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

CREATE TABLE IF NOT EXISTS project_services (
  project_id   INT NOT NULL,
  service_key  VARCHAR(100) NOT NULL,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (project_id, service_key),
  CONSTRAINT fk_ps_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
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
  id           INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  invoice_id   INT NOT NULL,
  description  TEXT NOT NULL,
  quantity     DECIMAL(10,2) DEFAULT 1,
  unit         VARCHAR(50)   DEFAULT 'Nos',
  unit_price   DECIMAL(12,2) DEFAULT 0,
  amount       DECIMAL(12,2) DEFAULT 0,
  sort_order   INT DEFAULT 0,
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

SET FOREIGN_KEY_CHECKS = 1;
