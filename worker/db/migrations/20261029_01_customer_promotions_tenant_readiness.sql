-- Customer promotions and loyalty ledger readiness migration.
-- Ensures idempotent promotion catalog, redemption tracking, customer promotion
-- usage logs, bonus campaign cap ledger, and permanent WELCOME (-10%, 30.000 VND cap)
-- new-customer promotion configuration.

CREATE TABLE IF NOT EXISTS promotions (
  id TEXT,
  code TEXT PRIMARY KEY,
  name TEXT,
  type TEXT DEFAULT 'percent',
  value REAL,
  percent INTEGER NOT NULL DEFAULT 0,
  max_discount INTEGER DEFAULT 0,
  min_order INTEGER DEFAULT 0,
  usage_limit INTEGER DEFAULT 0,
  usage_count INTEGER DEFAULT 0,
  starts_at TEXT,
  expires_at TEXT,
  is_active INTEGER DEFAULT 1,
  applicable_items TEXT,
  applicable_tiers TEXT,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_promotions_active
  ON promotions(is_active);

CREATE TABLE IF NOT EXISTS promotion_redemptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  promotion_id TEXT,
  code TEXT NOT NULL,
  order_id TEXT UNIQUE NOT NULL,
  customer_id TEXT,
  customer_phone TEXT,
  discount_amount INTEGER NOT NULL DEFAULT 0,
  order_total INTEGER NOT NULL DEFAULT 0,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  redeemed_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_promotion_redemptions_order
  ON promotion_redemptions(order_id);
CREATE INDEX IF NOT EXISTS idx_promotion_redemptions_code
  ON promotion_redemptions(code, tenant_id);

CREATE TABLE IF NOT EXISTS promotion_usages (
  id TEXT PRIMARY KEY,
  promotion_id TEXT NOT NULL,
  customer_id TEXT,
  order_id TEXT UNIQUE,
  discount_amount REAL NOT NULL DEFAULT 0,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_promotion_usages_customer
  ON promotion_usages(promotion_id, customer_id);

CREATE TABLE IF NOT EXISTS bonus_campaigns (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'grand_opening',
  signup_bonus_vnd INTEGER NOT NULL DEFAULT 50000,
  signup_bonus_cap INTEGER NOT NULL DEFAULT 100,
  signup_bonus_claimed INTEGER NOT NULL DEFAULT 0,
  refer_bonus_vnd INTEGER NOT NULL DEFAULT 10000,
  max_cap_per_customer_vnd INTEGER NOT NULL DEFAULT 50000,
  cashback_multiplier REAL NOT NULL DEFAULT 1,
  min_order_for_bonus INTEGER NOT NULL DEFAULT 0,
  start_date TEXT,
  end_date TEXT,
  starts_at TEXT,
  ends_at TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  is_active INTEGER NOT NULL DEFAULT 1,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_bonus_campaigns_code
  ON bonus_campaigns(code);
CREATE INDEX IF NOT EXISTS idx_bonus_campaigns_active
  ON bonus_campaigns(active);

CREATE TABLE IF NOT EXISTS signup_bonus_log (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  campaign_id TEXT NOT NULL,
  bonus_vnd INTEGER NOT NULL DEFAULT 0,
  amount_vnd INTEGER NOT NULL DEFAULT 0,
  wallet_tx_id TEXT,
  phone TEXT,
  ip_hint TEXT,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  granted_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(customer_id, campaign_id)
);

CREATE INDEX IF NOT EXISTS idx_signup_bonus_log_campaign
  ON signup_bonus_log(campaign_id, granted_at);

CREATE TABLE IF NOT EXISTS loyalty_audit_log (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  staff_id TEXT,
  action TEXT,
  event_type TEXT NOT NULL DEFAULT 'audit',
  amount_vnd INTEGER NOT NULL DEFAULT 0,
  metadata TEXT,
  points_delta INTEGER NOT NULL DEFAULT 0,
  points_after INTEGER NOT NULL DEFAULT 0,
  cashback_delta INTEGER NOT NULL DEFAULT 0,
  cashback_after INTEGER NOT NULL DEFAULT 0,
  tier_before TEXT,
  tier_after TEXT,
  order_id TEXT,
  campaign_id TEXT,
  note TEXT,
  actor TEXT,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_loyalty_audit_customer
  ON loyalty_audit_log(customer_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_audit_created
  ON loyalty_audit_log(created_at);

-- Ensure WELCOME (-10%, cap 30.000 VND, no expiry) is active for new customers
INSERT OR IGNORE INTO promotions (
  code, percent, max_discount, min_order, usage_limit, usage_count, starts_at, expires_at, is_active
) VALUES (
  'WELCOME', 10, 30000, 0, 0, 0, NULL, NULL, 1
);

UPDATE promotions
SET percent = 10,
    max_discount = 30000,
    starts_at = NULL,
    expires_at = NULL,
    is_active = 1
WHERE UPPER(code) = 'WELCOME';
