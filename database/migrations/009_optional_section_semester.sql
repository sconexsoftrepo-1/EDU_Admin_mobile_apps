-- Batch sections may be created before the academic calendar is configured.
-- Existing semester foreign keys and all existing values remain intact.
ALTER TABLE sections ALTER COLUMN semester_code DROP NOT NULL;
