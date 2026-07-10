-- Phase 4 — Mobile Staff Notifications + Push
-- Created: 2026-07-10

-- notifications table: per-user inbox, keyed by staff user id (sub of auth)
CREATE TABLE IF NOT EXISTS notifications (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  type        TEXT DEFAULT 'info',
  title_vi    TEXT NOT NULL,
  title_en    TEXT NOT NULL,
  body_vi     TEXT,
  body_en     TEXT,
  data        TEXT DEFAULT '{}',
  read_at     TEXT,
  created_at  TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at);

-- push_subscriptions already exists (20260706_11_push_staff.sql). Augment it:
-- add device_id / store columns that match mobile client and the tree notifier.
-- Safe no-op on fresh DBs since IF NOT EXISTS is on the table, ALTER swallows duplicate.
ALTER TABLE push_subscriptions ADD COLUMN device_id TEXT;
ALTER TABLE push_subscriptions ADD COLUMN user_agent   TEXT DEFAULT '';
ALTER TABLE push_subscriptions ADD COLUMN last_used_at TEXT;
CREATE INDEX IF NOT EXISTS idx_push_user ON push_subscriptions(user_id);
