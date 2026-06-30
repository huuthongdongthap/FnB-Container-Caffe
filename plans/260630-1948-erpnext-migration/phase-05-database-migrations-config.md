# Phase 05 — Database Migrations + Env Config

**Priority:** P1 | **Status:** done | **Effort:** 3h | **Depends:** Phase 03

## SQL Migration: Rename Tables

### New migration file: `scripts/migrations/004-rename-odoo-to-erpnext.sql`

```sql
-- Rename tables
ALTER TABLE odoo_mappings RENAME TO erpnext_mappings;
ALTER TABLE odoo_sync_logs RENAME TO erpnext_sync_logs;
ALTER TABLE odoo_product_sync RENAME TO erpnext_product_sync;
ALTER TABLE odoo_invoices RENAME TO erpnext_invoices;

-- Rename columns in erpnext_mappings
ALTER TABLE erpnext_mappings RENAME COLUMN odoo_id TO erpnext_id;
ALTER TABLE erpnext_mappings RENAME COLUMN odoo_model TO erpnext_model;

-- Rename columns in erpnext_product_sync
ALTER TABLE erpnext_product_sync RENAME COLUMN odoo_product_id TO erpnext_product_id;
ALTER TABLE erpnext_product_sync RENAME COLUMN odoo_write_date TO erpnext_write_date;

-- Rename columns in erpnext_invoices
ALTER TABLE erpnext_invoices RENAME COLUMN odoo_invoice_id TO erpnext_invoice_id;
```

### Update schema reference
- `worker/schema.sql` — update table definitions
- Keep old migration files (001-003) as historical

## Environment Variables

### wrangler.toml changes
```toml
# Remove
ODOO_URL = ""
ODOO_DB = ""
ODOO_USERNAME = ""
ODOO_API_KEY = ""

# Add
ERPNEXT_URL = ""
ERPNEXT_API_KEY = ""
ERPNEXT_API_SECRET = ""
```

### .env.example
- Remove ODOO_* vars
- Add ERPNEXT_URL, ERPNEXT_API_KEY, ERPNEXT_API_SECRET
- Add comment explaining ERPNext token auth

## KV Namespace
- Key prefix: `odoo:` → `erpnext:` (product cache, last sync timestamp)
- No binding changes needed (same KV namespace)

## Verification

- [ ] Migration SQL runs without errors
- [ ] D1 schema matches new table/column names
- [ ] Worker deploys with new env vars
- [ ] KV keys use new prefix
