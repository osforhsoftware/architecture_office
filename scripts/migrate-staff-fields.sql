-- Staff fields migration (MySQL)
-- Note: MySQL does not support ALTER TABLE ADD COLUMN IF NOT EXISTS.
-- The migration runner (migrate-staff-fields.mjs) catches ER_DUP_FIELDNAME
-- errors so this file is safe to re-run on existing databases.

ALTER TABLE app_users ADD COLUMN email  VARCHAR(255);
ALTER TABLE app_users ADD COLUMN phone  VARCHAR(50);
ALTER TABLE app_users ADD COLUMN active TINYINT(1) NOT NULL DEFAULT 1;
