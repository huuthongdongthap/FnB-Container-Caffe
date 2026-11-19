-- =============================================================================
-- Rollback: 20261115_01_tenant_unique_constraints_and_indexes.down.sql
-- Purpose: Reverse additive tables, columns, and indexes from 20261115_01.
-- =============================================================================

DROP INDEX IF EXISTS idx_orders_tenant_session;
DROP INDEX IF EXISTS idx_table_sessions_tenant_status;
DROP INDEX IF EXISTS idx_users_phone;
DROP INDEX IF EXISTS idx_shifts_staff;
DROP INDEX IF EXISTS idx_shifts_open;
DROP INDEX IF EXISTS idx_promo_tenant;
DROP INDEX IF EXISTS idx_promo_active;
DROP INDEX IF EXISTS idx_payments_transaction_id;
DROP INDEX IF EXISTS idx_payments_order;
DROP INDEX IF EXISTS idx_orders_table;
DROP INDEX IF EXISTS idx_orders_created;
DROP INDEX IF EXISTS idx_cafe_tables_zone;
DROP INDEX IF EXISTS idx_cafe_tables_status;
DROP INDEX IF EXISTS idx_waste_log_tenant_order;
DROP INDEX IF EXISTS idx_erpnext_mappings_tenant_order;
DROP INDEX IF EXISTS idx_consents_tenant_cust_channel;
DROP INDEX IF EXISTS idx_loyalty_logs_tenant_cust;
DROP INDEX IF EXISTS idx_loyalty_tx_tenant_cust;
DROP INDEX IF EXISTS idx_stock_movements_tenant_ing;
DROP INDEX IF EXISTS idx_inv_tx_tenant_ref;
DROP INDEX IF EXISTS idx_payments_tenant_order_status;
DROP INDEX IF EXISTS idx_otp_challenges_tenant_phone;
DROP INDEX IF EXISTS idx_staff_devices_tenant_staff;
DROP INDEX IF EXISTS idx_reservations_active_v1_slot;
DROP INDEX IF EXISTS idx_reservations_active_slot;
DROP INDEX IF EXISTS idx_inv_tx_order_item_dedup;
DROP INDEX IF EXISTS idx_loyalty_tx_idempotency_uniq;
DROP INDEX IF EXISTS idx_promotion_usages_idempotency_uniq;
DROP INDEX IF EXISTS idx_payments_provider_ref_uniq;

ALTER TABLE table_sessions DROP COLUMN tenant_id;
ALTER TABLE sessions DROP COLUMN revoked_at;
ALTER TABLE sessions DROP COLUMN tenant_id;
ALTER TABLE orders DROP COLUMN session_id;
ALTER TABLE orders DROP COLUMN guest_token_hash;
ALTER TABLE customers DROP COLUMN anonymized_at;
ALTER TABLE customers DROP COLUMN auth_version;
ALTER TABLE consents DROP COLUMN channel;
ALTER TABLE consents DROP COLUMN tenant_id;
ALTER TABLE erpnext_mappings DROP COLUMN tenant_id;
ALTER TABLE waste_log DROP COLUMN item_id;
ALTER TABLE waste_log DROP COLUMN order_id;
ALTER TABLE waste_log DROP COLUMN tenant_id;
ALTER TABLE stock_movements DROP COLUMN tenant_id;
ALTER TABLE inventory_transactions DROP COLUMN tenant_id;
ALTER TABLE loyalty_point_logs DROP COLUMN tenant_id;
ALTER TABLE loyalty_transactions DROP COLUMN tenant_id;
ALTER TABLE payments DROP COLUMN provider_reference;
ALTER TABLE staff_devices DROP COLUMN tenant_id;

DROP TABLE IF EXISTS otp_challenges;
DROP TABLE IF EXISTS schema_migrations;
