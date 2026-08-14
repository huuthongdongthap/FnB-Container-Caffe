-- Orders Table Extensions — QR Table Ordering support
-- D1 compat: skip if columns already exist, otherwise add them
-- Created: 2026-07-08, Fixed: 2026-08-04
CREATE TABLE IF NOT EXISTS _skip_20260708_orders_ext (skip INTEGER);
INSERT OR IGNORE INTO _skip_20260708_orders_ext (skip)
SELECT 1
WHERE (SELECT COUNT(*) FROM pragma_table_info('orders') WHERE name='table_id') = 1
  AND (SELECT COUNT(*) FROM pragma_table_info('orders') WHERE name='customer_id') = 1
  AND (SELECT COUNT(*) FROM pragma_table_info('orders') WHERE name='order_source') = 1
  AND (SELECT COUNT(*) FROM pragma_table_info('orders') WHERE name='payment_url') = 1
  AND (SELECT COUNT(*) FROM pragma_table_info('orders') WHERE name='paid_at') = 1;
DELETE FROM _skip_20260708_orders_ext;
DROP TABLE IF EXISTS _skip_20260708_orders_ext;
