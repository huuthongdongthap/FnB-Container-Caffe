-- Down Migration: Rollback the staff session invalidation counter
--
-- The index is dropped first because SQLite cannot drop a column that a
-- surviving index still references.
DROP INDEX IF EXISTS idx_users_auth_version;
ALTER TABLE users DROP COLUMN auth_version;
