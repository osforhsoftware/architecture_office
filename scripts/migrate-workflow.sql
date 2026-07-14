-- Service-driven workflow tables for ArchPermit Office

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
  id              INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  project_id      INT NOT NULL,
  workflow_step_id INT NOT NULL,
  decision        VARCHAR(50) NOT NULL,
  note            TEXT,
  reviewed_by     INT,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
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

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS project_package VARCHAR(50) DEFAULT 'full',
  ADD COLUMN IF NOT EXISTS current_workflow_step_id INT NULL,
  ADD COLUMN IF NOT EXISTS work_completed_at DATETIME NULL;

ALTER TABLE checklist_items
  ADD COLUMN IF NOT EXISTS service_key VARCHAR(100) NULL;

-- Seed service catalog
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
