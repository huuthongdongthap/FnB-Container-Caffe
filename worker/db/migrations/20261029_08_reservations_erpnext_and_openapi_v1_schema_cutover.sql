-- ============================================================
-- Migration: 20261029_08_reservations_erpnext_and_openapi_v1_schema_cutover.sql
-- Purpose: Reconcile missing columns and tables across Floor Plan, Cal.com
--          Bookings/Reservations, ERPNext Sync/Customers/POS Webhooks, and
--          mounted OpenAPI v1 routes against fnb-caffe-db without introducing
--          split-brain duplicate tables for cafe_tables, reservations,
--          customers, or suppliers.
-- ============================================================

-- 1. Floor Plan & Table Management columns on cafe_tables
--    Keep cafe_tables as the single source of truth for table records and
--    backfill capacity/name from existing seats/table_number columns.
ALTER TABLE cafe_tables ADD COLUMN name TEXT;
ALTER TABLE cafe_tables ADD COLUMN capacity INTEGER DEFAULT 4;
ALTER TABLE cafe_tables ADD COLUMN qr_code TEXT;

UPDATE cafe_tables
SET capacity = COALESCE(seats, 4),
    name = COALESCE(name, 'Bàn ' || table_number)
WHERE capacity IS NULL OR name IS NULL;

-- 2. Cal.com Booking & Reservation columns on reservations
--    Keep reservations as the single source of truth for bookings so webhook
--    and listing handlers share the same table.
ALTER TABLE reservations ADD COLUMN cal_booking_uid TEXT;
ALTER TABLE reservations ADD COLUMN customer_email TEXT;
ALTER TABLE reservations ADD COLUMN reservation_time TEXT;
ALTER TABLE reservations ADD COLUMN special_requests TEXT;

CREATE INDEX IF NOT EXISTS idx_reservations_cal_booking_uid ON reservations(cal_booking_uid);
CREATE INDEX IF NOT EXISTS idx_reservations_date_status ON reservations(date, status);

-- 3. ERPNext Customer Sync & OpenAPI Loyalty columns on customers
--    Keep customers as the single source of truth for customer loyalty and
--    ERPNext customer synchronization.
ALTER TABLE customers ADD COLUMN tax_id TEXT;
ALTER TABLE customers ADD COLUMN erpnext_id TEXT;
ALTER TABLE customers ADD COLUMN sync_status TEXT DEFAULT 'pending';
ALTER TABLE customers ADD COLUMN erpnext_last_synced TEXT;
ALTER TABLE customers ADD COLUMN referral_code TEXT;

CREATE INDEX IF NOT EXISTS idx_customers_erpnext_id ON customers(erpnext_id);
CREATE INDEX IF NOT EXISTS idx_customers_sync_status ON customers(sync_status);

-- 4. ERPNext Inbound Webhook Audit Log
CREATE TABLE IF NOT EXISTS erpnext_webhook_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  doctype TEXT NOT NULL,
  docname TEXT NOT NULL,
  action TEXT NOT NULL,
  payload TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_erpnext_webhook_log_doctype ON erpnext_webhook_log(doctype, docname);

-- 5. OpenAPI Auth & Staff columns and session/device tables
ALTER TABLE users ADD COLUMN locale TEXT DEFAULT 'vi';
ALTER TABLE users ADD COLUMN loyalty_tier TEXT DEFAULT 'bronze';
ALTER TABLE users ADD COLUMN loyalty_points INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN avatar_url TEXT;
ALTER TABLE users ADD COLUMN hire_date TEXT;

ALTER TABLE email_verifications ADD COLUMN user_id TEXT;
ALTER TABLE email_verifications ADD COLUMN token TEXT;
ALTER TABLE email_verifications ADD COLUMN type TEXT DEFAULT 'verify';
ALTER TABLE email_verifications ADD COLUMN used INTEGER DEFAULT 0;
ALTER TABLE email_verifications ADD COLUMN verified_at TEXT;

CREATE INDEX IF NOT EXISTS idx_email_verifications_token ON email_verifications(token, type);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL DEFAULT '',
  refresh_token_hash TEXT NOT NULL DEFAULT '',
  device_info TEXT,
  ip_address TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  last_active_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_refresh_token ON sessions(refresh_token_hash);

CREATE TABLE IF NOT EXISTS trusted_devices (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  device_id TEXT,
  device_name TEXT,
  trusted_at TEXT DEFAULT (datetime('now')),
  last_used_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, device_id)
);
CREATE INDEX IF NOT EXISTS idx_trusted_devices_user ON trusted_devices(user_id, device_id);

-- 6. OpenAPI Purchase Orders & Inventory fallback columns
ALTER TABLE purchase_orders ADD COLUMN expected_date TEXT;
ALTER TABLE purchase_orders ADD COLUMN total_amount REAL DEFAULT 0;
ALTER TABLE purchase_orders ADD COLUMN received_date TEXT;

ALTER TABLE purchase_order_items ADD COLUMN po_id TEXT;
ALTER TABLE purchase_order_items ADD COLUMN unit_cost REAL DEFAULT 0;
ALTER TABLE purchase_order_items ADD COLUMN created_at TEXT;

CREATE INDEX IF NOT EXISTS idx_purchase_order_items_po_id ON purchase_order_items(po_id);

ALTER TABLE inventory_items ADD COLUMN unit_cost REAL DEFAULT 0;
ALTER TABLE inventory_items ADD COLUMN is_active INTEGER DEFAULT 1;
ALTER TABLE inventory_items ADD COLUMN last_restocked_at TEXT;

UPDATE inventory_items
SET unit_cost = COALESCE(cost_per_unit, 0),
    is_active = COALESCE(active, 1);

INSERT OR IGNORE INTO suppliers (id, name, contact_person, email, phone, address, tax_id, payment_terms, is_active) VALUES
  ('sup_aura_roastery', 'AURA Roastery Sa Đéc', 'Nguyễn Văn Rang', 'roastery@auraspace.vn', '0901234888', 'Khu Công Nghiệp Sa Đéc, Đồng Tháp', '1400998877', 'NET15', 1),
  ('sup_vinamilk_dt', 'Vinamilk Chi Nhánh Đồng Tháp', 'Trần Thị Sữa', 'dongthap@vinamilk.com.vn', '02773861234', 'TP. Cao Lãnh, Đồng Tháp', '0300588569', 'NET30', 1),
  ('sup_tra_loc_phat', 'Trà Lộc Phát Bảo Lộc', 'Lê Hoàng Trà', 'sales@tralocphat.vn', '0918223344', 'TP. Bảo Lộc, Lâm Đồng', '5800112233', 'COD', 1),
  ('sup_uji_matcha', 'Uji Matcha Imports', 'Sato Kenji', 'orders@ujimatcha.vn', '0909887766', 'Quận 1, TP. Hồ Chí Minh', '0312345678', 'NET15', 1);

ALTER TABLE inventory_transactions ADD COLUMN previous_stock REAL DEFAULT 0;
ALTER TABLE inventory_transactions ADD COLUMN new_stock REAL DEFAULT 0;
ALTER TABLE inventory_transactions ADD COLUMN unit_cost REAL DEFAULT 0;
ALTER TABLE inventory_transactions ADD COLUMN reason TEXT;
ALTER TABLE inventory_transactions ADD COLUMN performed_by TEXT;

-- 7. OpenAPI Promotions columns
ALTER TABLE promotions ADD COLUMN description TEXT;
ALTER TABLE promotions ADD COLUMN discount_value REAL DEFAULT 0;
ALTER TABLE promotions ADD COLUMN discount_type TEXT DEFAULT 'percentage';
ALTER TABLE promotions ADD COLUMN max_uses INTEGER;
ALTER TABLE promotions ADD COLUMN current_uses INTEGER DEFAULT 0;
ALTER TABLE promotions ADD COLUMN used_count INTEGER DEFAULT 0;
ALTER TABLE promotions ADD COLUMN min_order_value REAL DEFAULT 0;
ALTER TABLE promotions ADD COLUMN max_discount_value REAL;
ALTER TABLE promotions ADD COLUMN valid_from TEXT;
ALTER TABLE promotions ADD COLUMN valid_to TEXT;
ALTER TABLE promotions ADD COLUMN excluded_items TEXT;
ALTER TABLE promotions ADD COLUMN updated_at TEXT;

UPDATE promotions
SET discount_value = COALESCE(value, percent, 0),
    min_order_value = COALESCE(min_order, 0),
    max_discount_value = CASE WHEN max_discount > 0 THEN max_discount ELSE NULL END,
    max_uses = CASE WHEN usage_limit > 0 THEN usage_limit ELSE NULL END,
    current_uses = COALESCE(usage_count, 0),
    used_count = COALESCE(usage_count, 0),
    valid_from = COALESCE(starts_at, created_at),
    valid_to = COALESCE(expires_at, datetime('now', '+30 days')),
    updated_at = COALESCE(updated_at, created_at);

ALTER TABLE promotion_usages ADD COLUMN idempotency_key TEXT;
CREATE INDEX IF NOT EXISTS idx_promotion_usages_idempotency ON promotion_usages(idempotency_key);

-- 8. OpenAPI Loyalty Ledger, Rewards Catalog & Tier Configurations
CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id TEXT PRIMARY KEY,
  account_id TEXT,
  customer_id TEXT,
  type TEXT NOT NULL,
  points INTEGER NOT NULL DEFAULT 0,
  balance_after INTEGER NOT NULL DEFAULT 0,
  order_id TEXT,
  reward_id TEXT,
  description TEXT,
  reason TEXT,
  idempotency_key TEXT,
  created_by TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_customer ON loyalty_transactions(customer_id, created_at);
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_account ON loyalty_transactions(account_id, created_at);

CREATE TABLE IF NOT EXISTS loyalty_rewards (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_en TEXT,
  description TEXT,
  points_cost INTEGER NOT NULL DEFAULT 100,
  points_required INTEGER NOT NULL DEFAULT 100,
  type TEXT NOT NULL DEFAULT 'voucher',
  reward_type TEXT NOT NULL DEFAULT 'voucher',
  value REAL DEFAULT 0,
  reward_value TEXT DEFAULT '0',
  menu_item_id TEXT,
  min_tier TEXT DEFAULT 'bronze',
  max_redemptions INTEGER,
  stock INTEGER,
  current_redemptions INTEGER DEFAULT 0,
  redeemed_count INTEGER DEFAULT 0,
  valid_from TEXT,
  valid_to TEXT,
  valid_until TEXT,
  image_url TEXT,
  terms TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_loyalty_rewards_active ON loyalty_rewards(is_active, points_cost);

CREATE TABLE IF NOT EXISTS loyalty_tier_configs (
  tier TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  min_points INTEGER NOT NULL DEFAULT 0,
  max_points INTEGER,
  point_multiplier REAL NOT NULL DEFAULT 1.0,
  points_multiplier REAL NOT NULL DEFAULT 1.0,
  discount_percent REAL DEFAULT 0,
  birthday_bonus INTEGER DEFAULT 500,
  free_shipping INTEGER DEFAULT 0,
  priority_support INTEGER DEFAULT 0,
  benefits TEXT DEFAULT '[]',
  color TEXT,
  icon TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO loyalty_tier_configs (tier, name, min_points, point_multiplier, points_multiplier, discount_percent, birthday_bonus, benefits, color) VALUES
  ('bronze', 'Đồng (Bronze)', 0, 1.0, 1.0, 0, 200, '["Tích điểm cơ bản 1x","Ưu đãi sinh nhật"]', '#CD7F32'),
  ('silver', 'Bạc (Silver)', 200, 1.2, 1.2, 5, 300, '["Tích điểm 1.2x","Ưu đãi sinh nhật","Giảm 5% thức uống"]', '#C0C0C0'),
  ('gold', 'Vàng (Gold)', 500, 1.5, 1.5, 10, 500, '["Tích điểm 1.5x","Quà sinh nhật đặc biệt","Ưu tiên đặt bàn"]', '#FFD700'),
  ('diamond', 'Kim Cương (Diamond)', 1000, 2.0, 2.0, 15, 1000, '["Tích điểm 2.0x","Quà VIP","Miễn phí upsize"]', '#B9F2FF');

-- 9. OpenAPI Cron Jobs & Cron Runs
CREATE TABLE IF NOT EXISTS cron_jobs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  cron_expression TEXT NOT NULL,
  handler TEXT NOT NULL,
  payload TEXT,
  timeout_seconds INTEGER DEFAULT 300,
  max_retries INTEGER DEFAULT 3,
  retry_delay_seconds INTEGER DEFAULT 60,
  is_active INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending',
  location_id TEXT,
  last_run_at TEXT,
  next_run_at TEXT,
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  last_status TEXT,
  last_error TEXT,
  created_by TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_cron_jobs_active_status ON cron_jobs(is_active, status);

CREATE TABLE IF NOT EXISTS cron_runs (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running',
  started_at TEXT NOT NULL,
  completed_at TEXT,
  duration_ms INTEGER DEFAULT 0,
  attempt INTEGER DEFAULT 1,
  output TEXT,
  error TEXT,
  triggered_by TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_cron_runs_job_started ON cron_runs(job_id, started_at);
