-- =====================================================
-- Migration 002: Loyalty & Cashback System
-- Database: Cloudflare D1 (SQLite)
-- Mirror of 001_loyalty_cashback.sql (PostgreSQL)
-- Functions/triggers/RLS handled in Worker code
-- =====================================================

-- ─────────────────────────────────────────────
-- LOYALTY TIERS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS loyalty_tiers (
    tier_name              TEXT PRIMARY KEY,
    min_points             INTEGER NOT NULL DEFAULT 0,
    cashback_rate          REAL NOT NULL,
    point_multiplier       REAL NOT NULL DEFAULT 1.0,
    birthday_discount      REAL DEFAULT 0.10,
    free_upsize_per_week   INTEGER DEFAULT 0,
    priority_booking_hours INTEGER DEFAULT 0,
    benefits_json          TEXT DEFAULT '[]',
    created_at             TEXT DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO loyalty_tiers (tier_name, min_points, cashback_rate, point_multiplier, birthday_discount, free_upsize_per_week, priority_booking_hours, benefits_json)
VALUES
  ('Silver', 0, 0.02, 1.0, 0.10, 0, 0, '[{"icon":"💰","title":"Cashback 2%","desc":"Hoàn tiền 2% mỗi đơn hàng"},{"icon":"⭐","title":"Tích điểm ×1","desc":"Tích điểm tiêu chuẩn"},{"icon":"🎂","title":"Giảm 10% sinh nhật","desc":"Giảm 10% trong tháng sinh nhật"}]'),
  ('Gold', 500, 0.05, 1.5, 0.30, 1, 24, '[{"icon":"💰","title":"Cashback 5%","desc":"Hoàn tiền 5% mỗi đơn hàng"},{"icon":"⭐","title":"Tích điểm ×1.5","desc":"Nhân 1.5x điểm mỗi đơn"},{"icon":"🎂","title":"Giảm 30% sinh nhật","desc":"Giảm 30% trong tháng sinh nhật"},{"icon":"☕","title":"Free upsize","desc":"Upsize miễn phí 1 lần/tuần"},{"icon":"🌅","title":"Ưu tiên đặt bàn","desc":"Đặt bàn Rooftop trước 24h"},{"icon":"🎁","title":"Quà tặng quý","desc":"Quà tặng bất ngờ mỗi quý"}]'),
  ('Platinum', 1000, 0.08, 2.0, 0.50, 99, 48, '[{"icon":"💰","title":"Cashback 8%","desc":"Hoàn tiền 8% mỗi đơn hàng"},{"icon":"⭐","title":"Tích điểm ×2","desc":"Nhân 2x điểm mỗi đơn"},{"icon":"🎂","title":"Giảm 50% sinh nhật","desc":"Giảm 50% + quà đặc biệt"},{"icon":"☕","title":"Free upsize không giới hạn","desc":"Upsize miễn phí mọi đơn"},{"icon":"🌅","title":"Ưu tiên đặt bàn 48h","desc":"Đặt bàn Rooftop trước 48h"},{"icon":"🎁","title":"Quà tặng Premium","desc":"Quà tặng Premium mỗi quý"},{"icon":"🎉","title":"Sự kiện VIP","desc":"Tham gia sự kiện VIP exclusive"}]');

-- ─────────────────────────────────────────────
-- CASHBACK WALLETS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cashback_wallets (
    id           TEXT PRIMARY KEY,
    user_id      TEXT NOT NULL UNIQUE,
    balance      REAL NOT NULL DEFAULT 0.00,
    total_earned REAL NOT NULL DEFAULT 0.00,
    total_spent  REAL NOT NULL DEFAULT 0.00,
    created_at   TEXT DEFAULT (datetime('now')),
    updated_at   TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_cb_wallets_user ON cashback_wallets(user_id);

-- ─────────────────────────────────────────────
-- CASHBACK TRANSACTIONS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cashback_transactions (
    id            TEXT PRIMARY KEY,
    wallet_id     TEXT NOT NULL,
    order_id      TEXT,
    type          TEXT NOT NULL CHECK (type IN ('earn', 'spend', 'bonus', 'expire', 'refund')),
    amount        REAL NOT NULL,
    balance_after REAL NOT NULL,
    description   TEXT,
    metadata      TEXT DEFAULT '{}',
    created_at    TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_cb_tx_wallet  ON cashback_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_cb_tx_order   ON cashback_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_cb_tx_type    ON cashback_transactions(type);
CREATE INDEX IF NOT EXISTS idx_cb_tx_created ON cashback_transactions(created_at);

-- ─────────────────────────────────────────────
-- LOYALTY POINT LOGS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS loyalty_point_logs (
    id            TEXT PRIMARY KEY,
    user_id       TEXT NOT NULL,
    order_id      TEXT,
    points_change INTEGER NOT NULL,
    reason        TEXT NOT NULL CHECK (reason IN ('purchase', 'redeem', 'bonus', 'tier_upgrade', 'expire', 'admin_adjust')),
    balance_after INTEGER NOT NULL,
    description   TEXT,
    created_at    TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pt_logs_user    ON loyalty_point_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_pt_logs_order   ON loyalty_point_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_pt_logs_created ON loyalty_point_logs(created_at);

-- ─────────────────────────────────────────────
-- USER REWARDS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_rewards (
    id            TEXT PRIMARY KEY,
    user_id       TEXT NOT NULL,
    reward_id     TEXT NOT NULL,
    code          TEXT UNIQUE NOT NULL,
    status        TEXT DEFAULT 'active' CHECK (status IN ('active', 'used', 'expired', 'locked')),
    expires_at    TEXT,
    used_at       TEXT,
    used_on_order TEXT,
    created_at    TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_user_rewards_user   ON user_rewards(user_id);
CREATE INDEX IF NOT EXISTS idx_user_rewards_status ON user_rewards(status);
CREATE INDEX IF NOT EXISTS idx_user_rewards_code   ON user_rewards(code);

-- ─────────────────────────────────────────────
-- ALTER EXISTING TABLES (SQLite workaround — columns added if missing)
-- D1 supports ALTER TABLE ADD COLUMN
-- ─────────────────────────────────────────────

-- users: add email + birthday (ignore if exists)
ALTER TABLE users ADD COLUMN email TEXT;
ALTER TABLE users ADD COLUMN birthday TEXT;

-- orders: add loyalty columns
ALTER TABLE orders ADD COLUMN user_id TEXT;
ALTER TABLE orders ADD COLUMN cashback_used REAL DEFAULT 0;
ALTER TABLE orders ADD COLUMN cashback_earned REAL DEFAULT 0;
ALTER TABLE orders ADD COLUMN points_earned INTEGER DEFAULT 0;
ALTER TABLE orders ADD COLUMN reward_code_used TEXT;

CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);

-- ─────────────────────────────────────────────
-- SEED REWARDS
-- ─────────────────────────────────────────────
INSERT OR IGNORE INTO rewards (id, title, discount_type, discount_value, point_cost)
VALUES
  ('rwd_discount10',   'Giảm 10% đơn hàng',       'PERCENTAGE',   10,    200),
  ('rwd_discount20',   'Giảm 20% đơn hàng',       'PERCENTAGE',   20,    400),
  ('rwd_50k',          'Giảm 50K',                 'FIXED_AMOUNT', 50000, 300),
  ('rwd_combo_sang',   'Combo Sáng miễn phí',     'FIXED_AMOUNT', 89000, 600),
  ('rwd_rooftop',      'Free Rooftop Seat',        'FIXED_AMOUNT', 0,     500);
