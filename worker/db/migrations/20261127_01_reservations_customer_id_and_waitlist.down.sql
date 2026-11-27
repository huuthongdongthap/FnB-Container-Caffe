-- =============================================================================
-- Rollback: 20261127_01_reservations_customer_id_and_waitlist.down.sql
-- Purpose: Reverse waitlist table and reservations.customer_id additions.
-- =============================================================================

DROP INDEX IF EXISTS idx_waitlist_tenant_status;
DROP TABLE IF EXISTS waitlist;
DROP INDEX IF EXISTS idx_reservations_customer_id;
ALTER TABLE reservations DROP COLUMN customer_id;
