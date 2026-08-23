-- 20260820_07_orders_staff.sql
-- F&B Gap 3.5 — staff attribution for tips and order updates.
--
-- `updated_by` records which staff member last touched the order (used to
-- attribute tips to the server). Idempotent: ALTER TABLE ADD COLUMN IF NOT
-- EXISTS is supported by SQLite 3.35+ (D1 ships with a recent SQLite).

ALTER TABLE orders ADD COLUMN updated_by TEXT;
CREATE INDEX IF NOT EXISTS idx_orders_updated_by ON orders(updated_by);