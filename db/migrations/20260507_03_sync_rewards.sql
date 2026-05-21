-- Migration: Sync rewards table with loyalty-config.json (9 rewards — drinks only, no food)
-- Date:      2026-05-07
-- Rationale: Original seed had 4 generic rewards + referenced non-existent food.
--            Menu is 100% drinks. All rewards now reference real drink menu items.
-- Apply:     wrangler d1 execute fnb-caffe-db --remote --file=db/migrations/20260507_03_sync_rewards.sql

-- ─────────────────────────────────────────────
-- 1. CLEAR OLD REWARDS (replace with correct set)
-- ─────────────────────────────────────────────
DELETE FROM rewards WHERE id IN ('rwd-001', 'rwd-002', 'rwd-003', 'rwd-004');

-- ─────────────────────────────────────────────
-- 2. INSERT 9 REWARDS — 100% drinks/merch, aligned with seed.sql menu
-- ─────────────────────────────────────────────
-- Value/pt ratio targets ~200-350₫/pt
-- Prices aligned with actual menu items from seed.sql (12 drinks, 0 food)

INSERT OR IGNORE INTO rewards (id, title, discount_type, discount_value, point_cost) VALUES
  -- 100 pts: Free Cà Phê Sữa Đá (35K₫ → 350₫/pt — entry reward, good perceived value)
  ('reward_001', 'Free Cà Phê Sữa Đá',         'FIXED_AMOUNT',  35000,  100),

  -- 150 pts: Free Espresso (35K₫ → 233₫/pt)
  ('reward_002', 'Free Espresso',               'FIXED_AMOUNT',  35000,  150),

  -- 250 pts: Giảm 30K (min order 100K) → 120₫/pt but drives higher spend
  ('reward_003', 'Voucher 30K',                'FIXED_AMOUNT',  30000,  250),

  -- 300 pts: Free Signature Drink (65K₫ AURA Cooler → 217₫/pt)
  ('reward_004', 'Free Signature Drink',        'FIXED_AMOUNT',  65000,  300),

  -- 450 pts: Giảm 50K (min order 200K) → 111₫/pt but drives group orders
  ('reward_005', 'Voucher 50K',                'FIXED_AMOUNT',  50000,  450),

  -- 600 pts: 2x Signature Drinks (2×70K = 140K₫ → 233₫/pt)
  ('reward_006', '2x Signature Drinks',         'FIXED_AMOUNT', 140000,  600),

  -- 800 pts: Limited Edition Mug (merch, cost ≈ 150K₫ → 188₫/pt)
  ('reward_007', 'Limited Edition Mug',         'FIXED_AMOUNT', 150000,  800),

  -- 1000 pts: Giảm 100K (min order 400K) → 100₫/pt but drives large group orders
  ('reward_008', 'Voucher 100K',               'FIXED_AMOUNT', 100000, 1000),

  -- 1200 pts: Giảm 10% toàn bộ (up to 3 uses) — perceptual value varies
  ('reward_009', '10% Discount Voucher',        'PERCENTAGE',      10,  1200);

-- ─────────────────────────────────────────────
-- 3. VERIFY
-- ─────────────────────────────────────────────
SELECT 'Rewards synced (drinks only):' AS info;
SELECT id, title, discount_type, discount_value, point_cost FROM rewards ORDER BY point_cost;