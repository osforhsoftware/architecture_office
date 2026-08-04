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
