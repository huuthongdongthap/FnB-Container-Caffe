-- =============================================================================
-- Migration: 20261124_05_orders_delivery_metadata.sql
-- Purpose: Persist delivery assignment and failure reason metadata on orders
--          during delivering / failed status transitions.
-- =============================================================================

ALTER TABLE orders ADD COLUMN assigned_shipper_id TEXT;
ALTER TABLE orders ADD COLUMN shipper_name TEXT;
ALTER TABLE orders ADD COLUMN failure_reason TEXT;
