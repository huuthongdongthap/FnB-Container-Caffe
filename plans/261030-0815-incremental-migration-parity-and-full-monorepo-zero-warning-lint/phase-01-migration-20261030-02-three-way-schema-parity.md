# Phase 01: Migration `20261030_02` 3-Way Schema Parity

## Context Links
- [Brainstorm Report](../reports/brainstorm-261030-incremental-migration-parity-and-full-monorepo-zero-warning-lint.md)
- `worker/db/migrations/20261030_01_schema_bootstrap_and_loyalty_erpnext_column_parity.sql`
- `worker/schema.sql`
- `db/schema.sql`

## Overview
- **Priority:** P0
- **Current Status:** Complete
- **Description:** Create forward and rollback migration pair `20261030_02_replica_schema_parity_and_waste_log_cutover.sql` (+ `.down.sql`) so `createProductionReplica() + migrations` matches `worker/schema.sql` and `db/schema.sql` across all 124 tables and all columns.

## Related Code Files
- Create: `worker/db/migrations/20261030_02_replica_schema_parity_and_waste_log_cutover.sql`
- Create: `worker/db/migrations/20261030_02_replica_schema_parity_and_waste_log_cutover.down.sql`

## Todo List
- [x] Create `worker/db/migrations/20261030_02_replica_schema_parity_and_waste_log_cutover.sql`
- [x] Create `worker/db/migrations/20261030_02_replica_schema_parity_and_waste_log_cutover.down.sql`
- [x] Verify `npm run lint:migrations` and 124-table column parity on `createProductionReplica() + migrations`
