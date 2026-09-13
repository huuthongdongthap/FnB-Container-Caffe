# M1 Batch 3 — D1 Orphan-Table Retirement + D7 Spec Reconciliation

Date: 2026-09-13 · Result: shipped 5ea380d · 359 files / 3269 tests green · tsc exit 0 · review PASS 9.2/10

## What shipped

- Migration `20260913_02_retire_orphan_tables` (+ `.down.sql` with DDL
  recovered verbatim from live `sqlite_master` pre-drop): dropped 9
  orphan tables — `users_legacy`, `checkin_log`, `odoo_*` (6),
  `erpnext_invoices`. All 0 rows, zero SQL consumers in worker/src + src.
- Spec reconciliation: D7 (payments/subscription `_new` merges) closed
  RESOLVED-NOT-NEEDED — migrations 006/013 were recreate+rename; no
  `_new` table ever existed in prod; subscription family never
  provisioned. Corrected migration-matrix, phase-map M1 §2, DOMAIN_MAP
  §1/§5, CURRENT_STATE P4, migrations README.
- `20260824_04_users_recreate` rewritten (review H1): ALTER RENAME →
  DROP IF EXISTS — fresh bootstraps no longer resurrect `users_legacy`
  by renaming the canonical `users` table away.

## Decisions

- Scope pivoted from "D7 duplicate merges" to orphan retirement after
  live-D1 verification overturned the premise — owner approved via
  AskUserQuestion ("Retire orphans" + "Drop users_legacy").
- `users_legacy` dropped despite 20260824_04's original "preserves for
  forensics" comment — table stayed empty for 20 days; owner called it.
- Kept (verified active): `bonus_campaigns` (3 rows + campaign.ts reads),
  campaign_configs/campaign_logs/signup_bonus_log/loyalty_audit_log
  (mounted /api/campaigns code), erpnext_mappings/sync_log/sync_queue/
  product_sync (active code), all live-data tables.

## Lessons

- The migration-matrix D7 rows were written from reading migration
  files, not the live DB — recreate+rename migrations leave no `_new`
  artifacts, so the "merge" was unnecessary from day one. **Verify
  live state before planning schema work.** One `sqlite_master` query
  killed a whole phantom batch.
- A "rename for forensics" migration is a time bomb on fresh
  environments: it renames whatever table exists, including the
  canonical one created by schema.sql. Rollback-safe retirements need
  `DROP IF EXISTS` semantics, not renames.
- DDL recovery before drop made the down-migration trivial and the
  review empirically validated it against real SQLite — rollback is
  proven, not assumed.

## Open items (recorded, not this batch)

- `payments` refund-column apply-state divergence (live table lacks
  006's refund columns)
- Subscription family provisioning decision (code mounted, tables
  absent — business call)
- `subscriptions` defined in both schema.sql and migration 008
