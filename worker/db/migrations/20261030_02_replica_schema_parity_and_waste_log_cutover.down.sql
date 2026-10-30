-- =============================================================================
-- Rollback: 20261030_02_replica_schema_parity_and_waste_log_cutover.down.sql
-- Purpose: Reverse additive table, index, and column creations from 20261030_02.
-- =============================================================================

DROP INDEX IF EXISTS idx_waste_log_date;
DROP INDEX IF EXISTS idx_waste_log_item;
DROP TABLE IF EXISTS waste_log;

ALTER TABLE payment_transactions DROP COLUMN gateway_response;
ALTER TABLE payment_transactions DROP COLUMN transaction_ref;
ALTER TABLE payment_transactions DROP COLUMN currency;

ALTER TABLE recipe_ingredients DROP COLUMN notes;
ALTER TABLE recipe_ingredients DROP COLUMN waste_percentage;

ALTER TABLE loyalty_redemptions DROP COLUMN used_at;
ALTER TABLE loyalty_redemptions DROP COLUMN voucher_code;

ALTER TABLE tier_configs DROP COLUMN max_spent_vnd;
ALTER TABLE tier_configs DROP COLUMN min_spent_vnd;
ALTER TABLE tier_configs DROP COLUMN display_name_vi;
ALTER TABLE tier_configs DROP COLUMN benefits;
ALTER TABLE tier_configs DROP COLUMN birthday_discount;
ALTER TABLE tier_configs DROP COLUMN multiplier;

ALTER TABLE loyalty_accounts DROP COLUMN referred_by;
ALTER TABLE loyalty_accounts DROP COLUMN referral_code;
ALTER TABLE loyalty_accounts DROP COLUMN total_orders;
ALTER TABLE loyalty_accounts DROP COLUMN last_checkin_date;
ALTER TABLE loyalty_accounts DROP COLUMN streak_days;
ALTER TABLE loyalty_accounts DROP COLUMN tier_expires_at;
ALTER TABLE loyalty_accounts DROP COLUMN points_balance;

ALTER TABLE staff_login_identities DROP COLUMN updated_at;
ALTER TABLE staff_login_identities DROP COLUMN created_at;

ALTER TABLE users DROP COLUMN total_points;
ALTER TABLE users DROP COLUMN tier;
ALTER TABLE users DROP COLUMN password_changed_at;
ALTER TABLE users DROP COLUMN full_name;
ALTER TABLE users DROP COLUMN username;

ALTER TABLE notification_audit_log DROP COLUMN latency_ms;

ALTER TABLE staff_shifts DROP COLUMN shift_type;
ALTER TABLE staff_shifts DROP COLUMN staff_email;
ALTER TABLE staff_shifts DROP COLUMN is_active;

ALTER TABLE referrals DROP COLUMN rewarded_at;
ALTER TABLE referrals DROP COLUMN referee_reward;
ALTER TABLE referrals DROP COLUMN referrer_reward;
ALTER TABLE referrals DROP COLUMN referee_id;

ALTER TABLE referral_codes DROP COLUMN tenant_id;
ALTER TABLE referral_codes DROP COLUMN max_uses;

ALTER TABLE promotion_usages DROP COLUMN tenant_id;
ALTER TABLE rewards DROP COLUMN min_order;
ALTER TABLE cashback_transactions DROP COLUMN tenant_id;

ALTER TABLE cashback_wallets DROP COLUMN tier;
ALTER TABLE cashback_wallets DROP COLUMN lifetime_spent;
ALTER TABLE cashback_wallets DROP COLUMN lifetime_earned;

ALTER TABLE reviews DROP COLUMN updated_at;
ALTER TABLE reviews DROP COLUMN is_visible;
ALTER TABLE reviews DROP COLUMN is_approved;
ALTER TABLE reviews DROP COLUMN customer_id;

ALTER TABLE customers DROP COLUMN referred_by;
ALTER TABLE customers DROP COLUMN last_visit_at;
ALTER TABLE customers DROP COLUMN first_visit_at;
ALTER TABLE customers DROP COLUMN consent_timestamp;
ALTER TABLE customers DROP COLUMN consent_analytics;
ALTER TABLE customers DROP COLUMN consent_marketing;
ALTER TABLE customers DROP COLUMN marketing_consent;
ALTER TABLE customers DROP COLUMN capture_source;
ALTER TABLE customers DROP COLUMN notes;

ALTER TABLE menu_items DROP COLUMN ingredient_source;
ALTER TABLE menu_items DROP COLUMN is_local_specialty;

ALTER TABLE cafe_tables DROP COLUMN created_at;


