-- G4: Push Notifications — push_subscriptions table + staff_shifts.clock_in_planned
-- Fixed: removed PostgreSQL DO $$ blocks (D1/SQLite compat)
-- Created: 2026-07-06, Fixed: 2026-08-04

-- push_subscriptions: stores Web Push endpoints for both customers and staff
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id TEXT PRIMARY KEY,
  customer_id TEXT,
  role TEXT DEFAULT 'customer', -- 'customer' | 'staff-kitchen' | 'staff-cashier' | 'staff-all'
  endpoint TEXT NOT NULL UNIQUE,
  auth_key TEXT NOT NULL,
  p256dh_key TEXT NOT NULL,
  user_agent TEXT,
  last_used_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

-- NOTE: staff_shifts.clock_in_planned skipped — D1 ALTER TABLE cannot add columns idempotently
-- The column will be added manually or via a future migration when the table can be recreated safely

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_role ON push_subscriptions(role);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_customer ON push_subscriptions(customer_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_endpoint ON push_subscriptions(endpoint);
