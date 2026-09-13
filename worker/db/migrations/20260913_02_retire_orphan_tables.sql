-- Retire orphan tables: 0 data rows, zero code consumers (verified 2026-09-13
-- via live sqlite_master + row counts + repo-wide grep).
-- DDL preserved verbatim in 20260913_02_retire_orphan_tables.down.sql.

DROP TABLE IF EXISTS users_legacy;
DROP TABLE IF EXISTS checkin_log;
DROP TABLE IF EXISTS odoo_invoices;
DROP TABLE IF EXISTS odoo_mappings;
DROP TABLE IF EXISTS odoo_customer_consent;
DROP TABLE IF EXISTS odoo_product_sync;
DROP TABLE IF EXISTS odoo_sync_failures;
DROP TABLE IF EXISTS odoo_sync_logs;
DROP TABLE IF EXISTS erpnext_invoices;
