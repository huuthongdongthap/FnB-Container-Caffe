# Arch Audit 03 — Data & Schema (D1/SQLite, Migrations, Sync, Tests)

**Goal:** check lại toàn bộ kiến trúc (--auto --parallel) | **Date:** 2026-09-07 | **Mode:** in-session (subagent 403 fallback)
**Scope:** schema.sql, 3 migration trees, db access layer, ERPNext sync, test coverage, seed.

## Executive Summary

CRITICAL: **three coexisting migration trees** with the ACTIVE deploy path (`deploy-cloudflare.sh:61`) applying the WRONG one — `scripts/migrations/` (7 legacy odoo/erpnext files) — while the real migration history (`worker/db/migrations/`, 24 files incl. users/checkins/locality/tenant) is only applied via manually-run `worker/scripts/apply-migrations.sh` (referenced by zero deploy automation). CI deploy.yml runs NO migrations at all. Fresh DB bootstrap cannot be reproduced; prod DB has drifted beyond repo's control. Schema.sql indexes are solid for hot paths. Tests green but 53/93 route files untested directly.

## Findings

| ID | Sev | file:line | Issue | Fix |
|---|---|---|---|---|
| D1 | **P0** | `deploy-cloudflare.sh:61` `MIGRATIONS_DIR="scripts/migrations"` | Active deploy script auto-applies LEGACY tree (odoo/campaign, 7 files); the current tree `worker/db/migrations/` (24 files: users, checkins, tenant binding, locality, email verification...) is NOT applied by any automated path | Point MIGRATIONS_DIR at `worker/db/migrations`; archive scripts/migrations |
| D2 | **P0** | `.github/workflows/deploy.yml` (no d1 step) | CI deploy runs `wrangler deploy` with zero migration step → new envs miss ALL schema after 2026-04 | Add migration step (wrangler d1 execute --file per pending migration, tracked) or adopt `wrangler d1 migrations` state table |
| D3 | P1 | `worker/migrations/` (11 files 004–014) vs `worker/db/migrations/` (24) | 2nd orphan tree inside worker/ — never referenced by any script (grep: only plan docs mention db/migrations) | Delete/archive — split-brain risk for future contributors |
| D4 | P1 | `worker/db/migrations/20260826_02_users_table.sql` vs `20260824_04_users_recreate.sql` | Both CREATE users; 04 renames prod legacy table then recreates — order-dependent; 02's header comment truncated mid-sentence (says migration story but body only has index) — file was overwritten at some point losing its CREATE TABLE (recovered only in 04) | Add one-shot migration ledger note; verify prod actually ran 04 |
| D5 | P1 | `apply-migrations.sh:5` comment "Each .sql file is idempotent" vs `20260826_02` ALTER ADD COLUMN (fails on re-run "duplicate column") | Comment false — re-running apply-migrations.sh always errors on locality file, breaking CI-style invocation | Convert comment to truth; wrap ALTERs in pragma-driven guard or split apply-once |
| D6 | P2 | `worker/src/routes/openapi-*.ts` — dynamic UPDATE builder duplicated ×6 (users, staff_shifts, tables, table_zones, categories, promotions, ingredients) | DRY violation; identical `updates.join(', ')` pattern copy-pasted | Extract `buildSetClause()` into lib/db.ts |
| D7 | P2 | `worker/db/migrations/20260824_04` `ALTER TABLE users RENAME TO users_legacy` | Legacy table w/ PII (phone) retained forever, untracked by any doc | Document + schedule drop after verification window |
| D8 | P2 | Test coverage: 53 of 93 route files lack direct tests (admin-*, openapi-* ×11, payments-nowpayments, webhooks(covered via debug tests? no — webhooks untested), saas-*, kds-stream, cron, reservations, reports, subscriptions...) | Payment/webhook/cron = money paths untested at route level (some logic tested via lib/middleware tests) | Prioritize: webhooks, openapi-payments, cron, reports |
| D9 | P3 | `worker/seed.sql` — 17 INSERTs, menu_items only, no PII | Clean seed ✓ — no action | — |
| D10 | P3 | `schema.sql` indexes | orders(status, created_at, payment_status), customers(email, tier), order_items(order_id), payments(order_id) all present ✓ | Add composite idx_orders_status_created (status queries filter+sort) |
| D11 | P2 | ERPNext retry queue (`cron.ts` processErpnextRetryQueue): SELECT pending w/ attempts but no MAX cap in SQL | Retries unbounded in queue (MAX_RETRIES const exists but rows with attempts≥MAX never deleted/marked dead in visible slice) | Mark dead + alert after N attempts |
| D12 | P3 | locality migration: code doesn't read fields yet ("no code reads these yet" per file comment) — `SELECT *` keeps additive | Intentional forward-migration ✓ documented | Wire FE when Phase 5 localization lands |

## ERPNext Sync Assessment

Queue-based (erpnext_sync_queue + retry w/ next_retry_at), env-gated (skips when unconfigured), 148 worker test files cover erpnext clients (accounting/crm/product) + invoices/pos/sync partially. Webhook signature (PayOS HMAC-SHA256) tested via dedicated lib tests. Sound design; D11 retry-cap gap only.

## Test Coverage Matrix

- Worker: 151 files / 1,547 tests green (3.8s) ✓
- Root FE: 341 files / 3,115 tests green (43.5s) ✓
- Route files w/o direct test: 53/93 (57%) — worst gaps in money paths (payments-nowpayments, webhooks e2e, openapi-payments)
- Migrations: 0 test/verify tooling (no drift checker, no fresh-DB bootstrap test)

## Top 5 Risks

1. **D1+D2 migration split-brain** — active deploy applies wrong tree; CI applies none.
2. **D5 false idempotency** — locality ALTER breaks scripted re-apply.
3. **D8 money-path test gaps**.
4. **D6 DRY violation** ×6 in openapi routes.
5. **D4 migration archaeology** — users story spans 2 files, one truncated.

## Unresolved Questions

- Has prod DB actually run 20260824_04 (users_legacy rename)? Check via wrangler d1 query when convenient.
- scripts/migrations/006 duplicated numbering (006-campaign-logs + 006-push-subscriptions) — legacy collision, harmless if archive.
- deploy-branded.sh (scripts/deploy-branded.sh:230) also points at scripts/migrations — same D1 fix needed there.
