-- Migration: Loyalty v2 Launch — 4-tier + bonus campaigns + idempotency
-- Date:      2026-05-18
-- Spec:      /05_Demos/KHAI_TRUONG_6-6/01_LOYALTY_CASHBACK_PROGRAM.md
-- Apply:     wrangler d1 execute fnb-caffe-db --remote --file=db/migrations/20260518_03_loyalty_v2_launch.sql
--
-- Rationale:
--   Prepare for AURA CAFE launch 06/06/2026 (Hybrid 2-phase event).
--   1. Migrate 3-tier (silver/gold/platinum, 2/5/8%) → 4-tier (bronze/silver/gold/platinum, 3/5/7/10%)
--   2. Add VND-based thresholds (min_spent_vnd, max_spent_vnd) — currently uses points
--   3. Add expiry_days per tier (cashback aging 90/120/180/null)
--   4. New table: bonus_campaigns (Grand Opening 6/6 cashback x2)
--   5. New table: signup_bonus_log (track +50k seed for first 100)
--   6. New table: loyalty_audit_log (anti-fraud trail)
--   7. ALTER cashback_transactions: expires_at, campaign_id, multiplier_applied, customer_id, staff_id
--   8. UNIQUE partial index (order_id, type='earn') chống double-credit
--
-- Backward compatibility:
--   * KHÔNG xóa column nào của schema cũ
--   * Tier names giữ silver/gold/platinum + thêm bronze
--   * amount giữ REAL (không break existing code)
--   * wallet_id vẫn dùng song song customer_id mới
--
-- Idempotency:
--   * CREATE TABLE IF NOT EXISTS · CREATE INDEX IF NOT EXISTS · INSERT OR IGNORE
--   * ALTER TABLE ADD COLUMN KHÔNG hỗ trợ IF NOT EXISTS trong SQLite/D1.
--     File này chỉ chạy 1 lần. Nếu cần re-run, dùng file _rerun.sql (chỉ data/DDL, bỏ ALTER).
--   * Applied: 2026-05-18 (tất cả ALTER đã applied thành công lần đầu)


-- ═════════════════════════════════════════════════════════════════
-- 1. EXTEND loyalty_tiers SCHEMA — add new columns
-- ═════════════════════════════════════════════════════════════════
-- Các ALTER này có thể fail nếu column đã tồn tại (run lần 2). Đó là OK.
-- Nếu run lần đầu, tất cả thành công.

ALTER TABLE loyalty_tiers ADD COLUMN display_name_vi TEXT;
ALTER TABLE loyalty_tiers ADD COLUMN min_spent_vnd INTEGER DEFAULT 0;
ALTER TABLE loyalty_tiers ADD COLUMN max_spent_vnd INTEGER;
ALTER TABLE loyalty_tiers ADD COLUMN expiry_days INTEGER;
ALTER TABLE loyalty_tiers ADD COLUMN sort_order INTEGER DEFAULT 0;


-- ═════════════════════════════════════════════════════════════════
-- 2. RESET loyalty_tiers DATA — 4 tier (Bronze/Silver/Gold/Platinum)
-- ═════════════════════════════════════════════════════════════════
-- Xóa data tier cũ để re-insert đúng spec mới
DELETE FROM loyalty_tiers WHERE tier_name IN ('silver', 'gold', 'platinum', 'bronze');

-- Insert 4 tier hierarchy
-- Bronze:   Đồng       · 0 - 500k VND     · 3% cashback · 90 days expiry
-- Silver:   Bạc        · 500k - 2tr VND   · 5% cashback · 120 days expiry
-- Gold:     Vàng       · 2tr - 5tr VND    · 7% cashback · 180 days expiry
-- Platinum: Bạch Kim   · >5tr VND         · 10% cashback · không hết hạn
INSERT INTO loyalty_tiers (tier_name, display_name_vi, min_points, min_spent_vnd, max_spent_vnd, cashback_rate, point_multiplier, birthday_discount, expiry_days, sort_order) VALUES
    ('bronze',   'Đồng',      0,    0,       500000,  0.03, 1.0,  10, 90,   1),
    ('silver',   'Bạc',       50,   500000,  2000000, 0.05, 1.2,  20, 120,  2),
    ('gold',     'Vàng',      200,  2000000, 5000000, 0.07, 1.5,  35, 180,  3),
    ('platinum', 'Bạch Kim',  500,  5000000, NULL,    0.10, 2.0,  50, NULL, 4);


-- ═════════════════════════════════════════════════════════════════
-- 3. MIGRATE EXISTING CUSTOMERS — default tier bronze
-- ═════════════════════════════════════════════════════════════════
-- Customer chưa active (loyalty_points < 50) đang default 'silver' → set 'bronze' đúng
UPDATE customers
SET loyalty_tier = 'bronze'
WHERE loyalty_tier = 'silver' AND COALESCE(loyalty_points, 0) < 50;

-- Customer có tier NULL hoặc tier không valid → set bronze
UPDATE customers
SET loyalty_tier = 'bronze'
WHERE loyalty_tier IS NULL
   OR loyalty_tier NOT IN ('bronze', 'silver', 'gold', 'platinum');


-- ═════════════════════════════════════════════════════════════════
-- 4. EXTEND cashback_transactions — new columns
-- ═════════════════════════════════════════════════════════════════
ALTER TABLE cashback_transactions ADD COLUMN expires_at TEXT;
ALTER TABLE cashback_transactions ADD COLUMN multiplier_applied REAL DEFAULT 1.0;
ALTER TABLE cashback_transactions ADD COLUMN campaign_id INTEGER;
ALTER TABLE cashback_transactions ADD COLUMN customer_id TEXT;
ALTER TABLE cashback_transactions ADD COLUMN staff_id TEXT;


-- ═════════════════════════════════════════════════════════════════
-- 5. POPULATE customer_id từ wallet_id (cho query nhanh)
-- ═════════════════════════════════════════════════════════════════
UPDATE cashback_transactions
SET customer_id = (
  SELECT cw.customer_id
  FROM cashback_wallets cw
  WHERE cw.id = cashback_transactions.wallet_id
)
WHERE customer_id IS NULL;


-- ═════════════════════════════════════════════════════════════════
-- 6. POPULATE expires_at — default 90 days cho earn/bonus existing
-- ═════════════════════════════════════════════════════════════════
UPDATE cashback_transactions
SET expires_at = datetime(created_at, '+90 days')
WHERE type IN ('earn', 'bonus') AND expires_at IS NULL;


-- ═════════════════════════════════════════════════════════════════
-- 7. INDEXES for query performance
-- ═════════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_cbtxn_customer ON cashback_transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_cbtxn_expires ON cashback_transactions(expires_at);
CREATE INDEX IF NOT EXISTS idx_cbtxn_order_type ON cashback_transactions(order_id, type);


-- ═════════════════════════════════════════════════════════════════
-- 8. UNIQUE PARTIAL INDEX — chống double-credit cashback earn per order
-- ═════════════════════════════════════════════════════════════════
-- Idempotency guard: same order_id chỉ được earn 1 lần
-- Partial: chỉ áp dụng cho type='earn' AND order_id IS NOT NULL
CREATE UNIQUE INDEX IF NOT EXISTS idx_cbtxn_order_earn_unique
  ON cashback_transactions(order_id, type)
  WHERE type = 'earn' AND order_id IS NOT NULL;


-- ═════════════════════════════════════════════════════════════════
-- 9. NEW TABLE: bonus_campaigns
-- ═════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS bonus_campaigns (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    code            TEXT UNIQUE NOT NULL,
    name            TEXT NOT NULL,
    description     TEXT,
    start_date      TEXT NOT NULL,
    end_date        TEXT NOT NULL,
    cashback_multiplier REAL DEFAULT 1.0,
    signup_bonus_vnd INTEGER DEFAULT 0,
    signup_bonus_cap INTEGER,
    refer_bonus_vnd INTEGER DEFAULT 20000,
    max_cap_per_customer_vnd INTEGER DEFAULT 50000,
    auto_upgrade_tier TEXT,
    auto_upgrade_min_spend INTEGER,
    active          INTEGER DEFAULT 1,
    created_at      TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_campaigns_active_dates ON bonus_campaigns(active, start_date, end_date);

-- Seed Grand Opening campaign 06-08/06/2026
INSERT OR IGNORE INTO bonus_campaigns
    (code, name, description, start_date, end_date,
     cashback_multiplier, signup_bonus_vnd, signup_bonus_cap,
     refer_bonus_vnd, max_cap_per_customer_vnd,
     auto_upgrade_tier, auto_upgrade_min_spend, active)
VALUES (
    'GRAND_OPENING_6_6_2026',
    'Khai trương AURA CAFE 06/06',
    'Cashback x2 + Signup +50k cho 100 người đầu + Refer +50k + Auto-upgrade Silver khi spend >=200k ngày 6/6',
    '2026-06-06 00:00:00',
    '2026-06-08 23:59:59',
    2.0,
    50000,
    100,
    50000,
    100000,
    'silver',
    200000,
    1
);


-- ═════════════════════════════════════════════════════════════════
-- 10. NEW TABLE: signup_bonus_log
-- ═════════════════════════════════════════════════════════════════
-- Track ai đã nhận signup bonus của campaign (cho cap "first 100")
CREATE TABLE IF NOT EXISTS signup_bonus_log (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id     TEXT NOT NULL,
    campaign_id     INTEGER NOT NULL,
    bonus_vnd       INTEGER NOT NULL,
    granted_at      TEXT DEFAULT (datetime('now')),
    UNIQUE(customer_id, campaign_id)
);

CREATE INDEX IF NOT EXISTS idx_signup_bonus_campaign ON signup_bonus_log(campaign_id, granted_at);


-- ═════════════════════════════════════════════════════════════════
-- 11. NEW TABLE: loyalty_audit_log (anti-fraud trail)
-- ═════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS loyalty_audit_log (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id     TEXT,
    staff_id        TEXT,
    action          TEXT NOT NULL,  -- signup_bonus, cashback_earn, cashback_spend, tier_upgrade, refund
    amount_vnd      REAL,
    order_id        TEXT,
    metadata        TEXT,           -- JSON: tier, multiplier, campaign code, raw, capped
    ip_address      TEXT,
    user_agent      TEXT,
    created_at      TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_audit_customer_date ON loyalty_audit_log(customer_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_action_date ON loyalty_audit_log(action, created_at);


-- ═════════════════════════════════════════════════════════════════
-- 12. VERIFY (read-only outputs)
-- ═════════════════════════════════════════════════════════════════
SELECT '=== Loyalty v2 migration applied ===' AS info;

SELECT '--- 4 tiers seeded ---' AS info;
SELECT tier_name, display_name_vi, min_spent_vnd, max_spent_vnd, cashback_rate, expiry_days, sort_order
FROM loyalty_tiers
ORDER BY sort_order;

SELECT '--- Active campaign ---' AS info;
SELECT code, name, cashback_multiplier, signup_bonus_vnd, signup_bonus_cap,
       refer_bonus_vnd, auto_upgrade_tier, start_date, end_date
FROM bonus_campaigns
WHERE active = 1;

SELECT '--- New tables created ---' AS info;
SELECT name FROM sqlite_master
WHERE type='table'
  AND name IN ('bonus_campaigns', 'signup_bonus_log', 'loyalty_audit_log')
ORDER BY name;

SELECT '--- UNIQUE constraint for idempotency ---' AS info;
SELECT name FROM sqlite_master
WHERE type='index' AND name='idx_cbtxn_order_earn_unique';

SELECT '=== Migration complete ===' AS info;
