-- F&B Caffe Container - Cloudflare D1 Schema
-- Creates 4 core tables: orders, customers, menu_items, payments

-- NOTE: the previous DROP TABLE block was removed — it silently destroyed
-- data whenever this file was re-run against a populated database.
-- For a clean rebuild, drop tables explicitly in a scratch database instead.

-- =====================================================
-- CATEGORIES TABLE
-- =====================================================
CREATE TABLE categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    image_url TEXT,
    display_name_vi TEXT,
    display_name_en TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_categories_slug ON categories(slug);
CREATE INDEX idx_categories_sort_order ON categories(sort_order);

-- =====================================================
-- PRODUCTS TABLE (canonical Product master for POS/KDS/Inventory/ERPNext)
-- =====================================================
CREATE TABLE products (
    id TEXT PRIMARY KEY,
    category_id TEXT NOT NULL,
    name TEXT NOT NULL,
    slug TEXT DEFAULT '',
    price INTEGER NOT NULL,
    compare_at_price INTEGER,
    description TEXT,
    image_url TEXT,
    tags TEXT,          -- JSON array
    badge TEXT,
    is_available BOOLEAN DEFAULT 1,
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id)
);

CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_available ON products(is_available);
CREATE INDEX idx_products_slug ON products(slug);
CREATE INDEX idx_products_sort_order ON products(sort_order);

-- =====================================================
-- CAFE_TABLES TABLE
-- =====================================================
CREATE TABLE cafe_tables (
    id           TEXT PRIMARY KEY,
    table_number TEXT UNIQUE NOT NULL,
    capacity     INTEGER NOT NULL,
    zone         TEXT NOT NULL,
    status       TEXT DEFAULT 'Available',
    tenant_id    TEXT NOT NULL DEFAULT 'default',
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_tables_zone ON cafe_tables(zone);
CREATE INDEX idx_tables_status ON cafe_tables(status);

-- =====================================================
-- MENU_ITEMS TABLE
-- =====================================================
CREATE TABLE menu_items (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL,
    name TEXT NOT NULL,
    price INTEGER NOT NULL,
    description TEXT,
    image_url TEXT,
    tags TEXT,  -- JSON array: ["Hot/Cold", "300ml"]
    badge TEXT,
    available BOOLEAN DEFAULT 1,
    is_local_specialty INTEGER DEFAULT 0,
    ingredient_source TEXT,  -- 'local', 'imported', 'mixed'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index for category filtering
CREATE INDEX idx_menu_items_category ON menu_items(category);
CREATE INDEX idx_menu_items_available ON menu_items(available);

-- =====================================================
-- CUSTOMERS TABLE
-- =====================================================
CREATE TABLE customers (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    phone TEXT,
    loyalty_points INTEGER DEFAULT 0,
    lifetime_points INTEGER DEFAULT 0,
    loyalty_tier TEXT DEFAULT 'bronze',  -- bronze, silver, gold, platinum
    date_of_birth TEXT,   -- loyalty phone signup (phone-auth-handler)
    zalo TEXT,
    source TEXT,          -- acquisition channel
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index for email lookup
CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_loyalty_tier ON customers(loyalty_tier);

-- =====================================================
-- ORDERS TABLE
-- =====================================================
CREATE TABLE orders (
    id TEXT PRIMARY KEY,
    items TEXT NOT NULL,  -- JSON array of order items
    total INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',  -- pending, confirmed, preparing, ready, delivered, cancelled
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    customer_email TEXT,
    customer_address TEXT,
    payment_method TEXT NOT NULL,  -- new orders: cod, payos; legacy values remain readable
    payment_status TEXT DEFAULT 'unpaid',  -- unpaid, paid, refunded
    shipping_fee INTEGER DEFAULT 0,
    discount INTEGER DEFAULT 0,
    notes TEXT,
    delivery_time TEXT,  -- 'now' or scheduled time
    table_id TEXT,       -- FK to cafe_tables (nullable, for dine-in)
    subtotal INTEGER,
    tax INTEGER DEFAULT 0,
    total_amount INTEGER,
    cashback_used INTEGER DEFAULT 0,
    cashback_earned INTEGER DEFAULT 0,
    points_earned INTEGER DEFAULT 0,
    locale TEXT DEFAULT 'vi-VN',
    location_id TEXT DEFAULT 'sa-dec-main',
    order_type TEXT DEFAULT 'dine_in',
    tip_amount INTEGER DEFAULT 0,
    service_fee INTEGER DEFAULT 0,
    updated_by TEXT,
    customer_id TEXT,
    tenant_id TEXT NOT NULL DEFAULT 'default',
    cod_paid_at TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (table_id) REFERENCES cafe_tables(id)
);

-- Index for status filtering and customer lookup
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_customer_phone ON orders(customer_phone);
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_orders_payment_status ON orders(payment_status);

-- Same additive contract as 20261020_01_order_creation_requests.sql.
CREATE TABLE IF NOT EXISTS order_creation_requests (
    scope_key TEXT PRIMARY KEY,
    fingerprint TEXT NOT NULL,
    order_id TEXT NOT NULL,
    response_body TEXT NOT NULL,
    created_at TEXT NOT NULL
);

-- =====================================================
-- PAYMENTS TABLE
-- =====================================================
CREATE TABLE payments (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    method TEXT NOT NULL,  -- new payments: cod, payos; legacy values remain readable
    amount INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',  -- pending, completed, failed, refunded
    transaction_id TEXT,  -- External payment gateway transaction ID
    payment_url TEXT,  -- Payment redirect URL
    refund_status TEXT,
    refund_amount INTEGER DEFAULT 0,
    refund_reason TEXT,
    refunded_at TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

-- Index for order lookup
CREATE INDEX idx_payments_order_id ON payments(order_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_created_at ON payments(created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_txn_unique
ON payments(transaction_id) WHERE transaction_id != '';

-- =====================================================
-- RESERVATIONS TABLE
-- =====================================================
CREATE TABLE reservations (
    id TEXT PRIMARY KEY,
    table_id TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    guest_count INTEGER NOT NULL DEFAULT 2,
    date TEXT NOT NULL,           -- YYYY-MM-DD
    time TEXT NOT NULL,           -- HH:MM
    zone TEXT NOT NULL,           -- Indoor, Outdoor, VIP
    status TEXT DEFAULT 'confirmed',  -- confirmed, cancelled, completed
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (table_id) REFERENCES cafe_tables(id)
);

CREATE INDEX idx_reservations_date ON reservations(date);
CREATE INDEX idx_reservations_table ON reservations(table_id);
CREATE INDEX idx_reservations_status ON reservations(status);

CREATE TRIGGER update_reservations_timestamp
AFTER UPDATE ON reservations
BEGIN
    UPDATE reservations SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- =====================================================
-- ORDER_ITEMS TABLE (normalised line items for KDS)
-- =====================================================
CREATE TABLE order_items (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    subtotal INTEGER NOT NULL,
    modifiers TEXT,      -- JSON: {"size":"L","ice":"less"}
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_product ON order_items(product_id);

-- =====================================================
-- TRIGGERS FOR updated_at
-- =====================================================
CREATE TRIGGER update_menu_items_timestamp
AFTER UPDATE ON menu_items
BEGIN
    UPDATE menu_items SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER update_customers_timestamp
AFTER UPDATE ON customers
BEGIN
    UPDATE customers SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER update_orders_timestamp
AFTER UPDATE ON orders
BEGIN
    UPDATE orders SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER update_payments_timestamp
AFTER UPDATE ON payments
BEGIN
    UPDATE payments SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- =====================================================
-- CONTACT MESSAGES TABLE
-- =====================================================
CREATE TABLE contact_messages (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    category TEXT,
    content TEXT NOT NULL,
    status TEXT DEFAULT 'unread',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- REVIEWS TABLE
-- =====================================================
CREATE TABLE reviews (
    id TEXT PRIMARY KEY,
    customer_name TEXT NOT NULL,
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    content TEXT NOT NULL,
    tags TEXT DEFAULT '[]',
    status TEXT DEFAULT 'published',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- LOYALTY TABLES — Full tiered loyalty + cashback system
-- =====================================================

-- Replace legacy loyalty tables with current schema
DROP TABLE IF EXISTS loyalty_members;
DROP TABLE IF EXISTS loyalty_transactions;
DROP TABLE IF EXISTS loyalty_tiers;
DROP TABLE IF EXISTS loyalty_rewards;

-- Cashback wallet per customer
CREATE TABLE IF NOT EXISTS cashback_wallets (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL UNIQUE,
    balance INTEGER DEFAULT 0,
    total_earned INTEGER DEFAULT 0,
    total_spent INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
);

-- Cashback transaction log
CREATE TABLE IF NOT EXISTS cashback_transactions (
    id TEXT PRIMARY KEY,
    wallet_id TEXT NOT NULL,
    order_id TEXT,
    type TEXT NOT NULL,  -- earn, spend, expire, refund
    amount INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    description TEXT,
    expires_at TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (wallet_id) REFERENCES cashback_wallets(id)
);

-- Loyalty tier definitions
CREATE TABLE IF NOT EXISTS loyalty_tiers (
    tier_name TEXT PRIMARY KEY,
    min_points INTEGER NOT NULL,
    cashback_rate REAL NOT NULL DEFAULT 0.02,
    point_multiplier REAL NOT NULL DEFAULT 1.0,
    birthday_discount INTEGER DEFAULT 0,
    display_name_vi TEXT,
    min_spent_vnd INTEGER DEFAULT 0,
    max_spent_vnd INTEGER,
    expiry_days INTEGER,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Loyalty points transaction log
CREATE TABLE IF NOT EXISTS loyalty_point_logs (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    order_id TEXT,
    points_change INTEGER NOT NULL,
    reason TEXT,
    balance_after INTEGER NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
);

-- Reward catalog
CREATE TABLE IF NOT EXISTS rewards (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    point_cost INTEGER NOT NULL,
    discount_type TEXT DEFAULT 'percent',  -- percent, fixed
    discount_value INTEGER NOT NULL,
  min_order INTEGER DEFAULT 0,
    image_url TEXT,
    stock INTEGER DEFAULT -1,  -- -1 = unlimited
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- User's redeemed rewards
CREATE TABLE IF NOT EXISTS user_rewards (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    reward_id TEXT NOT NULL,
    code TEXT NOT NULL,
    status TEXT DEFAULT 'active',  -- active, used, expired
    expires_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (reward_id) REFERENCES rewards(id)
);

-- =====================================================
-- PROMOTIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS promotions (
  code TEXT PRIMARY KEY,
  percent INTEGER NOT NULL,
  max_discount INTEGER DEFAULT 0,
  min_order INTEGER DEFAULT 0,
  usage_limit INTEGER DEFAULT 0,
  usage_count INTEGER DEFAULT 0,
  starts_at TEXT,
  expires_at TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

-- =====================================================
-- REFERRALS SYSTEM — "Giới thiệu bạn nhận 200 points"
-- =====================================================

-- Referral codes: one unique code per customer
CREATE TABLE IF NOT EXISTS referral_codes (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL UNIQUE,
    code TEXT NOT NULL UNIQUE,
    times_used INTEGER DEFAULT 0,
    total_points_earned INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE INDEX idx_referral_codes_customer ON referral_codes(customer_id);
CREATE INDEX idx_referral_codes_code ON referral_codes(code);

-- Referral tracking: records each successful referral
CREATE TABLE IF NOT EXISTS referrals (
    id TEXT PRIMARY KEY,
    referrer_id TEXT NOT NULL,
    referred_customer_id TEXT NOT NULL,
    referral_code TEXT NOT NULL,
    points_awarded INTEGER DEFAULT 200,
    status TEXT DEFAULT 'completed',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (referrer_id) REFERENCES customers(id),
    FOREIGN KEY (referred_customer_id) REFERENCES customers(id)
);

CREATE INDEX idx_referrals_referrer ON referrals(referrer_id);
CREATE INDEX idx_referrals_referred ON referrals(referred_customer_id);

-- =====================================================
-- STAFF_SHIFTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS staff_shifts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  staff_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'staff',
  date TEXT NOT NULL,
  shift TEXT NOT NULL,
  is_active INTEGER DEFAULT 1,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- =====================================================
-- SUBSCRIPTION TABLES (Container Lease Billing)
-- =====================================================
CREATE TABLE IF NOT EXISTS subscription_plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT DEFAULT '',
  container_size TEXT NOT NULL DEFAULT 'standard',
  monthly_price_vnd INTEGER NOT NULL,
  deposit_vnd INTEGER DEFAULT 0,
  features TEXT DEFAULT '[]',
  max_occupants INTEGER DEFAULT 1,
  is_popular INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
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
  billing_cycle TEXT DEFAULT 'monthly',
  current_period_start TEXT NOT NULL,
  current_period_end TEXT NOT NULL,
  next_billing_date TEXT NOT NULL,
  amount_vnd INTEGER NOT NULL,
  deposit_paid INTEGER DEFAULT 0,
  deposit_vnd INTEGER DEFAULT 0,
  cancelled_at TEXT,
  cancellation_reason TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS subscription_invoices (
  id TEXT PRIMARY KEY,
  subscription_id TEXT NOT NULL REFERENCES subscriptions(id),
  amount_vnd INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  invoice_number TEXT UNIQUE,
  paid_at TEXT,
  payment_method TEXT,
  payment_ref TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS mrr_snapshots (
  id TEXT PRIMARY KEY,
  snapshot_date TEXT NOT NULL UNIQUE,
  mrr_vnd INTEGER NOT NULL DEFAULT 0,
  arr_vnd INTEGER NOT NULL DEFAULT 0,
  active_subscriptions INTEGER NOT NULL DEFAULT 0,
  new_subscriptions_month INTEGER NOT NULL DEFAULT 0,
  churned_subscriptions_month INTEGER NOT NULL DEFAULT 0,
  expansion_mrr_vnd INTEGER DEFAULT 0,
  contraction_mrr_vnd INTEGER DEFAULT 0,
  churn_rate_pct REAL DEFAULT 0,
  avg_contract_value_vnd INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS erpnext_sync_logs (
  id TEXT PRIMARY KEY,
  method TEXT NOT NULL DEFAULT 'POST',
  endpoint TEXT NOT NULL,
  request_body TEXT,
  response_body TEXT,
  error TEXT,
  latency_ms INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  retry_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS erpnext_mappings (
  id TEXT PRIMARY KEY,
  local_type TEXT NOT NULL,
  local_id TEXT NOT NULL,
  erpnext_id TEXT,
  erpnext_model TEXT,
  sync_status TEXT DEFAULT 'pending',
  attempts INTEGER DEFAULT 0,
  last_synced_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS notification_audit_log (
  id TEXT PRIMARY KEY,
  channel TEXT NOT NULL,
  phone TEXT NOT NULL,
  template_key TEXT,
  data TEXT,
  payload TEXT,
  response TEXT,
  error TEXT,
  latency_ms INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_subscription_plans_slug ON subscription_plans(slug);
CREATE INDEX IF NOT EXISTS idx_subscription_plans_active ON subscription_plans(is_active);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_zone ON subscriptions(zone);
CREATE INDEX IF NOT EXISTS idx_subscriptions_customer ON subscriptions(customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_next_billing ON subscriptions(next_billing_date);
CREATE INDEX IF NOT EXISTS idx_invoices_subscription ON subscription_invoices(subscription_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON subscription_invoices(status);
CREATE INDEX IF NOT EXISTS idx_mrr_snapshots_date ON mrr_snapshots(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_erpnext_sync_logs_status ON erpnext_sync_logs(status, retry_count);
CREATE INDEX IF NOT EXISTS idx_erpnext_mappings_local ON erpnext_mappings(local_type, local_id);
CREATE INDEX IF NOT EXISTS idx_notification_audit_log_channel ON notification_audit_log(channel, created_at);

-- =====================================================
-- SUBSCRIPTION TRIGGERS
-- =====================================================
CREATE TRIGGER IF NOT EXISTS update_subscription_plans_timestamp
AFTER UPDATE ON subscription_plans
FOR EACH ROW
BEGIN
  UPDATE subscription_plans SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_subscriptions_timestamp
AFTER UPDATE ON subscriptions
FOR EACH ROW
BEGIN
  UPDATE subscriptions SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS set_next_billing_on_insert
AFTER INSERT ON subscriptions
FOR EACH ROW
BEGIN
  UPDATE subscriptions SET next_billing_date = NEW.current_period_end WHERE id = NEW.id;
END;
CREATE INDEX IF NOT EXISTS idx_invoices_period ON subscription_invoices(period_start, period_end);

-- =====================================================
-- PUSH SUBSCRIPTIONS TABLE (Web Push API)
-- =====================================================
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

-- =====================================================
-- CHECKINS TABLE (daily check-in rewards)
-- =====================================================
CREATE TABLE IF NOT EXISTS checkins (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  customer_name TEXT,
  checkin_date TEXT NOT NULL,          -- YYYY-MM-DD
  checkin_time TEXT NOT NULL,
  reward_amount INTEGER NOT NULL DEFAULT 5000,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending, approved, rejected
  staff_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_checkins_customer_date ON checkins(customer_id, checkin_date);
CREATE INDEX IF NOT EXISTS idx_checkins_date ON checkins(checkin_date);

-- =====================================================
-- USERS TABLE (staff accounts, tip attribution via orders.updated_by)
-- =====================================================
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'staff',  -- owner, manager, staff, waiter
  phone TEXT,
  tenant_id TEXT,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);

-- =====================================================
-- CAMPAIGN ENGINE — logs + per-trigger configs
-- =====================================================
CREATE TABLE IF NOT EXISTS campaign_configs (
  trigger TEXT PRIMARY KEY,
  is_active INTEGER NOT NULL DEFAULT 1,
  channels TEXT NOT NULL DEFAULT '["sms"]',  -- JSON array of channel slugs
  timing TEXT,  -- optional schedule hint (cron-ish or hours)
  updated_at DATETIME
);

CREATE TABLE IF NOT EXISTS campaign_logs (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  trigger TEXT NOT NULL,
  channel TEXT NOT NULL,
  sent_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status TEXT NOT NULL DEFAULT 'sent',  -- sent, failed, skipped
  error TEXT
);

CREATE INDEX IF NOT EXISTS idx_campaign_logs_customer ON campaign_logs(customer_id, trigger);
CREATE INDEX IF NOT EXISTS idx_campaign_logs_sent ON campaign_logs(sent_at);

-- =====================================================
-- CATALOG MODIFIER CONTRACT
-- Canonical hierarchy: modifier_groups -> modifier_choices -> product_modifier_groups
-- =====================================================
CREATE TABLE IF NOT EXISTS modifier_groups (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'single',
  required    INTEGER NOT NULL DEFAULT 0,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_active   INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT DEFAULT (datetime('now')),
  updated_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS modifier_choices (
  id           TEXT PRIMARY KEY,
  group_id     TEXT NOT NULL,
  name         TEXT NOT NULL,
  price_delta  INTEGER NOT NULL DEFAULT 0,
  is_default   INTEGER NOT NULL DEFAULT 0,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  is_available INTEGER NOT NULL DEFAULT 1,
  created_at   TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (group_id) REFERENCES modifier_groups(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS product_modifier_groups (
  product_id  TEXT NOT NULL,
  group_id    TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (product_id, group_id)
);

CREATE INDEX IF NOT EXISTS idx_mod_choices_group_avail ON modifier_choices(group_id, is_available);
CREATE INDEX IF NOT EXISTS idx_pm_groups_prod_grp ON product_modifier_groups(product_id, group_id);

-- Fresh bootstrap parity with additive operational migrations. Existing DBs use their migration ledger.
-- 20260913_01_customer_identity_consent_events_visits.sql
-- M1 Customer + Data foundation (v4 pivot): formalize identity, consent,
-- customer events, and visits on top of the existing zero-based
-- `customers` table + `customer_phone` order key.
--
-- Zero-based policy: these tables are ADDITIVE. No existing behavior
-- (guest checkout, loyalty signup, order creation) is altered. New
-- writes are optional enrichment gated by explicit consent.
--
-- All tables CREATE TABLE IF NOT EXISTS (re-run safe).

-- ─────────────────────────────────────────────────────────────────────
-- 1. customer_identities — one row per verified identifier a customer
--    presents (phone, email, zalo, ...). A customer may hold multiple
--    identifiers over time; the identifier that created the row is the
--    canonical one and stays marked is_primary.
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customer_identities (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,            -- FK customers.id
  identifier_type TEXT NOT NULL,        -- phone | email | zalo | other
  identifier_value TEXT NOT NULL,       -- normalized value
  is_primary INTEGER NOT NULL DEFAULT 0,
  verified_at TEXT,                     -- ISO timestamp of last verification
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE INDEX IF NOT EXISTS idx_customer_identities_customer
  ON customer_identities(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_identities_value
  ON customer_identities(identifier_type, identifier_value);

-- ─────────────────────────────────────────────────────────────────────
-- 2. consents — granular opt-in records. A consent is only valid when
--    the customer explicitly granted it (source = checkout | signup |
--    setting). CRM writes (tier promotion, outreach, data export) MUST
--    check an active consent row before mutating state.
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS consents (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,            -- FK customers.id
  purpose TEXT NOT NULL,                -- crm | marketing | analytics | erpnext_sync
  granted INTEGER NOT NULL DEFAULT 1,   -- 1 = granted, 0 = revoked
  source TEXT NOT NULL,                 -- checkout | signup | setting | staff
  policy_version TEXT NOT NULL DEFAULT 'v1',
  granted_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE INDEX IF NOT EXISTS idx_consents_customer
  ON consents(customer_id, purpose, granted);

-- ─────────────────────────────────────────────────────────────────────
-- 3. customer_events — append-only log of identity-lifecycle events.
--    The golden-loop spine (v2 §11) reads from here. Never update or
--    delete a row once written; corrections append a new compensating row.
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customer_events (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,            -- FK customers.id (nullable only for anonymous)
  event_type TEXT NOT NULL,
    -- CustomerIdentified | ConsentGiven | ConsentRevoked |
    -- VisitRecorded | CustomerUpgraded | OrderLinked
  payload TEXT,                         -- JSON event detail
  recorded_at TEXT NOT NULL,            -- ISO event time
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE INDEX IF NOT EXISTS idx_customer_events_customer
  ON customer_events(customer_id, recorded_at);
CREATE INDEX IF NOT EXISTS idx_customer_events_type
  ON customer_events(event_type, recorded_at);

-- ─────────────────────────────────────────────────────────────────────
-- 4. visits — materialized store visits (order presential, check-in,
--    reservation completion). Each row is one visit; used by CRM
--    frequency/value queries (v2 §13 the 6 questions).
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS visits (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,            -- FK customers.id
  visited_at TEXT NOT NULL,             -- ISO arrival time
  channel TEXT NOT NULL DEFAULT 'in_store',
    -- in_store | qr_table | online_pickup | online_delivery
  order_id TEXT,                        -- nullable (a visit may have no order)
  spent INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE INDEX IF NOT EXISTS idx_visits_customer
  ON visits(customer_id, visited_at);
CREATE INDEX IF NOT EXISTS idx_visits_date
  ON visits(visited_at);

-- 20260820_08_client_errors.sql
-- SPA uncaught-render reports from the per-route ErrorBoundary.

CREATE TABLE IF NOT EXISTS client_errors (
    id         TEXT PRIMARY KEY,
    route      TEXT,
    message    TEXT,
    stack      TEXT,
    href       TEXT,
    user_agent TEXT,
    ts         TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_client_errors_route ON client_errors(route);
CREATE INDEX IF NOT EXISTS idx_client_errors_ts ON client_errors(ts);
-- 1. Observability: _metrics
CREATE TABLE IF NOT EXISTS _metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  value REAL NOT NULL DEFAULT 1,
  tags TEXT DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_metrics_name_created ON _metrics(name, created_at);

-- 2. Observability: _alerts
CREATE TABLE IF NOT EXISTS _alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  alert_key TEXT NOT NULL,
  message TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'warning',
  dispatched INTEGER NOT NULL DEFAULT 0,
  dispatched_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_alerts_key_created ON _alerts(alert_key, created_at);


-- 4. Domain Inventory: inventory_items
CREATE TABLE IF NOT EXISTS inventory_items (
  id TEXT PRIMARY KEY,
  sku TEXT UNIQUE NOT NULL,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  name TEXT NOT NULL,
  name_en TEXT,
  category TEXT NOT NULL DEFAULT 'raw_materials',
  unit TEXT NOT NULL DEFAULT 'pcs',
  current_stock REAL NOT NULL DEFAULT 0,
  min_stock REAL NOT NULL DEFAULT 0,
  max_stock REAL NOT NULL DEFAULT 1000,
  cost_per_unit REAL DEFAULT 0,
  supplier TEXT,
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_inventory_items_sku ON inventory_items(sku);
CREATE INDEX IF NOT EXISTS idx_inventory_items_category ON inventory_items(category);

-- 5. Domain Inventory: inventory_transactions
CREATE TABLE IF NOT EXISTS inventory_transactions (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('in', 'out', 'adjust', 'waste', 'reserve', 'release')),
  quantity REAL NOT NULL,
  reference_id TEXT,
  reference_type TEXT CHECK(reference_type IN ('order', 'purchase', 'adjustment', 'waste_report', 'sync')),
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (item_id) REFERENCES inventory_items(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_item ON inventory_transactions(item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_created ON inventory_transactions(created_at);

-- 6. Domain Inventory: inventory_snapshots
CREATE TABLE IF NOT EXISTS inventory_snapshots (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL,
  date TEXT NOT NULL DEFAULT (date('now')),
  opening_stock REAL NOT NULL,
  closing_stock REAL NOT NULL,
  FOREIGN KEY (item_id) REFERENCES inventory_items(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_snapshots_item_date ON inventory_snapshots(item_id, date);

-- 7. OpenAPI Inventory: ingredients
CREATE TABLE IF NOT EXISTS ingredients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sku TEXT UNIQUE NOT NULL,
  category TEXT NOT NULL DEFAULT 'raw_materials',
  unit TEXT NOT NULL DEFAULT 'pcs',
  cost_per_unit REAL DEFAULT 0,
  current_stock REAL NOT NULL DEFAULT 0,
  min_stock REAL NOT NULL DEFAULT 0,
  max_stock REAL NOT NULL DEFAULT 1000,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ingredients_sku ON ingredients(sku);
CREATE INDEX IF NOT EXISTS idx_ingredients_category ON ingredients(category);

-- 8. OpenAPI Inventory: stock_movements
CREATE TABLE IF NOT EXISTS stock_movements (
  id TEXT PRIMARY KEY,
  ingredient_id TEXT NOT NULL,
  type TEXT NOT NULL,
  quantity REAL NOT NULL,
  reference_id TEXT,
  reference_type TEXT,
  notes TEXT,
  created_by TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_stock_movements_ingredient ON stock_movements(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created ON stock_movements(created_at);

-- 9. OpenAPI Inventory: suppliers
CREATE TABLE IF NOT EXISTS suppliers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  contact_person TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  tax_id TEXT,
  payment_terms TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name);

-- 10. OpenAPI Inventory: purchase_orders
CREATE TABLE IF NOT EXISTS purchase_orders (
  id TEXT PRIMARY KEY,
  po_number TEXT UNIQUE NOT NULL,
  supplier_id TEXT NOT NULL,
  order_date TEXT NOT NULL,
  expected_delivery_date TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  subtotal REAL NOT NULL DEFAULT 0,
  tax REAL NOT NULL DEFAULT 0,
  shipping REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  notes TEXT,
  created_by TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_po_supplier ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_po_status ON purchase_orders(status);

-- 11. OpenAPI Inventory: purchase_order_items
CREATE TABLE IF NOT EXISTS purchase_order_items (
  id TEXT PRIMARY KEY,
  purchase_order_id TEXT NOT NULL,
  ingredient_id TEXT NOT NULL,
  quantity REAL NOT NULL,
  unit_price REAL NOT NULL,
  total_price REAL NOT NULL,
  received_quantity REAL DEFAULT 0,
  FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
  FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_po_items_po ON purchase_order_items(purchase_order_id);

-- 12. Recipe / BOM & Waste
CREATE TABLE IF NOT EXISTS recipes (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  name TEXT,
  instructions TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_recipes_product ON recipes(product_id);

CREATE TABLE IF NOT EXISTS recipe_items (
  id TEXT PRIMARY KEY,
  recipe_id TEXT NOT NULL,
  ingredient_id TEXT NOT NULL,
  quantity REAL NOT NULL,
  unit TEXT NOT NULL DEFAULT 'g',
  FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE,
  FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_recipe_items_recipe ON recipe_items(recipe_id);

CREATE TABLE IF NOT EXISTS waste_log (
  id TEXT PRIMARY KEY,
  ingredient_id TEXT NOT NULL,
  quantity REAL NOT NULL,
  unit TEXT NOT NULL,
  reason TEXT NOT NULL,
  recorded_by TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_waste_log_ingredient ON waste_log(ingredient_id);
