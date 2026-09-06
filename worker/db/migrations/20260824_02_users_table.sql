-- 20260824_02_users_table.sql
-- Staff accounts. staff-tips.ts aggregates tips via
-- LEFT JOIN users u ON u.id = o.updated_by, but no migration ever created
-- `users`, so the report endpoint fails on any fresh database.
--
-- `orders.updated_by` stores a users.id; see 20260820_07_orders_staff.sql.

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