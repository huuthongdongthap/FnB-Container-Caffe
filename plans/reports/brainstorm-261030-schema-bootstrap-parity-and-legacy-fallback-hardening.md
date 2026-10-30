# Empirical Brainstorm Report: Schema Bootstrap Parity, Legacy Fallback Hardening & Zero-Warning Worker Convergence

**Date:** 2026-10-30
**Baseline Commit:** `9f7e0bd98c2503cb0c98e40a96e05b2f5e62f654`
**Tracked Product Diff SHA-256 (Pre-Phase):** `70ee465b21bce7f49641a62d3e7631f5213a154a949664d6373c8d97012aa889`
**Environment:** Local repository + in-memory `node:sqlite` (`DatabaseSync`) empirical SQL compilation scan across all 1,496 static `.prepare()` statements (`packages/domain/**` + `worker/src/**`).

---

## 1. Executive Summary & Empirical Root-Cause Matrix

Following the 498/498 Vitest suite convergence in `261030-0630`, an AST/regex SQL compilation scan of all **1,496 static `.prepare()` statements** in `packages/domain/**` and `worker/src/**` against:
1. **Fresh bootstrap (`worker/schema.sql` alone)** — used by `scripts/local-payment-flow/local-runtime.mjs`, `order-creation-fixture.ts`, `privacy-sqlite-fixture.ts`, and `wrangler d1 execute --file=schema.sql`
2. **Bootstrap + all forward migrations (`worker/schema.sql` + `worker/db/migrations/*.sql`)**
3. **Production D1 126-table replica (`createProductionReplica()` + `20261029_03..11` + `20261030_01`)**

surfaced **4 concrete, empirically verified engineering gaps**:

| # | Subsystem | Empirical Root Cause | Runtime / Gate Impact |
|---|---|---|---|
| **F1** | `worker/schema.sql`, `db/schema.sql` & `20261030_02` Forward Migration | `worker/schema.sql` defines narrower pre-cutover shapes for `loyalty_accounts` (missing `current_points`, `order_count`, `last_activity_at`), `tier_configs` (missing `tier_name`, `cashback_rate`, `points_multiplier`, `point_multiplier`, `birthday_discount`, `display_name_vi`, `min_spent_vnd`, `max_spent_vnd`, `expiry_days`, `perks`, `sort_order`, `created_at`, `updated_at`), and `reviews` (`content TEXT NOT NULL` without default, missing `order_id`, `customer_id`, `comment`, `is_approved`, `is_visible`, `updated_at`). Because `20261029_07` and `20261029_11` use `CREATE TABLE IF NOT EXISTS`, those narrower definitions block column creation and cause `20261029_11` `INSERT OR IGNORE` to fail. Additionally, `erpnext_product_sync` and `kds_stations` are missing from `worker/schema.sql` + migrations, and `erpnext_mappings.error_message`, `erpnext_sync_logs.mapping_id/attempt/error_message`, `orders.reward_code_used/staff_id/table_number/is_cod/fulfillment_type/delivery_address`, and `cafe_tables.seats/notes` are absent in `worker/schema.sql`. | **19 primary canonical `.prepare()` queries fail** on `worker/schema.sql + migrations`, and **289 `.prepare()` queries fail** on fresh `worker/schema.sql` bootstrap. |
| **F2** | `packages/domain/shift/src/policies/cash-reconciliation-policy.ts:45-61` | When `reconcileShiftCash(db, { shiftId, actualCash })` is called with a `shiftId` not found in `staff_shifts` (`staffShift === null`), `!clockIn` is true. The fallback queries legacy `shifts` in a `try` block, catches `no such table: shifts`, and then executes a second query on `shifts` (`SELECT COALESCE(actual_start, start_time) ... FROM shifts`) **outside** any `try/catch`. | Throws uncaught `SQLITE_ERROR: no such table: shifts` (`500` crash) instead of returning `{ ok: false, error: 'shift_not_found' }` on canonical D1. |
| **F3** | `worker/src/tree/analytics/zone-analytics.ts:32-44`, `worker/src/routes/tables-mobile.ts:180-185`, `worker/src/routes/customer-assistant.ts:84-106` | (a) `zone-analytics.ts:34`: when a store has `0` completed orders (`zones.length === 0`), it executes an unguarded fallback query joining `LEFT JOIN tables t` (`no such table: tables`).<br>(b) `tables-mobile.ts:182`: when `usedLegacyTables === false` and `updatedChanges === 0`, it executes an unguarded `UPDATE tables SET status = ? WHERE id = ?`.<br>(c) `customer-assistant.ts:96`: fallback `table_bill` query references `o.table_number` without a `cafe_tables` join fallback. | Unhandled `no such table: tables` `500` errors on empty-order zone analytics or mobile table updates, and silent `null` table bill lookup when `orders.table_number` is unpopulated. |
| **F4** | `worker/src/` ESLint Hygiene (`6` unused declarations) | `SopRunProgressSchema` (`sop-admin-read-handlers.ts:26`), `findViolation` (`sop-admin-write-handlers.ts:19`), `SOP_ROLES` (`sop-mobile/queries.ts:22`), `SopItemParamsSchema` (`schemas/sop-routes.ts:17`), `SopDisciplineStepEnum` (`schemas/sop.ts:25`), and `WebPushError` (`types/module-ambient.d.ts:17`) are unused in `worker/src/`. | `6` ESLint warnings in `worker/src/`. |

---

## 2. Option Analysis (YAGNI / KISS / DRY)

### Option A (Recommended): Canonical Schema Bootstrap Parity + Migration `20261030_02` + Legacy Fallback Hardening + Zero-Warning Worker Src
1. **Phase 01 — Canonical Schema & Migration `20261030_02` Parity (`worker/schema.sql`, `db/schema.sql`, `worker/db/migrations/20261030_02_*.sql`)**:
   - Create `worker/db/migrations/20261030_02_schema_bootstrap_and_loyalty_erpnext_column_parity.sql` (+ `.down.sql`) to idempotently create `erpnext_product_sync` and `kds_stations` and reconcile all missing columns on pre-existing `loyalty_accounts`, `tier_configs`, `reviews`, `erpnext_mappings`, `erpnext_sync_logs`, `orders`, `cafe_tables`, `bonus_campaigns`, `ingredients`, `inventory_items`, `loyalty_audit_log`, `loyalty_redemptions`, `mrr_snapshots`, `payment_transactions`, `purchase_order_items`, and `suppliers`.
   - Reconcile `worker/schema.sql` and `db/schema.sql` so that a fresh `worker/schema.sql` bootstrap contains all canonical tables and columns while preserving existing DDL contract tests (`order-persistence-tamper-schema.test.ts` and `catalog-canonical-reconciliation.test.ts`).
2. **Phase 02 — Legacy Fallback Hardening (`cash-reconciliation-policy.ts`, `zone-analytics.ts`, `tables-mobile.ts`, `customer-assistant.ts`)**:
   - Wrap the secondary `shifts` fallback in `cash-reconciliation-policy.ts:53-60` in `try / catch` so missing shift IDs cleanly return `{ ok: false, error: 'shift_not_found' }` on canonical D1.
   - Wrap the legacy `tables` fallbacks in `zone-analytics.ts:34-43` and `tables-mobile.ts:180-185` in `try / catch`.
   - Add a `cafe_tables` join fallback in `customer-assistant.ts:95-107` when `orders.table_number` is absent or null.
3. **Phase 03 — Worker Source Zero-Warning ESLint Cleanup & Regression Tests**:
   - Clean the 6 unused symbols in `worker/src/` (`sop-admin-read-handlers.ts`, `sop-admin-write-handlers.ts`, `sop-mobile/queries.ts`, `schemas/sop-routes.ts`, `schemas/sop.ts`, `types/module-ambient.d.ts`).
   - Update `web-payment-and-staging-gates.test.ts` for the new migration pair (`38` forward / `37` rollback) and add empirical regression assertions in `loyalty-referrals-inventory-po-cutover.test.ts` for `reconcileShiftCash` missing-shift handling, `zone-analytics` zero-order handling, and `worker/schema.sql` + `20261030_02` parity.
4. **Phase 04 — Full-Monorepo Verification & Audit Baseline Lock**:
   - Verify `npm run typecheck:all`, `npm run lint`, full `npx vitest run`, `npx vite build`, `npm run verify:gates`, and rebaseline `source-baseline.json`.

### Option B: Suppress SQL Errors Only in Application Handlers Without Fixing `worker/schema.sql`
- **Rejected:** Violates the project invariant (`tests/bootstrap-payment-schema.test.ts`: *"has the real optional side-effect tables instead of bypassing SQL errors"*).

---

## 3. Hard Constraints & Invariant Preservation
- Dirty working tree preserved; no destructive git operations.
- D1 authority for Staff, 8h absolute TTL (`STAFF_SESSION_ABSOLUTE_TTL_SECONDS = 28800`), device binding, and separate customer TTL remain untouched.
- External cloud gates (`DB Admin live`, `real roster`, `deployed origin live`, `production_readiness`) remain `UNKNOWN/NOT_RUN` / `NOT_ESTABLISHED`.
- Unresolved questions: None.
