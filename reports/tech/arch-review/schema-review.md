# Database Schema Review — AURA CAFE (`FnB-Container-Caffe`)

**Audit command:** `schema --audit` (architecture-review pipeline)
**Scope:** `worker/schema.sql`, all migration directories, `worker/seed.sql`, `db/seed-promotions.sql`, raw SQL in `worker/src/**`
**Dialect:** Cloudflare D1 (SQLite). Binding: `AURA_DB` / `fnb-caffe-db` (`worker/wrangler.toml:7-10`)
**Date:** 2026-08-25
**Verdict:** 🔴 **Schema health 4/10** — a workable single-store F&B schema buried under four uncoordinated migration streams, heavy baseline↔migration drift, zero multi-tenant isolation, and ~14 tables referenced by code that no DDL ever creates.

---

## 1. Executive Summary

| Metric | Count |
|---|---|
| Tables defined across all SQL files | **68** (+ orphan `users_legacy` in prod) |
| Tables in canonical `worker/schema.sql` | **31** |
| Unique index names across all files | **131** (many duplicated cross-file; ~100 effective) |
| Indexes / triggers in `worker/schema.sql` | 43 / 9 |
| Migration files | **46**, spread across **4 directories** |
| Same-name tables with conflicting definitions | **6+** (`users`, `payments`, `staff_shifts`, `reservations`, `notification_audit_log`, `push_subscriptions`) |
| Code-referenced entities with **no DDL anywhere** | **~14** |
| Drift items catalogued | **23** |

Top risks:

1. **P0 — Multi-tenancy absent from the data model.** `tenant_id` appears **0 times** in any DDL. Tenancy is simulated by an unvalidated client header: `worker/src/middleware/tenant.ts:16-21` accepts `X-Tenant-Id` verbatim with no existence check.
2. **P0 — Ghost entities.** Production code INSERTs/SELECTs ~14 tables that no repo file creates (`campaign_enrollments`, `ti_order_bridge`, `bookings`, `signup_bonus_log`, …) → `no such table` on any fresh environment.
3. **P0 — Split-brain tables.** Code writes `erpnext_sync_log` (singular) while `schema.sql` creates `erpnext_sync_logs` (plural); `notification_audit_log` has two incompatible definitions; `staff_shifts` exists in two completely different shapes.
4. **P0 — Destructive re-runs.** `worker/schema.sql:264-267` still contains `DROP TABLE IF EXISTS loyalty_*` despite the header comment claiming that block was removed; `seed.sql` runs bare `DELETE FROM` on six production tables.

---

## 2. Table Inventory

### 2.1 Canonical baseline — `worker/schema.sql` (31 tables)

| Domain | Tables |
|---|---|
| Menu | `categories`, `products`, `menu_items` (duplicate mirror of products) |
| Orders / POS | `orders`, `order_items`, `cafe_tables`, `reservations`, `payments` |
| Customers / CRM | `customers`, `contact_messages`, `reviews` |
| Loyalty | `cashback_wallets`, `cashback_transactions`, `loyalty_tiers`, `loyalty_point_logs`, `rewards`, `user_rewards`, `referral_codes`, `referrals` |
| Ops | `staff_shifts`, `promotions`, `checkins`, `users` |
| SaaS billing | `subscription_plans`, `subscriptions`, `subscription_invoices`, `mrr_snapshots` |
| Integration | `erpnext_sync_logs`, `erpnext_mappings`, `notification_audit_log`, `push_subscriptions` |

### 2.2 Tables added only via migrations (37)

| Source directory | Tables added |
|---|---|
| `worker/migrations/` (7) | `_metrics`, `_alerts`, `audit_logs`, `erpnext_sync_log` ⚠️conflict, `saas_pricing`, `saas_tenants`, `email_verifications` |
| `worker/db/migrations/` (16) | `table_qr_codes`, `erpnext_sync_queue`, `ha_device_states`, `ha_automation_log`, `staff_devices`, `notifications`, `feedback`, `client_errors`, `table_sessions`, `modifier_groups`, `modifier_choices`, `product_modifier_groups`, `happy_hour_windows`, `kitchen_stations`, `category_stations`, `order_item_stations` |
| `db/migrations/` (6) | `checkin_log`, `bonus_campaigns`, `loyalty_audit_log`, `inventory_items`, `inventory_transactions`, `inventory_snapshots` |
| `scripts/migrations/` (8) | `campaign_configs`, `campaign_logs`, `odoo_customer_consent`, `odoo_invoices`, `odoo_mappings`, `odoo_product_sync`, `odoo_sync_failures`, `odoo_sync_logs` |

### 2.3 Ghost entities — referenced in `worker/src` but never created (≈14)

Evidence (FROM/INTO/UPDATE hits in `worker/src/**/*.ts`):

`campaign_enrollments` (5), `ti_order_bridge` (4), `ti_menu_cache` (4), `mixpost_posts` (4), `mixpost_templates` (1), `bookings` (5), `signup_bonus_log` (3), `birthday_redemptions` (3), `promotion_redemptions` (2), `admin_audit_log` (3), `frigate_events` (3), `dindin_config` (3), `dindin_cart` (2), `expenses` (1), `vendors` (1).

Any of these routes fails at runtime on a database built from the repo's own SQL.

---

## 3. ER Relationships (text)

```
categories 1─* products (products.category_id, schema.sql:38)
products    1─* order_items (order_items.product_id, :199)
orders      1─* order_items (order_id, ON DELETE CASCADE, :198)
cafe_tables 1─* orders (orders.table_id, nullable dine-in, :128)
cafe_tables 1─1 table_qr_codes (table_qr_codes.table_id UNIQUE — INTEGER→TEXT FK mismatch, 20260706_01)
cafe_tables 1─* reservations (:174) / table_sessions (CASCADE, 20260820_03) / category_stations? no
orders      1─* payments (ON DELETE CASCADE, :150)
customers   1─* orders (orders.customer_id — added by migration 014, NO FK declared)
customers   1─1 cashback_wallets (:278); wallets 1─* cashback_transactions (:291)
customers   1─* loyalty_point_logs, user_rewards, referral_codes(1─1), referrals(referrer+referred), checkins
rewards     1─* user_rewards (:347)
subscription_plans 1─* subscriptions 1─* subscription_invoices (008/013)
kitchen_stations *─* categories (category_stations), *─* order_items (order_item_stations)
modifier_groups 1─* modifier_choices; products *─* modifier_groups (product_modifier_groups)
users       0..1─* orders (orders.updated_by — no FK, join in staff-tips)
inventory_items 1─* inventory_transactions / inventory_snapshots (db/migrations/20260705_10)
```

Integrity notes: `orders.customer_id`, `orders.staff_id`, `orders.updated_by` have **no FOREIGN KEY** clauses. D1 enforces declared FKs by default (`PRAGMA foreign_keys=ON` is fixed), so undeclared relations rely entirely on application code.

---

## 4. Findings

| # | Sev | Area | Finding | Evidence | Recommendation |
|---|---|---|---|---|---|
| F-01 | **P0** | Multi-tenancy | Zero `tenant_id` on any of 68 tables; tenancy faked via client header accepted without validation → full cross-tenant read/write by setting a header | `worker/src/middleware/tenant.ts:16-21`; grep tenant_id = 0 hits in all SQL | Add `tenant_id TEXT NOT NULL REFERENCES saas_tenants(id)` to every domain table + composite indexes `(tenant_id, …)`; resolve tenant server-side from auth token, never trust the header |
| F-02 | **P0** | Schema-code alignment | ~14 code-referenced tables have no DDL (see §2.3) | e.g. `campaign_enrollments` INSERT in loyalty campaign handlers; `bookings` UPDATE in booking routes | Ship a "missing entities" migration or delete dead routes; add CI check that diffs `sqlite_master` vs static analysis of src SQL |
| F-03 | **P0** | Drift | Split-brain sync-log: schema creates `erpnext_sync_logs` (plural, schema.sql:481) but code only writes `erpnext_sync_log` (singular, migration 007; `routes/erpnext-sync.ts:55,90,110`) | Both tables exist on prod; plural one is write-orphaned | Drop one; keep singular (code target); backfill/merge rows |
| F-04 | **P0** | Drift | `notification_audit_log` defined twice with incompatible shapes: schema.sql:504 (TEXT id, phone NOT NULL, CHECKs) vs `db/migrations/20260620_05` (INTEGER id, customer_id FK, different CHECKs). Whichever ran last wins silently | schema.sql:504-516 vs db/migrations/20260620_05_notification_audit.sql:6-20 | Reconcile to one canonical DDL; verify prod shape before migrating |
| F-05 | **P0** | Drift | `staff_shifts` two unrelated shapes: schema.sql:403 (INTEGER id, staff_name/date/shift) vs db/schema.sql:156 (TEXT id, staff_email/clock_in/clock_out/shift_type) — different column sets entirely | worker/schema.sql:403-412 vs db/schema.sql:156-166 | Declare db/schema.sql non-canonical (delete or archive it); recreate staff_shifts once |
| F-06 | **P0** | Safety | `schema.sql` still destructively drops 4 loyalty tables on every re-run despite header note claiming removal | worker/schema.sql:4-6 note vs :264-267 `DROP TABLE IF EXISTS loyalty_members…loyalty_rewards` | Delete lines 264-267; treat schema.sql as build-only artifact |
| F-07 | **P0** | Process | 4 parallel migration dirs, none wired to tooling: `wrangler.toml` has no `migrations_dir`, so default is `worker/migrations/`; other dirs applied manually per file-header comments ("Run: npx wrangler d1 execute --remote") | wrangler.toml:7-15; comments in 20260818_*, db/migrations/* headers | Consolidate into ONE directory consumed by `wrangler d1 migrations apply`; add applied-migrations tracking |
| F-08 | P1 | Migration safety | No-op migration: `20260708_01_orders_table_extensions_fixed.sql` claims to extend orders but contains zero ALTER statements — only creates/deletes/drops a `_skip_` sentinel table. `order_source/paid_at/payment_url` on orders never actually added (and are not referenced by code — lucky) | worker/db/migrations/20260708_01:5-13 | Replace with real guarded ALTERs or delete file and document columns as N/A |
| F-09 | P1 | Migration safety | Bare `ALTER TABLE ADD COLUMN` one-shots fail on re-run (no IF NOT EXISTS in SQLite): 014_cod_guest_columns (8 alters), 20260820_06 (3), 20260820_07 (1), 20260824_03 (3), db/migrations 20260606_06 (2) | worker/migrations/014; worker/db/migrations/20260820_06:10-12 etc. | Adopt recreate-table pattern (as 006/013 do) or pragma-guarded sentinel like 20260708 intended |
| F-10 | P1 | Drift | Money-type drift: `subscription_plans.monthly_price_vnd`, `subscriptions.amount_vnd`, `mrr_snapshots.mrr_vnd` are REAL in migration 008 but INTEGER in schema.sql; VND has no subunit — floats risk rounding drift in billing | worker/migrations/008 vs schema.sql:417-480; also db/schema.sql:19 products.price REAL vs worker schema INTEGER | Standardize ALL VND as INTEGER; recreate affected tables casting CAST(x AS INTEGER) |
| F-11 | P1 | Indexing | Hot-path lookups unindexed: `customers WHERE phone = ?` used by 3 production loyalty handlers (process-order.ts:41, lookup-handler.ts:20, phone-auth-handler.ts:38) — no index on customers.phone (email is indexed+unique); `orders WHERE table_id` (table-sessions.ts:253) — no index on orders.table_id in canonical schema | worker/src/tree/loyalty/*.ts; schema.sql:98-99 | `CREATE INDEX idx_customers_phone ON customers(phone)` (+UNIQUE if business rule allows); `CREATE INDEX idx_orders_table ON orders(table_id)` |
| F-12 | P1 | Integrity | FK type mismatches: `table_qr_codes.table_id INTEGER` → cafe_tables.id TEXT (20260706_01:6); `feedback.table_id INTEGER` → TEXT (20260707_01); `notification_audit_log.customer_id INTEGER` → customers.id TEXT (20260620_05). Works only by SQLite affinity accident | cited files | Change child columns to TEXT to match parent PKs |
| F-13 | P1 | Integrity | `user_rewards.code` has no UNIQUE constraint though codes are redeemable vouchers (loyalty.ts:140 inserts generated code); duplicate voucher = double redemption risk | worker/schema.sql:338-348; routes/loyalty.ts:140 | `CREATE UNIQUE INDEX idx_user_rewards_code ON user_rewards(code)` |
| F-14 | P1 | Data types | JSON blob denormalization / dual source of truth: `orders.items` JSON duplicates normalized `order_items` rows (both written); menu seeded twice (`menu_items` AND `products` mirror in seed.sql:13-158); notification_audit_log carries BOTH `data` and `payload` columns | schema.sql:106 vs :190-200; seed.sql:109-158 | Pick one write path for line items (order_items) and treat orders.items as snapshot-only or drop it |
| F-15 | P1 | Migration drift | Duplicate/conflicting numbering: `scripts/migrations/` has TWO files numbered 006 (campaign-configs, push-subscriptions); `worker/migrations/` starts at 004 (001-003 missing); `db/migrations/` date-suffixes out of numeric order (_05 dated after _07: 20260530_03 → 20260606_06 → 20260606_07 → 20260620_05) — lexicographic sort misapplies them | ls of all four dirs | Renumber monotonically in single dir; never reuse numbers |
| F-16 | P1 | Seed data | seed.sql: bare `DELETE FROM products/menu_items/categories/cafe_tables/loyalty_tiers/rewards/promotions` wipes prod data when re-run; `PRAGMA foreign_keys = OFF` (line 5) is rejected/no-op on D1; test reviews r1-r10 with fake names inserted as published; expired promos AURA20/AURA10 seeded active | worker/seed.sql:5-10,163,181,191,203-222; db/seed-promotions.sql deletes promotions too | Gate seeds behind ENV check; use INSERT OR IGNORE with stable IDs; remove fake reviews from prod seed |
| F-17 | P1 | Constraints | Almost no CHECK constraints on enums: orders.status/payment_status, payments.status, subscriptions.status, feedback, notifications all free-form TEXT (only reviews.rating :252, _alerts.severity, inventory type, notif-audit have CHECKs); app-level validation only | grep CHECK across schema = 4 tables | Add CHECK constraints during next recreate-table pass |
| F-18 | P2 | Redundancy | Redundant indexes duplicating UNIQUE constraints: idx_categories_slug (:21), idx_referral_codes_code/code (:382), idx_push_subscriptions_endpoint (:578), idx_subscription_plans_slug (:517); duplicate-purpose metrics indexes across two migrations (idx_metrics_name_ts 004 vs idx_metrics_name_created 20260701_08) | cited lines | Drop redundant; UNIQUE constraint already provides the index |
| F-19 | P2 | Composite indexing | Common patterns lack composite indexes: orders(status,created_at) dashboard scans; subscription_invoices(subscription_id,created_at) for "last 5 invoices" (sub-handlers.ts:159); cashback_transactions has no index at all on wallet_id/order_id despite balance math; loyalty_point_logs.customer_id unindexed | schema.sql:132-135; routes queries | Add composites above; index cashback_transactions(wallet_id), (order_id), loyalty_point_logs(customer_id) |
| F-20 | P2 | Datetime hygiene | Mixed conventions inside one file: DATETIME DEFAULT CURRENT_TIMESTAMP vs TEXT DEFAULT datetime('now'); reservations.date/time as separate TEXT fields; delivery_time overloaded ('now' string OR timestamp) | schema.sql:17 vs :306; :167-168; :118 | Standardize on TEXT ISO-8601 UTC; split delivery_time into delivery_mode + scheduled_at |
| F-21 | P2 | Booleans | Inconsistent boolean naming/type: is_available vs available (products/menu_items), active vs is_active (saas_pricing/happy_hour vs rewards/promotions), all INTEGER 0/1 without CHECK | schema.sql:35,70; migrations 010:18, 20260820_04 | Rename to is_* uniformly; CHECK(col IN (0,1)) |
| F-22 | P2 | Orphans | Prod carries `users_legacy` (renamed by 20260824_04 for forensics) plus temp artifacts `_skip_*`, `*_new` if a recreate failed mid-flight | 20260824_04:9; 20260708_01 | Schedule drop after retention window; document cleanup runbook |
| F-23 | P2 | Backup/down-migrations | Zero down-migrations anywhere; destructive recreates (payments 006, invoices 013, push_subs 20260710_02, users 20260824_04) rely on ad-hoc manual backups — exactly one backup exists (worker/backups/fnb-caffe-db-20260825-204654.sql) taken same day as latest migration | migrations dir listing; backups/ | Require pre-migration `d1 export` step in CI; store timestamped dumps |

---

## 5. Migration Drift Analysis

### 5.1 Chronology & ordering hazards

| Stream | Files | Ordering problem |
|---|---|---|
| `db/migrations/` | 8 | Suffix numbers jump: 01→03→06→07→05→08→09→10. A runner sorting numerically applies 20260620_**05** AFTER 20260606_**07**. Also this stream predates worker streams yet defines overlapping tables (notification_audit_log, _metrics/_alerts) with different shapes. |
| `worker/migrations/` | 11 (004-014) | Missing 001-003 — baseline history lost; 004 duplicates db/migrations 08 (_metrics/_alerts, different shapes); 007 conflicts with schema's erpnext_sync_logs. |
| `worker/db/migrations/` | 20 | Mixed concerns (QR, HA, feedback, modifiers, users recreate). 20260708_01 is a no-op (F-08). 20260706_11 recreates push_subscriptions again (3rd definition), then 20260710_02 recreates it a 4th time adding device_id — each recreate loses prior indexes/triggers until re-created later in-file. |
| `scripts/migrations/` | 7 | Two files share number 006; odoo_* tables (7) referenced nowhere in worker/src (dead schema?). |

### 5.2 Same-name table definition matrix

| Table | Definitions | Conflict severity |
|---|---|---|
| `push_subscriptions` | 4 (009, scripts/006, 20260706_11, 20260710_02-recreate, +schema.sql copy) | Medium — final shape OK (device_id added) but churn risks lost rows on partial application |
| `payments` | 3 (schema.sql, 006-recreate w/ refund cols, 20260818_02 minimal IF-NOT-EXISTS) | High — fresh DB hitting 20260818_02 first gets a table missing refund_amount/refund_status/updated_at; subsequent schema.sql CREATE (no IF NOT EXISTS, :140) then fails |
| `users` | 3 (db/schema legacy customer shape, 20260824_02 staff shape, 20260824_04 recreate) | Resolved on prod by rename, but db/schema.sql still poisons fresh builds |
| `staff_shifts` | 2 incompatible | High (F-05) |
| `reservations` | 2 incompatible (customer_phone/date/time/guest_count vs phone/reservation_date/pax) | High — whichever baseline wins breaks half the reservation code paths |
| `email_verifications` | 2 (012 vs 20260818_01, differing created_at defaults/indexes) | Low |
| `checkins` | 2 identical-ish (schema.sql:583 + 20260824_01) | Low (harmless duplication, signals process gap) |
| `erpnext_sync_log(s)` | name mismatch singular/plural | High (F-03) |

### 5.3 Schema↔migration column drift (examples)

- `mrr_snapshots`: schema.sql adds expansion_mrr_vnd/contraction_mrr_vnd/churn_rate_pct/avg_contract_value_vnd (schema.sql:467-480) absent from 008.
- `subscriptions`: schema.sql drops `notes`/`paused_at` that 008 declares.
- `orders`: cumulative ALTERs from three streams (014, 20260820_06, 20260820_07) leave canonical schema.sql WITHOUT customer_id/staff_id/is_cod/order_type/tip_amount/service_fee/updated_by — i.e., **the canonical baseline no longer matches what code requires**; any DB built from schema.sql alone fails dozens of queries until 9+ migrations are manually applied in the right order.

---

## 6. Recommendations (prioritized)

1. **Freeze & consolidate migrations (P0):** pick `worker/migrations/` as the single source, wire `[[migrations]]`/`migrations_dir` semantics via `wrangler d1 migrations`, squash history into `000_baseline.sql` matching current prod (`SELECT sql FROM sqlite_master` export exists in backups/), archive other dirs.
2. **Add tenancy properly (P0):** `tenant_id` column + composite indexes + server-side resolution; reject `X-Tenant-Id` header spoofing (tenant.ts:16).
3. **Create or delete ghost entities (P0):** audit §2.3 list route-by-route; ship DDL for live features, remove dead ones.
4. **De-duplicate split-brain tables (P0):** erpnext_sync_log(s), staff_shifts, reservations, notification_audit_log — reconcile against prod shape, migrate data, drop extras.
5. **Make schema.sql non-destructive (P0):** delete DROP block (:264-267); convert seeds to idempotent INSERT OR IGNORE behind env guard.
6. **Index hot paths (P1):** customers(phone), orders(table_id), cashback_transactions(wallet_id, order_id), loyalty_point_logs(customer_id), orders(status, created_at), unique user_rewards(code).
7. **Money as INTEGER everywhere (P1):** cast REAL VND columns during next recreate.
8. **CI guardrails (P1):** lint job that (a) builds scratch D1 from schema+migrations in sorted order, (b) runs app smoke queries, (c) diffs referenced tables vs sqlite_master — would have caught F-02/F-08 automatically.
9. **Constraint hardening (P2):** CHECK enums, FK for orders.customer_id/updated_by, fix INTEGER↔TEXT FK mismatches.
10. **Operational policy (P2):** mandatory `d1 export` backup before any recreate-table migration (only one backup exists today); drop `users_legacy` after forensics window.

---

*Report generated by `schema --audit` pipeline. Evidence line numbers refer to files at commit time of audit (2026-08-25).*
