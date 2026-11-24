-- =============================================================================
-- Migration: 20261124_01_orders_kds_prep_timestamps.sql
-- Purpose: Add canonical started_at and ready_at timestamps to orders for KDS
--          prep duration tracking and frozen ready timers.
-- =============================================================================

ALTER TABLE orders ADD COLUMN started_at TEXT;
ALTER TABLE orders ADD COLUMN ready_at TEXT;
