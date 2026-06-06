-- Migration 06: Referral edge-case fixes (H13, H14, H15, P7)
-- - Add last_ip to customers (H14 self-referral IP check)
-- - Add bonus_type to referrals (H13 double-bonus guard)
-- - Existing code handles H15 (reverseReferralCashback) and P7 (INSERT retry)

-- H14: last_ip on customers (soft self-referral block)
ALTER TABLE customers ADD COLUMN last_ip TEXT;

-- H13: bonus_type on referrals (prevents double-bonus race)
ALTER TABLE referrals ADD COLUMN bonus_type TEXT DEFAULT 'pending';
