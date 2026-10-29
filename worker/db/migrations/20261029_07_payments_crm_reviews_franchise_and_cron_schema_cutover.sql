-- Production D1 Schema Cutover for Payments Reconciliation, CRM, Reviews, Franchise & Scheduled Jobs
-- Bridges legacy worker/migrations/004..013 and multi-tenant franchise/CRM tables into worker/db/migrations/
-- so PayOS reconciliation cron, manual payment reconcile, refunds, BOM active recipes, referrals,
-- birthday redemptions, customer reviews, franchise locations, SaaS pricing/tenants, and Mixpost
-- routes execute against fnb-caffe-db without missing-table or missing-column errors.

-- 1. Payments refund tracking columns (required by PayOS reconciliation cron, manual reconcile, and refund routes)
ALTER TABLE payments ADD COLUMN refund_status TEXT DEFAULT NULL;
ALTER TABLE payments ADD COLUMN refund_amount INTEGER DEFAULT 0;
ALTER TABLE payments ADD COLUMN refund_reason TEXT;
ALTER TABLE payments ADD COLUMN refunded_at TEXT;

-- 2. BOM recipes active flag (required by primary BOM lookup in order stock deduction)
ALTER TABLE recipes ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1;

-- 3. Customer CRM, cashback expiry warning, and loyalty export columns
ALTER TABLE customers ADD COLUMN last_expiry_warning_at TEXT;
ALTER TABLE customers ADD COLUMN cashback_balance REAL DEFAULT 0;
ALTER TABLE customers ADD COLUMN total_spent REAL DEFAULT 0;
ALTER TABLE customers ADD COLUMN visit_count INTEGER DEFAULT 0;
ALTER TABLE customers ADD COLUMN total_orders INTEGER DEFAULT 0;
ALTER TABLE customers ADD COLUMN last_ip TEXT;

-- 4. Referral program cashback and bonus type columns
ALTER TABLE referral_codes ADD COLUMN total_cashback_earned_vnd INTEGER DEFAULT 0;
ALTER TABLE referrals ADD COLUMN bonus_type TEXT DEFAULT 'cashback';

-- 5. Observability alerts, push subscriptions, and ERPNext sync columns
ALTER TABLE _alerts ADD COLUMN value REAL;
ALTER TABLE _alerts ADD COLUMN threshold REAL;
ALTER TABLE _alerts ADD COLUMN resolved_at TEXT;

ALTER TABLE push_subscriptions ADD COLUMN user_id TEXT;

ALTER TABLE erpnext_mappings ADD COLUMN updated_at TEXT;
ALTER TABLE erpnext_product_sync ADD COLUMN erpnext_item_code TEXT;
ALTER TABLE erpnext_product_sync ADD COLUMN erpnext_modified TEXT;
ALTER TABLE erpnext_sync_logs ADD COLUMN method TEXT DEFAULT 'POST';
ALTER TABLE erpnext_sync_logs ADD COLUMN endpoint TEXT;
ALTER TABLE erpnext_sync_logs ADD COLUMN request_body TEXT;
ALTER TABLE erpnext_sync_logs ADD COLUMN response_body TEXT;
ALTER TABLE erpnext_sync_logs ADD COLUMN error TEXT;
ALTER TABLE erpnext_sync_logs ADD COLUMN retry_count INTEGER DEFAULT 0;

CREATE TABLE IF NOT EXISTS erpnext_sync_log (
  id TEXT PRIMARY KEY,
  method TEXT NOT NULL DEFAULT 'POST',
  endpoint TEXT NOT NULL,
  request_body TEXT,
  response_body TEXT,
  error TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  retry_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_erpnext_sync_log_status ON erpnext_sync_log(status, retry_count);
CREATE INDEX IF NOT EXISTS idx_erpnext_sync_log_created ON erpnext_sync_log(created_at);

-- 6. Birthday redemptions table (required by /api/birthday/check and /api/birthday/redeem)
CREATE TABLE IF NOT EXISTS birthday_redemptions (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  discount_percent INTEGER NOT NULL DEFAULT 15,
  order_id TEXT,
  redeemed_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);
CREATE INDEX IF NOT EXISTS idx_birthday_redemptions_customer ON birthday_redemptions(customer_id, redeemed_at);

-- 7. Customer reviews table (required by /api/reviews and /api/reviews/stats)
CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  order_id TEXT,
  customer_name TEXT NOT NULL DEFAULT 'Anonymous',
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT DEFAULT '',
  content TEXT DEFAULT '',
  tags TEXT DEFAULT '[]',
  status TEXT DEFAULT 'published',
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_reviews_created_at ON reviews(created_at);
CREATE INDEX IF NOT EXISTS idx_reviews_rating ON reviews(rating);

-- 8. Franchise locations table and Sa Dec flagship container seed (required by /api/franchise/locations)
CREATE TABLE IF NOT EXISTS franchise_locations (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  address TEXT,
  city TEXT DEFAULT 'Sa Đéc',
  phone TEXT,
  royalty_percentage REAL DEFAULT 5.0,
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_franchise_tenant ON franchise_locations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_franchise_code ON franchise_locations(code);
CREATE INDEX IF NOT EXISTS idx_franchise_status ON franchise_locations(status);

INSERT OR IGNORE INTO franchise_locations (
  id, tenant_id, code, name, address, city, phone, royalty_percentage, status
) VALUES (
  'loc_sadec_flagship', 'default', 'SD-01', 'AURA Sa Đéc Container 01', 'Sa Đéc, Đồng Tháp', 'Sa Đéc', '0901234567', 0.0, 'active'
);

-- 9. Container lease subscription and MRR tables (required by /api/subscriptions/* and MRR cron)
CREATE TABLE IF NOT EXISTS subscription_plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT DEFAULT '',
  container_size TEXT NOT NULL DEFAULT 'standard',
  monthly_price_vnd REAL NOT NULL,
  deposit_vnd REAL NOT NULL DEFAULT 0,
  features TEXT DEFAULT '[]',
  max_occupants INTEGER NOT NULL DEFAULT 1,
  is_popular INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_subscription_plans_slug ON subscription_plans(slug);
CREATE INDEX IF NOT EXISTS idx_subscription_plans_active ON subscription_plans(is_active);

CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL REFERENCES subscription_plans(id),
  customer_id TEXT,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  container_number TEXT,
  zone TEXT NOT NULL DEFAULT 'indoor',
  status TEXT NOT NULL DEFAULT 'active',
  billing_cycle TEXT NOT NULL DEFAULT 'monthly',
  current_period_start TEXT NOT NULL,
  current_period_end TEXT NOT NULL,
  next_billing_date TEXT NOT NULL,
  amount_vnd REAL NOT NULL,
  deposit_paid REAL NOT NULL DEFAULT 0,
  deposit_vnd REAL NOT NULL DEFAULT 0,
  notes TEXT DEFAULT '',
  cancelled_at TEXT,
  cancellation_reason TEXT,
  paused_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_subscriptions_customer ON subscriptions(customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_zone ON subscriptions(zone);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

CREATE TABLE IF NOT EXISTS subscription_invoices (
  id TEXT PRIMARY KEY,
  subscription_id TEXT NOT NULL REFERENCES subscriptions(id),
  invoice_number TEXT UNIQUE,
  amount_vnd REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'VND',
  status TEXT NOT NULL DEFAULT 'pending',
  payment_method TEXT,
  payment_ref TEXT,
  paid_at TEXT,
  period_start TEXT,
  period_end TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_invoices_subscription ON subscription_invoices(subscription_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON subscription_invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_payment_ref ON subscription_invoices(payment_ref);

CREATE TABLE IF NOT EXISTS mrr_snapshots (
  id TEXT PRIMARY KEY,
  snapshot_date TEXT UNIQUE NOT NULL,
  mrr_vnd REAL NOT NULL DEFAULT 0,
  arr_vnd REAL NOT NULL DEFAULT 0,
  active_subscriptions INTEGER NOT NULL DEFAULT 0,
  new_subscriptions_month INTEGER NOT NULL DEFAULT 0,
  churned_subscriptions_month INTEGER NOT NULL DEFAULT 0,
  expansion_mrr_vnd REAL DEFAULT 0,
  contraction_mrr_vnd REAL DEFAULT 0,
  churn_rate_pct REAL DEFAULT 0,
  avg_contract_value_vnd REAL DEFAULT 0,
  by_zone TEXT DEFAULT '{}',
  by_plan TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now'))
);

-- 10. SaaS pricing & tenant tables (required by /api/pricing, /api/tenants, and owner tenant lookup)
CREATE TABLE IF NOT EXISTS saas_pricing (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name_vi TEXT NOT NULL,
  name_en TEXT NOT NULL,
  description_vi TEXT,
  description_en TEXT,
  price_vnd INTEGER NOT NULL,
  price_usd REAL,
  currency TEXT NOT NULL DEFAULT 'VND',
  billing_period TEXT NOT NULL DEFAULT 'monthly',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_recommended INTEGER NOT NULL DEFAULT 0,
  features_vi TEXT NOT NULL DEFAULT '[]',
  features_en TEXT NOT NULL DEFAULT '[]',
  cta_text_vi TEXT NOT NULL DEFAULT 'Bắt đầu',
  cta_text_en TEXT NOT NULL DEFAULT 'Get Started',
  cta_link TEXT NOT NULL DEFAULT '/register',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_saas_pricing_slug ON saas_pricing(slug);
CREATE INDEX IF NOT EXISTS idx_saas_pricing_active_sort ON saas_pricing(active, sort_order);

CREATE TABLE IF NOT EXISTS saas_tenants (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT,
  tier TEXT NOT NULL DEFAULT 'BASIC',
  status TEXT NOT NULL DEFAULT 'trial',
  owner_user_id TEXT,
  trial_ends_at TEXT,
  current_period_end TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_saas_tenants_owner ON saas_tenants(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_saas_tenants_slug ON saas_tenants(slug);

INSERT OR IGNORE INTO saas_tenants (
  id, slug, name, tier, status, owner_user_id, created_at, updated_at
) VALUES (
  'default', 'aura-sadec-01', 'AURA Space — Container Caffe Sa Đéc', 'ENTERPRISE', 'active', 'USR_owner01', '2026-10-29T00:00:00.000Z', '2026-10-29T00:00:00.000Z'
);

-- 11. Mixpost social publishing tables (required by /api/mixpost/posts and auto-post handler)
CREATE TABLE IF NOT EXISTS mixpost_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  platforms TEXT DEFAULT '[]',
  media_urls TEXT DEFAULT '[]',
  source TEXT DEFAULT 'manual',
  scheduled_at TEXT,
  published_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_mixpost_posts_created ON mixpost_posts(created_at);

CREATE TABLE IF NOT EXISTS mixpost_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  content_template TEXT NOT NULL,
  accounts TEXT DEFAULT '[]',
  schedule_cron TEXT NOT NULL DEFAULT '* *',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);
