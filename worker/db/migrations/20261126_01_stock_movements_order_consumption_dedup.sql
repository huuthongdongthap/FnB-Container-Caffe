-- =============================================================================
-- Migration: 20261126_01_stock_movements_order_consumption_dedup.sql
-- Purpose: One BOM consumption ledger row per (tenant, order, ingredient).
--          BOM stock deduction inserts its ledger row first and gates the
--          ingredient stock UPDATE on that row existing, so a concurrent retry
--          (for example a payment webhook redelivery) becomes a no-op instead
--          of deducting twice. This partial unique index is what enforces it.
--
-- Pre-existing duplicates: every order consumption row other than the earliest
-- one per key is re-keyed from 'consumption' to 'consumption_duplicate'
-- (UPDATE only, no DELETE, so the audit trail and quantities are preserved).
-- Reporting impact: COGS / forecasting queries that list explicit consumption
-- types no longer count the re-keyed rows. Stock levels are NOT adjusted; an
-- operator must reconcile ingredients that were genuinely double-deducted.
-- Void restore rows ('adjustment' / 'waste') are not covered by the index.
--
-- Re-run safe: re-keying matches nothing once duplicates are gone and the
-- index uses IF NOT EXISTS.
-- =============================================================================

UPDATE stock_movements
SET type = 'consumption_duplicate',
    notes = COALESCE(notes || ' ', '') || '[duplicate order consumption re-keyed]'
WHERE reference_type = 'order'
  AND type = 'consumption'
  AND EXISTS (
    SELECT 1
    FROM stock_movements earlier
    WHERE earlier.reference_type = 'order'
      AND earlier.type = 'consumption'
      AND earlier.reference_id = stock_movements.reference_id
      AND earlier.ingredient_id = stock_movements.ingredient_id
      AND COALESCE(NULLIF(TRIM(earlier.tenant_id), ''), 'default') = COALESCE(NULLIF(TRIM(stock_movements.tenant_id), ''), 'default')
      AND (
        COALESCE(earlier.created_at, '') < COALESCE(stock_movements.created_at, '')
        OR (COALESCE(earlier.created_at, '') = COALESCE(stock_movements.created_at, '') AND earlier.id < stock_movements.id)
      )
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_movements_order_consumption_dedup ON stock_movements(COALESCE(NULLIF(TRIM(tenant_id), ''), 'default'), reference_id, ingredient_id) WHERE reference_type = 'order' AND type = 'consumption';
