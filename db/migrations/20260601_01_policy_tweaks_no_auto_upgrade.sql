-- Migration: Policy tweaks — bỏ auto-upgrade Silver trong GRAND_OPENING
-- Date: 2026-06-01 (T2, D-5)
-- Anh Còn quyết: bỏ auto-upgrade Silver khi spend ≥200k ngày 6/6
--                bỏ lì xì 20 phong 50k (đã loại khỏi master plan, không cần code change)
--                birthday discount chỉ 1 đơn/tháng (code change ở birthday.js, không phải schema)
--
-- Idempotent: UPDATE WHERE conditions

UPDATE bonus_campaigns
SET auto_upgrade_tier = NULL,
    auto_upgrade_min_spend = NULL,
    description = 'Cashback x2 trong 3 ngày khai trương 6-8/6. Signup bonus bỏ. Refer +10k CASHBACK cho người giới thiệu khi friend có đơn đầu >=30k. KHÔNG auto-upgrade tier.'
WHERE code = 'GRAND_OPENING_6_6_2026';

-- Verify:
SELECT '=== Auto-upgrade removed ===' AS info;
SELECT code, auto_upgrade_tier, auto_upgrade_min_spend, description
FROM bonus_campaigns
WHERE code = 'GRAND_OPENING_6_6_2026';

-- Expected: auto_upgrade_tier=NULL, auto_upgrade_min_spend=NULL
