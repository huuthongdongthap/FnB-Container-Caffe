# Phase 02: BOM `recipe_ingredients` & `cron_jobs` Seed Cutover

## Context Links
- Brainstorm Report: `plans/reports/brainstorm-261030-post-cutover-live-hardening-and-data-completeness.md`
- Ingredient Deletion Guard: `worker/src/routes/openapi-inventory-handlers/ingredient-handlers.ts:319`
- Cron Handlers: `worker/src/routes/cron-handlers/query-handlers.ts`, `worker/src/routes/openapi-cron-handlers/job-handlers.ts`

## Overview
- **Priority**: P1 (Inventory BOM referential integrity & Admin Cron visibility)
- **Current Status**: Pending
- **Description**: Populate `recipe_ingredients` from existing `recipe_items JOIN recipes` (`46` rows) so `/api/v1/inventory/ingredients/:id` `DELETE` guards work against live BOM data, and seed the 5 canonical scheduled jobs into `cron_jobs`.

## Key Insights
- Live D1 has `14` rows in `recipes` and `46` rows in `recipe_items`, while `recipe_ingredients` has `0` rows.
- `ingredient-handlers.ts:319` queries `SELECT COUNT(*) as count FROM recipe_ingredients WHERE ingredient_id = ?` to block deleting ingredients used in active recipes (`409 INGREDIENT_IN_USE`).
- Live D1 `cron_jobs` has `0` rows; seeding the 5 Worker cron tasks (`payos_reconciliation`, `campaign_engine`, `erpnext_sync`, `inventory_forecast`, `cashback_expiry`) ensures `/api/cron/jobs` and `/api/v1/cron/jobs` immediately expose job metadata and schedules.

## Requirements
- **Functional**:
  - Backfill `recipe_ingredients (id, recipe_id, item_id, ingredient_id, quantity, unit)` from `recipe_items ri JOIN recipes r ON r.id = ri.recipe_id` using `INSERT OR IGNORE`.
  - Also backfill `recipes.item_id`, `recipes.ingredient_id`, and `recipes.quantity` for primary recipe rows where `recipes.item_id IS NULL`.
  - Seed the 5 canonical `cron_jobs` rows using `INSERT OR IGNORE`.
- **Non-Functional**:
  - Must pass `node scripts/lint-d1-migrations.mjs` (`0` errors, paired `.down.sql`).

## Architecture
- `recipe_items` + `recipes` → `INSERT OR IGNORE INTO recipe_ingredients` → protects `/api/v1/inventory/ingredients/:id` and `/api/inventory/deduct`.
- `cron_jobs` seed → `GET /api/cron/jobs` & `GET /api/v1/cron/jobs`.

## Related Code Files
- Create/Modify: `worker/db/migrations/20261030_01_catalog_images_bom_ingredients_and_cron_seed.sql`
- Create/Modify: `worker/db/migrations/20261030_01_catalog_images_bom_ingredients_and_cron_seed.down.sql`
- Test: `worker/src/__tests__/integrations/loyalty-referrals-inventory-po-cutover.test.ts`

## Implementation Steps
1. In `20261030_01_catalog_images_bom_ingredients_and_cron_seed.sql`, add `INSERT OR IGNORE INTO recipe_ingredients (id, recipe_id, item_id, ingredient_id, quantity, unit)` selecting from `recipe_items ri JOIN recipes r ON r.id = ri.recipe_id`.
2. Update `recipes` `item_id = menu_item_id` where `item_id IS NULL`.
3. Insert the 5 canonical scheduled jobs into `cron_jobs` (`cron_payos_reconcile`, `cron_campaign_engine`, `cron_erpnext_sync`, `cron_inventory_forecast`, `cron_cashback_expiry`) with `INSERT OR IGNORE`.
4. Create the paired `.down.sql` that removes the seeded rows idempotently.

## Todo List
- [ ] Add `recipe_ingredients` backfill from `recipe_items JOIN recipes`
- [ ] Add `cron_jobs` canonical seed rows
- [ ] Verify migration against the 126-table production D1 replica in Vitest

## Success Criteria
- `SELECT COUNT(*) FROM recipe_ingredients` equals `46` on the production replica.
- `SELECT COUNT(*) FROM cron_jobs` equals `5` on the production replica.
- `node scripts/lint-d1-migrations.mjs` passes with `0` errors.

## Risk Assessment
- **Risk**: Duplicate IDs on re-run.
- **Mitigation**: Deterministic IDs (`'ri_' || ri.id`) with `INSERT OR IGNORE`.

## Security Considerations
- Read-only schedule metadata in `cron_jobs`; execution still requires admin JWT or `X-Cron-Secret`.

## Next Steps
- Proceed to Phase 03 for Pages `/api/*` proxy and Service Worker hardening.
