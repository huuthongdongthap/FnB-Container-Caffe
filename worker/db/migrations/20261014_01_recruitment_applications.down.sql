-- Down Migration: Rollback recruitment_applications indexes and table
DROP INDEX IF EXISTS idx_recruitment_created;
DROP INDEX IF EXISTS idx_recruitment_status;
DROP TABLE IF EXISTS recruitment_applications;
