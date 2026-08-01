-- Migration 009: push_subscriptions table
-- Adds Web Push API subscription storage for push notifications

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id TEXT PRIMARY KEY,
  customer_id TEXT,
  endpoint TEXT NOT NULL UNIQUE,
  auth_key TEXT NOT NULL,
  p256dh_key TEXT NOT NULL,
  user_agent TEXT,
  role TEXT NOT NULL DEFAULT 'customer',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TRIGGER IF NOT EXISTS update_push_subscriptions_timestamp
AFTER UPDATE ON push_subscriptions
FOR EACH ROW
BEGIN
  UPDATE push_subscriptions SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_role ON push_subscriptions(role);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_endpoint ON push_subscriptions(endpoint);
