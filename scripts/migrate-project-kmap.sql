-- K-Map floor area capture table (MySQL)
-- The migration runner catches ER_TABLE_EXISTS_ERROR / ER_DUP_FIELDNAME.

CREATE TABLE IF NOT EXISTS project_kmap_areas (
  id            INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  project_id    INT NOT NULL,
  floor_key     VARCHAR(50) NOT NULL,
  plinth_area   DECIMAL(12,2),
  floor_area    DECIMAL(12,2),
  UNIQUE KEY uq_kmap_floor (project_id, floor_key),
  CONSTRAINT fk_kmap_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
