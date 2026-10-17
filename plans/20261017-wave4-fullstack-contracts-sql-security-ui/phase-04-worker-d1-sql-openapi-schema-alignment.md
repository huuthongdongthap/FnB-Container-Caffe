# Phase 04: Worker D1 SQL Schema Alignment & OpenAPI Router Binding

## Context Links
- Brainstorm Report: `plans/20261017-wave4-fullstack-contracts-sql-security-ui/reports/brainstorm-20261017-wave4-deep-audit.md`
- Overview Plan: `plans/20261017-wave4-fullstack-contracts-sql-security-ui/plan.md`

## Overview
- **Priority**: P0
- **Status**: Pending
- **Description**: Align Worker D1 SQL queries and Zod schemas with canonical D1 tables/columns (`worker/schema.sql` & `worker/db/migrations/*.sql`), fix `worker/src/lib/openapi.ts` so real OpenAPI routers are registered before 501 fallback stubs, and wire KV config into `birthday.ts` and read receipts into `chat.ts`.

## Key Insights
- `worker/src/lib/openapi.ts:123-132` registers 501 `'Route not bound'` stubs for all OpenAPI routes BEFORE mounting `openApiCategoriesRouter`, `openApiProductsRouter`, `openApiOrdersRouter`, and `MenuRoutes`. In Hono, the first registered handler wins, so `/api/menu/full` and other OpenAPI paths return 501!
- Inventory schemas (`movements.ts`, `purchase-orders.ts`, `common.ts`) enforce `.uuid()` on IDs that the handlers generate as `ing_${Date.now()}_...`, `sup_${Date.now()}_...`, and `USR_${Date.now()}_...`.
- `inventory-forecasting.ts` queries `inventory_item_id` instead of `item_id` (and does not fallback to `ingredients`/`stock_movements`).
- `purchase-order-handlers.ts`, `ingredient-handlers.ts`, `movement-handlers.ts`, and `po-waste-handlers.ts` reference non-existent columns/tables (`expected_date`, `unit_cost` on `purchase_order_items`, `recipe_ingredients`, `cost_per_unit` on `ingredients`, `previous_stock` on `stock_movements`).

## Requirements
- In `worker/src/lib/openapi.ts`, mount `openApiCategoriesRouter`, `openApiProductsRouter`, `openApiOrdersRouter`, and `MenuRoutes` BEFORE registering fallback 501 stubs.
- Relax `.uuid()` to `z.string().min(1)` on entity IDs in `worker/src/schemas/inventory/*.ts` and `worker/src/routes/openapi-staff-handlers/routes.ts` (`IdParamsSchema`).
- Fix `purchase-order-handlers.ts` (`po_number`, `expected_delivery_date`, `unit_price`, `total_price`, `LEFT JOIN suppliers`), `ingredient-handlers.ts` (`recipe_items` with fallback), `movement-handlers.ts` (`LEFT JOIN ingredients` and canonical `stock_movements` columns with fallback), and `po-waste-handlers.ts` (`unit_cost`).
- Fix `inventory-forecasting.ts` to query `item_id` (and fallback to `ingredients` + `stock_movements`) and include `{ id, sku, name, recommended_reorder_qty }` aliases alongside `{ item_id, item_sku, item_name, suggested_reorder_qty }`.
- Update `openapi-staff-handlers/staff-handlers.ts` (`patchStaffHandler`) and `worker/src/tree/auth/list-staff.ts` so `PATCH /api/staff/:id` updates both D1 (`staff_users` / `users`) and `AUTH_KV` (`user:${email}`).
- Update `recruitment.ts` to ignore `status === 'all'` and `position === 'all'`.
- Update `birthday.ts` (`/check` and `/redeem`) to read `config:birthday` from `AUTH_KV` (`discountPercent`, `earlyWindowDays`, `lateWindowDays`).
- Update `chat.ts` (`GET /api/chat/conversations/:id/messages`) to mark customer messages as read (`UPDATE chat_messages SET read_at = ? WHERE conversation_id = ? AND sender_type = 'customer' AND read_at IS NULL`).
- Fix `erpnext-invoices.ts` (remove `m.error_message`, allow local D1 query when ERPNext env is unset, parse `request.json()` outside loop in `/retry`), `erpnext-sync.ts` (`erpnext_sync_logs` with fallback to `erpnext_sync_log`), `erpnext/expenses.ts` (fix `binds.unshift` order and graceful table fallback), `erpnext-accounting-client.ts` (`last_synced_at`), `orders-unified.ts` (`optionalAuth` on `GET /api/orders/:id`), `openapi-orders-handlers/helpers.ts` (`order.total_amount ?? order.total` and `LEFT JOIN menu_items`), `customer-menu.ts` (`now: new Date()`), `customer-assistant.ts` (join `cafe_tables` fallback), `menu-projection.ts` (`option_name`, `price_delta`, `available`), and `reservations.ts` (support `status` default `'pending'` or configurable status).

## Architecture
- All D1 queries must match `worker/schema.sql` and `worker/db/migrations/*.sql`, using safe `COALESCE` or `try/catch` fallbacks where legacy test mocks expect older column names.

## Related Code Files
- Modify:
  - `worker/src/lib/openapi.ts`
  - `worker/src/schemas/inventory/common.ts`
  - `worker/src/schemas/inventory/movements.ts`
  - `worker/src/schemas/inventory/purchase-orders.ts`
  - `worker/src/routes/openapi-inventory-handlers/ingredient-handlers.ts`
  - `worker/src/routes/openapi-inventory-handlers/movement-handlers.ts`
  - `worker/src/routes/openapi-inventory-handlers/purchase-order-handlers.ts`
  - `worker/src/routes/openapi-inventory-handlers/po-waste-handlers.ts`
  - `worker/src/routes/openapi-inventory-handlers/routes.ts`
  - `worker/src/routes/openapi-orders-handlers/helpers.ts`
  - `worker/src/routes/openapi-staff-handlers/routes.ts`
  - `worker/src/routes/openapi-staff-handlers/staff-handlers.ts`
  - `worker/src/routes/inventory-forecasting.ts`
  - `worker/src/routes/recruitment.ts`
  - `worker/src/routes/birthday.ts`
  - `worker/src/routes/chat.ts`
  - `worker/src/routes/erpnext-invoices.ts`
  - `worker/src/routes/erpnext-sync.ts`
  - `worker/src/routes/erpnext/expenses.ts`
  - `worker/src/routes/erpnext/customers.ts`
  - `worker/src/routes/erpnext/vendors.ts`
  - `worker/src/clients/erpnext-accounting-client.ts`
  - `worker/src/routes/orders-unified.ts`
  - `worker/src/routes/customer-menu.ts`
  - `worker/src/routes/customer-assistant.ts`
  - `worker/src/tree/auth/list-staff.ts`
  - `packages/domain/catalog/policies/menu-projection.ts`
  - `packages/domain/reservation/src/routes/reservations.ts`

## Implementation Steps
1. Fix `worker/src/lib/openapi.ts` router registration order.
2. Relax ID schemas in `worker/src/schemas/inventory/*.ts` and `openapi-staff-handlers/routes.ts`; fix SQL in `openapi-inventory-handlers/*` and `inventory-forecasting.ts`.
3. Update `recruitment.ts`, `birthday.ts`, `chat.ts`, `openapi-staff-handlers/staff-handlers.ts`, and `list-staff.ts`.
4. Fix `erpnext-invoices.ts`, `erpnext-sync.ts`, `erpnext/expenses.ts`, `erpnext/customers.ts`, `erpnext/vendors.ts`, and `erpnext-accounting-client.ts`.
5. Fix `orders-unified.ts`, `openapi-orders-handlers/helpers.ts`, `customer-menu.ts`, `customer-assistant.ts`, `menu-projection.ts`, and `reservations.ts`.

## Todo List
- [ ] Mount real routers before 501 stubs in `worker/src/lib/openapi.ts`
- [ ] Fix Inventory Zod ID schemas and D1 SQL queries (`purchase-order-handlers`, `ingredient-handlers`, `movement-handlers`, `po-waste-handlers`, `inventory-forecasting`)
- [ ] Fix `recruitment.ts`, `birthday.ts` KV config, and `chat.ts` `read_at`
- [ ] Fix `erpnext-invoices.ts`, `erpnext-sync.ts`, and `erpnext/*` SQL
- [ ] Fix `orders-unified.ts`, `openapi-orders-handlers/helpers.ts`, `customer-menu.ts`, and `menu-projection.ts`

## Success Criteria
- Zero `no such table` / `no such column` errors across Inventory, Forecasting, ERPNext, Orders, Menu Projection, Recruitment, Birthday, and Chat routes.
- All existing Worker and Domain tests pass.

## Risk Assessment
- Some existing tests mock SQL strings (e.g. `erpnext_sync_log` in `phase-19-mobile-kds-admin-contracts.test.ts`); use `try/catch` fallback so both canonical `erpnext_sync_logs` and mock `erpnext_sync_log` work seamlessly.

## Security Considerations
- `GET /api/orders/:id` uses `optionalAuth()` while preserving ownership checks via `order-ownership-policy.ts`.

## Next Steps
- Coordinates with Phase 05 security & cron hardening.
