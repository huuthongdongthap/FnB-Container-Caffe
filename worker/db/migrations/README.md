# D1 Migrations — Canonical Index

D1 migrations are applied **manually** with explicit file selection (no wrangler `migrations_dir`, no CI auto-migration step, and no bulk replay during normal deploy):

```bash
# Fail-closed runner from repo root (recommended — blocks *.down.sql & superseded files):
bash worker/scripts/apply-migrations.sh --file <file>.sql

# Or direct Wrangler invocation from worker/:
cd worker
npx wrangler d1 execute fnb-caffe-db --file=db/migrations/<file>.sql --remote
```

Rules:
- Apply files in name order, once each. There is currently no verified applied-migrations tracking table in D1.
- **Never bulk-replay all historical migrations against an existing database.** Both `deploy-cloudflare.sh` and `scripts/deploy-branded.sh` skip D1 migrations by default unless `--migration-file=<file>.sql` is explicitly provided, and `worker/scripts/apply-migrations.sh` fails closed unless `--file <file>.sql` is passed.
- **Historical table-rebuild hazards (do not re-run on live D1):**
  - `20260710_02_notifications_fixed.sql` (`:24-45`) rebuilds `push_subscriptions` via `push_subscriptions_new` and overwrites `role = 'customer'`, `last_used_at = NULL`, and `device_id = NULL` on every existing row.
  - `20261003_02_admin_metrics_and_inventory.sql` (`:27-47`) rebuilds `audit_logs` via `audit_logs_new`, copying only 9 of 13 columns (resetting `user_id`, `entity_type`, `entity_id`, `metadata` to `NULL`/`'{}'`) and dropping the 4 columns added later by `20261009_01_audit_trail_canonical_contract.sql` (`:4-7`: `operating_unit_id`, `tenant_id`, `status`, `correlation_id`).
- New tables use `CREATE TABLE IF NOT EXISTS` (re-run safe). `ALTER TABLE ADD COLUMN` is one-shot (SQLite has no IF NOT EXISTS variant).
- Down-migrations live beside their up-file as `<same-stem>.down.sql`. They are a rollback tool — never applied as part of normal forward flow.
- All new DDL goes in `worker/db/migrations/` (date-numbered). `worker/migrations/` (004–014) is legacy — do not add files there.

## Canonical vs duplicate definitions

Some tables are defined in more than one place. When they conflict, the canonical source below is the one code targets; the duplicates are kept only because they may already have been applied to remote D1.

| Table | Canonical | Duplicate / superseded (do not re-apply) |
|-------|-----------|-------------------------------------------|
| push_subscriptions | `db/migrations/20260710_02_notifications_fixed.sql` (`push_subscriptions_new`) | `migrations/009`, `db/migrations/20260706_11`, `schema.sql` |
| email_verifications | `db/migrations/20260818_01_email_verifications.sql` | `migrations/012_email_verification.sql` |
| payments | `schema.sql` + `migrations/006_refund_columns.sql` | `db/migrations/20260818_02_payments_table.sql` (narrower column set) |
| checkins | `db/migrations/20260824_01_checkins_table.sql` | — |
| users | `db/migrations/20260824_04_users_recreate.sql` (renames empty legacy table to `users_legacy`, then canonical DDL) | `db/migrations/20260824_02_users_table.sql` (fails on DBs that still carry the legacy table) |
| customer_identities / consents / customer_events / visits | `db/migrations/20260913_01_customer_identity_consent_events_visits.sql` (+ `.down.sql` rollback) | — |

## Retired tables (2026-09-13)

`db/migrations/20260913_02_retire_orphan_tables.sql` drops 9 orphan tables
(0 data rows, zero code consumers, verified against live D1 before drop):
`users_legacy`, `checkin_log`, `odoo_invoices`, `odoo_mappings`,
`odoo_customer_consent`, `odoo_product_sync`, `odoo_sync_failures`,
`odoo_sync_logs`, `erpnext_invoices`. Their DDL is preserved verbatim in
the `.down.sql` rollback. Never recreate them except via that rollback.

## Ordering hazard

`migrations/006_refund_columns.sql` recreates `payments` and SELECTs refund columns from the pre-migration table — only valid if those columns already exist (added by prior manual applies). On a fresh database, run `schema.sql` first, then treat 006 as a no-op.

## Remote-only tables

Canonical DDL for `sessions`, `bonus_campaigns`, `signup_bonus_log`, `loyalty_audit_log`, `erpnext_product_sync`, `campaign_logs`, `campaign_configs`, `otp_challenges`, and `schema_migrations` now lives in both `worker/schema.sql` and `db/schema.sql` with 100% table, column, and index parity.
Only legacy `order_payments` and D1 internal `_cf_KV` remain outside repository DDL; inspect `pragma_table_info` on remote D1 before referencing `order_payments`.

(`checkin_log`, `erpnext_invoices`, the 5 `odoo_*` tables, and `users_legacy`
were retired 2026-09-13; DDL preserved in `20260913_02_retire_orphan_tables.down.sql`.)

## Fresh-environment bootstrap vs incremental cutover

- **Fresh D1 / SQLite environment:**
  1. `npx wrangler d1 execute AURA_DB --file=worker/schema.sql` (`db/schema.sql` is an identical mirror verified by `tests/bootstrap-payment-schema.test.ts`).
  2. `npx wrangler d1 execute AURA_DB --file=worker/seed.sql`
  3. **Do NOT bulk-replay historical `worker/db/migrations/*.sql` on top of `schema.sql`** — `schema.sql` already incorporates every forward migration up to the latest cutover, and `deploy-cloudflare.sh` / `worker/scripts/apply-migrations.sh` intentionally block bulk replay fail-closed. Record the baseline version in `schema_migrations`.
- **Existing D1 environment:**
  1. Check `SELECT version FROM schema_migrations ORDER BY version` and verify column/index state via `pragma_table_info` / `pragma_index_list`.
  2. Apply only new unapplied `YYYYMMDD_NN_<slug>.sql` files individually via `./worker/scripts/apply-migrations.sh <target> <migration_file>` and insert the applied version + SHA-256 checksum into `schema_migrations`.