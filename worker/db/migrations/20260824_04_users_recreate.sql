-- 20260824_04_users_recreate.sql
-- The remote database carried an empty legacy `users` table
-- (id, phone, full_name, tier, total_points — a customer-loyalty shape) that
-- is absent from every SQL file in this repo and does not match the shape
-- staff-tips.ts joins on (u.id = orders.updated_by, u.name).
--
-- Originally this migration renamed that table to users_legacy for
-- forensics. The legacy table was retired 2026-09-13 (dropped via
-- 20260913_02_retire_orphan_tables.sql after owner approval — it stayed
-- empty). A rename is now wrong: on a fresh bootstrap (schema.sql already
-- creates the canonical `users`), it would rename the canonical table away
-- and resurrect `users_legacy`. DROP IF EXISTS keeps this migration
-- idempotent everywhere: no-op on fresh databases, no-op on prod
-- (already applied historically).

DROP TABLE IF EXISTS users_legacy;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'staff',  -- owner, manager, staff, waiter
  phone TEXT,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
