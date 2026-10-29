-- =============================================================================
-- Migration: 20261029_11_loyalty_referrals_inventory_po_customer_events_and_audit_cutover.sql
-- Purpose: Reconcile remaining runtime tables and columns across Loyalty
--          (accounts, tiers, rewards, redemptions, check-ins, cashback
--          multiplier), Referrals, Promotions, Customer 360 (events, visits),
--          Inventory/BOM/Purchase Orders/Forecasting, Reservations, Catalog,
--          Payments, Auth Devices/Email Verifications, Canonical Audit Logs,
--          SOP Checklists, and Edge/IoT Integrations on fnb-caffe-db.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Loyalty Accounts, Tiers, Rewards, Redemptions, Check-ins & Cashback
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS loyalty_accounts (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL UNIQUE,
  current_points INTEGER NOT NULL DEFAULT 0,
  lifetime_points INTEGER NOT NULL DEFAULT 0,
  tier TEXT NOT NULL DEFAULT 'bronze',
  order_count INTEGER NOT NULL DEFAULT 0,
  total_spent REAL NOT NULL DEFAULT 0,
  last_activity_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_loyalty_accounts_customer
  ON loyalty_accounts(customer_id);

INSERT OR IGNORE INTO loyalty_accounts (
  id, customer_id, current_points, lifetime_points, tier, order_count, total_spent, last_activity_at, created_at, updated_at
)
SELECT
  'la_' || id,
  id,
  COALESCE(loyalty_points, 0),
  COALESCE(lifetime_points, loyalty_points, 0),
  COALESCE(NULLIF(loyalty_tier, ''), NULLIF(tier, ''), 'bronze'),
  COALESCE(total_orders, 0),
  COALESCE(total_spent, 0),
  COALESCE(updated_at, created_at, datetime('now')),
  COALESCE(created_at, datetime('now')),
  COALESCE(updated_at, datetime('now'))
FROM customers;

CREATE TABLE IF NOT EXISTS loyalty_tiers (
  tier_name TEXT PRIMARY KEY,
  min_points INTEGER NOT NULL DEFAULT 0,
  cashback_rate REAL NOT NULL DEFAULT 0.02,
  point_multiplier REAL NOT NULL DEFAULT 1.0,
  birthday_discount INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  display_name_vi TEXT,
  min_spent_vnd INTEGER NOT NULL DEFAULT 0,
  max_spent_vnd INTEGER,
  expiry_days INTEGER DEFAULT 90,
  sort_order INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE loyalty_tiers ADD COLUMN points_multiplier REAL NOT NULL DEFAULT 1.0;
ALTER TABLE loyalty_tiers ADD COLUMN perks TEXT DEFAULT '[]';
ALTER TABLE loyalty_tiers ADD COLUMN color TEXT DEFAULT '#CD7F32';
ALTER TABLE loyalty_tiers ADD COLUMN updated_at TEXT;

UPDATE loyalty_tiers
SET points_multiplier = COALESCE(point_multiplier, 1.0),
    updated_at = COALESCE(updated_at, created_at, datetime('now'));

INSERT OR IGNORE INTO loyalty_tiers (
  tier_name, min_points, cashback_rate, point_multiplier, points_multiplier,
  birthday_discount, display_name_vi, min_spent_vnd, expiry_days, perks, color, sort_order
) VALUES
  ('bronze', 0, 0.02, 1.0, 1.0, 5, 'Đồng', 0, 90, '["Tích điểm 2%","Ưu đãi sinh nhật 5%"]', '#CD7F32', 1),
  ('silver', 500, 0.03, 1.2, 1.2, 10, 'Bạc', 2000000, 120, '["Tích điểm 3%","Nhân hệ số 1.2x","Ưu đãi sinh nhật 10%"]', '#C0C0C0', 2),
  ('gold', 1000, 0.05, 1.5, 1.5, 15, 'Vàng', 5000000, 180, '["Tích điểm 5%","Nhân hệ số 1.5x","Ưu đãi sinh nhật 15%"]', '#FFD700', 3),
  ('platinum', 3000, 0.08, 2.0, 2.0, 20, 'Bạch Kim', 15000000, 365, '["Tích điểm 8%","Nhân hệ số 2.0x","Ưu đãi sinh nhật 20%","Ưu tiên bàn VIP"]', '#E5E4E2', 4);

CREATE TABLE IF NOT EXISTS tier_configs (
  tier TEXT PRIMARY KEY,
  tier_name TEXT NOT NULL,
  min_points INTEGER NOT NULL DEFAULT 0,
  cashback_rate REAL NOT NULL DEFAULT 0.02,
  points_multiplier REAL NOT NULL DEFAULT 1.0,
  point_multiplier REAL NOT NULL DEFAULT 1.0,
  expiry_days INTEGER DEFAULT 90,
  perks TEXT DEFAULT '[]',
  color TEXT DEFAULT '#CD7F32',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO tier_configs (
  tier, tier_name, min_points, cashback_rate, points_multiplier, point_multiplier, expiry_days, perks, color, sort_order
) VALUES
  ('bronze', 'Đồng', 0, 0.02, 1.0, 1.0, 90, '["Tích điểm 2%","Ưu đãi sinh nhật 5%"]', '#CD7F32', 1),
  ('silver', 'Bạc', 500, 0.03, 1.2, 1.2, 120, '["Tích điểm 3%","Nhân hệ số 1.2x","Ưu đãi sinh nhật 10%"]', '#C0C0C0', 2),
  ('gold', 'Vàng', 1000, 0.05, 1.5, 1.5, 180, '["Tích điểm 5%","Nhân hệ số 1.5x","Ưu đãi sinh nhật 15%"]', '#FFD700', 3),
  ('platinum', 'Bạch Kim', 3000, 0.08, 2.0, 2.0, 365, '["Tích điểm 8%","Nhân hệ số 2.0x","Ưu đãi sinh nhật 20%"]', '#E5E4E2', 4),
  ('diamond', 'Kim Cương', 3000, 0.08, 2.0, 2.0, 365, '["Tích điểm 8%","Nhân hệ số 2.0x","Ưu đãi sinh nhật 20%"]', '#B9F2FF', 5);

CREATE TABLE IF NOT EXISTS rewards (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  discount_type TEXT NOT NULL DEFAULT 'fixed',
  discount_value REAL NOT NULL DEFAULT 0,
  point_cost INTEGER NOT NULL DEFAULT 100,
  created_at TEXT DEFAULT (datetime('now'))
);

ALTER TABLE rewards ADD COLUMN name TEXT;
ALTER TABLE rewards ADD COLUMN description TEXT;
ALTER TABLE rewards ADD COLUMN points_cost INTEGER NOT NULL DEFAULT 100;
ALTER TABLE rewards ADD COLUMN type TEXT NOT NULL DEFAULT 'fixed';
ALTER TABLE rewards ADD COLUMN value REAL NOT NULL DEFAULT 0;
ALTER TABLE rewards ADD COLUMN reward_type TEXT NOT NULL DEFAULT 'fixed';
ALTER TABLE rewards ADD COLUMN reward_value REAL NOT NULL DEFAULT 0;
ALTER TABLE rewards ADD COLUMN min_tier TEXT DEFAULT 'bronze';
ALTER TABLE rewards ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1;
ALTER TABLE rewards ADD COLUMN stock INTEGER;
ALTER TABLE rewards ADD COLUMN image_url TEXT;
ALTER TABLE rewards ADD COLUMN updated_at TEXT;

UPDATE rewards
SET name = COALESCE(name, title),
    points_cost = COALESCE(point_cost, 100),
    type = COALESCE(discount_type, 'fixed'),
    value = COALESCE(discount_value, 0),
    reward_type = COALESCE(discount_type, 'fixed'),
    reward_value = COALESCE(discount_value, 0),
    updated_at = COALESCE(updated_at, created_at, datetime('now'));

INSERT OR IGNORE INTO rewards (
  id, title, name, description, point_cost, points_cost,
  discount_type, discount_value, type, value, reward_type, reward_value, min_tier, is_active
) VALUES
  ('rw_disc_20k', 'Voucher giảm 20.000đ', 'Voucher giảm 20.000đ', 'Giảm trực tiếp 20.000đ cho đơn từ 60.000đ', 200, 200, 'fixed', 20000, 'fixed', 20000, 'fixed', 20000, 'bronze', 1),
  ('rw_cf_free', 'Miễn phí 1 ly Cà Phê Sữa Đá', 'Miễn phí 1 ly Cà Phê Sữa Đá', 'Đổi 450 điểm nhận 1 ly Cà Phê Sữa Đá', 450, 450, 'free_item', 45000, 'free_item', 45000, 'free_item', 45000, 'silver', 1),
  ('rw_disc_15pct', 'Ưu đãi giảm 15% toàn đơn', 'Ưu đãi giảm 15% toàn đơn', 'Giảm 15% tối đa 50.000đ cho thành viên Vàng', 800, 800, 'percent', 15, 'percent', 15, 'percent', 15, 'gold', 1);

CREATE TABLE IF NOT EXISTS user_rewards (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  reward_id TEXT NOT NULL,
  code TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  expires_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
ALTER TABLE user_rewards ADD COLUMN redeemed_at TEXT;
CREATE INDEX IF NOT EXISTS idx_user_rewards_customer
  ON user_rewards(customer_id, status);

CREATE TABLE IF NOT EXISTS loyalty_redemptions (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  reward_id TEXT NOT NULL,
  points_spent INTEGER NOT NULL DEFAULT 0,
  code TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  expires_at TEXT,
  redeemed_at TEXT,
  order_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_loyalty_redemptions_customer
  ON loyalty_redemptions(customer_id, status);

CREATE TABLE IF NOT EXISTS checkins (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  customer_name TEXT,
  checkin_date TEXT NOT NULL,
  checkin_time TEXT NOT NULL DEFAULT (datetime('now')),
  reward_amount INTEGER NOT NULL DEFAULT 5000,
  status TEXT NOT NULL DEFAULT 'approved',
  staff_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE checkins ADD COLUMN streak INTEGER NOT NULL DEFAULT 1;
ALTER TABLE checkins ADD COLUMN points_earned INTEGER NOT NULL DEFAULT 10;
ALTER TABLE checkins ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';
CREATE INDEX IF NOT EXISTS idx_checkins_customer_date
  ON checkins(customer_id, checkin_date);

-- -----------------------------------------------------------------------------
-- 2. Referrals & Promotions Column Alignment
-- -----------------------------------------------------------------------------
ALTER TABLE referral_codes ADD COLUMN uses_count INTEGER DEFAULT 0;

UPDATE referral_codes
SET id = COALESCE(id, code),
    times_used = COALESCE(times_used, uses_count, 0),
    uses_count = COALESCE(uses_count, times_used, 0),
    total_points_earned = COALESCE(total_points_earned, 0);

CREATE INDEX IF NOT EXISTS idx_referral_codes_id
  ON referral_codes(id);

ALTER TABLE promotion_usages ADD COLUMN used_at TEXT;

UPDATE promotion_usages
SET created_at = COALESCE(created_at, used_at, datetime('now')),
    used_at = COALESCE(used_at, created_at, datetime('now'))
WHERE created_at IS NULL OR used_at IS NULL;

ALTER TABLE promotions ADD COLUMN start_date TEXT;
ALTER TABLE promotions ADD COLUMN end_date TEXT;

UPDATE promotions
SET start_date = COALESCE(start_date, valid_from, starts_at),
    end_date = COALESCE(end_date, valid_to, expires_at);

-- -----------------------------------------------------------------------------
-- 3. Customer 360 Event Sourcing & Visits
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customer_events (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload TEXT DEFAULT '{}',
  recorded_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_customer_events_customer_recorded
  ON customer_events(customer_id, recorded_at);

CREATE TABLE IF NOT EXISTS visits (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  visited_at TEXT NOT NULL DEFAULT (datetime('now')),
  channel TEXT NOT NULL DEFAULT 'in_store',
  order_id TEXT,
  spent INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE visits ADD COLUMN table_id TEXT;
ALTER TABLE visits ADD COLUMN amount REAL DEFAULT 0;
ALTER TABLE visits ADD COLUMN points_earned INTEGER DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_visits_customer_visited
  ON visits(customer_id, visited_at);
CREATE INDEX IF NOT EXISTS idx_visits_order_id
  ON visits(order_id);

-- -----------------------------------------------------------------------------
-- 4. Inventory, BOM, Purchase Orders, Snapshots & Forecasting
-- -----------------------------------------------------------------------------
ALTER TABLE inventory_transactions ADD COLUMN inventory_item_id TEXT;
ALTER TABLE inventory_transactions ADD COLUMN staff_id TEXT;

UPDATE inventory_transactions
SET inventory_item_id = COALESCE(inventory_item_id, item_id),
    reference_type = COALESCE(reference_type, 'manual');

CREATE INDEX IF NOT EXISTS idx_inventory_transactions_ref
  ON inventory_transactions(reference_id, reference_type);

ALTER TABLE purchase_orders ADD COLUMN total_cost REAL DEFAULT 0;
ALTER TABLE purchase_orders ADD COLUMN expected_delivery TEXT;
ALTER TABLE purchase_orders ADD COLUMN received_at TEXT;
ALTER TABLE purchase_orders ADD COLUMN approved_by TEXT;
ALTER TABLE purchase_orders ADD COLUMN received_by TEXT;

UPDATE purchase_orders
SET order_date = COALESCE(order_date, created_at, datetime('now')),
    expected_delivery_date = COALESCE(expected_delivery_date, expected_date, expected_delivery),
    expected_delivery = COALESCE(expected_delivery, expected_delivery_date, expected_date),
    subtotal = CASE WHEN COALESCE(subtotal, 0) = 0 THEN COALESCE(total_amount, total_cost, 0) ELSE subtotal END,
    total = CASE WHEN COALESCE(total, 0) = 0 THEN COALESCE(total_amount, total_cost, 0) ELSE total END,
    total_cost = CASE WHEN COALESCE(total_cost, 0) = 0 THEN COALESCE(total, total_amount, 0) ELSE total_cost END;

ALTER TABLE recipes ADD COLUMN item_id TEXT;
ALTER TABLE recipes ADD COLUMN ingredient_id TEXT;
ALTER TABLE recipes ADD COLUMN quantity REAL DEFAULT 0;

CREATE TABLE IF NOT EXISTS recipe_ingredients (
  id TEXT PRIMARY KEY,
  recipe_id TEXT,
  product_id TEXT,
  ingredient_id TEXT NOT NULL,
  item_id TEXT,
  quantity REAL NOT NULL DEFAULT 1,
  unit TEXT DEFAULT 'g',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_ingredient
  ON recipe_ingredients(ingredient_id);

CREATE TABLE IF NOT EXISTS inventory_snapshots (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL,
  date TEXT NOT NULL DEFAULT (date('now')),
  opening_stock REAL NOT NULL DEFAULT 0,
  closing_stock REAL NOT NULL DEFAULT 0
);
ALTER TABLE inventory_snapshots ADD COLUMN created_at TEXT;
CREATE INDEX IF NOT EXISTS idx_inventory_snapshots_item_date
  ON inventory_snapshots(item_id, date);

CREATE TABLE IF NOT EXISTS inventory_forecast_snapshots (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  item_sku TEXT NOT NULL,
  item_name TEXT,
  daily_run_rate REAL NOT NULL DEFAULT 0,
  current_stock REAL NOT NULL DEFAULT 0,
  days_of_supply REAL NOT NULL DEFAULT 0,
  risk_level TEXT NOT NULL DEFAULT 'healthy',
  suggested_reorder_qty REAL NOT NULL DEFAULT 0,
  lead_time_days INTEGER DEFAULT 2,
  snapshot_date TEXT DEFAULT (date('now')),
  created_at TEXT DEFAULT (datetime('now'))
);
ALTER TABLE inventory_forecast_snapshots ADD COLUMN ai_summary TEXT;
CREATE INDEX IF NOT EXISTS idx_inventory_forecast_snapshots_tenant
  ON inventory_forecast_snapshots(tenant_id, created_at);

-- -----------------------------------------------------------------------------
-- 5. Reservations, Catalog & Payments Alignment
-- -----------------------------------------------------------------------------
ALTER TABLE reservations ADD COLUMN phone TEXT;
ALTER TABLE reservations ADD COLUMN pax INTEGER DEFAULT 2;
ALTER TABLE reservations ADD COLUMN reservation_date TEXT;

UPDATE reservations
SET phone = COALESCE(phone, customer_phone),
    pax = COALESCE(pax, guest_count, 2),
    reservation_date = COALESCE(reservation_date, date),
    reservation_time = COALESCE(reservation_time, time);

CREATE INDEX IF NOT EXISTS idx_reservations_table_date_time
  ON reservations(table_id, reservation_date, reservation_time);

ALTER TABLE cafe_tables ADD COLUMN current_order_id TEXT;

ALTER TABLE products ADD COLUMN category TEXT;

UPDATE products
SET category = COALESCE(category, category_id)
WHERE category IS NULL;

ALTER TABLE menu_items ADD COLUMN name_en TEXT;
ALTER TABLE menu_items ADD COLUMN sort_order INTEGER DEFAULT 0;

ALTER TABLE payments ADD COLUMN payment_method TEXT;

UPDATE payments
SET payment_method = COALESCE(payment_method, method)
WHERE payment_method IS NULL;

CREATE TABLE IF NOT EXISTS payment_transactions (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  payment_id TEXT,
  provider TEXT DEFAULT 'payos',
  method TEXT DEFAULT 'payos',
  amount REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  transaction_id TEXT,
  raw_payload TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_order_id
  ON payment_transactions(order_id);

CREATE TABLE IF NOT EXISTS payment_reconciliation_jobs (
  payment_id TEXT PRIMARY KEY,
  next_attempt_at TEXT NOT NULL,
  lease_until TEXT,
  lease_owner TEXT,
  last_checked_at TEXT,
  last_outcome TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

-- -----------------------------------------------------------------------------
-- 6. Auth Email Verifications, Staff Devices & Canonical Audit Logs Columns
-- -----------------------------------------------------------------------------
ALTER TABLE email_verifications ADD COLUMN attempts INTEGER DEFAULT 0;
ALTER TABLE email_verifications ADD COLUMN verified INTEGER DEFAULT 0;

UPDATE email_verifications
SET id = COALESCE(id, 'ev_' || email),
    token = COALESCE(token, code),
    used = COALESCE(used, verified, 0),
    verified = COALESCE(verified, used, 0);

CREATE INDEX IF NOT EXISTS idx_email_verifications_id
  ON email_verifications(id);

CREATE TABLE IF NOT EXISTS staff_devices (
  id TEXT PRIMARY KEY,
  staff_id TEXT NOT NULL,
  device_name TEXT,
  device_token TEXT UNIQUE NOT NULL,
  pin_hash TEXT NOT NULL DEFAULT '',
  role TEXT DEFAULT 'staff',
  last_login_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
ALTER TABLE staff_devices ADD COLUMN is_active INTEGER DEFAULT 1;
CREATE INDEX IF NOT EXISTS idx_staff_devices_token
  ON staff_devices(device_token);
CREATE INDEX IF NOT EXISTS idx_staff_devices_staff_id
  ON staff_devices(staff_id);

UPDATE audit_logs
SET user_id = COALESCE(user_id, actor_id, actor),
    entity_type = COALESCE(entity_type, resource_type, resource),
    entity_id = COALESCE(entity_id, resource_id),
    metadata = COALESCE(metadata, details);

-- -----------------------------------------------------------------------------
-- 7. SOP Checklists, ERPNext Queue, Notifications & Edge Integrations
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sop_templates (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  code TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  source TEXT NOT NULL DEFAULT 'SOP01',
  shift_type TEXT NOT NULL DEFAULT 'any',
  applicable_roles TEXT NOT NULL DEFAULT 'owner,manager,staff',
  version INTEGER NOT NULL DEFAULT 1,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sop_template_items (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  template_id TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  is_critical INTEGER NOT NULL DEFAULT 0,
  requires_note INTEGER NOT NULL DEFAULT 0,
  requires_value INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sop_runs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  template_id TEXT NOT NULL,
  template_version INTEGER NOT NULL DEFAULT 1,
  shift_id TEXT,
  staff_id TEXT NOT NULL,
  staff_name TEXT,
  shift_type TEXT NOT NULL DEFAULT 'any',
  status TEXT NOT NULL DEFAULT 'in_progress',
  scheduled_date TEXT,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  abandoned_reason TEXT,
  reminder_sent_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sop_run_items (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  run_id TEXT NOT NULL,
  template_item_id TEXT NOT NULL,
  is_checked INTEGER NOT NULL DEFAULT 0,
  checked_at TEXT,
  checked_by TEXT,
  note TEXT,
  value REAL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS erpnext_sync_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  erpnext_id TEXT,
  action TEXT NOT NULL,
  payload TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  error_message TEXT,
  attempts INTEGER DEFAULT 0,
  next_retry_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

ALTER TABLE erpnext_mappings ADD COLUMN aura_order_id TEXT;
ALTER TABLE erpnext_mappings ADD COLUMN erpnext_invoice_id TEXT;

UPDATE erpnext_mappings
SET aura_order_id = COALESCE(aura_order_id, local_id),
    erpnext_invoice_id = COALESCE(erpnext_invoice_id, CAST(erpnext_id AS TEXT));

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
CREATE INDEX IF NOT EXISTS idx_notifications_user_read
  ON notifications(user_id, read_at);

CREATE TABLE IF NOT EXISTS client_errors (
  id TEXT PRIMARY KEY,
  route TEXT,
  message TEXT,
  stack TEXT,
  href TEXT,
  user_agent TEXT,
  ts TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ai_product_affinities (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  item_a TEXT NOT NULL,
  item_b TEXT NOT NULL,
  co_occurrence_count INTEGER NOT NULL DEFAULT 1,
  affinity_score REAL NOT NULL DEFAULT 0.0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ai_barista_interactions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  customer_id TEXT,
  customer_phone TEXT,
  query_prompt TEXT,
  preferences_json TEXT,
  recommended_product_id TEXT NOT NULL,
  recommended_product_name TEXT NOT NULL,
  engine_used TEXT NOT NULL DEFAULT 'deterministic',
  feedback TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS dynamic_pricing_rules (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  name TEXT NOT NULL,
  rule_type TEXT NOT NULL,
  discount_percent REAL NOT NULL,
  target_category TEXT,
  target_product_id TEXT,
  min_margin_percent REAL NOT NULL DEFAULT 30.0,
  days_of_week TEXT NOT NULL DEFAULT '1,2,3,4,5',
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS container_telemetry_logs (
  id TEXT PRIMARY KEY,
  container_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  power_source TEXT NOT NULL,
  battery_percentage REAL,
  ambient_temp_celsius REAL NOT NULL,
  kds_online INTEGER NOT NULL DEFAULT 1,
  network_ping_ms INTEGER DEFAULT 20,
  alert_status TEXT NOT NULL DEFAULT 'NORMAL',
  alert_message TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS customer_support_interactions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  channel TEXT NOT NULL DEFAULT 'web',
  customer_phone TEXT,
  user_query TEXT NOT NULL,
  detected_intent TEXT NOT NULL,
  bot_response TEXT NOT NULL,
  engine_used TEXT NOT NULL DEFAULT 'deterministic',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ha_device_states (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_id TEXT NOT NULL UNIQUE,
  state TEXT NOT NULL,
  attributes TEXT,
  last_changed TEXT DEFAULT (datetime('now')),
  last_updated TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ha_automation_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  automation_id TEXT NOT NULL,
  trigger_entity TEXT,
  payload TEXT,
  result TEXT,
  executed_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ti_order_bridge (
  id TEXT PRIMARY KEY,
  local_order_id TEXT NOT NULL,
  ti_order_id TEXT,
  status TEXT NOT NULL,
  error TEXT,
  synced_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ti_menu_cache (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sku TEXT,
  price REAL DEFAULT 0,
  active INTEGER DEFAULT 1,
  cached_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS frigate_events (
  id TEXT PRIMARY KEY,
  camera TEXT NOT NULL,
  label TEXT NOT NULL,
  start_time REAL NOT NULL,
  end_time REAL,
  score REAL,
  payload TEXT,
  received_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS wifi_sessions (
  id TEXT PRIMARY KEY,
  client_mac TEXT NOT NULL,
  ip_address TEXT,
  phone TEXT,
  customer_id TEXT,
  status TEXT NOT NULL,
  session_timeout INTEGER DEFAULT 3600,
  authorized_at TEXT DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
