-- Staff profile avatar migration (MySQL)
-- Note: MySQL does not support ALTER TABLE ADD COLUMN IF NOT EXISTS.
-- The migration runner catches ER_DUP_FIELDNAME so this is safe to re-run.

ALTER TABLE app_users ADD COLUMN avatar_url VARCHAR(500) NULL;
