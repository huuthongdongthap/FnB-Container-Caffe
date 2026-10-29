-- ============================================================
-- Rollback: 20261029_08_reservations_erpnext_and_openapi_v1_schema_cutover.down.sql
-- Purpose: Drop tables and indexes added in 20261029_08.
--          Columns added via ALTER TABLE ADD COLUMN are nullable/defaulted
--          and backward-compatible on SQLite/D1.
-- ============================================================

DROP INDEX IF EXISTS idx_cron_runs_job_started;
DROP TABLE IF EXISTS cron_runs;

DROP INDEX IF EXISTS idx_cron_jobs_active_status;
DROP TABLE IF EXISTS cron_jobs;

DROP TABLE IF EXISTS loyalty_tier_configs;

DROP INDEX IF EXISTS idx_loyalty_rewards_active;
DROP TABLE IF EXISTS loyalty_rewards;

DROP INDEX IF EXISTS idx_loyalty_transactions_account;
DROP INDEX IF EXISTS idx_loyalty_transactions_customer;
DROP TABLE IF EXISTS loyalty_transactions;

DROP INDEX IF EXISTS idx_promotion_usages_idempotency;
DROP INDEX IF EXISTS idx_purchase_order_items_po_id;

DROP INDEX IF EXISTS idx_trusted_devices_user;
DROP TABLE IF EXISTS trusted_devices;

DROP INDEX IF EXISTS idx_sessions_refresh_token;
DROP INDEX IF EXISTS idx_sessions_user_id;
DROP TABLE IF EXISTS sessions;

DROP INDEX IF EXISTS idx_email_verifications_token;
DROP INDEX IF EXISTS idx_erpnext_webhook_log_doctype;
DROP TABLE IF EXISTS erpnext_webhook_log;

DROP INDEX IF EXISTS idx_customers_sync_status;
DROP INDEX IF EXISTS idx_customers_erpnext_id;
DROP INDEX IF EXISTS idx_reservations_date_status;
DROP INDEX IF EXISTS idx_reservations_cal_booking_uid;

ALTER TABLE promotion_usages DROP COLUMN idempotency_key;

ALTER TABLE promotions DROP COLUMN updated_at;
ALTER TABLE promotions DROP COLUMN excluded_items;
ALTER TABLE promotions DROP COLUMN valid_to;
ALTER TABLE promotions DROP COLUMN valid_from;
ALTER TABLE promotions DROP COLUMN max_discount_value;
ALTER TABLE promotions DROP COLUMN min_order_value;
ALTER TABLE promotions DROP COLUMN used_count;
ALTER TABLE promotions DROP COLUMN current_uses;
ALTER TABLE promotions DROP COLUMN max_uses;
ALTER TABLE promotions DROP COLUMN discount_type;
ALTER TABLE promotions DROP COLUMN discount_value;
ALTER TABLE promotions DROP COLUMN description;

ALTER TABLE inventory_transactions DROP COLUMN performed_by;
ALTER TABLE inventory_transactions DROP COLUMN reason;
ALTER TABLE inventory_transactions DROP COLUMN unit_cost;
ALTER TABLE inventory_transactions DROP COLUMN new_stock;
ALTER TABLE inventory_transactions DROP COLUMN previous_stock;

ALTER TABLE inventory_items DROP COLUMN last_restocked_at;
ALTER TABLE inventory_items DROP COLUMN is_active;
ALTER TABLE inventory_items DROP COLUMN unit_cost;

ALTER TABLE purchase_order_items DROP COLUMN created_at;
ALTER TABLE purchase_order_items DROP COLUMN unit_cost;
ALTER TABLE purchase_order_items DROP COLUMN po_id;

ALTER TABLE purchase_orders DROP COLUMN received_date;
ALTER TABLE purchase_orders DROP COLUMN total_amount;
ALTER TABLE purchase_orders DROP COLUMN expected_date;

ALTER TABLE email_verifications DROP COLUMN verified_at;
ALTER TABLE email_verifications DROP COLUMN used;
ALTER TABLE email_verifications DROP COLUMN type;
ALTER TABLE email_verifications DROP COLUMN token;
ALTER TABLE email_verifications DROP COLUMN user_id;

ALTER TABLE users DROP COLUMN hire_date;
ALTER TABLE users DROP COLUMN avatar_url;
ALTER TABLE users DROP COLUMN email_verified;
ALTER TABLE users DROP COLUMN loyalty_points;
ALTER TABLE users DROP COLUMN loyalty_tier;
ALTER TABLE users DROP COLUMN locale;

ALTER TABLE customers DROP COLUMN referral_code;
ALTER TABLE customers DROP COLUMN erpnext_last_synced;
ALTER TABLE customers DROP COLUMN sync_status;
ALTER TABLE customers DROP COLUMN erpnext_id;
ALTER TABLE customers DROP COLUMN tax_id;

ALTER TABLE reservations DROP COLUMN special_requests;
ALTER TABLE reservations DROP COLUMN reservation_time;
ALTER TABLE reservations DROP COLUMN customer_email;
ALTER TABLE reservations DROP COLUMN cal_booking_uid;

ALTER TABLE cafe_tables DROP COLUMN qr_code;
ALTER TABLE cafe_tables DROP COLUMN capacity;
ALTER TABLE cafe_tables DROP COLUMN name;
