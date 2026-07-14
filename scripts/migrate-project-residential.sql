-- Residential project detail fields (MySQL)
-- The migration runner catches ER_DUP_FIELDNAME so this file is safe to re-run.

ALTER TABLE projects ADD COLUMN building_number VARCHAR(100);
ALTER TABLE projects ADD COLUMN building_permit_number VARCHAR(100);
ALTER TABLE projects ADD COLUMN req_architectural_plan TINYINT(1) DEFAULT 0;
ALTER TABLE projects ADD COLUMN req_building_permit TINYINT(1) DEFAULT 0;
ALTER TABLE projects ADD COLUMN req_regularization TINYINT(1) DEFAULT 0;
