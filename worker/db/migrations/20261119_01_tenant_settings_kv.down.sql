-- =============================================================================
-- Rollback: 20261119_01_tenant_settings_kv.down.sql
-- Purpose: Reverse the tenant settings store addition.
-- =============================================================================

DROP INDEX IF EXISTS idx_settings_tenant_key;
DROP TABLE IF EXISTS settings;
