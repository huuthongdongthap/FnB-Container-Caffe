-- 20260824_04_users_recreate.sql
-- The remote database carries an empty legacy `users` table
-- (id, phone, full_name, tier, total_points — a customer-loyalty shape) that
-- is absent from every SQL file in this repo and does not match the shape
-- staff-tips.ts joins on (u.id = orders.updated_by, u.name).
--
-- The table was confirmed empty (SELECT COUNT(*) = 0) before this migration
-- was authored; renaming preserves it for forensics without blocking the
-- canonical DDL from 20260824_02_users_table.sql.

ALTER TABLE users RENAME TO users_legacy;

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