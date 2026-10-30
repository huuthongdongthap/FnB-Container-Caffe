# Phase 01: Canonical Schema & Migration `20261030_02` Parity

## Context Links
- [Brainstorm Report](../reports/brainstorm-261030-schema-bootstrap-parity-and-legacy-fallback-hardening.md)
- `worker/schema.sql`
- `db/schema.sql`
- `worker/db/migrations/20261030_02_schema_bootstrap_and_loyalty_erpnext_column_parity.sql`

## Overview
- **Priority:** P0
- **Current Status:** Complete
- **Description:** Reconcile `worker/schema.sql` and `db/schema.sql` with all canonical production tables and columns, and add forward/rollback migration pair `20261030_02_schema_bootstrap_and_loyalty_erpnext_column_parity.sql` (+ `.down.sql`) so that both fresh bootstrap and incremental migrations achieve 0 canonical `.prepare()` compilation errors.

## Requirements
- **Functional:**
  - Add `worker/db/migrations/20261030_02_schema_bootstrap_and_loyalty_erpnext_column_parity.sql` and `.down.sql` to create `erpnext_product_sync` and `kds_stations` if missing and add missing columns on `loyalty_accounts`, `tier_configs`, `reviews`, `erpnext_mappings`, `erpnext_sync_logs`, `orders`, `cafe_tables`, `bonus_campaigns`, `ingredients`, `inventory_items`, `loyalty_audit_log`, `loyalty_redemptions`, `mrr_snapshots`, `payment_transactions`, `purchase_order_items`, and `suppliers`, then re-run `loyalty_accounts` and `tier_configs` seed upserts.
  - Reconcile `worker/schema.sql` and `db/schema.sql` so fresh bootstrap has all canonical tables and columns while preserving `order-persistence-tamper-schema.test.ts` and `catalog-canonical-reconciliation.test.ts` DDL invariants.
- **Non-Functional:**
  - Zero destructive operations on existing rows.

## Related Code Files
- Create: `worker/db/migrations/20261030_02_schema_bootstrap_and_loyalty_erpnext_column_parity.sql`
- Create: `worker/db/migrations/20261030_02_schema_bootstrap_and_loyalty_erpnext_column_parity.down.sql`
- Modify: `worker/schema.sql`
- Modify: `db/schema.sql`

## Todo List
- [x] Create `20261030_02_schema_bootstrap_and_loyalty_erpnext_column_parity.sql` and `.down.sql`
- [x] Reconcile `worker/schema.sql` and `db/schema.sql`
- [x] Verify 0 canonical `.prepare()` failures against both fresh `worker/schema.sql` and `worker/schema.sql + migrations`
