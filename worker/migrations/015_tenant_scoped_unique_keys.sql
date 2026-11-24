-- Migration 015: Tenant-scoped composite primary/unique keys for loyalty_tier_configs, customers, and promotions
-- Replaces global single-column PK/UNIQUE constraints so multiple tenants can independently
-- configure loyalty tiers, register customers with the same phone/email, and create shared promo codes.
-- Preserves all canonical + post-ALTER TABLE columns, indexes, and triggers.

PRAGMA defer_foreign_keys = ON;

-- 1. loyalty_tier_configs: composite PRIMARY KEY (tenant_id, tier)
CREATE TABLE IF NOT EXISTS loyalty_tier_configs_new (
  tenant_id TEXT NOT NULL DEFAULT 'default',
  tier TEXT NOT NULL,
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
  updated_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (tenant_id, tier)
);

INSERT OR IGNORE INTO loyalty_tier_configs_new (
  tenant_id, tier, name, min_points, max_points, point_multiplier, points_multiplier,
  discount_percent, birthday_bonus, free_shipping, priority_support, benefits, color, icon, updated_at
)
SELECT
  COALESCE(NULLIF(TRIM(tenant_id), ''), 'default'),
  tier, name, min_points, max_points, point_multiplier, points_multiplier,
  discount_percent, birthday_bonus, free_shipping, priority_support, benefits, color, icon, updated_at
FROM loyalty_tier_configs;

DROP TABLE IF EXISTS loyalty_tier_configs;
ALTER TABLE loyalty_tier_configs_new RENAME TO loyalty_tier_configs;

CREATE INDEX IF NOT EXISTS idx_loyalty_tier_configs_tenant_id ON loyalty_tier_configs(tenant_id);

-- 2. promotions: composite PRIMARY KEY (tenant_id, code) with all canonical + post-ALTER columns
CREATE TABLE IF NOT EXISTS promotions_new (
  id TEXT,
  code TEXT NOT NULL,
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
  created_at TEXT DEFAULT (datetime('now')),
  description TEXT,
  discount_value REAL,
  discount_type TEXT DEFAULT 'percentage',
  max_uses INTEGER,
  current_uses INTEGER DEFAULT 0,
  used_count INTEGER DEFAULT 0,
  min_order_value REAL DEFAULT 0,
  max_discount_value REAL,
  valid_from TEXT,
  valid_to TEXT,
  excluded_items TEXT,
  updated_at TEXT,
  start_date TEXT,
  end_date TEXT,
  PRIMARY KEY (tenant_id, code)
);

INSERT OR IGNORE INTO promotions_new (
  id, code, name, type, value, percent, max_discount, min_order,
  usage_limit, usage_count, starts_at, expires_at, is_active,
  applicable_items, applicable_tiers, tenant_id, created_at,
  description, discount_value, discount_type, max_uses, current_uses, used_count,
  min_order_value, max_discount_value, valid_from, valid_to, excluded_items,
  updated_at, start_date, end_date
)
SELECT
  id, code, name, type, value, percent, max_discount, min_order,
  usage_limit, usage_count, starts_at, expires_at, is_active,
  applicable_items, applicable_tiers,
  COALESCE(NULLIF(TRIM(tenant_id), ''), 'default'),
  created_at,
  description, discount_value, discount_type, max_uses, current_uses, used_count,
  min_order_value, max_discount_value, valid_from, valid_to, excluded_items,
  updated_at, start_date, end_date
FROM promotions;

DROP TABLE IF EXISTS promotions;
ALTER TABLE promotions_new RENAME TO promotions;

CREATE INDEX IF NOT EXISTS idx_promo_active ON promotions(is_active);
CREATE INDEX IF NOT EXISTS idx_promo_tenant ON promotions(tenant_id, is_active);

-- 3. customers: tenant-scoped UNIQUE(tenant_id, email) and UNIQUE(tenant_id, phone) with all canonical + post-ALTER columns
CREATE TABLE IF NOT EXISTS customers_new (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  email TEXT,
  name TEXT,
  phone TEXT,
  tier TEXT DEFAULT 'bronze',
  loyalty_points INTEGER DEFAULT 0,
  lifetime_points INTEGER DEFAULT 0,
  loyalty_tier TEXT DEFAULT 'bronze',
  total_spent REAL DEFAULT 0,
  total_orders INTEGER DEFAULT 0,
  date_of_birth TEXT,
  birthday TEXT,
  notes TEXT,
  zalo TEXT,
  source TEXT,
  capture_source TEXT,
  marketing_consent INTEGER DEFAULT 0,
  consent_marketing INTEGER DEFAULT 0,
  consent_analytics INTEGER DEFAULT 0,
  consent_timestamp TEXT,
  verified_at TEXT,
  first_visit_at TEXT,
  last_visit_at TEXT,
  referral_code TEXT,
  referred_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  signup_bonus_claimed INTEGER DEFAULT 0,
  last_expiry_warning_at TEXT,
  cashback_balance INTEGER DEFAULT 0,
  visit_count INTEGER DEFAULT 0,
  last_ip TEXT,
  tax_id TEXT,
  erpnext_id TEXT,
  sync_status TEXT DEFAULT 'pending',
  erpnext_last_synced DATETIME,
  auth_version INTEGER DEFAULT 1,
  anonymized_at TEXT,
  UNIQUE(tenant_id, email),
  UNIQUE(tenant_id, phone)
);

INSERT OR IGNORE INTO customers_new (
  id, tenant_id, email, name, phone, tier, loyalty_points, lifetime_points, loyalty_tier,
  total_spent, total_orders, date_of_birth, birthday, notes, zalo, source, capture_source,
  marketing_consent, consent_marketing, consent_analytics, consent_timestamp, verified_at,
  first_visit_at, last_visit_at, referral_code, referred_by, created_at, updated_at,
  signup_bonus_claimed, last_expiry_warning_at, cashback_balance, visit_count, last_ip,
  tax_id, erpnext_id, sync_status, erpnext_last_synced, auth_version, anonymized_at
)
SELECT
  id,
  COALESCE(NULLIF(TRIM(tenant_id), ''), 'default'),
  email, name, phone, tier, loyalty_points, lifetime_points, loyalty_tier,
  total_spent, total_orders, date_of_birth, birthday, notes, zalo, source, capture_source,
  marketing_consent, consent_marketing, consent_analytics, consent_timestamp, verified_at,
  first_visit_at, last_visit_at, referral_code, referred_by, created_at, updated_at,
  signup_bonus_claimed, last_expiry_warning_at, cashback_balance, visit_count, last_ip,
  tax_id, erpnext_id, sync_status, erpnext_last_synced, auth_version, anonymized_at
FROM customers;

DROP TABLE IF EXISTS customers;
ALTER TABLE customers_new RENAME TO customers;

CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_loyalty_tier ON customers(loyalty_tier);
CREATE INDEX IF NOT EXISTS idx_customers_tenant ON customers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_customers_erpnext_id ON customers(erpnext_id);
CREATE INDEX IF NOT EXISTS idx_customers_sync_status ON customers(sync_status);

CREATE TRIGGER IF NOT EXISTS update_customers_timestamp
AFTER UPDATE ON customers
BEGIN
    UPDATE customers SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
