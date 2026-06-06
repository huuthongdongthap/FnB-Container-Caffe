-- F&B Caffe Container - Cloudflare D1 Schema
-- Creates 4 core tables: orders, customers, menu_items, payments

-- Drop existing tables/views (for development)
DROP VIEW IF EXISTS menu_items;
DROP TABLE IF EXISTS reservations;
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS customers;
DROP TABLE IF EXISTS menu_items;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS cafe_tables;

-- =====================================================
-- CATEGORIES TABLE
-- =====================================================
CREATE TABLE categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_categories_slug ON categories(slug);

-- =====================================================
-- PRODUCTS TABLE (normalised menu items for KDS/POS)
-- =====================================================
CREATE TABLE products (
    id TEXT PRIMARY KEY,
    category_id TEXT NOT NULL,
    name TEXT NOT NULL,
    price INTEGER NOT NULL,
    description TEXT,
    image_url TEXT,
    tags TEXT,          -- JSON array
    badge TEXT,
    is_available BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id)
);

CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_available ON products(is_available);

-- =====================================================
-- CAFE_TABLES TABLE
-- =====================================================
CREATE TABLE cafe_tables (
    id           TEXT PRIMARY KEY,
    table_number TEXT UNIQUE NOT NULL,
    capacity     INTEGER NOT NULL,
    zone         TEXT NOT NULL,
    status       TEXT DEFAULT 'Available',
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
    tags TEXT,  -- JSON array: ["Hot/Cold", "300ml"]
    badge TEXT,
    available BOOLEAN DEFAULT 1,
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
    payment_method TEXT NOT NULL,  -- cod, momo, vnpay, payos
    payment_status TEXT DEFAULT 'unpaid',  -- unpaid, paid, refunded
    shipping_fee INTEGER DEFAULT 0,
    discount INTEGER DEFAULT 0, discount_applied INTEGER DEFAULT 0,
    notes TEXT,
    delivery_time TEXT,  -- 'now' or scheduled time
    table_id TEXT,       -- FK to cafe_tables (nullable, for dine-in)
    subtotal INTEGER,
    tax INTEGER DEFAULT 0,
    total_amount INTEGER,
    cashback_used INTEGER DEFAULT 0,
    cashback_earned INTEGER DEFAULT 0,
    points_earned INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (table_id) REFERENCES cafe_tables(id)
);

-- Index for status filtering and customer lookup
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_customer_phone ON orders(customer_phone);
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_orders_payment_status ON orders(payment_status);

-- =====================================================
-- BONUS_CAMPAIGNS TABLE (H13, M1)
-- =====================================================
CREATE TABLE IF NOT EXISTS bonus_campaigns (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'checkin', 'referral', 'birthday', 'signup'
  reward_type TEXT NOT NULL, -- 'points', 'cashback', 'discount'
  reward_value INTEGER NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  max_uses INTEGER,
  used_count INTEGER DEFAULT 0,
  active INTEGER DEFAULT 1,
  metadata TEXT, -- JSON
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bonus_campaigns_code ON bonus_campaigns(code);
CREATE INDEX IF NOT EXISTS idx_bonus_campaigns_active ON bonus_campaigns(active);

-- =====================================================
-- LOYALTY_AUDIT_LOG TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS loyalty_audit_log (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  staff_id TEXT,
  action TEXT NOT NULL, -- 'earn', 'spend', 'bonus', 'referral', 'checkin', 'expire'
  amount_vnd INTEGER DEFAULT 0,
  order_id TEXT,
  metadata TEXT, -- JSON
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE INDEX IF NOT EXISTS idx_loyalty_audit_customer ON loyalty_audit_log(customer_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_audit_created ON loyalty_audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_loyalty_audit_action ON loyalty_audit_log(action);

-- =====================================================
-- PAYMENTS TABLE
-- =====================================================
CREATE TABLE payments (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    method TEXT NOT NULL,  -- cod, momo, vnpay, payos
    amount INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',  -- pending, completed, failed, refunded
    transaction_id TEXT,  -- External payment gateway transaction ID
    payment_url TEXT,  -- Payment redirect URL
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

-- Index for order lookup
CREATE INDEX idx_payments_order_id ON payments(order_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_created_at ON payments(created_at);
-- UNIQUE constraint on transaction_id to prevent orderCode collisions (partial: NULLs allowed for non-payos methods)
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_transaction_id_unique ON payments(transaction_id) WHERE transaction_id IS NOT NULL;

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

-- ═══════════════════════════════════════════════════════════════════════════════
-- MRR SUBSCRIPTION SYSTEM — Container Lease Plans for AURA CAFE
-- Model: Renting container units to F&B vendors (pop-ups, delivery kitchens)
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── SUBSCRIPTION PLANS ───
-- Defines container lease tiers (size, features, monthly price)
CREATE TABLE IF NOT EXISTS subscription_plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,                    -- e.g. "Mini Container", "Standard Rooftop", "Premium VIP"
  slug TEXT UNIQUE NOT NULL,             -- e.g. "mini", "standard", "vip"
  description TEXT,                      -- Vietnamese marketing description
  container_size TEXT NOT NULL,          -- e.g. "20ft", "40ft", "custom"
  monthly_price_vnd INTEGER NOT NULL,    -- Monthly lease in VND (e.g. 3500000)
  deposit_vnd INTEGER DEFAULT 0,         -- Security deposit amount
  features TEXT DEFAULT '[]',            -- JSON array: ["wifi","electricity","water","kitchen","signage"]
  max_occupants INTEGER DEFAULT 1,       -- How many vendors can share
  is_popular INTEGER DEFAULT 0,          -- 1 = highlight as popular plan
  is_active INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- ─── SUBSCRIPTIONS ───
-- Active/vendor container lease contracts
CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL,                 -- FK to subscription_plans
  customer_id TEXT NOT NULL,             -- FK to customers (the renting vendor)
  customer_name TEXT NOT NULL,           -- Denormalized for display
  customer_email TEXT,
  customer_phone TEXT NOT NULL,
  container_number TEXT,                 -- Assigned container ID/label
  zone TEXT,                             -- Which zone: Jade Counter, Sky Deck, Noir Cabin, etc.
  status TEXT NOT NULL DEFAULT 'active', -- active, paused, cancelled, expired, pending
  billing_cycle TEXT DEFAULT 'monthly',  -- monthly, quarterly, yearly
  current_period_start TEXT NOT NULL,    -- ISO date start of current billing period
  current_period_end TEXT NOT NULL,      -- ISO date end of current billing period
  next_billing_date TEXT,                -- When next invoice is due
  amount_vnd INTEGER NOT NULL,           -- Actual billed amount (may differ from plan price)
  deposit_paid INTEGER DEFAULT 0,        -- Whether deposit has been paid
  deposit_vnd INTEGER DEFAULT 0,         -- Deposit amount on record
  notes TEXT,                            -- Admin notes about this lease
  cancelled_at TEXT,
  cancellation_reason TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (plan_id) REFERENCES subscription_plans(id),
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

-- ─── MRR METRICS SNAPSHOT ───
-- Daily snapshot for fast MRR trend charts without live aggregation
CREATE TABLE IF NOT EXISTS mrr_snapshots (
  id TEXT PRIMARY KEY,
  snapshot_date TEXT NOT NULL UNIQUE,    -- YYYY-MM-DD
  mrr_vnd INTEGER NOT NULL DEFAULT 0,    -- Monthly Recurring Revenue (active subs)
  arr_vnd INTEGER NOT NULL DEFAULT 0,    -- Annualized: mrr * 12
  active_subscriptions INTEGER NOT NULL DEFAULT 0,
  new_subscriptions_month INTEGER NOT NULL DEFAULT 0,
  churned_subscriptions_month INTEGER NOT NULL DEFAULT 0,
  expansion_mrr_vnd INTEGER DEFAULT 0,   -- Upgrades added this month
  contraction_mrr_vnd INTEGER DEFAULT 0, -- Downgrades lost this month
  churn_rate_pct REAL DEFAULT 0,         -- Monthly churn percentage
  avg_contract_value_vnd INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- ─── SUBSCRIPTION INVOICES ───
-- Payment records for subscription renewals
CREATE TABLE IF NOT EXISTS subscription_invoices (
  id TEXT PRIMARY KEY,
  subscription_id TEXT NOT NULL,
  amount_vnd INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, paid, overdue, cancelled
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  paid_at TEXT,
  payment_method TEXT,                   -- cod, bank_transfer, momo, vnpay
  payment_ref TEXT,                      -- External transaction reference
  invoice_number TEXT UNIQUE,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (subscription_id) REFERENCES subscriptions(id)
);

-- ─── INDEXES ───
CREATE INDEX IF NOT EXISTS idx_subscription_plans_slug ON subscription_plans(slug);
CREATE INDEX IF NOT EXISTS idx_subscription_plans_active ON subscription_plans(is_active);
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan ON subscriptions(plan_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_customer ON subscriptions(customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_zone ON subscriptions(zone);
CREATE INDEX IF NOT EXISTS idx_subscriptions_next_billing ON subscriptions(next_billing_date);
CREATE INDEX IF NOT EXISTS idx_subscriptions_created ON subscriptions(created_at);
CREATE INDEX IF NOT EXISTS idx_mrr_snapshots_date ON mrr_snapshots(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_invoices_subscription ON subscription_invoices(subscription_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON subscription_invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_period ON subscription_invoices(period_start, period_end);

-- ─── TRIGGERS ───
CREATE TRIGGER IF NOT EXISTS update_subscription_plans_timestamp AFTER UPDATE ON subscription_plans
BEGIN UPDATE subscription_plans SET updated_at = datetime('now') WHERE id = NEW.id; END;

CREATE TRIGGER IF NOT EXISTS update_subscriptions_timestamp AFTER UPDATE ON subscriptions
BEGIN UPDATE subscriptions SET updated_at = datetime('now') WHERE id = NEW.id; END;

-- Auto-set next_billing_date on subscription creation/extension
CREATE TRIGGER IF NOT EXISTS set_next_billing_on_insert AFTER INSERT ON subscriptions
BEGIN
  UPDATE subscriptions SET next_billing_date = current_period_end WHERE id = NEW.id;
END;
