# D1 Migrations — Canonical Index

D1 migrations are applied **manually** (no wrangler `migrations_dir`, no CI step):

```bash
cd worker
npx wrangler d1 execute AURA_DB --file=db/migrations/<file>.sql --remote
```

Rules:
- Apply files in name order, once each. There is no applied-migrations tracking table.
- New tables use `CREATE TABLE IF NOT EXISTS` (re-run safe). `ALTER TABLE ADD COLUMN` is one-shot (SQLite has no IF NOT EXISTS variant).
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

## Ordering hazard

`migrations/006_refund_columns.sql` recreates `payments` and SELECTs refund columns from the pre-migration table — only valid if those columns already exist (added by prior manual applies). On a fresh database, run `schema.sql` first, then treat 006 as a no-op.

## Remote-only tables (DDL absent from this repo)

The production D1 contains tables with no CREATE TABLE in any repo file:
`_cf_KV`, `bonus_campaigns`, `signup_bonus_log`, `loyalty_audit_log`,
`checkin_log`, `erpnext_invoices`, `erpnext_product_sync`, `odoo_*`
(5 tables), `campaign_logs`, `campaign_configs`, `users_legacy`,
`sessions`, `order_payments`.
Before recreating or altering any of these, dump their schema from remote
(`pragma_table_info`) — the repo cannot rebuild them.

## Fresh-environment bootstrap

1. `npx wrangler d1 execute AURA_DB --file=schema.sql`
2. `npx wrangler d1 execute AURA_DB --file=seed.sql`
3. Apply `db/migrations/` files in order, **skipping**:
   - the superseded duplicates in the table above, and
   - `20260824_03_customers_profile_columns.sql` — its columns are already declared in schema.sql; that file is only for databases created before 2026-08-24, and
   - `20260826_02_locality_fields.sql` — same reason; schema.sql on or after 2026-08-26 already declares these columns.