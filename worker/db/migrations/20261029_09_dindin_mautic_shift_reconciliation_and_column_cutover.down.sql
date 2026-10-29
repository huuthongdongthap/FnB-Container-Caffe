-- =============================================================================
-- Rollback: 20261029_09_dindin_mautic_shift_reconciliation_and_column_cutover.down.sql
-- Purpose: Revert tables and indexes created in 20261029_09 while preserving
--          canonical existing tables (sessions, trusted_devices, cron_runs,
--          categories, stock_movements, order_items, table_sessions,
--          promotion_redemptions, notification_audit_log).
-- =============================================================================

DROP INDEX IF EXISTS idx_pretix_webhook_log_code;
DROP TABLE IF EXISTS pretix_webhook_log;

DROP INDEX IF EXISTS idx_expenses_date;
DROP TABLE IF EXISTS expenses;

DROP INDEX IF EXISTS idx_cash_payouts_shift_id;
DROP TABLE IF EXISTS cash_payouts;

DROP INDEX IF EXISTS idx_shift_reconciliations_shift_id;
DROP TABLE IF EXISTS shift_reconciliations;

DROP INDEX IF EXISTS idx_campaign_enrollments_customer_type;
DROP TABLE IF EXISTS campaign_enrollments;

DROP INDEX IF EXISTS idx_dindin_cart_updated_at;
DROP TABLE IF EXISTS dindin_cart;

DROP TABLE IF EXISTS dindin_config;

DROP INDEX IF EXISTS idx_trusted_devices_user_fingerprint;
DROP INDEX IF EXISTS idx_sessions_refresh_token_value;
DROP INDEX IF EXISTS idx_sessions_access_token;

ALTER TABLE notification_audit_log DROP COLUMN sent_at;
ALTER TABLE notification_audit_log DROP COLUMN retry_count;
ALTER TABLE notification_audit_log DROP COLUMN error_message;
ALTER TABLE notification_audit_log DROP COLUMN error;
ALTER TABLE notification_audit_log DROP COLUMN provider_response;
ALTER TABLE notification_audit_log DROP COLUMN payload;
ALTER TABLE notification_audit_log DROP COLUMN message_type;
ALTER TABLE notification_audit_log DROP COLUMN template_id;
ALTER TABLE notification_audit_log DROP COLUMN template;
ALTER TABLE notification_audit_log DROP COLUMN recipient;
ALTER TABLE notification_audit_log DROP COLUMN order_id;

ALTER TABLE promotion_redemptions DROP COLUMN created_at;

ALTER TABLE table_sessions DROP COLUMN ended_at;
ALTER TABLE table_sessions DROP COLUMN started_at;
ALTER TABLE table_sessions DROP COLUMN current_order_id;
ALTER TABLE table_sessions DROP COLUMN order_id;

ALTER TABLE order_items DROP COLUMN updated_at;
ALTER TABLE order_items DROP COLUMN status;

ALTER TABLE categories DROP COLUMN location_id;
ALTER TABLE categories DROP COLUMN is_active;

ALTER TABLE staff_shifts DROP COLUMN updated_at;
ALTER TABLE staff_shifts DROP COLUMN order_count;
ALTER TABLE staff_shifts DROP COLUMN online_sales;
ALTER TABLE staff_shifts DROP COLUMN cash_sales;
ALTER TABLE staff_shifts DROP COLUMN total_sales;
ALTER TABLE staff_shifts DROP COLUMN cash_variance;
ALTER TABLE staff_shifts DROP COLUMN actual_cash;
ALTER TABLE staff_shifts DROP COLUMN expected_cash;
ALTER TABLE staff_shifts DROP COLUMN opening_cash;
ALTER TABLE staff_shifts DROP COLUMN status;
ALTER TABLE staff_shifts DROP COLUMN operating_unit_id;

ALTER TABLE cron_runs DROP COLUMN payload;

ALTER TABLE trusted_devices DROP COLUMN expires_at;
ALTER TABLE trusted_devices DROP COLUMN created_at;
ALTER TABLE trusted_devices DROP COLUMN is_trusted;
ALTER TABLE trusted_devices DROP COLUMN ip;
ALTER TABLE trusted_devices DROP COLUMN browser;
ALTER TABLE trusted_devices DROP COLUMN platform;
ALTER TABLE trusted_devices DROP COLUMN name;
ALTER TABLE trusted_devices DROP COLUMN fingerprint;

ALTER TABLE sessions DROP COLUMN updated_at;
ALTER TABLE sessions DROP COLUMN last_used_at;
ALTER TABLE sessions DROP COLUMN device_name;
ALTER TABLE sessions DROP COLUMN device_fingerprint;
ALTER TABLE sessions DROP COLUMN is_trusted_device;
ALTER TABLE sessions DROP COLUMN refresh_token;
ALTER TABLE sessions DROP COLUMN access_token;
