-- Tenant-scoped composite primary and unique keys for loyalty_tier_configs, tier_configs, promotions, and customers.
-- Replaces legacy global single-column PK/UNIQUE constraints with tenant-scoped constraints while
-- preserving all canonical and post-ALTER columns, foreign-key references, indexes, and triggers.

PRAGMA foreign_keys = OFF;
PRAGMA defer_foreign_keys = ON;

-- 1a. loyalty_tier_configs: composite PRIMARY KEY (tenant_id, tier)
DROP TABLE IF EXISTS _skip_loyalty_tier_configs_staging;
CREATE TABLE IF NOT EXISTS _skip_loyalty_tier_configs_staging (
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
  updated_at TEXT DEFAULT (datetime('now'))
);

WITH ranked_tiers AS (
  SELECT
    COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') AS norm_tenant_id,
    tier,
    name,
    min_points,
    max_points,
    point_multiplier,
    points_multiplier,
    discount_percent,
    birthday_bonus,
    free_shipping,
    priority_support,
    benefits,
    color,
    icon,
    updated_at,
    ROW_NUMBER() OVER (
      PARTITION BY COALESCE(NULLIF(TRIM(tenant_id), ''), 'default'), tier
      ORDER BY COALESCE(updated_at, '') DESC
    ) AS rn
  FROM loyalty_tier_configs
)
INSERT INTO _skip_loyalty_tier_configs_staging (
  tenant_id, tier, name, min_points, max_points, point_multiplier, points_multiplier,
  discount_percent, birthday_bonus, free_shipping, priority_support, benefits, color, icon, updated_at
)
SELECT
  norm_tenant_id, tier, name, min_points, max_points, point_multiplier, points_multiplier,
  discount_percent, birthday_bonus, free_shipping, priority_support, benefits, color, icon, updated_at
FROM ranked_tiers
WHERE rn = 1;

DROP TABLE IF EXISTS loyalty_tier_configs;
CREATE TABLE IF NOT EXISTS loyalty_tier_configs (
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

INSERT INTO loyalty_tier_configs (
  tenant_id, tier, name, min_points, max_points, point_multiplier, points_multiplier,
  discount_percent, birthday_bonus, free_shipping, priority_support, benefits, color, icon, updated_at
)
SELECT
  tenant_id, tier, name, min_points, max_points, point_multiplier, points_multiplier,
  discount_percent, birthday_bonus, free_shipping, priority_support, benefits, color, icon, updated_at
FROM _skip_loyalty_tier_configs_staging;

DROP TABLE IF EXISTS _skip_loyalty_tier_configs_staging;

CREATE INDEX IF NOT EXISTS idx_loyalty_tier_configs_tenant_id ON loyalty_tier_configs(tenant_id);

-- 1b. tier_configs: composite PRIMARY KEY (tenant_id, tier)
DROP TABLE IF EXISTS _skip_tier_configs_staging;
CREATE TABLE IF NOT EXISTS _skip_tier_configs_staging (
  tenant_id TEXT NOT NULL DEFAULT 'default',
  tier TEXT NOT NULL,
  tier_name TEXT,
  min_points INTEGER NOT NULL DEFAULT 0,
  cashback_rate REAL NOT NULL DEFAULT 0.02,
  multiplier REAL NOT NULL DEFAULT 1.0,
  point_multiplier REAL NOT NULL DEFAULT 1.0,
  points_multiplier REAL NOT NULL DEFAULT 1.0,
  birthday_discount INTEGER DEFAULT 0,
  benefits TEXT DEFAULT '[]',
  perks TEXT DEFAULT '[]',
  color TEXT DEFAULT '#CD7F32',
  display_name_vi TEXT,
  min_spent_vnd INTEGER NOT NULL DEFAULT 0,
  max_spent_vnd INTEGER,
  expiry_days INTEGER DEFAULT 90,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

WITH ranked_canonical_tiers AS (
  SELECT
    COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') AS norm_tenant_id,
    tier,
    tier_name,
    min_points,
    cashback_rate,
    multiplier,
    point_multiplier,
    points_multiplier,
    birthday_discount,
    benefits,
    perks,
    color,
    display_name_vi,
    min_spent_vnd,
    max_spent_vnd,
    expiry_days,
    sort_order,
    created_at,
    updated_at,
    ROW_NUMBER() OVER (
      PARTITION BY COALESCE(NULLIF(TRIM(tenant_id), ''), 'default'), tier
      ORDER BY COALESCE(updated_at, created_at, '') DESC
    ) AS rn
  FROM tier_configs
)
INSERT INTO _skip_tier_configs_staging (
  tenant_id, tier, tier_name, min_points, cashback_rate, multiplier, point_multiplier,
  points_multiplier, birthday_discount, benefits, perks, color, display_name_vi,
  min_spent_vnd, max_spent_vnd, expiry_days, sort_order, created_at, updated_at
)
SELECT
  norm_tenant_id, tier, tier_name, min_points, cashback_rate, multiplier, point_multiplier,
  points_multiplier, birthday_discount, benefits, perks, color, display_name_vi,
  min_spent_vnd, max_spent_vnd, expiry_days, sort_order, created_at, updated_at
FROM ranked_canonical_tiers
WHERE rn = 1;

DROP TABLE IF EXISTS tier_configs;
CREATE TABLE IF NOT EXISTS tier_configs (
  tenant_id TEXT NOT NULL DEFAULT 'default',
  tier TEXT NOT NULL,
  tier_name TEXT,
  min_points INTEGER NOT NULL DEFAULT 0,
  cashback_rate REAL NOT NULL DEFAULT 0.02,
  multiplier REAL NOT NULL DEFAULT 1.0,
  point_multiplier REAL NOT NULL DEFAULT 1.0,
  points_multiplier REAL NOT NULL DEFAULT 1.0,
  birthday_discount INTEGER DEFAULT 0,
  benefits TEXT DEFAULT '[]',
  perks TEXT DEFAULT '[]',
  color TEXT DEFAULT '#CD7F32',
  display_name_vi TEXT,
  min_spent_vnd INTEGER NOT NULL DEFAULT 0,
  max_spent_vnd INTEGER,
  expiry_days INTEGER DEFAULT 90,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (tenant_id, tier)
);

INSERT INTO tier_configs (
  tenant_id, tier, tier_name, min_points, cashback_rate, multiplier, point_multiplier,
  points_multiplier, birthday_discount, benefits, perks, color, display_name_vi,
  min_spent_vnd, max_spent_vnd, expiry_days, sort_order, created_at, updated_at
)
SELECT
  tenant_id, tier, tier_name, min_points, cashback_rate, multiplier, point_multiplier,
  points_multiplier, birthday_discount, benefits, perks, color, display_name_vi,
  min_spent_vnd, max_spent_vnd, expiry_days, sort_order, created_at, updated_at
FROM _skip_tier_configs_staging;

DROP TABLE IF EXISTS _skip_tier_configs_staging;

CREATE INDEX IF NOT EXISTS idx_tier_configs_tenant_id ON tier_configs(tenant_id);

-- 2. promotions: composite PRIMARY KEY (tenant_id, code) with usage_limit_per_customer
DROP TABLE IF EXISTS _skip_promo_defaults;
CREATE TABLE IF NOT EXISTS _skip_promo_defaults (
  usage_limit_per_customer INTEGER NOT NULL DEFAULT 0
);
INSERT INTO _skip_promo_defaults (usage_limit_per_customer) VALUES (0);

DROP TABLE IF EXISTS _skip_promotions_staging;
CREATE TABLE IF NOT EXISTS _skip_promotions_staging (
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
  discount_value REAL DEFAULT 0,
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
  usage_limit_per_customer INTEGER DEFAULT 0
);

WITH extracted_promos AS (
  SELECT
    p.id,
    p.code,
    p.name,
    p.type,
    p.value,
    COALESCE(p.percent, 0) AS percent,
    p.max_discount,
    p.min_order,
    p.usage_limit,
    p.usage_count,
    p.starts_at,
    p.expires_at,
    p.is_active,
    p.applicable_items,
    p.applicable_tiers,
    COALESCE(NULLIF(TRIM(p.tenant_id), ''), 'default') AS norm_tenant_id,
    p.created_at,
    p.description,
    p.discount_value,
    p.discount_type,
    p.max_uses,
    p.current_uses,
    p.used_count,
    p.min_order_value,
    p.max_discount_value,
    p.valid_from,
    p.valid_to,
    p.excluded_items,
    p.updated_at,
    p.start_date,
    p.end_date,
    (SELECT COALESCE(usage_limit_per_customer, 0) FROM promotions p2 WHERE p2.rowid = p.rowid) AS resolved_usage_limit_per_customer
  FROM _skip_promo_defaults d
  CROSS JOIN promotions p
),
ranked_promos AS (
  SELECT
    *,
    ROW_NUMBER() OVER (
      PARTITION BY norm_tenant_id, code
      ORDER BY COALESCE(updated_at, '') DESC, COALESCE(created_at, '') DESC, COALESCE(id, '') DESC
    ) AS rn
  FROM extracted_promos
)
INSERT INTO _skip_promotions_staging (
  id, code, name, type, value, percent, max_discount, min_order,
  usage_limit, usage_count, starts_at, expires_at, is_active,
  applicable_items, applicable_tiers, tenant_id, created_at,
  description, discount_value, discount_type, max_uses, current_uses, used_count,
  min_order_value, max_discount_value, valid_from, valid_to, excluded_items,
  updated_at, start_date, end_date, usage_limit_per_customer
)
SELECT
  id, code, name, type, value, percent, max_discount, min_order,
  usage_limit, usage_count, starts_at, expires_at, is_active,
  applicable_items, applicable_tiers, norm_tenant_id, created_at,
  description, discount_value, discount_type, max_uses, current_uses, used_count,
  min_order_value, max_discount_value, valid_from, valid_to, excluded_items,
  updated_at, start_date, end_date, resolved_usage_limit_per_customer
FROM ranked_promos
WHERE rn = 1;

DROP TABLE IF EXISTS _skip_promo_defaults;
DROP TABLE IF EXISTS promotions;
CREATE TABLE IF NOT EXISTS promotions (
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
  discount_value REAL DEFAULT 0,
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
  usage_limit_per_customer INTEGER DEFAULT 0,
  PRIMARY KEY (tenant_id, code)
);

INSERT INTO promotions (
  id, code, name, type, value, percent, max_discount, min_order,
  usage_limit, usage_count, starts_at, expires_at, is_active,
  applicable_items, applicable_tiers, tenant_id, created_at,
  description, discount_value, discount_type, max_uses, current_uses, used_count,
  min_order_value, max_discount_value, valid_from, valid_to, excluded_items,
  updated_at, start_date, end_date, usage_limit_per_customer
)
SELECT
  id, code, name, type, value, percent, max_discount, min_order,
  usage_limit, usage_count, starts_at, expires_at, is_active,
  applicable_items, applicable_tiers, tenant_id, created_at,
  description, discount_value, discount_type, max_uses, current_uses, used_count,
  min_order_value, max_discount_value, valid_from, valid_to, excluded_items,
  updated_at, start_date, end_date, usage_limit_per_customer
FROM _skip_promotions_staging;

DROP TABLE IF EXISTS _skip_promotions_staging;

CREATE INDEX IF NOT EXISTS idx_promo_active ON promotions(is_active);
CREATE INDEX IF NOT EXISTS idx_promo_tenant ON promotions(tenant_id, is_active);

-- 3. customers: tenant-scoped UNIQUE(tenant_id, email) and UNIQUE(tenant_id, phone)
-- Normalizes blank/whitespace email and phone to NULL and deduplicates in-tenant collisions
-- deterministically while preserving every customer id so child foreign keys remain intact.
DROP TABLE IF EXISTS _skip_customers_staging;
CREATE TABLE IF NOT EXISTS _skip_customers_staging (
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
  cashback_balance REAL DEFAULT 0,
  visit_count INTEGER DEFAULT 0,
  last_ip TEXT,
  tax_id TEXT,
  erpnext_id TEXT,
  sync_status TEXT DEFAULT 'pending',
  erpnext_last_synced TEXT,
  auth_version INTEGER NOT NULL DEFAULT 1,
  anonymized_at TEXT
);

WITH normalized_customers AS (
  SELECT
    id,
    COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') AS norm_tenant_id,
    NULLIF(TRIM(email), '') AS norm_email,
    name,
    NULLIF(TRIM(phone), '') AS norm_phone,
    tier,
    loyalty_points,
    lifetime_points,
    loyalty_tier,
    total_spent,
    total_orders,
    date_of_birth,
    birthday,
    notes,
    zalo,
    source,
    capture_source,
    marketing_consent,
    consent_marketing,
    consent_analytics,
    consent_timestamp,
    verified_at,
    first_visit_at,
    last_visit_at,
    referral_code,
    referred_by,
    created_at,
    updated_at,
    signup_bonus_claimed,
    last_expiry_warning_at,
    cashback_balance,
    visit_count,
    last_ip,
    tax_id,
    erpnext_id,
    sync_status,
    erpnext_last_synced,
    COALESCE(auth_version, 1) AS norm_auth_version,
    anonymized_at
  FROM customers
),
ranked_customers AS (
  SELECT
    *,
    CASE
      WHEN norm_email IS NULL THEN 1
      ELSE ROW_NUMBER() OVER (
        PARTITION BY norm_tenant_id, LOWER(norm_email)
        ORDER BY COALESCE(updated_at, '') DESC, COALESCE(created_at, '') DESC, id DESC
      )
    END AS email_rn,
    CASE
      WHEN norm_phone IS NULL THEN 1
      ELSE ROW_NUMBER() OVER (
        PARTITION BY norm_tenant_id, norm_phone
        ORDER BY COALESCE(updated_at, '') DESC, COALESCE(created_at, '') DESC, id DESC
      )
    END AS phone_rn
  FROM normalized_customers
)
INSERT INTO _skip_customers_staging (
  id, tenant_id, email, name, phone, tier, loyalty_points, lifetime_points, loyalty_tier,
  total_spent, total_orders, date_of_birth, birthday, notes, zalo, source, capture_source,
  marketing_consent, consent_marketing, consent_analytics, consent_timestamp, verified_at,
  first_visit_at, last_visit_at, referral_code, referred_by, created_at, updated_at,
  signup_bonus_claimed, last_expiry_warning_at, cashback_balance, visit_count, last_ip,
  tax_id, erpnext_id, sync_status, erpnext_last_synced, auth_version, anonymized_at
)
SELECT
  id,
  norm_tenant_id,
  CASE WHEN email_rn = 1 THEN norm_email ELSE NULL END,
  name,
  CASE WHEN phone_rn = 1 THEN norm_phone ELSE NULL END,
  tier,
  loyalty_points,
  lifetime_points,
  loyalty_tier,
  total_spent,
  total_orders,
  date_of_birth,
  birthday,
  notes,
  zalo,
  source,
  capture_source,
  marketing_consent,
  consent_marketing,
  consent_analytics,
  consent_timestamp,
  verified_at,
  first_visit_at,
  last_visit_at,
  referral_code,
  referred_by,
  created_at,
  updated_at,
  signup_bonus_claimed,
  last_expiry_warning_at,
  cashback_balance,
  visit_count,
  last_ip,
  tax_id,
  erpnext_id,
  sync_status,
  erpnext_last_synced,
  norm_auth_version,
  anonymized_at
FROM ranked_customers;

DROP TABLE IF EXISTS customers;
CREATE TABLE IF NOT EXISTS customers (
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
  cashback_balance REAL DEFAULT 0,
  visit_count INTEGER DEFAULT 0,
  last_ip TEXT,
  tax_id TEXT,
  erpnext_id TEXT,
  sync_status TEXT DEFAULT 'pending',
  erpnext_last_synced TEXT,
  auth_version INTEGER NOT NULL DEFAULT 1,
  anonymized_at TEXT,
  UNIQUE(tenant_id, email),
  UNIQUE(tenant_id, phone)
);

INSERT INTO customers (
  id, tenant_id, email, name, phone, tier, loyalty_points, lifetime_points, loyalty_tier,
  total_spent, total_orders, date_of_birth, birthday, notes, zalo, source, capture_source,
  marketing_consent, consent_marketing, consent_analytics, consent_timestamp, verified_at,
  first_visit_at, last_visit_at, referral_code, referred_by, created_at, updated_at,
  signup_bonus_claimed, last_expiry_warning_at, cashback_balance, visit_count, last_ip,
  tax_id, erpnext_id, sync_status, erpnext_last_synced, auth_version, anonymized_at
)
SELECT
  id, tenant_id, email, name, phone, tier, loyalty_points, lifetime_points, loyalty_tier,
  total_spent, total_orders, date_of_birth, birthday, notes, zalo, source, capture_source,
  marketing_consent, consent_marketing, consent_analytics, consent_timestamp, verified_at,
  first_visit_at, last_visit_at, referral_code, referred_by, created_at, updated_at,
  signup_bonus_claimed, last_expiry_warning_at, cashback_balance, visit_count, last_ip,
  tax_id, erpnext_id, sync_status, erpnext_last_synced, auth_version, anonymized_at
FROM _skip_customers_staging;

DROP TABLE IF EXISTS _skip_customers_staging;

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

PRAGMA foreign_keys = ON;
