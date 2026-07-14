CREATE TABLE IF NOT EXISTS project_assignees (
  project_id  INT NOT NULL,
  user_id     INT NOT NULL,
  stage_key   VARCHAR(100) NOT NULL DEFAULT 'site_visit',
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (project_id, user_id, stage_key),
  CONSTRAINT fk_pa_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  CONSTRAINT fk_pa_user FOREIGN KEY (user_id) REFERENCES app_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
