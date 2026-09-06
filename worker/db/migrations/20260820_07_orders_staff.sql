-- 20260820_07_orders_staff.sql
-- F&B Gap 3.5 — staff attribution for tips and order updates.
--
-- `updated_by` records which staff member last touched the order (used to
-- attribute tips to the server); it stores a users.id. One-shot: SQLite has
-- no ADD COLUMN IF NOT EXISTS, so this migration must only be applied once.

ALTER TABLE orders ADD COLUMN updated_by TEXT;
CREATE INDEX IF NOT EXISTS idx_orders_updated_by ON orders(updated_by);