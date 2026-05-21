-- Migration: Add lifetime_points to customers for tier calculation
-- Date: 2026-05-21

ALTER TABLE customers ADD COLUMN lifetime_points INTEGER DEFAULT 0;

-- Sync initial values: lifetime_points = loyalty_points
UPDATE customers SET lifetime_points = COALESCE(loyalty_points, 0);

SELECT '=== customers lifetime_points added and synced ===' AS info;
