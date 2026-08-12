-- Phase 4 — Mobile Staff Notifications + Push
-- Fixed: removed PostgreSQL DO $$ blocks (D1/SQLite compat)
-- Created: 2026-07-10, Fixed: 2026-08-04
-- 2026-08-04 fix: removed duplicate user_agent in recreate-table + orphan user_id index

-- notifications table: per-user inbox, keyed by staff user id
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT DEFAULT 'info',
  title_vi TEXT NOT NULL,
  title_en TEXT NOT NULL,
  body_vi TEXT,
  body_en TEXT,
  data TEXT DEFAULT '{}',
  read_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at);

-- push_subscriptions: add device_id column idempotently (D1 compat - recreate-table)
-- Source table has no user_id; select only existing columns
CREATE TABLE IF NOT EXISTS push_subscriptions_new (
  id TEXT PRIMARY KEY,
  customer_id TEXT,
  role TEXT DEFAULT 'customer',
  endpoint TEXT NOT NULL UNIQUE,
  auth_key TEXT NOT NULL,
  p256dh_key TEXT NOT NULL,
  user_agent TEXT,
  last_used_at TEXT,
  device_id TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO push_subscriptions_new
SELECT id, customer_id, 'customer', endpoint, auth_key, p256dh_key,
  user_agent, NULL, NULL,
  COALESCE(created_at, datetime('now')), COALESCE(updated_at, datetime('now'))
FROM push_subscriptions;

DROP TABLE IF EXISTS push_subscriptions;
ALTER TABLE push_subscriptions_new RENAME TO push_subscriptions;

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_role ON push_subscriptions(role);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_customer ON push_subscriptions(customer_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_endpoint ON push_subscriptions(endpoint);
