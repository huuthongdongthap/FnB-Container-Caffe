-- ============================================================================
-- Migration: 20261029_10_crm_campaigns_table_zones_and_audit_column_cutover.sql
-- Purpose:
--   Reconcile remaining table and column contracts between live D1
--   (`fnb-caffe-db`) and Worker + domain handlers across:
--     1. OpenAPI Table Zones (`table_zones`) and canonical `cafe_tables`
--        floor-plan layout / dimension / zone columns
--     2. Customer tier and birthday columns (`customers.tier`, `customers.birthday`)
--     3. Order lifecycle, KDS, and CRM columns (`orders.order_number`, `channel`,
--        `source`, `tax_amount`, `happy_hour_applied`, `total_cents`,
--        `placed_at`, `served_at`, `completed_at`, `cancelled_at`)
--     4. Campaign logs dual-column contract (`campaign_logs.trigger_type`,
--        `error_message`, `created_at`)
--     5. CRM consents, customer identities, loyalty point logs, audit logs,
--        and product availability columns
-- ============================================================================

-- 1. OpenAPI Table Zones (`table_zones`)
CREATE TABLE IF NOT EXISTS table_zones (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  location_id TEXT DEFAULT 'default',
  tenant_id TEXT DEFAULT 'default',
  metadata TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_table_zones_slug_location
  ON table_zones(slug, location_id);

INSERT OR IGNORE INTO table_zones (id, slug, name, description, sort_order, is_active, location_id, tenant_id, metadata)
VALUES
  ('indoor', 'indoor', 'Indoor', 'Khu vực trong nhà', 1, 1, 'default', 'default', '{}'),
  ('outdoor', 'outdoor', 'Outdoor', 'Khu vực sân vườn / ngoài trời', 2, 1, 'default', 'default', '{}'),
  ('rooftop', 'rooftop', 'Rooftop', 'Khu vực sân thượng', 3, 1, 'default', 'default', '{}'),
  ('vip', 'vip', 'VIP', 'Phòng riêng / VIP', 4, 1, 'default', 'default', '{}');

-- 2. Canonical `cafe_tables` OpenAPI layout & metadata columns
ALTER TABLE cafe_tables ADD COLUMN code TEXT;
ALTER TABLE cafe_tables ADD COLUMN zone_id TEXT;
ALTER TABLE cafe_tables ADD COLUMN min_capacity INTEGER DEFAULT 1;
ALTER TABLE cafe_tables ADD COLUMN shape TEXT DEFAULT 'square';
ALTER TABLE cafe_tables ADD COLUMN position_x REAL DEFAULT 0;
ALTER TABLE cafe_tables ADD COLUMN position_y REAL DEFAULT 0;
ALTER TABLE cafe_tables ADD COLUMN width REAL DEFAULT 80;
ALTER TABLE cafe_tables ADD COLUMN height REAL DEFAULT 80;
ALTER TABLE cafe_tables ADD COLUMN rotation REAL DEFAULT 0;
ALTER TABLE cafe_tables ADD COLUMN sort_order INTEGER DEFAULT 0;
ALTER TABLE cafe_tables ADD COLUMN is_active INTEGER DEFAULT 1;
ALTER TABLE cafe_tables ADD COLUMN location_id TEXT DEFAULT 'default';
ALTER TABLE cafe_tables ADD COLUMN current_session_id TEXT;
ALTER TABLE cafe_tables ADD COLUMN metadata TEXT DEFAULT '{}';

UPDATE cafe_tables
SET code = COALESCE(code, 'T' || printf('%02d', CAST(table_number AS INTEGER))),
    zone_id = COALESCE(zone_id, LOWER(zone), 'indoor'),
    sort_order = COALESCE(sort_order, CAST(table_number AS INTEGER), 0),
    is_active = COALESCE(is_active, 1),
    location_id = COALESCE(location_id, 'default'),
    metadata = COALESCE(metadata, '{}');

CREATE INDEX IF NOT EXISTS idx_cafe_tables_zone_id
  ON cafe_tables(zone_id);
CREATE INDEX IF NOT EXISTS idx_cafe_tables_code_location
  ON cafe_tables(code, location_id);

-- 3. Customer tier & birthday columns (`customers`)
ALTER TABLE customers ADD COLUMN tier TEXT DEFAULT 'bronze';
ALTER TABLE customers ADD COLUMN birthday TEXT;

UPDATE customers
SET tier = COALESCE(NULLIF(loyalty_tier, ''), NULLIF(tier, ''), 'bronze'),
    birthday = COALESCE(birthday, date_of_birth);

CREATE INDEX IF NOT EXISTS idx_customers_tier
  ON customers(tier);

-- 4. Order lifecycle, KDS, and CRM columns (`orders`)
ALTER TABLE orders ADD COLUMN order_number TEXT;
ALTER TABLE orders ADD COLUMN channel TEXT DEFAULT 'dine_in';
ALTER TABLE orders ADD COLUMN source TEXT DEFAULT 'pos';
ALTER TABLE orders ADD COLUMN tax_amount REAL DEFAULT 0;
ALTER TABLE orders ADD COLUMN happy_hour_applied INTEGER DEFAULT 0;
ALTER TABLE orders ADD COLUMN total_cents INTEGER DEFAULT 0;
ALTER TABLE orders ADD COLUMN placed_at TEXT;
ALTER TABLE orders ADD COLUMN served_at TEXT;
ALTER TABLE orders ADD COLUMN completed_at TEXT;
ALTER TABLE orders ADD COLUMN cancelled_at TEXT;

UPDATE orders
SET order_number = COALESCE(order_number, id),
    channel = COALESCE(channel, order_type, 'dine_in'),
    source = COALESCE(source, order_type, 'pos'),
    tax_amount = COALESCE(tax_amount, tax, 0),
    total_cents = CASE WHEN COALESCE(total_cents, 0) = 0 THEN CAST(COALESCE(total, total_amount, 0) AS INTEGER) ELSE total_cents END,
    placed_at = COALESCE(placed_at, created_at);

CREATE INDEX IF NOT EXISTS idx_orders_order_number
  ON orders(order_number);

-- 5. Campaign logs dual-column contract (`campaign_logs`)
ALTER TABLE campaign_logs ADD COLUMN trigger_type TEXT;
ALTER TABLE campaign_logs ADD COLUMN error_message TEXT;
ALTER TABLE campaign_logs ADD COLUMN created_at TEXT;

UPDATE campaign_logs
SET trigger_type = COALESCE(trigger_type, trigger),
    error_message = COALESCE(error_message, error),
    created_at = COALESCE(created_at, sent_at, datetime('now'));

CREATE INDEX IF NOT EXISTS idx_campaign_logs_trigger_type
  ON campaign_logs(customer_id, trigger_type, created_at);

-- 6. CRM consents, customer identities, loyalty point logs, audit logs & products
ALTER TABLE consents ADD COLUMN updated_at TEXT;
ALTER TABLE consents ADD COLUMN created_by TEXT;

UPDATE consents
SET updated_at = COALESCE(updated_at, revoked_at, granted_at, created_at);

ALTER TABLE customer_identities ADD COLUMN type TEXT;
ALTER TABLE customer_identities ADD COLUMN value TEXT;

UPDATE customer_identities
SET type = COALESCE(type, identifier_type),
    value = COALESCE(value, identifier_value);

CREATE INDEX IF NOT EXISTS idx_customer_identities_type_value
  ON customer_identities(type, value);

ALTER TABLE loyalty_point_logs ADD COLUMN points INTEGER DEFAULT 0;

UPDATE loyalty_point_logs
SET points = COALESCE(points_change, 0)
WHERE points IS NULL OR points = 0;

ALTER TABLE audit_logs ADD COLUMN actor TEXT;
ALTER TABLE audit_logs ADD COLUMN resource TEXT;
ALTER TABLE audit_logs ADD COLUMN ip TEXT;

UPDATE audit_logs
SET actor = COALESCE(actor, actor_id),
    resource = COALESCE(resource, resource_type),
    ip = COALESCE(ip, ip_address);

ALTER TABLE products ADD COLUMN available INTEGER DEFAULT 1;

UPDATE products
SET available = COALESCE(is_available, 1)
WHERE available IS NULL;
