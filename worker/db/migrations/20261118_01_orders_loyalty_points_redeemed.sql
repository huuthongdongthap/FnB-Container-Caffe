-- =============================================================================
-- Migration: 20261118_01_orders_loyalty_points_redeemed.sql
-- Purpose: Add canonical loyalty_points_redeemed column to orders for checkout
--          point redemption & cancel/refund point restoration parity.
-- =============================================================================

ALTER TABLE orders ADD COLUMN loyalty_points_redeemed INTEGER DEFAULT 0;
