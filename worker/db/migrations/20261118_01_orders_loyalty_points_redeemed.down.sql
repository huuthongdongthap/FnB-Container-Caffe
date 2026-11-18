-- =============================================================================
-- Rollback: 20261118_01_orders_loyalty_points_redeemed.down.sql
-- Purpose: Reverse loyalty_points_redeemed column addition on orders.
-- =============================================================================

ALTER TABLE orders DROP COLUMN loyalty_points_redeemed;
