# Phase 05: Domain Packages (`@aura/domain-*`) SQL, Pricing/Loyalty/Inventory/Table Policies & RBAC

## Context Links
- Brainstorm Report: `plans/20261018-wave5-pos-loyalty-admin-d1-domain-hardening/reports/brainstorm-20261018-wave5-deep-audit.md`
- Overview Plan: `plans/20261018-wave5-pos-loyalty-admin-d1-domain-hardening/plan.md`

## Overview
- **Priority**: P0
- **Status**: Completed
- **Description**: Fix SQL table/column mismatches, pricing/happy-hour/cashback/inventory/table/segment logic bugs, overly strict `.uuid()` schemas, and missing RBAC roles across `packages/domain/**`.

## Key Insights
- `order-snapshot.ts` selects `category_id` instead of `category` from `menu_items`, `get-order.ts` omits `shipping_fee, discount`, `update-order.ts` queries `referrals.first_order_id` without `try/catch` and `orders.subtotal, tax`, and `create-order.ts` only looks up `cafe_tables` by `table_number`.
- `pricing.ts` (`happyHourDiscountFor`) ignores `apply_to` / `apply_ids` and fails on unpadded `9:00` times.
- `accrual.ts` initializes new `cashback_wallets` rows with `total_earned = cashback` and then adds `total_earned = total_earned + cashback` in `db.batch()`, double-counting `total_earned`.
- `segments.ts` passes `firstOrderAt: row.last_order_at` and `orderCount: 0` to `computeFrequencyBand`, misclassifying all active customers as `'new'`.
- `inventory-transactions.ts` treats `type === 'reserve'` as `+quantity` instead of `-quantity`, and `order-deduction.ts` matches `LIKE '%%'` when `item.name` is empty.
- `table/commands/tables.ts` calls `parseInt('t01', 10)` (`NaN`), so `qr_code_url` is always `null`.
- `staff/src/policies/authorization-policy.ts` rejects `'admin'`, `'barista'`, `'kitchen'`, and `'chef'` roles.
- `payment/commands/payos-create-link.ts` allows unauthenticated COD requests to mark any order as `'paid'` and `'completed'`.

## Requirements
- Fix `packages/domain/order/{policies/order-snapshot.ts,queries/get-order.ts,commands/update-order.ts,commands/create-order.ts,commands/split-orders.ts}`.
- Fix `packages/domain/catalog/{policies/pricing.ts,policies/pricing-resolver.ts,commands/happy-hour.ts,schemas/categories.ts,schemas/products.ts}`.
- Fix `packages/domain/crm/{lookup-profile.ts,commands/get-customer-account.ts,commands/update-consent.ts,commands/accrual.ts,commands/aggregate-events.ts,commands/customer-360.ts,commands/place-order.ts,commands/segments.ts}` and `packages/domain/customer/{policies/customer-lifecycle-policy.ts,policies/order-ownership-policy.ts,events/customer-event-dispatcher.ts}` using safe fallbacks so existing unit tests remain 100% compatible.
- Fix `packages/domain/inventory/src/{routes/inventory-transactions.ts,routes/order-deduction.ts,model/inventory-schemas.ts}`.
- Fix `packages/domain/table/{commands/tables.ts,src/policies/table-reservation-policy.ts}` and `packages/domain/reservation/src/routes/reservations.ts`.
- Fix `packages/domain/staff/{src/policies/authorization-policy.ts,commands/staff-auth.ts}`, `packages/domain/payment/commands/{payos-create-link.ts,payos-helpers.ts,process-web-payment.ts,momo-create.ts}`, `packages/domain/kitchen/commands/{kds-mobile.ts,kitchen-stations.ts}`, and `packages/domain/shift/src/policies/shift-lifecycle-policy.ts`.

## Related Code Files
- Modify:
  - `packages/domain/order/policies/order-snapshot.ts`
  - `packages/domain/order/queries/get-order.ts`
  - `packages/domain/order/commands/update-order.ts`
  - `packages/domain/order/commands/create-order.ts`
  - `packages/domain/order/commands/split-orders.ts`
  - `packages/domain/catalog/policies/pricing.ts`
  - `packages/domain/catalog/policies/pricing-resolver.ts`
  - `packages/domain/catalog/commands/happy-hour.ts`
  - `packages/domain/catalog/schemas/categories.ts`
  - `packages/domain/catalog/schemas/products.ts`
  - `packages/domain/crm/lookup-profile.ts`
  - `packages/domain/crm/commands/get-customer-account.ts`
  - `packages/domain/crm/commands/update-consent.ts`
  - `packages/domain/crm/commands/accrual.ts`
  - `packages/domain/crm/commands/aggregate-events.ts`
  - `packages/domain/crm/commands/customer-360.ts`
  - `packages/domain/crm/commands/place-order.ts`
  - `packages/domain/crm/commands/segments.ts`
  - `packages/domain/customer/policies/customer-lifecycle-policy.ts`
  - `packages/domain/customer/policies/order-ownership-policy.ts`
  - `packages/domain/customer/events/customer-event-dispatcher.ts`
  - `packages/domain/inventory/src/routes/inventory-transactions.ts`
  - `packages/domain/inventory/src/routes/order-deduction.ts`
  - `packages/domain/inventory/src/model/inventory-schemas.ts`
  - `packages/domain/table/commands/tables.ts`
  - `packages/domain/table/src/policies/table-reservation-policy.ts`
  - `packages/domain/reservation/src/routes/reservations.ts`
  - `packages/domain/staff/src/policies/authorization-policy.ts`
  - `packages/domain/staff/commands/staff-auth.ts`
  - `packages/domain/payment/commands/payos-create-link.ts`
  - `packages/domain/payment/commands/payos-helpers.ts`
  - `packages/domain/payment/commands/process-web-payment.ts`
  - `packages/domain/payment/commands/momo-create.ts`
  - `packages/domain/kitchen/commands/kds-mobile.ts`
  - `packages/domain/kitchen/commands/kitchen-stations.ts`
  - `packages/domain/shift/src/policies/shift-lifecycle-policy.ts`

## Todo List
- [x] Fix Order & Catalog domain SQL, `happyHourDiscountFor`, and `.uuid()` schemas
- [x] Fix CRM & Customer domain SQL fallbacks, `accrual.ts` `total_earned`, and `segments.ts` frequency band
- [x] Fix Inventory (`'reserve'` delta, empty `item.name` guard, `.uuid()` schemas) and Table/Reservation (`tables.ts` QR slug lookup, `table-reservation-policy.ts`)
- [x] Fix Staff `authorization-policy.ts`, Payment `payos-create-link.ts` / `momo-create.ts`, Kitchen, and Shift RBAC
