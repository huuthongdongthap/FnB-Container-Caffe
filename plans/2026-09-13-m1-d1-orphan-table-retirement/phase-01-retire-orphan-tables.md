# M1 Batch 3 — D1 Orphan-Table Retirement + Spec Reconciliation (D7/D1)

Priority: P1 · Status: complete · 2026-09-13

## Context — live-DB verification (remote D1, 2026-09-13)

- D7 "payments/subscription_invoices + _new merges" assumption is **void**:
  `worker/migrations/006`/`013` are recreate+rename migrations —
  no `_new` table exists in prod. Subscription family (plans/
  subscriptions/invoices) has **never been provisioned** in prod D1
  (verified: `sqlite_master` query returns none of them).
- Orphans verified with row counts + code-reference grep:
  - `users_legacy` — 0 rows; created 20260824_04 as forensic rename
    (empty legacy table); **owner approved drop 2026-09-13**
  - `checkin_log` — 0 rows; DDL absent from repo (remote-only); no
    code references anywhere
  - `odoo_*` family (6 tables: invoices, mappings, customer_consent,
    product_sync, sync_failures, sync_logs) — 0 rows each; only
    references are `console.log` strings in
    `scripts/backfill-odoo-customers.js` (never executes SQL against
    them); no worker/src SQL touches them
  - `erpnext_invoices` — 0 rows; no SQL consumers in code (only
    `erpnext_mappings`, `erpnext_sync_log`, `erpnext_sync_queue`,
    `erpnext_product_sync` are used — all still present)
- **Kept** (live data or active code): `bonus_campaigns` (3 rows +
  `tree/loyalty/campaign.ts` reads), `campaign_configs`/`campaign_logs`/
  `signup_bonus_log`/`loyalty_audit_log` (0 rows but mounted
  `/api/campaigns` code writes them — active schema), `payments` (14
  rows), `orders` (89), `users` (6), `customers` (20)

## Requirements (locked — owner approved 2026-09-13)

1. Drop orphan tables on prod D1 (single migration, down-migration
   provided): `users_legacy`, `checkin_log`, `odoo_invoices`,
   `odoo_mappings`, `odoo_customer_consent`, `odoo_product_sync`,
   `odoo_sync_failures`, `odoo_sync_logs`, `erpnext_invoices`
   — 9 tables, 0 data rows total, zero code consumers
2. Migration files: `worker/db/migrations/20260913_02_retire_orphan_tables.sql`
   + `.down.sql` (recreate stub DDL for rollback; original DDL for
   checkin_log/odoo_* recovered via `pragma_table_info` before drop)
3. Update `worker/db/migrations/README.md` remote-only table list
4. Spec reconciliation (D7 closure):
   - `.ai/specs/migration-matrix.md` — payments/subscription_invoices
     MERGE rows → mark RESOLVED-NOT-NEEDED (recreate+rename already
     unified; subscription family never provisioned)
   - `.ai/specs/phase-map.md` §2 item 5 — D1 merges → orphan
     retirement (actual work)
   - `docs/architecture/DOMAIN_MAP.md` §5, `CURRENT_STATE.md` P4 —
     correct `_new` claims
5. Tests: no code touches dropped tables, so suite proves no
   regression (existing 3269 tests); add no new tests beyond running
   the full suite + tsc

## Out of scope

- `payments` refund-column divergence (live table lacks refund
  columns vs migrations/006 — that's an apply-state question, separate
  batch)
- Subscription family provisioning (code exists, tables don't —
  feature decision, not M1 batch 3)
- Campaign/loyalty tables (active code)
- `_cf_KV`, `sqlite_sequence` (system)

## Todo

- [x] Dump `pragma_table_info` DDL for all 9 tables (pre-drop backup
      into migration .down.sql)
- [x] Write up + down migration files
- [x] Apply to prod D1 (remote execute, file mode)
- [x] Verify: `sqlite_master` no longer lists the 9; spot counts
      unchanged on orders/payments/users/customers
- [x] Update README.md remote-only section + specs/matrix/phase-map
      + DOMAIN_MAP/CURRENT_STATE
- [x] Full test suite + tsc green (359 files / 3269 tests; tsc 0)
- [x] Reviewer pass + commit (PASS 9.2/10; H1 fixed —
      20260824_04 rewrite ALTER RENAME → DROP IF EXISTS; odoo count
      5→6 corrected)

## Success criteria

- 9 orphan tables gone from prod; 0 data loss (0-row verified pre-drop)
- Down-migration recreates table shells with recovered DDL
- Docs/specs no longer claim `_new` duplicates exist
- 359 files / 3269 tests green; tsc exit 0

## Risks

- Remote-only DDL unknown pre-drop → mitigated: dump schema first,
  embed in .down.sql
- Rollback law (repo-root spec §26): down-migration + old bundle
  deployable — satisfied (no code reads these tables)

## Rollback

- Apply `.down.sql` (recreates shells); tables were empty — no data
  restore needed
