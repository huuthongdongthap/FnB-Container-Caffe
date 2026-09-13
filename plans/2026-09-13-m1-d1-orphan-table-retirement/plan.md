# M1 Batch 3 — D1 Orphan-Table Retirement + Spec Reconciliation (D7/D1)

**Status: COMPLETE** 2026-09-13 — executed same day after owner
approval ("Retire orphans" + "Drop users_legacy" + plan Execute).
9 orphan tables dropped from prod D1 (migration 20260913_02); DDL
preserved in down-migration; specs reconciled; 359 files / 3269
tests green; tsc exit 0; review PASS 9.2/10
(`plans/reports/reviewer-260913-m1-batch3-orphan-retirement.md`).

## Locked decision (owner, 2026-09-13)

Live-D1 verification overturned the D7 merge premise: no `_new`
tables exist (migrations 006/013 were recreate+rename, already
unified), and the subscription family was never provisioned. Batch 3
pivots to the real D1 hygiene work: retire verified orphan tables
(9 tables, 0 rows, zero code consumers) and correct the specs that
recorded the wrong assumption.

## Requirements

1. Drop 9 orphan tables (0 data rows, 0 code consumers):
   users_legacy, checkin_log, odoo_invoices, odoo_mappings,
   odoo_customer_consent, odoo_product_sync, odoo_sync_failures,
   odoo_sync_logs, erpnext_invoices
2. Down-migration with recovered DDL (pragma dump pre-drop)
3. Spec/doc reconciliation: migration-matrix D7 rows → resolved,
   phase-map §2.5, DOMAIN_MAP §5, CURRENT_STATE P4, migrations
   README remote-only list
4. Full suite + tsc green (no code touches dropped tables)

## Phases

| # | Phase | File | Status |
|---|---|---|---|
| 1 | Retire orphan tables + spec reconciliation | phase-01-retire-orphan-tables.md | complete |

## Not in this batch (recorded for later)

- payments refund-column apply-state divergence (live table vs 006)
- Subscription family provisioning decision (code mounted, tables
  absent — needs business decision)
- campaign/loyalty remote-only tables (active code keeps them)

## Laws binding this batch

- Repo-root spec §26: down-migration + old bundle stays deployable
  (trivially satisfied — no code reads dropped tables)
- D1 decision register: D7 closes as RESOLVED-NOT-NEEDED with
  evidence trail (live sqlite_master queries 2026-09-13)
