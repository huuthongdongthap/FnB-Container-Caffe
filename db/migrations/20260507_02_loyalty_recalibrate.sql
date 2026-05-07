-- Migration: Loyalty tiers recalibration (3 tiers, remove Kim Cương)
-- Date:      2026-05-07
-- Rationale: Adjust tier thresholds to match realistic Sa Đéc market.
--            5000/15000/50000 pts was unreachable (years to reach).
--            Now: 0/500/2000 pts (months to reach, achievable).
--            Remove Kim Cương tier (not achievable in F&B context).
--            Referral: referrer 100 pts (was 200), referee 0 pts (FIRSTORDER code only).
--            Birthday: % discount only, no bonus points.
-- Apply:     wrangler d1 execute fnb-caffe-db --remote --file=db/migrations/20260507_02_loyalty_recalibrate.sql

-- ─────────────────────────────────────────────
-- 1. UPDATE LOYALTY TIERS (remove old, insert new)
-- ─────────────────────────────────────────────
-- Delete old tiers to re-insert with correct values
DELETE FROM loyalty_tiers WHERE tier_name IN ('silver', 'gold', 'platinum');

-- Insert recalibrated 3-tier system
-- Đồng (Silver): 0 pts | 2% cashback | ×1.0 | 10% birthday discount
-- Bạc (Gold): 500 pts | 5% cashback | ×1.5 | 30% birthday discount
-- Vàng (Platinum): 2000 pts | 8% cashback | ×2.0 | 50% birthday discount
INSERT INTO loyalty_tiers (tier_name, min_points, cashback_rate, point_multiplier, birthday_discount) VALUES
    ('silver',   0,     0.02, 1.0, 10),
    ('gold',     500,   0.05, 1.5, 30),
    ('platinum', 2000,  0.08, 2.0, 50);

-- ─────────────────────────────────────────────
-- 2. ADD REFERRAL CONFIG to loyalty_tiers table
-- ─────────────────────────────────────────────
-- (No schema change needed, referral config is in loyalty-config.json)
-- Referrer: 100 pts (was 200)
-- Referee: 0 pts + FIRSTORDER promo code

-- ─────────────────────────────────────────────
-- 3. VERIFY
-- ─────────────────────────────────────────────
SELECT 'Loyalty tiers recalibrated:' AS info;
SELECT tier_name, min_points, cashback_rate, point_multiplier, birthday_discount FROM loyalty_tiers ORDER BY min_points;