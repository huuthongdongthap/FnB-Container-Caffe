# Cook Report — Phase 11: Loyalty, Referrals, Inventory PO, Customer Events & Audit Cutover (`20261029_11`)

- **Date**: 2026-10-29
- **Status**: VERIFIED LOCAL (D1 replica + `.down.sql` rollback/re-apply + Vitest + TypeScript + Migration Linter)

## 1. Deliverables Executed
- `worker/db/migrations/20261029_11_loyalty_referrals_inventory_po_customer_events_and_audit_cutover.sql`
  - **Loyalty & Rewards**: Creates and seeds `loyalty_accounts` (backfilled from `customers`), `loyalty_tiers`, `tier_configs`, `rewards`, `user_rewards`, `loyalty_redemptions`, `checkins`, and adds `cashback_transactions.multiplier_applied`.
  - **Referrals & Promotions**: Adds `id`, `times_used`, `total_points_earned` to `referral_codes`; `created_at` to `promotion_usages`; `start_date`, `end_date` to `promotions`.
  - **Customer 360 Event Sourcing**: Creates `customer_events` and `visits`.
  - **Inventory, BOM, Purchase Orders & Forecasting**: Adds `reference_type`, `inventory_item_id` to `inventory_transactions`; `order_date`, `expected_delivery_date`, `subtotal`, `tax`, `shipping`, `total`, `received_by` to `purchase_orders`; `item_id`, `ingredient_id`, `quantity` to `recipes`; and creates `recipe_ingredients`, `inventory_snapshots`, and `inventory_forecast_snapshots` (`lead_time_days`, `snapshot_date`).
  - **Reservations, Catalog, Payments, Auth & Canonical Audit**: Adds `phone`, `pax`, `reservation_date` to `reservations`; `notes` to `cafe_tables`; `category` to `products`; `tags`, `badge` to `menu_items`; `payment_method` to `payments`; creates `payment_transactions` and `payment_reconciliation_jobs`; adds `id` to `email_verifications`; creates `staff_devices`; adds `user_id`, `entity_type`, `entity_id`, `metadata`, `operating_unit_id`, `tenant_id`, `status`, `correlation_id` to `audit_logs`; and ensures SOP, ERPNext queue, notifications, and edge telemetry tables exist.
- `worker/db/migrations/20261029_11_loyalty_referrals_inventory_po_customer_events_and_audit_cutover.down.sql`
  - Full deterministic rollback of all tables, indexes, and columns added in `20261029_11`.
- `packages/domain/audit/src/policies/audit-writer-policy.ts`, `packages/domain/customer/policies/order-ownership-policy.ts`, `worker/src/routes/openapi-promotions-handlers/usage-handlers.ts`, and all 18 OpenAPI `audit_logs` handlers (`openapi-categories-handlers`, `openapi-tables-handlers`, `openapi-loyalty-handlers`, `openapi-inventory-handlers`, `openapi-staff-handlers`, `openapi-products-handlers`, `openapi-promotions-handlers`, `openapi-orders-handlers`, `openapi-cron-handlers`, `openapi-auth-handlers`)
  - Added `id`-omitting fallback inserts on `audit_logs` populating both legacy (`actor_id, actor_name, resource_type, resource_id, details`) and canonical (`user_id, entity_type, entity_id, metadata`) columns so `INTEGER PRIMARY KEY AUTOINCREMENT` on live D1 assigns the row ID without throwing `SQLITE_MISMATCH` or `SQLITE_CONSTRAINT_NOTNULL`.
- `packages/domain/notification/src/policies/notification-orchestration-policy.ts`
  - Added `id`-omitting fallback insert on `notification_audit_log` so `id INTEGER PRIMARY KEY AUTOINCREMENT` on live D1 records `channel, recipient, phone, template_id, template_key, status, error_message, retry_count, event_id, idempotency_key, correlation_id, provider, created_at`.
- `worker/src/clients/erpnext-product-client.ts` & `worker/src/routes/erpnext-sync.ts`
  - Added `erpnext_product_id = 0` fallback on `erpnext_product_sync` and `id`-omitting + `status` fallback on `erpnext_sync_logs` to satisfy live D1 `NOT NULL` and `INTEGER PRIMARY KEY AUTOINCREMENT` constraints.
- `worker/src/routes/openapi-loyalty-handlers/tier-handlers.ts`
  - Scoped `discount_percent` to `loyalty_tier_configs` and mapped `benefits` to `perks` on `tier_configs`.
- `worker/schema.sql` & `worker/src/__tests__/integrations/loyalty-referrals-inventory-po-cutover.test.ts`
  - Synced canonical schema and verified full forward + `.down.sql` rollback + re-apply + end-to-end route and domain policy execution (`Loyalty`, `Referrals`, `Check-in`, `Promotions`, `Purchase Orders`, `Forecasting`, `claimGuestOrder`, `writeCanonicalAuditLog`, `processNotificationIntent`, `openCanonicalShift`/`recordShiftSale`/`closeCanonicalShift`, and `ErpnextProductClient.syncProductsToLocal`).

## 2. Verification Results
- `npm run lint:migrations`: `83 forward, 14 down migrations verified` (`56 forward, 14 down` in `worker/db/migrations`).
- `npm run typecheck:all`: `0 errors`.
- `npx vitest run` (full worker suite): `234 passed (234), 2343 passed (2343)`.

## 3. Unresolved Questions
- None. Remote D1 execution (`20261029_03..11`), `wrangler deploy`, and `git commit`/`git push` await explicit operator approval.
