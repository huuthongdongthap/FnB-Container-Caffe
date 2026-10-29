# Cook Report — CRM 360, Campaign Engine, OpenAPI Table Zones, Order Lifecycle & Audit Column Cutover (`20261029_10`)

- **Date:** 2026-10-29
- **Phase:** Go-Live D1 Schema & OpenAPI Handler Cutover (`20261029_10`)
- **Status:** COMPLETED & VERIFIED

## 1. Deliverables Executed

1. **D1 Forward & Rollback Migrations (`20261029_10`)**:
   - `worker/db/migrations/20261029_10_crm_campaigns_table_zones_and_audit_column_cutover.sql`
   - `worker/db/migrations/20261029_10_crm_campaigns_table_zones_and_audit_column_cutover.down.sql`
   - Creates `table_zones` and seeds canonical zones (`indoor`, `outdoor`, `rooftop`, `vip`).
   - Adds OpenAPI layout & metadata columns (`code`, `zone_id`, `min_capacity`, `shape`, `position_x`, `position_y`, `width`, `height`, `rotation`, `sort_order`, `is_active`, `location_id`, `current_session_id`, `metadata`) to canonical `cafe_tables` and backfills from `table_number` / `zone`.
   - Adds `tier` and `birthday` to `customers` and backfills from `loyalty_tier` / `date_of_birth`.
   - Adds `order_number`, `channel`, `source`, `tax_amount`, `happy_hour_applied`, `total_cents`, `placed_at`, `served_at`, `completed_at`, `cancelled_at` to `orders`.
   - Adds `trigger_type`, `error_message`, `created_at` to `campaign_logs`.
   - Adds `updated_at`, `created_by` to `consents`; `type`, `value` to `customer_identities`; `points` to `loyalty_point_logs`; `actor`, `resource`, `ip` to `audit_logs`; and `available` to `products`.
2. **Canonical Schema Synchronization**:
   - Updated `worker/schema.sql` across `products`, `cafe_tables`, `table_zones`, `customers`, `orders`, `loyalty_point_logs`, `campaign_logs`, `customer_identities`, `consents`, and `audit_logs`.
3. **OpenAPI Table Zones, Tables, Orders & Campaign Engine Alignment**:
   - `worker/src/schemas/tables.ts`: Extended `TableCreateSchema`, `TableUpdateSchema`, `TableZoneCreateSchema`, and `TableZoneUpdateSchema` so nested `position`, `dimensions`, `isActive`, `locationId`, `sortOrder`, and `metadata` are preserved by Zod validation alongside flat `x`, `y`, `width`, `height`, `rotation`, and `displayOrder`.
   - `worker/src/routes/openapi-tables-handlers/table-crud-handlers.ts` & `zone-crud-handlers.ts`: Aligned `cafe_tables` and `table_zones` CRUD queries to persist layout coordinates, dimensions, `code`, `zone_id`, `location_id`, and `metadata`.
   - `worker/src/routes/openapi-orders-handlers/order-read-handlers.ts`: Registered `OrderRoutes.summary` (`/api/orders/summary`) before `OrderRoutes.get` (`/api/orders/{id}`) so Hono does not shadow `/api/orders/summary` with `id = "summary"`.
   - `worker/src/tree/campaigns/campaign-engine.ts`: Updated `logSend` to populate both `(trigger, sent_at, error)` and `(trigger_type, created_at, error_message)` in `campaign_logs`.
4. **End-to-End Cutover Verification**:
   - `worker/src/__tests__/integrations/crm-campaigns-table-zones-cutover.test.ts`: Verifies `20261029_03..10` forward migrations, `.down.sql` rollback and re-application, OpenAPI Table Zones & Tables CRUD (`position`/`dimensions` persistence and 409 non-empty zone deletion guard), KDS Mobile primary query (`notes` + `order_number`), OpenAPI Orders (`sort=order_number`, `/api/orders/summary`, lifecycle timestamps `served_at` + `completed_at`), Campaign Engine deduplication, and `customers.tier` + `customers.birthday` backfill.

## 2. Verification Summary

- `npx vitest run src/__tests__/integrations/crm-campaigns-table-zones-cutover.test.ts src/__tests__/integrations/dindin-mautic-shift-reconciliation-cutover.test.ts src/__tests__/integrations/reservations-erpnext-openapi-v1-cutover.test.ts src/__tests__/routes/web-payment-and-staging-gates.test.ts` -> **4 files, 19/19 tests PASS**
- `npx vitest run src/__tests__/routes/openapi-orders.test.ts` -> **15/15 tests PASS**
- `npm run lint:migrations` -> **PASS (82 forward, 13 down migrations verified; 55 forward / 13 down in `worker/db/migrations`)**
- `npm run typecheck:all` -> **PASS (0 errors)**

## 3. Unresolved Questions

- None. Remote D1 migration execution (`wrangler d1 migrations apply fnb-caffe-db --remote`) and production deployment remain gated on explicit operator confirmation.
