-- Client address / Aadhaar fields migration (MySQL)
-- Note: MySQL does not support ALTER TABLE ADD COLUMN IF NOT EXISTS.
-- The migration runner (migrate-client-fields.mjs) catches ER_DUP_FIELDNAME
-- errors so this file is safe to re-run on existing databases.

ALTER TABLE clients ADD COLUMN street VARCHAR(500);
ALTER TABLE clients ADD COLUMN district VARCHAR(100);
ALTER TABLE clients ADD COLUMN aadhaar_numbers JSON;
ALTER TABLE clients ADD COLUMN linked_numbers JSON;
