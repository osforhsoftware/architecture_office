-- MySQL search indexes (replaces PostgreSQL pg_trgm / GIN indexes).
-- LIKE searches on utf8mb4_unicode_ci columns are already case-insensitive.

CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON projects(updated_at);
CREATE INDEX IF NOT EXISTS idx_projects_code        ON projects(code);
CREATE INDEX IF NOT EXISTS idx_projects_name        ON projects(name);
CREATE INDEX IF NOT EXISTS idx_clients_created_at   ON clients(created_at);
CREATE INDEX IF NOT EXISTS idx_clients_name         ON clients(name);
CREATE INDEX IF NOT EXISTS idx_clients_phone        ON clients(phone);
CREATE INDEX IF NOT EXISTS idx_clients_email        ON clients(email);
CREATE INDEX IF NOT EXISTS idx_payments_method      ON payments(method);
