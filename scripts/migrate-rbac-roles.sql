-- RBAC: Super Admin / Admin split + audit log enrichment
-- Safe to re-run (duplicate column errors are ignored by the migrate script)

ALTER TABLE audit_logs ADD COLUMN role VARCHAR(100) NULL AFTER user_id;
ALTER TABLE audit_logs ADD COLUMN ip_address VARCHAR(100) NULL AFTER details;

-- Existing full-power Admin accounts become Super Admin
UPDATE app_users SET role = 'Super Admin' WHERE role = 'Admin';
