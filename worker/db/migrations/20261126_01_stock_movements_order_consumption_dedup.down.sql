-- =============================================================================
-- Rollback: 20261126_01_stock_movements_order_consumption_dedup.down.sql
-- Purpose: Drop the order consumption uniqueness index. Rows re-keyed to
--          'consumption_duplicate' by the forward migration stay re-keyed:
--          they cannot be told apart from rows written later, and restoring
--          them would immediately break re-applying the forward migration.
-- =============================================================================

DROP INDEX IF EXISTS idx_stock_movements_order_consumption_dedup;
