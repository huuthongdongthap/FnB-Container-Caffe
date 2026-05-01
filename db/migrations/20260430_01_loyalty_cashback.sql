-- Migration: Loyalty & Cashback tables for D1
-- Date:      2026-04-30
-- Rationale: Required for phone-auth, cashback wallet, points, rewards
-- Apply:     wrangler d1 execute fnb-caffe-db --remote --file=db/migrations/20260430_01_loyalty_cashback.sql

-- ─────────────────────────────────────────────
-- 1. CUSTOMERS (extended from users table)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customers (
    id              TEXT PRIMARY KEY,
    email           TEXT UNIQUE NOT NULL,
    name            TEXT DEFAULT '',
    phone           TEXT,
    loyalty_tier    TEXT DEFAULT 'silver',
    loyalty_points  INTEGER DEFAULT 0,
    birthday        TEXT,
    created_at      TEXT DEFAULT (datetime('now')),
    updated_at      TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);

-- ─────────────────────────────────────────────
-- 2. LOYALTY TIERS (config)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS loyalty_tiers (
    tier_name       TEXT PRIMARY KEY,
    min_points      INTEGER NOT NULL,
    cashback_rate   REAL NOT NULL DEFAULT 0.02,
    point_multiplier REAL NOT NULL DEFAULT 1.0,
    birthday_discount INTEGER DEFAULT 0,
    created_at      TEXT DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO loyalty_tiers (tier_name, min_points, cashback_rate, point_multiplier, birthday_discount) VALUES
    ('silver',   0,     0.02, 1.0, 10),
    ('gold',     500,   0.05, 1.5, 30),
    ('platinum', 1000,  0.08, 2.0, 50);

-- ─────────────────────────────────────────────
-- 3. CASHBACK WALLETS (1:1 with customers)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cashback_wallets (
    id              TEXT PRIMARY KEY,
    customer_id     TEXT NOT NULL,
    balance         REAL DEFAULT 0,
    total_earned    REAL DEFAULT 0,
    total_spent     REAL DEFAULT 0,
    created_at      TEXT DEFAULT (datetime('now')),
    updated_at      TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_cashback_wallets_customer ON cashback_wallets(customer_id);

-- ─────────────────────────────────────────────
-- 4. CASHBACK TRANSACTIONS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cashback_transactions (
    id              TEXT PRIMARY KEY,
    wallet_id       TEXT NOT NULL,
    order_id        TEXT,
    type             TEXT NOT NULL,  -- earn, spend, bonus, expire, refund
    amount           REAL NOT NULL,
    balance_after    REAL,
    description     TEXT,
    created_at      TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_cbtxn_wallet ON cashback_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_cbtxn_type ON cashback_transactions(type);

-- ─────────────────────────────────────────────
-- 5. LOYALTY POINT LOGS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS loyalty_point_logs (
    id              TEXT PRIMARY KEY,
    customer_id     TEXT NOT NULL,
    order_id        TEXT,
    points_change   INTEGER NOT NULL,
    reason          TEXT NOT NULL,  -- purchase, redeem, bonus, tier_upgrade
    balance_after   INTEGER,
    description     TEXT,
    created_at      TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ptlog_customer ON loyalty_point_logs(customer_id);
CREATE INDEX IF NOT EXISTS idx_ptlog_reason ON loyalty_point_logs(reason);

-- ─────────────────────────────────────────────
-- 6. USER REWARDS (claimed vouchers)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_rewards (
    id              TEXT PRIMARY KEY,
    customer_id     TEXT NOT NULL,
    reward_id       TEXT NOT NULL,
    code            TEXT NOT NULL,
    status          TEXT DEFAULT 'active',  -- active, used, expired
    expires_at      TEXT,
    created_at      TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_urewards_customer ON user_rewards(customer_id);
CREATE INDEX IF NOT EXISTS idx_urewards_status ON user_rewards(status);

-- ─────────────────────────────────────────────
-- 7. ALTER ORDERS: add loyalty columns
-- ─────────────────────────────────────────────
-- D1 doesn't support ALTER TABLE ADD COLUMN IF NOT EXISTS, so we use try/catch pattern
-- These may fail if columns already exist (that's OK):
ALTER TABLE orders ADD COLUMN cashback_used REAL DEFAULT 0;
ALTER TABLE orders ADD COLUMN cashback_earned REAL DEFAULT 0;
ALTER TABLE orders ADD COLUMN points_earned INTEGER DEFAULT 0;
ALTER TABLE orders ADD COLUMN reward_code_used TEXT;

-- ─────────────────────────────────────────────
-- 8. VIEW: menu_items (compat for menu.js API)
-- ─────────────────────────────────────────────
CREATE VIEW IF NOT EXISTS menu_items AS 
SELECT 
  p.id, p.name, p.price, p.description, p.is_available as available, 
  p.category_id as category, c.name as category_name, p.image_url, p.created_at
FROM products p
LEFT JOIN categories c ON p.category_id = c.id;