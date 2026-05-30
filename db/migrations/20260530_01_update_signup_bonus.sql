-- Migration: Update GRAND_OPENING_6_6_2026 signup bonus from 50k → 30k
-- Date: 2026-05-30 (T7, D-7 before launch)
-- Reason: Anh Còn quyết định 30/5 — strategy mới đơn giản hoá launch,
--         signup bonus 30k × cap 100 = 3tr (vs 5tr ban đầu) → cash flow OK hơn
--
-- Impact:
-- - Cap vẫn 100 người (không thay đổi)
-- - Mỗi sign-up đầu tiên nhận +30k vào ví thay vì +50k
-- - Cashback x2 multiplier vẫn giữ nguyên
-- - Auto-upgrade Silver khi spend ≥200k vẫn giữ nguyên
--
-- This is a one-time UPDATE — idempotent qua điều kiện code='GRAND_OPENING_6_6_2026'
-- Re-running migration sẽ không gây side effect (vẫn set value = 30000).

-- ============================================================================
-- Section 1: Update bonus amount
-- ============================================================================

UPDATE bonus_campaigns
SET signup_bonus_vnd = 30000,
    updated_at = datetime('now')
WHERE code = 'GRAND_OPENING_6_6_2026';

-- ============================================================================
-- Section 2: Verification query (kết quả expected sau migration)
-- ============================================================================

-- Expected output:
--   code                       | signup_bonus_vnd | signup_bonus_cap | cashback_multiplier | active
--   GRAND_OPENING_6_6_2026     | 30000            | 100              | 2.0                 | 1
--
-- Run manually after apply:
--   SELECT code, signup_bonus_vnd, signup_bonus_cap, cashback_multiplier, active
--   FROM bonus_campaigns
--   WHERE code='GRAND_OPENING_6_6_2026';
