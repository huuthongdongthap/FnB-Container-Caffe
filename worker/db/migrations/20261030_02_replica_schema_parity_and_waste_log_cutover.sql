-- =============================================================================
-- Migration: 20261030_02_replica_schema_parity_and_waste_log_cutover.sql
-- Purpose: Converge incremental production D1 replica migrations to 100% 124-table
--          and column parity with worker/schema.sql and db/schema.sql.
-- =============================================================================

CREATE TABLE IF NOT EXISTS waste_log (
  id TEXT PRIMARY KEY,
  ingredient_id TEXT NOT NULL,
  quantity REAL NOT NULL,
  unit TEXT NOT NULL,
  reason TEXT NOT NULL,
  recorded_by TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_waste_log_item ON waste_log(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_waste_log_date ON waste_log(created_at);

-- 1. cafe_tables & menu_items
ALTER TABLE cafe_tables ADD COLUMN created_at TEXT;
ALTER TABLE menu_items ADD COLUMN is_local_specialty INTEGER DEFAULT 0;
ALTER TABLE menu_items ADD COLUMN ingredient_source TEXT;

-- 2. customers & reviews
ALTER TABLE customers ADD COLUMN notes TEXT;
ALTER TABLE customers ADD COLUMN capture_source TEXT;
ALTER TABLE customers ADD COLUMN marketing_consent INTEGER DEFAULT 0;
ALTER TABLE customers ADD COLUMN consent_marketing INTEGER DEFAULT 0;
ALTER TABLE customers ADD COLUMN consent_analytics INTEGER DEFAULT 0;
ALTER TABLE customers ADD COLUMN consent_timestamp TEXT;
ALTER TABLE customers ADD COLUMN first_visit_at TEXT;
ALTER TABLE customers ADD COLUMN last_visit_at TEXT;
ALTER TABLE customers ADD COLUMN referred_by TEXT;

ALTER TABLE reviews ADD COLUMN customer_id TEXT;
ALTER TABLE reviews ADD COLUMN is_approved INTEGER DEFAULT 1;
ALTER TABLE reviews ADD COLUMN is_visible INTEGER DEFAULT 1;
ALTER TABLE reviews ADD COLUMN updated_at TEXT;

-- 3. cashback, rewards, promotions & referrals
ALTER TABLE cashback_wallets ADD COLUMN lifetime_earned INTEGER DEFAULT 0;
ALTER TABLE cashback_wallets ADD COLUMN lifetime_spent INTEGER DEFAULT 0;
ALTER TABLE cashback_wallets ADD COLUMN tier TEXT DEFAULT 'Member';

ALTER TABLE cashback_transactions ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE rewards ADD COLUMN min_order INTEGER DEFAULT 0;
ALTER TABLE promotion_usages ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';

ALTER TABLE referral_codes ADD COLUMN max_uses INTEGER DEFAULT 50;
ALTER TABLE referral_codes ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';

ALTER TABLE referrals ADD COLUMN referee_id TEXT;
ALTER TABLE referrals ADD COLUMN referrer_reward INTEGER DEFAULT 10000;
ALTER TABLE referrals ADD COLUMN referee_reward INTEGER DEFAULT 5000;
ALTER TABLE referrals ADD COLUMN rewarded_at TEXT;

-- 4. staff_shifts, notification_audit_log, users & staff_login_identities
ALTER TABLE staff_shifts ADD COLUMN is_active INTEGER DEFAULT 1;
ALTER TABLE staff_shifts ADD COLUMN staff_email TEXT;
ALTER TABLE staff_shifts ADD COLUMN shift_type TEXT;

ALTER TABLE notification_audit_log ADD COLUMN latency_ms INTEGER DEFAULT 0;

ALTER TABLE users ADD COLUMN username TEXT;
ALTER TABLE users ADD COLUMN full_name TEXT;
ALTER TABLE users ADD COLUMN password_changed_at TEXT;
ALTER TABLE users ADD COLUMN tier TEXT DEFAULT 'Member';
ALTER TABLE users ADD COLUMN total_points INTEGER DEFAULT 0;

ALTER TABLE staff_login_identities ADD COLUMN created_at TEXT;
ALTER TABLE staff_login_identities ADD COLUMN updated_at TEXT;

-- 5. loyalty_accounts, tier_configs & loyalty_redemptions
ALTER TABLE loyalty_accounts ADD COLUMN points_balance INTEGER DEFAULT 0;
ALTER TABLE loyalty_accounts ADD COLUMN tier_expires_at TEXT;
ALTER TABLE loyalty_accounts ADD COLUMN streak_days INTEGER DEFAULT 0;
ALTER TABLE loyalty_accounts ADD COLUMN last_checkin_date TEXT;
ALTER TABLE loyalty_accounts ADD COLUMN total_orders INTEGER DEFAULT 0;
ALTER TABLE loyalty_accounts ADD COLUMN referral_code TEXT;
ALTER TABLE loyalty_accounts ADD COLUMN referred_by TEXT;

ALTER TABLE tier_configs ADD COLUMN multiplier REAL NOT NULL DEFAULT 1.0;
ALTER TABLE tier_configs ADD COLUMN birthday_discount INTEGER DEFAULT 0;
ALTER TABLE tier_configs ADD COLUMN benefits TEXT DEFAULT '[]';
ALTER TABLE tier_configs ADD COLUMN display_name_vi TEXT;
ALTER TABLE tier_configs ADD COLUMN min_spent_vnd INTEGER NOT NULL DEFAULT 0;
ALTER TABLE tier_configs ADD COLUMN max_spent_vnd INTEGER;

ALTER TABLE loyalty_redemptions ADD COLUMN voucher_code TEXT;
ALTER TABLE loyalty_redemptions ADD COLUMN used_at TEXT;

-- 6. recipe_ingredients & payment_transactions
ALTER TABLE recipe_ingredients ADD COLUMN waste_percentage REAL DEFAULT 0;
ALTER TABLE recipe_ingredients ADD COLUMN notes TEXT;

ALTER TABLE payment_transactions ADD COLUMN currency TEXT DEFAULT 'VND';
ALTER TABLE payment_transactions ADD COLUMN transaction_ref TEXT;
ALTER TABLE payment_transactions ADD COLUMN gateway_response TEXT;

-- 7. Backfill newly added parity columns on loyalty_accounts & tier_configs
UPDATE loyalty_accounts
SET points_balance = COALESCE(current_points, 0),
    referral_code = COALESCE(
      referral_code,
      (SELECT c.referral_code FROM customers c WHERE c.id = loyalty_accounts.customer_id)
    ),
    referred_by = COALESCE(
      referred_by,
      (SELECT c.referred_by FROM customers c WHERE c.id = loyalty_accounts.customer_id)
    );

UPDATE tier_configs
SET multiplier = COALESCE(points_multiplier, 1.0),
    benefits = COALESCE(perks, '[]'),
    display_name_vi = COALESCE(display_name_vi, tier_name);
