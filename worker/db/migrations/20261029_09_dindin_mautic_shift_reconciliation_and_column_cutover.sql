-- =============================================================================
-- Migration: 20261029_09_dindin_mautic_shift_reconciliation_and_column_cutover.sql
-- Purpose: Reconcile remaining runtime tables and column drift across DinDin
--          kiosk config/carts, Mautic campaign enrollment tracking, shift cash
--          reconciliation/payouts, ERPNext expenses, Pretix webhook logging,
--          OpenAPI auth sessions/devices, cron run payloads, and catalog/order
--          audit columns without introducing duplicate split-brain tables.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. OpenAPI Auth Sessions & Trusted Devices Column Alignment
--    Required by /api/auth/register, /api/auth/login, /api/auth/logout,
--    /api/auth/session, /api/auth/verify-email, /api/auth/bootstrap-owner,
--    and /api/auth/devices.
-- -----------------------------------------------------------------------------
ALTER TABLE sessions ADD COLUMN access_token TEXT;
ALTER TABLE sessions ADD COLUMN refresh_token TEXT;
ALTER TABLE sessions ADD COLUMN is_trusted_device INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sessions ADD COLUMN device_fingerprint TEXT;
ALTER TABLE sessions ADD COLUMN device_name TEXT;
ALTER TABLE sessions ADD COLUMN last_used_at TEXT;
ALTER TABLE sessions ADD COLUMN updated_at TEXT;

UPDATE sessions
SET access_token = COALESCE(access_token, token_hash),
    refresh_token = COALESCE(refresh_token, refresh_token_hash),
    updated_at = COALESCE(updated_at, created_at, datetime('now'))
WHERE access_token IS NULL OR updated_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_sessions_access_token
  ON sessions(access_token);
CREATE INDEX IF NOT EXISTS idx_sessions_refresh_token_value
  ON sessions(refresh_token);

ALTER TABLE trusted_devices ADD COLUMN fingerprint TEXT;
ALTER TABLE trusted_devices ADD COLUMN name TEXT;
ALTER TABLE trusted_devices ADD COLUMN platform TEXT;
ALTER TABLE trusted_devices ADD COLUMN browser TEXT;
ALTER TABLE trusted_devices ADD COLUMN ip TEXT;
ALTER TABLE trusted_devices ADD COLUMN is_trusted INTEGER NOT NULL DEFAULT 1;
ALTER TABLE trusted_devices ADD COLUMN created_at TEXT;
ALTER TABLE trusted_devices ADD COLUMN expires_at TEXT;

UPDATE trusted_devices
SET fingerprint = COALESCE(fingerprint, device_id),
    name = COALESCE(name, device_name),
    created_at = COALESCE(created_at, trusted_at, datetime('now'))
WHERE fingerprint IS NULL OR created_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_trusted_devices_user_fingerprint
  ON trusted_devices(user_id, fingerprint);

-- -----------------------------------------------------------------------------
-- 2. OpenAPI Cron Runs Payload Column
--    Required by POST /api/cron/jobs/:id/trigger and POST /api/cron/runs/:id/retry.
-- -----------------------------------------------------------------------------
ALTER TABLE cron_runs ADD COLUMN payload TEXT;

-- -----------------------------------------------------------------------------
-- 3. DinDin Kiosk Config & Cart Persistence
--    Required by GET/PUT /api/dindin/config, GET /api/dindin/carts,
--    GET/PATCH /api/dindin/cart/:sessionId, and POST /api/dindin/checkout.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dindin_config (
  id INTEGER PRIMARY KEY,
  config TEXT NOT NULL DEFAULT '{"menu":{"sections":[]},"settings":{}}',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO dindin_config (id, config, updated_at)
VALUES (1, '{"menu":{"sections":[]},"settings":{}}', datetime('now'));

CREATE TABLE IF NOT EXISTS dindin_cart (
  session_id TEXT PRIMARY KEY,
  raw TEXT NOT NULL DEFAULT '{"items":[],"total":0}',
  cart TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_dindin_cart_updated_at
  ON dindin_cart(updated_at);

-- -----------------------------------------------------------------------------
-- 4. Mautic Campaign Enrollments
--    Required by Mautic winback, birthday, tier-upgrade, and referral milestone
--    detectors and deduplication checks.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS campaign_enrollments (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  campaign_type TEXT NOT NULL,
  campaign_id TEXT NOT NULL,
  mautic_contact_id TEXT,
  status TEXT NOT NULL DEFAULT 'enrolled',
  enrolled_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_campaign_enrollments_customer_type
  ON campaign_enrollments(customer_id, campaign_type, created_at);

-- -----------------------------------------------------------------------------
-- 5. Shift Cash Reconciliations, Cash Payouts & Staff Shifts POS Counters
--    Required by shift close cash variance calculation and POS sales tracking.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS shift_reconciliations (
  id TEXT PRIMARY KEY,
  shift_id TEXT NOT NULL,
  staff_id TEXT NOT NULL DEFAULT '',
  opening_float REAL NOT NULL DEFAULT 0,
  opening_cash REAL NOT NULL DEFAULT 0,
  cash_sales REAL NOT NULL DEFAULT 0,
  cash_refunds REAL NOT NULL DEFAULT 0,
  paid_outs REAL NOT NULL DEFAULT 0,
  expected_cash REAL NOT NULL DEFAULT 0,
  actual_cash REAL NOT NULL DEFAULT 0,
  variance REAL NOT NULL DEFAULT 0,
  variance_amount REAL NOT NULL DEFAULT 0,
  variance_pct REAL NOT NULL DEFAULT 0,
  variance_status TEXT NOT NULL DEFAULT 'balanced',
  status TEXT NOT NULL DEFAULT 'balanced',
  denominations TEXT NOT NULL DEFAULT '{}',
  cash_payment_total REAL NOT NULL DEFAULT 0,
  cash_payout_total REAL NOT NULL DEFAULT 0,
  notes TEXT,
  reconciled_by TEXT DEFAULT '',
  approved_by TEXT,
  reconciled_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_shift_reconciliations_shift_id
  ON shift_reconciliations(shift_id, created_at);

CREATE TABLE IF NOT EXISTS cash_payouts (
  id TEXT PRIMARY KEY,
  shift_id TEXT NOT NULL DEFAULT '',
  amount REAL NOT NULL DEFAULT 0,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'completed',
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_cash_payouts_shift_id
  ON cash_payouts(shift_id, status);

ALTER TABLE staff_shifts ADD COLUMN operating_unit_id TEXT DEFAULT 'main_store';
ALTER TABLE staff_shifts ADD COLUMN status TEXT DEFAULT 'open';
ALTER TABLE staff_shifts ADD COLUMN opening_cash REAL DEFAULT 0;
ALTER TABLE staff_shifts ADD COLUMN expected_cash REAL;
ALTER TABLE staff_shifts ADD COLUMN actual_cash REAL;
ALTER TABLE staff_shifts ADD COLUMN cash_variance REAL;
ALTER TABLE staff_shifts ADD COLUMN total_sales REAL DEFAULT 0;
ALTER TABLE staff_shifts ADD COLUMN cash_sales REAL DEFAULT 0;
ALTER TABLE staff_shifts ADD COLUMN online_sales REAL DEFAULT 0;
ALTER TABLE staff_shifts ADD COLUMN order_count INTEGER DEFAULT 0;
ALTER TABLE staff_shifts ADD COLUMN updated_at TEXT;

-- -----------------------------------------------------------------------------
-- 6. ERPNext Expenses & Pretix Webhook Audit Log
--    Required by GET /api/erpnext/expenses and POST /api/pretix/webhook.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  amount REAL NOT NULL DEFAULT 0,
  category TEXT NOT NULL,
  date TEXT NOT NULL,
  description TEXT,
  erpnext_id TEXT,
  sync_status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_expenses_date
  ON expenses(date);

CREATE TABLE IF NOT EXISTS pretix_webhook_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  notification_id INTEGER,
  organizer TEXT NOT NULL DEFAULT '',
  event TEXT NOT NULL DEFAULT '',
  code TEXT NOT NULL,
  action TEXT NOT NULL,
  payload TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pretix_webhook_log_code
  ON pretix_webhook_log(code, created_at);

-- -----------------------------------------------------------------------------
-- 7. Catalog, Order Item, Table Session, Promotion Redemption & Notification
--    Column Alignment on Existing Canonical Tables
-- -----------------------------------------------------------------------------
ALTER TABLE categories ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1;
ALTER TABLE categories ADD COLUMN location_id TEXT;

UPDATE categories
SET display_name_vi = COALESCE(display_name_vi, name)
WHERE display_name_vi IS NULL;

ALTER TABLE order_items ADD COLUMN status TEXT DEFAULT 'pending';
ALTER TABLE order_items ADD COLUMN updated_at TEXT;

ALTER TABLE table_sessions ADD COLUMN order_id TEXT;
ALTER TABLE table_sessions ADD COLUMN current_order_id TEXT;
ALTER TABLE table_sessions ADD COLUMN started_at TEXT;
ALTER TABLE table_sessions ADD COLUMN ended_at TEXT;

UPDATE table_sessions
SET started_at = COALESCE(started_at, opened_at, created_at),
    ended_at = COALESCE(ended_at, closed_at),
    current_order_id = COALESCE(current_order_id, order_id)
WHERE started_at IS NULL OR current_order_id IS NULL;

ALTER TABLE promotion_redemptions ADD COLUMN created_at TEXT;

UPDATE promotion_redemptions
SET created_at = COALESCE(created_at, redeemed_at, datetime('now'))
WHERE created_at IS NULL;

ALTER TABLE notification_audit_log ADD COLUMN order_id TEXT;
ALTER TABLE notification_audit_log ADD COLUMN recipient TEXT;
ALTER TABLE notification_audit_log ADD COLUMN template TEXT;
ALTER TABLE notification_audit_log ADD COLUMN template_id TEXT;
ALTER TABLE notification_audit_log ADD COLUMN message_type TEXT;
ALTER TABLE notification_audit_log ADD COLUMN payload TEXT;
ALTER TABLE notification_audit_log ADD COLUMN provider_response TEXT;
ALTER TABLE notification_audit_log ADD COLUMN error TEXT;
ALTER TABLE notification_audit_log ADD COLUMN error_message TEXT;
ALTER TABLE notification_audit_log ADD COLUMN retry_count INTEGER DEFAULT 0;
ALTER TABLE notification_audit_log ADD COLUMN sent_at TEXT;
