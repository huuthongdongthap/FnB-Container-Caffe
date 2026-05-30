-- Migration: Loyalty v3 — Tier thresholds update + birthday discount + check-in + referral
-- Date: 2026-05-30 (T7, D-7 before launch)
-- Spec: /05_Demos/KHAI_TRUONG_6-6/07_LOYALTY_V3_RULES_30-5.md
--
-- Anh Còn quyết 30/5 (revised after questions):
--   1. Tier thresholds mới: Bronze 0-500k, Silver 500k-5tr, Gold 5tr-15tr, Platinum >15tr
--      (Gold/Plat = exclusive club, không phải mass-market)
--   2. Birthday discount theo tier: 5/10/15/20% (bỏ free 1 ly birthday)
--   3. Bỏ signup_bonus (0đ) — strategy mới đơn giản hoá
--   4. Bỏ welcome drink + LOYALTY50 — đã quyết trong master plan v2
--   5. Refer-a-friend: tặng 10k CASHBACK (KHÔNG phải 100 điểm) CHO NGƯỜI GIỚI THIỆU
--      khi friend mới CÓ TIÊU DÙNG (min 30k order). Người mới không nhận gì.
--      → Reuse existing 'referrals' table (referrer_id, referred_customer_id, points_awarded, status)
--      → Add column 'cashback_awarded_vnd' để track 10k cashback grant
--   6. Check-in: 1 LẦN/KHÁCH/THÁNG 6 (revised — was 5 lần tuần + 10 lần tháng)
--      Khách chọn 1 trong 2 phase: tuần khai trương (+20k cashback) hoặc sau khai trương (-10% direct)
--   7. Cashback ví: GIỮ CAP 50% bill (revised — anh chọn restore cap 50% như cũ)
--      Application logic: maxFromWallet = Math.min(walletBalance, total * 0.5)
--   8. Cashback rates giữ nguyên 3/5/7/10% (đã match industry VN với COGS 35%)
--   9. Per-transaction earn cap: 50k/đơn (giữ nguyên)
--
-- Idempotent: dùng UPDATE WHERE conditions + CREATE TABLE IF NOT EXISTS + INSERT OR IGNORE

-- ═════════════════════════════════════════════════════════════════
-- 1. UPDATE loyalty_tiers — thresholds mới + birthday_discount
-- ═════════════════════════════════════════════════════════════════
-- Bronze (giữ nguyên thresholds, đổi birthday 10→5)
UPDATE loyalty_tiers
SET birthday_discount = 5
WHERE tier_name = 'bronze';

-- Silver: thresholds 500k-5tr (cũ 500k-2tr), birthday 20→10
UPDATE loyalty_tiers
SET min_spent_vnd = 500000,
    max_spent_vnd = 5000000,
    birthday_discount = 10
WHERE tier_name = 'silver';

-- Gold: thresholds 5tr-15tr (cũ 2-5tr), birthday 35→15
UPDATE loyalty_tiers
SET min_spent_vnd = 5000000,
    max_spent_vnd = 15000000,
    birthday_discount = 15
WHERE tier_name = 'gold';

-- Platinum: thresholds >15tr (cũ >5tr), birthday 50→20
UPDATE loyalty_tiers
SET min_spent_vnd = 15000000,
    max_spent_vnd = NULL,
    birthday_discount = 20
WHERE tier_name = 'platinum';


-- ═════════════════════════════════════════════════════════════════
-- 2. UPDATE bonus_campaigns — signup_bonus=0, refer=10k
-- ═════════════════════════════════════════════════════════════════
UPDATE bonus_campaigns
SET signup_bonus_vnd = 0,
    signup_bonus_cap = 0,
    refer_bonus_vnd = 10000,
    description = 'Cashback x2 + Auto-upgrade Silver khi spend >=200k ngày 6/6. Signup bonus bỏ. Refer +10k CASHBACK cho người giới thiệu khi friend có đơn đầu >=30k.'
WHERE code = 'GRAND_OPENING_6_6_2026';


-- ═════════════════════════════════════════════════════════════════
-- 3. NEW CAMPAIGN: CHECKIN_WEEK_6_6 (6-13/6) — +20k cashback (1 lần/khách)
-- ═════════════════════════════════════════════════════════════════
INSERT OR IGNORE INTO bonus_campaigns
    (code, name, description, start_date, end_date,
     cashback_multiplier, signup_bonus_vnd, signup_bonus_cap,
     refer_bonus_vnd, max_cap_per_customer_vnd,
     auto_upgrade_tier, auto_upgrade_min_spend, active)
VALUES (
    'CHECKIN_WEEK_6_6',
    'Check-in tuần khai trương — Tặng 20k cashback',
    'Khách check-in tại quán (post FB/Zalo có tag) → tặng 20k vào ví. CAP 1 LẦN/KHÁCH duy nhất trong tháng 6 (chia sẻ với CHECKIN_DISCOUNT_THANG_6).',
    '2026-06-06 00:00:00',
    '2026-06-13 23:59:59',
    1.0,    -- không multiplier vì đã có GRAND_OPENING
    0,
    0,
    0,
    20000,  -- max 20k/customer (= 1 lần duy nhất × 20k)
    NULL,
    NULL,
    1
);


-- ═════════════════════════════════════════════════════════════════
-- 4. NEW CAMPAIGN: CHECKIN_DISCOUNT_THANG_6 (14-30/6) — -10% off direct (1 lần/khách)
-- ═════════════════════════════════════════════════════════════════
INSERT OR IGNORE INTO bonus_campaigns
    (code, name, description, start_date, end_date,
     cashback_multiplier, signup_bonus_vnd, signup_bonus_cap,
     refer_bonus_vnd, max_cap_per_customer_vnd,
     auto_upgrade_tier, auto_upgrade_min_spend, active)
VALUES (
    'CHECKIN_DISCOUNT_THANG_6',
    'Check-in tháng 6 — Giảm 10% trực tiếp',
    'Khách check-in tại quán (post FB/Zalo có tag) → giảm 10% hoá đơn ngay. Không tích vào ví. CAP 1 LẦN/KHÁCH duy nhất trong tháng 6 (chia sẻ với CHECKIN_WEEK_6_6).',
    '2026-06-14 00:00:00',
    '2026-06-30 23:59:59',
    1.0,
    0,
    0,
    0,
    0,
    NULL,
    NULL,
    1
);


-- ═════════════════════════════════════════════════════════════════
-- 5. NEW TABLE: checkin_log (track check-in trust-based)
-- ═════════════════════════════════════════════════════════════════
-- Anh Còn quyết: 1 customer chỉ check-in 1 LẦN duy nhất trong tháng 6
-- Customer chọn 1 trong 2 phase (tuần khai trương HOẶC sau khai trương)
-- Enforce qua UNIQUE INDEX trên (customer_id, year-month)
CREATE TABLE IF NOT EXISTS checkin_log (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id     TEXT NOT NULL,
    campaign_code   TEXT NOT NULL,        -- 'CHECKIN_WEEK_6_6' hoặc 'CHECKIN_DISCOUNT_THANG_6'
    reward_type     TEXT NOT NULL,        -- 'POINTS_20K' hoặc 'DISCOUNT_10PCT'
    reward_value    INTEGER NOT NULL,     -- 20000 hoặc 10 (%)
    post_platform   TEXT,                 -- 'FB', 'ZALO', 'IG', 'OTHER'
    post_url        TEXT,                 -- link/screenshot URL nếu có
    staff_id        TEXT NOT NULL,        -- người approve
    order_id        TEXT,                 -- nếu liên kết với 1 đơn cụ thể (DISCOUNT_10PCT)
    notes           TEXT,
    checkin_at      TEXT DEFAULT (datetime('now'))
);

-- UNIQUE INDEX: 1 customer chỉ có 1 row/tháng (substr lấy YYYY-MM từ checkin_at)
CREATE UNIQUE INDEX IF NOT EXISTS idx_checkin_unique_customer_month
ON checkin_log(customer_id, substr(checkin_at, 1, 7));

CREATE INDEX IF NOT EXISTS idx_checkin_customer ON checkin_log(customer_id, checkin_at);
CREATE INDEX IF NOT EXISTS idx_checkin_campaign ON checkin_log(campaign_code, checkin_at);


-- ═════════════════════════════════════════════════════════════════
-- 5b. CREATE referrals tables if they do not exist
-- ═════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS referral_codes (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL UNIQUE,
    code TEXT NOT NULL UNIQUE,
    times_used INTEGER DEFAULT 0,
    total_points_earned INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
);
CREATE INDEX IF NOT EXISTS idx_referral_codes_customer ON referral_codes(customer_id);
CREATE INDEX IF NOT EXISTS idx_referral_codes_code ON referral_codes(code);

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
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred ON referrals(referred_customer_id);


-- ═════════════════════════════════════════════════════════════════
-- 6. ALTER TABLE referrals — Add cashback_awarded_vnd column
-- ═════════════════════════════════════════════════════════════════
-- Table 'referrals' đã tồn tại với schema:
--   (id, referrer_id, referred_customer_id, referral_code, points_awarded, status, created_at)
-- Em REUSE table existing, chỉ thêm 1 column track cashback grant (vs points cũ)
--
-- ALTER TABLE có thể fail nếu column đã tồn tại — D1 sẽ skip an toàn.

ALTER TABLE referrals ADD COLUMN cashback_awarded_vnd INTEGER DEFAULT 0;
ALTER TABLE referrals ADD COLUMN first_order_id TEXT;
ALTER TABLE referrals ADD COLUMN first_order_amount REAL;
ALTER TABLE referrals ADD COLUMN reward_paid_at TEXT;

-- Index cho query nhanh
CREATE INDEX IF NOT EXISTS idx_referrals_referrer_status ON referrals(referrer_id, status);


-- ═════════════════════════════════════════════════════════════════
-- 7. VERIFY queries
-- ═════════════════════════════════════════════════════════════════
SELECT '=== Loyalty v3 migration applied ===' AS info;

SELECT '--- 4 tiers updated (new thresholds + birthday discount) ---' AS info;
SELECT tier_name, display_name_vi, min_spent_vnd, max_spent_vnd, cashback_rate, birthday_discount, expiry_days
FROM loyalty_tiers
ORDER BY sort_order;

-- Expected:
-- bronze   | Đồng     | 0        | 500000   | 0.03 | 5  | 90
-- silver   | Bạc      | 500000   | 5000000  | 0.05 | 10 | 120
-- gold     | Vàng     | 5000000  | 15000000 | 0.07 | 15 | 180
-- platinum | Bạch Kim | 15000000 | NULL     | 0.10 | 20 | NULL

SELECT '--- All campaigns ---' AS info;
SELECT code, name, signup_bonus_vnd, refer_bonus_vnd, cashback_multiplier,
       max_cap_per_customer_vnd, start_date, end_date, active
FROM bonus_campaigns
ORDER BY start_date;

SELECT '--- New table checkin_log ---' AS info;
SELECT name FROM sqlite_master WHERE type='table' AND name='checkin_log';

SELECT '--- referrals new columns (cashback tracking) ---' AS info;
SELECT name FROM pragma_table_info('referrals')
WHERE name IN ('cashback_awarded_vnd', 'first_order_id', 'first_order_amount', 'reward_paid_at')
ORDER BY name;

SELECT '--- UNIQUE index for 1 check-in/customer/month ---' AS info;
SELECT name FROM sqlite_master WHERE type='index' AND name='idx_checkin_unique_customer_month';

SELECT '=== Migration v3 complete ===' AS info;
