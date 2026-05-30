-- Migration: Loyalty v3 — Tier thresholds update + birthday discount + check-in + referral
-- Date: 2026-05-30 (T7, D-7 before launch)
-- Spec: /05_Demos/KHAI_TRUONG_6-6/01_LOYALTY_CASHBACK_PROGRAM.md (updated)
--
-- Anh Còn quyết 30/5:
--   1. Tier thresholds mới: Bronze 0-500k, Silver 500k-5tr, Gold 5tr-15tr, Platinum >15tr
--      (Gold/Plat = exclusive club, không phải mass-market)
--   2. Birthday discount theo tier: 5/10/15/20% (bỏ free 1 ly birthday)
--   3. Bỏ signup_bonus (0đ) — strategy mới đơn giản hoá
--   4. Bỏ welcome drink + LOYALTY50 — đã quyết trong master plan v2
--   5. Refer-a-friend: tặng 10k cashback CHO NGƯỜI GIỚI THIỆU
--      khi friend mới CÓ TIÊU DÙNG (min 30k order). Người mới không nhận gì.
--   6. Check-in tuần khai trương (6-13/6): +20 điểm cashback (20k vào ví), trust-based
--   7. Check-in sau khai trương (14-30/6): -10% off direct (không tích ví)
--   8. Cashback ví dùng cho MỌI món, 100% bill (bỏ cap 50%) — application logic
--   9. Cashback rates giữ nguyên 3/5/7/10% (đã match industry VN với COGS 35%)
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
    description = 'Cashback x2 + Auto-upgrade Silver khi spend >=200k ngày 6/6. Signup bonus bỏ. Refer +10k cho người giới thiệu khi friend có đơn đầu >=30k.'
WHERE code = 'GRAND_OPENING_6_6_2026';


-- ═════════════════════════════════════════════════════════════════
-- 3. NEW CAMPAIGN: CHECKIN_WEEK_6_6 (6-13/6) — 20 điểm/check-in
-- ═════════════════════════════════════════════════════════════════
INSERT OR IGNORE INTO bonus_campaigns
    (code, name, description, start_date, end_date,
     cashback_multiplier, signup_bonus_vnd, signup_bonus_cap,
     refer_bonus_vnd, max_cap_per_customer_vnd,
     auto_upgrade_tier, auto_upgrade_min_spend, active)
VALUES (
    'CHECKIN_WEEK_6_6',
    'Check-in tuần khai trương — Tặng 20k cashback',
    'Khách check-in tại quán (post FB/Zalo có tag) → tặng 20k vào ví. Cap 1 lần/ngày, max 5 ngày trong tuần.',
    '2026-06-06 00:00:00',
    '2026-06-13 23:59:59',
    1.0,    -- không multiplier vì đã có GRAND_OPENING
    0,
    0,
    0,
    100000, -- max 100k/customer cumulative check-in
    NULL,
    NULL,
    1
);


-- ═════════════════════════════════════════════════════════════════
-- 4. NEW CAMPAIGN: CHECKIN_DISCOUNT_THANG_6 (14-30/6) — -10% off direct
-- ═════════════════════════════════════════════════════════════════
INSERT OR IGNORE INTO bonus_campaigns
    (code, name, description, start_date, end_date,
     cashback_multiplier, signup_bonus_vnd, signup_bonus_cap,
     refer_bonus_vnd, max_cap_per_customer_vnd,
     auto_upgrade_tier, auto_upgrade_min_spend, active)
VALUES (
    'CHECKIN_DISCOUNT_THANG_6',
    'Check-in tháng 6 — Giảm 10% trực tiếp',
    'Khách check-in tại quán (post FB/Zalo có tag) → giảm 10% hoá đơn ngay. Không tích vào ví. Cap 1 lần/ngày, max 10 lần trong tháng.',
    '2026-06-14 00:00:00',
    '2026-06-30 23:59:59',
    1.0,
    0,
    0,
    0,
    0, -- không cap vì discount direct không cộng ví
    NULL,
    NULL,
    1
);


-- ═════════════════════════════════════════════════════════════════
-- 5. NEW TABLE: checkin_log (track check-in trust-based)
-- ═════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS checkin_log (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id     TEXT NOT NULL,
    campaign_code   TEXT NOT NULL,        -- 'CHECKIN_WEEK_6_6' hoặc 'CHECKIN_DISCOUNT_THANG_6'
    reward_type     TEXT NOT NULL,        -- 'POINTS_20K' hoặc 'DISCOUNT_10PCT'
    reward_value    INTEGER NOT NULL,     -- 20000 hoặc % (10)
    post_platform   TEXT,                 -- 'FB', 'ZALO', 'IG', 'OTHER'
    post_url        TEXT,                 -- link/screenshot URL nếu có
    staff_id        TEXT NOT NULL,        -- người approve
    order_id        TEXT,                 -- nếu liên kết với 1 đơn cụ thể (DISCOUNT_10PCT)
    notes           TEXT,
    checkin_at      TEXT DEFAULT (datetime('now')),
    UNIQUE(customer_id, campaign_code, date(checkin_at)) -- 1 lần/ngày/campaign
);

CREATE INDEX IF NOT EXISTS idx_checkin_customer ON checkin_log(customer_id, checkin_at);
CREATE INDEX IF NOT EXISTS idx_checkin_campaign ON checkin_log(campaign_code, checkin_at);


-- ═════════════════════════════════════════════════════════════════
-- 6. NEW TABLE: referrals (track refer-a-friend)
-- ═════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS referrals (
    id                          INTEGER PRIMARY KEY AUTOINCREMENT,
    referrer_customer_id        TEXT NOT NULL,
    referred_customer_id        TEXT NOT NULL,
    referred_signup_at          TEXT DEFAULT (datetime('now')),
    referred_first_order_id     TEXT,                 -- NULL khi chưa có đơn đầu
    referred_first_order_amount REAL,
    referred_first_order_at     TEXT,
    reward_paid_vnd             INTEGER DEFAULT 0,    -- 10000 khi paid
    reward_paid_at              TEXT,
    status                      TEXT DEFAULT 'pending', -- 'pending', 'confirmed', 'fraud'
    notes                       TEXT,
    UNIQUE(referred_customer_id) -- 1 customer chỉ được refer 1 lần
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_customer_id, status);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals(status, referred_signup_at);


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
SELECT code, name, signup_bonus_vnd, refer_bonus_vnd, cashback_multiplier, start_date, end_date, active
FROM bonus_campaigns
ORDER BY start_date;

-- Expected:
-- GRAND_OPENING_6_6_2026     | ... | 0     | 10000 | 2.0 | 2026-06-06 | 2026-06-08
-- CHECKIN_WEEK_6_6           | ... | 0     | 0     | 1.0 | 2026-06-06 | 2026-06-13
-- CHECKIN_DISCOUNT_THANG_6   | ... | 0     | 0     | 1.0 | 2026-06-14 | 2026-06-30

SELECT '--- New tables created ---' AS info;
SELECT name FROM sqlite_master
WHERE type='table'
  AND name IN ('checkin_log', 'referrals')
ORDER BY name;

SELECT '=== Migration v3 complete ===' AS info;
