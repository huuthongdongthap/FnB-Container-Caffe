-- Phase 1: Staff Roles + Mobile Auth
-- Extends: push_subscriptions (already has role column), staff_shifts
-- Created: 2026-07-10

-- Expand role enum in push_subscriptions to cover new staff roles
-- (role column already exists as TEXT — just ensure valid values)
-- No ALTER needed since role is TEXT with application-level validation

-- Add staff_devices for mobile device PIN authentication (waiter/kitchen don't need email login)
CREATE TABLE IF NOT EXISTS staff_devices (
  id TEXT PRIMARY KEY,
  staff_id TEXT NOT NULL,
  device_name TEXT,
  device_token TEXT UNIQUE NOT NULL,
  pin_hash TEXT NOT NULL,
  role TEXT DEFAULT 'staff',
  last_login_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_staff_devices_token ON staff_devices(device_token);
CREATE INDEX IF NOT EXISTS idx_staff_devices_staff ON staff_devices(staff_id);
