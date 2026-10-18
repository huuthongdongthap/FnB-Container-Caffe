# Phase 03: Worker OpenAPI Zod Schemas & OpenAPI Route Handlers Alignment

## Context Links
- Brainstorm Report: `plans/20261018-wave5-pos-loyalty-admin-d1-domain-hardening/reports/brainstorm-20261018-wave5-deep-audit.md`
- Overview Plan: `plans/20261018-wave5-pos-loyalty-admin-d1-domain-hardening/plan.md`

## Overview
- **Priority**: P0
- **Status**: Completed
- **Description**: Relax overly strict `.uuid()` and `.datetime()` constraints in `worker/src/schemas/**`, align `worker/src/routes/openapi-*.ts` with canonical D1 tables/columns and `'admin'` RBAC, include `menuItemId` in customer order items, and allow string/number `category_id` in `worker/src/lib/validators/products.ts`.

## Key Insights
- Real D1 records use prefixed IDs (`ORD_...`, `CUST_...`, `USR_...`, `TBL_...`, `PRD_...`, `CAT_...`, `PAY_...`, `tier_...`, integer IDs) and SQLite `YYYY-MM-DD HH:MM:SS` timestamps.
- Legacy OpenAPI route files (`worker/src/routes/openapi-{menu,products,orders,payments,customers,loyalty,promotions,reservations,shifts,staff,tables,analytics}.ts`) query non-existent tables/columns (`payments`, `loyalty_tiers.min_spend`, `loyalty_transactions`, `promotions.valid_until`, `reservations.reservation_date`/`guest_count`, `shifts`, `staff`) and omit `'admin'` from `requireAuth`.
- `formatCustomerOrderItem` in `worker/src/routes/openapi-orders-handlers/helpers.ts` strips `product_id`/`menu_item_id`, breaking "Reorder" on `/account`.

## Requirements
- Relax `.uuid()` and `.datetime()` across `worker/src/schemas/{common,orders,payments,staff,tables}.ts` and `worker/src/schemas/{promotions/PromoSchema,loyalty/*,inventory/*}.ts`.
- Fix SQL queries, RBAC (`'admin'`), and response envelopes in `worker/src/routes/openapi-{menu,products,orders,payments,customers,loyalty,promotions,reservations,shifts,staff,tables,analytics}.ts`.
- Include `menuItemId` and `product_id` in `formatCustomerOrderItem` (`worker/src/routes/openapi-orders-handlers/helpers.ts`).
- Accept `z.union([z.string(), z.number().transform(String)]).optional()` for `category_id` in `worker/src/lib/validators/products.ts`.

## Related Code Files
- Modify:
  - `worker/src/schemas/common.ts`
  - `worker/src/schemas/orders.ts`
  - `worker/src/schemas/payments.ts`
  - `worker/src/schemas/staff.ts`
  - `worker/src/schemas/tables.ts`
  - `worker/src/schemas/promotions/PromoSchema.ts`
  - `worker/src/schemas/loyalty/LoyaltyTierSchema.ts`
  - `worker/src/schemas/loyalty/LoyaltyTransactionSchema.ts`
  - `worker/src/schemas/loyalty/CashbackSchema.ts`
  - `worker/src/schemas/loyalty/BonusCampaignSchema.ts`
  - `worker/src/schemas/inventory/IngredientSchema.ts`
  - `worker/src/schemas/inventory/SupplierSchema.ts`
  - `worker/src/schemas/inventory/PurchaseOrderSchema.ts`
  - `worker/src/schemas/inventory/StockMovementSchema.ts`
  - `worker/src/routes/openapi-menu.ts`
  - `worker/src/routes/openapi-products.ts`
  - `worker/src/routes/openapi-orders.ts`
  - `worker/src/routes/openapi-payments.ts`
  - `worker/src/routes/openapi-customers.ts`
  - `worker/src/routes/openapi-loyalty.ts`
  - `worker/src/routes/openapi-promotions.ts`
  - `worker/src/routes/openapi-reservations.ts`
  - `worker/src/routes/openapi-shifts.ts`
  - `worker/src/routes/openapi-staff.ts`
  - `worker/src/routes/openapi-tables.ts`
  - `worker/src/routes/openapi-analytics.ts`
  - `worker/src/routes/openapi-orders-handlers/helpers.ts`
  - `worker/src/lib/validators/products.ts`

## Todo List
- [x] Relax `.uuid()` and `.datetime()` in `worker/src/schemas/**`
- [x] Fix SQL, RBAC, and response schemas in `worker/src/routes/openapi-*.ts`
- [x] Add `menuItemId` / `product_id` to `formatCustomerOrderItem` in `openapi-orders-handlers/helpers.ts`
- [x] Update `category_id` validator in `worker/src/lib/validators/products.ts`
