-- =============================================================================
-- Rollback: 20261124_01_orders_kds_prep_timestamps.down.sql
-- Purpose: Reverse started_at and ready_at column additions on orders.
-- =============================================================================

ALTER TABLE orders DROP COLUMN ready_at;
ALTER TABLE orders DROP COLUMN started_at;
