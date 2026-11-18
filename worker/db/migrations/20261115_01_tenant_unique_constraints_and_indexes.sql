-- =============================================================================
-- Migration: 20261115_01_tenant_unique_constraints_and_indexes.sql
-- Purpose: Add migration ledger, canonical OTP challenge table, tenant-scoped
--          columns across operational/audit tables, and partial unique indexes
--          enforcing idempotent settlement, promo/loyalty dedup, BOM order
--          dedup, and single active table reservation per time slot.
-- =============================================================================

CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  checksum TEXT NOT NULL,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS otp_challenges (
  challenge_key TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  phone TEXT NOT NULL,
  code TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Additive tenant, session, consent, payment reference, and guest token columns
ALTER TABLE staff_devices ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE payments ADD COLUMN provider_reference TEXT;
ALTER TABLE loyalty_transactions ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE loyalty_point_logs ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE inventory_transactions ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE stock_movements ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE waste_log ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE waste_log ADD COLUMN order_id TEXT;
ALTER TABLE waste_log ADD COLUMN item_id TEXT;
ALTER TABLE erpnext_mappings ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE consents ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE consents ADD COLUMN channel TEXT NOT NULL DEFAULT 'all';
ALTER TABLE customers ADD COLUMN auth_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE customers ADD COLUMN anonymized_at TEXT;
ALTER TABLE orders ADD COLUMN guest_token_hash TEXT;
ALTER TABLE orders ADD COLUMN session_id TEXT;
ALTER TABLE sessions ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE sessions ADD COLUMN revoked_at TEXT;
ALTER TABLE table_sessions ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';

-- Partial unique constraints for concurrent idempotency and slot serialization
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_provider_ref_uniq ON payments(tenant_id, provider_reference) WHERE provider_reference IS NOT NULL AND provider_reference != '';
CREATE UNIQUE INDEX IF NOT EXISTS idx_promotion_usages_idempotency_uniq ON promotion_usages(tenant_id, idempotency_key) WHERE idempotency_key IS NOT NULL AND idempotency_key != '';
CREATE UNIQUE INDEX IF NOT EXISTS idx_loyalty_tx_idempotency_uniq ON loyalty_transactions(tenant_id, idempotency_key) WHERE idempotency_key IS NOT NULL AND idempotency_key != '';
CREATE UNIQUE INDEX IF NOT EXISTS idx_inv_tx_order_item_dedup ON inventory_transactions(tenant_id, reference_type, reference_id, item_id, type) WHERE reference_type = 'order' AND reference_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_reservations_active_slot ON reservations(tenant_id, table_id, date, time) WHERE date IS NOT NULL AND time IS NOT NULL AND status IN ('pending', 'confirmed', 'approved', 'seated');
CREATE UNIQUE INDEX IF NOT EXISTS idx_reservations_active_v1_slot ON reservations(tenant_id, table_id, reservation_date, reservation_time) WHERE reservation_date IS NOT NULL AND reservation_time IS NOT NULL AND status IN ('pending', 'confirmed', 'approved', 'seated');

-- Composite tenant B-tree indexes for hot read/write paths
CREATE INDEX IF NOT EXISTS idx_staff_devices_tenant_staff ON staff_devices(tenant_id, staff_id, is_active);
CREATE INDEX IF NOT EXISTS idx_otp_challenges_tenant_phone ON otp_challenges(tenant_id, phone, expires_at);
CREATE INDEX IF NOT EXISTS idx_payments_tenant_order_status ON payments(tenant_id, order_id, status);
CREATE INDEX IF NOT EXISTS idx_inv_tx_tenant_ref ON inventory_transactions(tenant_id, reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_tenant_ing ON stock_movements(tenant_id, ingredient_id, created_at);
CREATE INDEX IF NOT EXISTS idx_loyalty_tx_tenant_cust ON loyalty_transactions(tenant_id, customer_id, created_at);
CREATE INDEX IF NOT EXISTS idx_loyalty_logs_tenant_cust ON loyalty_point_logs(tenant_id, customer_id, created_at);
CREATE INDEX IF NOT EXISTS idx_consents_tenant_cust_channel ON consents(tenant_id, customer_id, purpose, channel);
CREATE INDEX IF NOT EXISTS idx_erpnext_mappings_tenant_order ON erpnext_mappings(tenant_id, aura_order_id, sync_status);
CREATE INDEX IF NOT EXISTS idx_waste_log_tenant_order ON waste_log(tenant_id, order_id, created_at);
CREATE INDEX IF NOT EXISTS idx_cafe_tables_status ON cafe_tables(status);
CREATE INDEX IF NOT EXISTS idx_cafe_tables_zone ON cafe_tables(zone);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_table ON orders(table_id);
CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_transaction_id ON payments(transaction_id);
CREATE INDEX IF NOT EXISTS idx_promo_active ON promotions(is_active);
CREATE INDEX IF NOT EXISTS idx_promo_tenant ON promotions(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_shifts_open ON staff_shifts(clock_out);
CREATE INDEX IF NOT EXISTS idx_shifts_staff ON staff_shifts(staff_email);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_table_sessions_tenant_status ON table_sessions(tenant_id, table_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_tenant_session ON orders(tenant_id, session_id);
