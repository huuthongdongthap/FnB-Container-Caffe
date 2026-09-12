-- 20260913_01_customer_identity_consent_events_visits.down.sql
-- Down-migration: drops only the four M1 customer-foundation tables.
-- The pre-existing `customers` table and `orders.customer_phone` key are
-- untouched (they predate this migration and stay live).
-- Safe to run while production checkout is live: nothing else reads
-- these tables until the M1 domain code is also reverted.

DROP INDEX IF EXISTS idx_visits_date;
DROP INDEX IF EXISTS idx_visits_customer;
DROP TABLE IF EXISTS visits;

DROP INDEX IF EXISTS idx_customer_events_type;
DROP INDEX IF EXISTS idx_customer_events_customer;
DROP TABLE IF EXISTS customer_events;

DROP INDEX IF EXISTS idx_consents_customer;
DROP TABLE IF EXISTS consents;

DROP INDEX IF EXISTS idx_customer_identities_value;
DROP INDEX IF EXISTS idx_customer_identities_customer;
DROP TABLE IF EXISTS customer_identities;
