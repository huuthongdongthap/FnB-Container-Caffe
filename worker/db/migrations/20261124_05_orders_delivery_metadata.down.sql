-- =============================================================================
-- Rollback: 20261124_05_orders_delivery_metadata.down.sql
-- Purpose: Reverse delivery metadata column additions on orders.
-- =============================================================================

ALTER TABLE orders DROP COLUMN failure_reason;
ALTER TABLE orders DROP COLUMN shipper_name;
ALTER TABLE orders DROP COLUMN assigned_shipper_id;
