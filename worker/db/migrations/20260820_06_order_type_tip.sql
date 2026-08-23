-- 20260820_06_order_type_tip.sql
-- F&B Gap 2.5/2.6 — order type unification + tip management.
--
-- A single order model now carries an `order_type` enum
-- (dine_in | takeaway | delivery) and a `tip_amount`. Type-specific
-- behaviour (delivery address, pickup time, table session linkage) is
-- carried in existing nullable columns rather than a separate table.

ALTER TABLE orders ADD COLUMN order_type TEXT DEFAULT 'dine_in';
ALTER TABLE orders ADD COLUMN tip_amount INTEGER DEFAULT 0;
ALTER TABLE orders ADD COLUMN service_fee INTEGER DEFAULT 0;

-- Default existing rows to dine_in (the legacy behaviour).
UPDATE orders SET order_type = 'dine_in' WHERE order_type IS NULL;

CREATE INDEX IF NOT EXISTS idx_orders_type ON orders(order_type);