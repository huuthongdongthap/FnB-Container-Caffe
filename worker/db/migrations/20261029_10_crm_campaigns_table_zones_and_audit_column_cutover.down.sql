-- ============================================================================
-- Down Migration: 20261029_10_crm_campaigns_table_zones_and_audit_column_cutover.down.sql
-- Purpose:
--   Reverse additive table and index creations from 20261029_10.
--   Added nullable/defaulted columns on existing tables remain backward-compatible.
-- ============================================================================

DROP INDEX IF EXISTS idx_customer_identities_type_value;
DROP INDEX IF EXISTS idx_campaign_logs_trigger_type;
DROP INDEX IF EXISTS idx_orders_order_number;
DROP INDEX IF EXISTS idx_customers_tier;
DROP INDEX IF EXISTS idx_cafe_tables_code_location;
DROP INDEX IF EXISTS idx_cafe_tables_zone_id;
DROP INDEX IF EXISTS idx_table_zones_slug_location;
DROP TABLE IF EXISTS table_zones;

ALTER TABLE products DROP COLUMN available;

ALTER TABLE audit_logs DROP COLUMN ip;
ALTER TABLE audit_logs DROP COLUMN resource;
ALTER TABLE audit_logs DROP COLUMN actor;

ALTER TABLE loyalty_point_logs DROP COLUMN points;

ALTER TABLE customer_identities DROP COLUMN value;
ALTER TABLE customer_identities DROP COLUMN type;

ALTER TABLE consents DROP COLUMN created_by;
ALTER TABLE consents DROP COLUMN updated_at;

ALTER TABLE campaign_logs DROP COLUMN created_at;
ALTER TABLE campaign_logs DROP COLUMN error_message;
ALTER TABLE campaign_logs DROP COLUMN trigger_type;

ALTER TABLE orders DROP COLUMN cancelled_at;
ALTER TABLE orders DROP COLUMN completed_at;
ALTER TABLE orders DROP COLUMN served_at;
ALTER TABLE orders DROP COLUMN placed_at;
ALTER TABLE orders DROP COLUMN total_cents;
ALTER TABLE orders DROP COLUMN happy_hour_applied;
ALTER TABLE orders DROP COLUMN tax_amount;
ALTER TABLE orders DROP COLUMN source;
ALTER TABLE orders DROP COLUMN channel;
ALTER TABLE orders DROP COLUMN order_number;

ALTER TABLE customers DROP COLUMN birthday;
ALTER TABLE customers DROP COLUMN tier;

ALTER TABLE cafe_tables DROP COLUMN metadata;
ALTER TABLE cafe_tables DROP COLUMN current_session_id;
ALTER TABLE cafe_tables DROP COLUMN location_id;
ALTER TABLE cafe_tables DROP COLUMN is_active;
ALTER TABLE cafe_tables DROP COLUMN sort_order;
ALTER TABLE cafe_tables DROP COLUMN rotation;
ALTER TABLE cafe_tables DROP COLUMN height;
ALTER TABLE cafe_tables DROP COLUMN width;
ALTER TABLE cafe_tables DROP COLUMN position_y;
ALTER TABLE cafe_tables DROP COLUMN position_x;
ALTER TABLE cafe_tables DROP COLUMN shape;
ALTER TABLE cafe_tables DROP COLUMN min_capacity;
ALTER TABLE cafe_tables DROP COLUMN zone_id;
ALTER TABLE cafe_tables DROP COLUMN code;
