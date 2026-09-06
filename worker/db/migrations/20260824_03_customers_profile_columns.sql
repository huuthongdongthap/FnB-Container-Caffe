-- 20260824_03_customers_profile_columns.sql
-- phone-auth-handler.ts INSERTs date_of_birth / zalo / source into customers,
-- but the base schema (schema.sql) never declared them, so loyalty phone
-- signup fails on any database built only from schema.sql.
--
-- One-shot: SQLite has no ADD COLUMN IF NOT EXISTS — apply exactly once
-- (re-running raises "duplicate column name"). Skip on databases built from
-- schema.sql on or after 2026-08-24, which already declares these columns;
-- this file exists for databases created before that date.

ALTER TABLE customers ADD COLUMN date_of_birth TEXT;
ALTER TABLE customers ADD COLUMN zalo TEXT;
ALTER TABLE customers ADD COLUMN source TEXT;