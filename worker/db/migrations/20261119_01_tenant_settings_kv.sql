-- =============================================================================
-- Migration: 20261119_01_tenant_settings_kv.sql
-- Purpose: Add tenant-scoped key/value settings store. Used by per-store feature
--          opt-outs (e.g. cash reconciliation) that must be readable at runtime
--          from D1 rather than redeploy-time environment bindings.
-- =============================================================================

CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_settings_tenant_key
  ON settings(tenant_id, key);
