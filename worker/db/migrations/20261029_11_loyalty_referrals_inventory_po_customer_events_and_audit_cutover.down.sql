-- =============================================================================
-- Rollback: 20261029_11_loyalty_referrals_inventory_po_customer_events_and_audit_cutover.down.sql
-- =============================================================================

-- 7. SOP Checklists, ERPNext Queue, Notifications & Edge Integrations
DROP TABLE IF EXISTS wifi_sessions;
DROP TABLE IF EXISTS frigate_events;
DROP TABLE IF EXISTS ti_menu_cache;
DROP TABLE IF EXISTS ti_order_bridge;
DROP TABLE IF EXISTS ha_automation_log;
DROP TABLE IF EXISTS ha_device_states;
DROP TABLE IF EXISTS customer_support_interactions;
DROP TABLE IF EXISTS container_telemetry_logs;
DROP TABLE IF EXISTS dynamic_pricing_rules;
DROP TABLE IF EXISTS ai_barista_interactions;
DROP TABLE IF EXISTS ai_product_affinities;
DROP TABLE IF EXISTS client_errors;

DROP INDEX IF EXISTS idx_notifications_user_read;
DROP TABLE IF EXISTS notifications;

ALTER TABLE erpnext_mappings DROP COLUMN erpnext_invoice_id;
ALTER TABLE erpnext_mappings DROP COLUMN aura_order_id;

DROP TABLE IF EXISTS erpnext_sync_queue;
DROP TABLE IF EXISTS sop_run_items;
DROP TABLE IF EXISTS sop_runs;
DROP TABLE IF EXISTS sop_template_items;
DROP TABLE IF EXISTS sop_templates;

-- 6. Auth Email Verifications, Staff Devices & Canonical Audit Logs Columns
DROP INDEX IF EXISTS idx_staff_devices_staff_id;
DROP INDEX IF EXISTS idx_staff_devices_token;
ALTER TABLE staff_devices DROP COLUMN is_active;
DROP TABLE IF EXISTS staff_devices;

DROP INDEX IF EXISTS idx_email_verifications_id;
ALTER TABLE email_verifications DROP COLUMN verified;
ALTER TABLE email_verifications DROP COLUMN attempts;

-- 5. Reservations, Catalog & Payments Alignment
DROP TABLE IF EXISTS payment_reconciliation_jobs;
DROP INDEX IF EXISTS idx_payment_transactions_order_id;
DROP TABLE IF EXISTS payment_transactions;

ALTER TABLE payments DROP COLUMN payment_method;
ALTER TABLE menu_items DROP COLUMN sort_order;
ALTER TABLE menu_items DROP COLUMN name_en;
ALTER TABLE products DROP COLUMN category;
ALTER TABLE cafe_tables DROP COLUMN current_order_id;

DROP INDEX IF EXISTS idx_reservations_table_date_time;
ALTER TABLE reservations DROP COLUMN reservation_date;
ALTER TABLE reservations DROP COLUMN pax;
ALTER TABLE reservations DROP COLUMN phone;

-- 4. Inventory, BOM, Purchase Orders, Snapshots & Forecasting
DROP INDEX IF EXISTS idx_inventory_forecast_snapshots_tenant;
ALTER TABLE inventory_forecast_snapshots DROP COLUMN ai_summary;
DROP TABLE IF EXISTS inventory_forecast_snapshots;

DROP INDEX IF EXISTS idx_inventory_snapshots_item_date;
ALTER TABLE inventory_snapshots DROP COLUMN created_at;
DROP TABLE IF EXISTS inventory_snapshots;

DROP INDEX IF EXISTS idx_recipe_ingredients_ingredient;
DROP TABLE IF EXISTS recipe_ingredients;

ALTER TABLE recipes DROP COLUMN quantity;
ALTER TABLE recipes DROP COLUMN ingredient_id;
ALTER TABLE recipes DROP COLUMN item_id;

ALTER TABLE purchase_orders DROP COLUMN received_by;
ALTER TABLE purchase_orders DROP COLUMN approved_by;
ALTER TABLE purchase_orders DROP COLUMN received_at;
ALTER TABLE purchase_orders DROP COLUMN expected_delivery;
ALTER TABLE purchase_orders DROP COLUMN total_cost;

DROP INDEX IF EXISTS idx_inventory_transactions_ref;
ALTER TABLE inventory_transactions DROP COLUMN staff_id;
ALTER TABLE inventory_transactions DROP COLUMN inventory_item_id;

-- 3. Customer 360 Event Sourcing & Visits
DROP INDEX IF EXISTS idx_visits_order_id;
DROP INDEX IF EXISTS idx_visits_customer_visited;
ALTER TABLE visits DROP COLUMN points_earned;
ALTER TABLE visits DROP COLUMN amount;
ALTER TABLE visits DROP COLUMN table_id;
DROP TABLE IF EXISTS visits;

DROP INDEX IF EXISTS idx_customer_events_customer_recorded;
DROP TABLE IF EXISTS customer_events;

-- 2. Referrals & Promotions Column Alignment
ALTER TABLE promotions DROP COLUMN end_date;
ALTER TABLE promotions DROP COLUMN start_date;

ALTER TABLE promotion_usages DROP COLUMN used_at;

DROP INDEX IF EXISTS idx_referral_codes_id;
ALTER TABLE referral_codes DROP COLUMN uses_count;

-- 1. Loyalty Accounts, Tiers, Rewards, Redemptions, Check-ins & Cashback
DROP INDEX IF EXISTS idx_checkins_customer_date;
ALTER TABLE checkins DROP COLUMN tenant_id;
ALTER TABLE checkins DROP COLUMN points_earned;
ALTER TABLE checkins DROP COLUMN streak;
DROP TABLE IF EXISTS checkins;

DROP INDEX IF EXISTS idx_loyalty_redemptions_customer;
DROP TABLE IF EXISTS loyalty_redemptions;

DROP INDEX IF EXISTS idx_user_rewards_customer;
ALTER TABLE user_rewards DROP COLUMN redeemed_at;
DROP TABLE IF EXISTS user_rewards;

ALTER TABLE rewards DROP COLUMN updated_at;
ALTER TABLE rewards DROP COLUMN image_url;
ALTER TABLE rewards DROP COLUMN stock;
ALTER TABLE rewards DROP COLUMN is_active;
ALTER TABLE rewards DROP COLUMN min_tier;
ALTER TABLE rewards DROP COLUMN reward_value;
ALTER TABLE rewards DROP COLUMN reward_type;
ALTER TABLE rewards DROP COLUMN value;
ALTER TABLE rewards DROP COLUMN type;
ALTER TABLE rewards DROP COLUMN points_cost;
ALTER TABLE rewards DROP COLUMN description;
ALTER TABLE rewards DROP COLUMN name;
DROP TABLE IF EXISTS rewards;

DROP TABLE IF EXISTS tier_configs;

ALTER TABLE loyalty_tiers DROP COLUMN updated_at;
ALTER TABLE loyalty_tiers DROP COLUMN color;
ALTER TABLE loyalty_tiers DROP COLUMN perks;
ALTER TABLE loyalty_tiers DROP COLUMN points_multiplier;
DROP TABLE IF EXISTS loyalty_tiers;

DROP INDEX IF EXISTS idx_loyalty_accounts_customer;
DROP TABLE IF EXISTS loyalty_accounts;
