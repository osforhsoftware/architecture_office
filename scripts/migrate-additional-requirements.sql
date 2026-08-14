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

ALTER TABLE additional_requirement_templates
  ADD COLUMN value_type VARCHAR(20) NOT NULL DEFAULT 'text';
ALTER TABLE additional_requirement_templates
  ADD COLUMN choice_options JSON;
ALTER TABLE project_additional_requirements
  ADD COLUMN value_type VARCHAR(20) NOT NULL DEFAULT 'text';
ALTER TABLE project_additional_requirements
  ADD COLUMN choice_options JSON;
