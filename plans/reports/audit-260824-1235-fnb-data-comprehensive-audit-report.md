# F&B AURA CAFE — Comprehensive Data Audit Report

Date: 2026-08-24 | Scope: DB schema + migrations + docs-vs-code + business data flow
Method: direct code/schema inspection (workflow orchestration failed — model unavailable — fell back to solo audit)

## Verdict

Schema-vs-code drift is **HIGH**. Runtime business flows verified healthy (loyalty earn idempotent, POS phone lookup correct). Core risk: code queries tables/columns that no migration creates → silent 500s or manual-only DB state that no fresh environment can reproduce.

## Findings

### HIGH

| # | Finding | Evidence |
|---|---------|----------|
| H1 | `checkins` table: no DDL anywhere. checkin.ts INSERTs 8 cols (id, customer_id, customer_name, checkin_date, checkin_time, reward_amount, status, created_at); reports.ts + admin-loyalty.ts also read it | grep `CREATE TABLE.*checkins` across all SQL = 0 hits |
| H2 | `users` table: joined at staff-tips.ts:46 (`LEFT JOIN users u ON u.id = o.updated_by`) but no DDL exists | grep `CREATE TABLE.*users` = 0 hits |
| H3 | `customers` extra columns: phone-auth-handler.ts:50 INSERTs date_of_birth, zalo, source — absent from schema.sql:90-100, no ALTER migration | grep date_of_birth/zalo/source in SQL = 0 hits |
| H4 | Migration topology: 2 parallel dirs (`worker/migrations/` numbered 004-014, `worker/db/migrations/` date-named), manual-only apply (`wrangler d1 execute`), no `migrations_dir` in wrangler.toml (its `[[migrations]]` at :36-37 is Durable Objects only), no applied-migrations tracking table, no CI migration step | wrangler.toml:10 has database_id only; ci.yml/deploy.yml have no D1 step |
| H5 | schema.sql:4-14 opens with DROP TABLE for 10 core tables ("for development") — running it against prod-shaped DB destroys data | schema.sql:4-14 |

### MEDIUM

| # | Finding | Evidence |
|---|---------|----------|
| M1 | `email_verifications` defined twice w/ different indexes: migrations/012 vs db/migrations/20260818_01 | both CREATE TABLE IF NOT EXISTS |
| M2 | `push_subscriptions` defined 3-4×: schema.sql:563, migrations/009, db/migrations/20260706_11, + `_new` variant in 20260710_02 (column sets differ: last_used_at, FK, indexes) | all four files |
| M3 | `payments` defined 3× w/ conflicting columns: schema.sql:145 (updated_at, no refund cols) vs db/migrations/20260818_02 (created_at TEXT NOT NULL, no updated_at/refund) vs migrations/006 recreate (adds refund cols) | three definitions |
| M4 | migrations/006 recreate-table SELECTs refund columns from the OLD payments table — ordering hazard if old table lacks them | 006_payments_recreate |
| M5 | db/migrations/20260820_07: comment claims `ADD COLUMN IF NOT EXISTS` support but statement is plain `ALTER TABLE ADD COLUMN` → non-idempotent, re-run fails | 20260820_07_orders_staff.sql:5-8 |

### OK (verified healthy — no action)

- pos-customer.ts: phone normalize (`+84`→`0`, `/^0\d{9}$/`), cashback join, visit_count — correct
- loyalty-trigger.ts: idempotent earn (checks cashback_transactions order_id+type='earn' before credit)
- erpnext_sync_log (erpnext-sync.ts) vs erpnext_sync_queue (cron.ts): distinct tables, both legitimate
- staff_devices (20260710_01), notifications (20260710_02), client_errors (20260820_08): DDL exists
- loyalty_tiers seed ↔ schema.sql:300 match (4 tiers bronze/silver/gold/platinum)
- migrations/013 invoice recreate content verified correct

## Fix Proposals (pending user approval)

1. **H1** — new migration `CREATE TABLE IF NOT EXISTS checkins` matching the 8 cols checkin.ts writes + dup-check index (customer_id, checkin_date)
2. **H2** — users table: decide create-DDL vs re-point staff-tips.ts join onto staff_devices/staff_shifts (join intent = staff name for tip attribution)
3. **H3** — migration `ALTER TABLE customers ADD COLUMN date_of_birth/zalo/source` (plain, one-shot)
4. **H4** — consolidate: single `worker/db/migrations/` dir + `migrations_dir` in wrangler.toml D1 block + CI step `wrangler d1 migrations apply`
5. **H5** — move DROP block out of schema.sql (or gate behind explicit dev flag file)
6. **M1-M3** — dedupe: keep newest definition per table, mark superseded files applied/no-op
7. **M5** — fix 20260820_07: wrap ADD COLUMN in idempotent pattern or correct the misleading comment

## Resolution (2026-08-24, same day — user-approved batch)

| Fix | Status |
|-----|--------|
| H1 checkins | migration 20260824_01 applied to remote D1 ✅ (table live, 8 cols match code) |
| H2 users | remote had EMPTY legacy `users` (id/phone/full_name/tier/total_points, no repo DDL). User chose rename+recreate → 20260824_04 applied ✅ (legacy preserved as `users_legacy`, canonical users live) |
| H3 customers cols | remote ALREADY had date_of_birth/zalo/source. 20260824_03 kept for pre-0824 DBs only; schema.sql now declares them for fresh builds |
| H4 consolidate | db/migrations/README.md written (canonical table map + bootstrap order + remote-only-tables warning). wrangler migrations_dir NOT enabled — would re-apply history onto manually-built remote DB |
| H5 DROP block | removed from schema.sql |
| M1-M3 dedupe | documented in README (canonical vs superseded) |
| M5 comment | 20260820_07 corrected to "one-shot" |

Verified: fresh bootstrap test via local sqlite3 (schema.sql → seed.sql → 01/02) passes; legacy-path test for 03 passes.

## Unresolved Questions

- 12+ tables exist only in remote D1 (`bonus_campaigns`, `checkin_log`, `odoo_*`, `campaign_*`, …) with zero repo DDL — repo cannot rebuild prod. Recommend a one-time `schema dump` from remote into `worker/db/schema-remote-snapshot.sql`.
- wrangler D1 `migrations_dir` enforcement deferred: enabling it creates `_cf_KV`-style tracking and attempts full history replay against a manually-built DB.
- `users` is empty in prod — staff-tips report returns "Unassigned" for all tips until staff rows are seeded.

</content>