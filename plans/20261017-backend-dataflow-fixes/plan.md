# Plan: Backend & Frontend Data-Flow Contract Fixes (Staff, Admin, KDS, Order, Payment)

**Date**: 2026-10-17
**Work Context**: `/Users/mac/mekong-cli/FnB-Container-Caffe`
**Status**: Completed (589/589 test files, 5,243/5,243 unit tests passed, 0 build errors)

## 1. Deep Brainstorm Synthesis (`/brainstorm --deep`)

### Root-Cause Matrix & Trade-off Decisions
1. **Track A — Staff Auth, Mobile Session & Shift Reconciliation (`@aura/domain-staff`, `@aura/domain-shift`, `worker/src/tree/auth`)**
   - **Lockout Bypass (`staff-auth.ts:163-185`)**: `staffTokenRefresh` does not check `pin_lockout:${deviceToken}` in `AUTH_KV`. A device locked out after 5 failed PIN attempts can still mint fresh JWTs via `/mobile/refresh`. **Fix**: Check `pin_lockout:${deviceToken}` before issuing a refresh token and return `429` if locked.
   - **Mobile `/mobile/me` 404 (`current-user.ts:27`, `staff-auth.ts:141,175`)**: `registerStaffDevice` stores/validates staff under `user:${staff_id}` in `AUTH_KV`, whereas `staffMobileLogin`/`staffTokenRefresh` sign JWTs with `email: ''` and `getCurrentUser` only queries `user:${payload.email}`. **Fix**: Hydrate `email`/`name` from `user:${device.staff_id}` in `staff-auth.ts` when present, and add `user:${payload.id}` + mobile-token fallback in `current-user.ts`.
   - **Midnight Shift Clock-Out (`shifts.ts:58-62`)**: `POST /api/shifts/clock-out` filters `WHERE staff_id = ? AND date = ? AND clock_out IS NULL` with UTC date. Cross-midnight shifts (or pre-07:00 GMT+7 shifts) fail with `404`. **Fix**: Fallback to most recent open shift (`WHERE staff_id = ? AND clock_out IS NULL ORDER BY clock_in DESC LIMIT 1`) when same-date match is null.
   - **Unmounted Cash Reconciliation (`features-router.ts:149`)**: `reconciliationRoutes` is exported from `@aura/domain-shift` but not mounted on `/api/shifts`. **Fix**: Mount `reconciliationRoutes` at `/api/shifts` in `features-router.ts`.

2. **Track B — KDS, Kitchen Stations & Role RBAC (`@aura/domain-kitchen`, `worker/src/index.ts`, `worker/src/routes/*`, `src/hooks/use-kds.ts`)**
   - **Cross-Order Item Collision & Ticket Filtering (`kitchen-station-tickets.ts:31-40,71-74,98-114`)**: `start` and `ready` bind bare `itemId` (which is often a shared product/catalog ID), causing one order's item ready state to bleed into another order's item, while `GET /:id/tickets` checks `assignedOrderIds.has(order.id)` against `order_item_id`. **Fix**: Normalize `order_item_id` to `${orderId}:${itemId}` in `start` and `ready` (matching the existing `SELECT ... WHERE (order_item_id = ? OR order_item_id = ?)` query in `ready`), and extract the order ID prefix (`String(r.order_item_id).split(':')[0]`) in `GET /:id/tickets`.
   - **KDS Role Mismatch (`worker/src/index.ts:75`, `orders-unified.ts:55,71`, `kitchen-stations.ts:42`, `kds-mobile.ts:10-11`, `staff-mobile.ts:42,44`)**: `toActorRole` in `@aura/domain-order` maps `['kitchen', 'barista', 'chef']` to KDS kitchen actors and `['admin']` to manager, but route middleware on `/api/kds/orders/*`, `/api/orders/kds`, `/api/kitchen-stations/*`, and `/mobile/kds/*` omits `barista`/`chef` (and some omit `kitchen`/`admin`). **Fix**: Align middleware role arrays with `['owner', 'manager', 'staff', 'admin', 'kitchen', 'barista', 'chef']`.
   - **Raw SQL Bypass on Admin Order Status (`features-router.ts:78-103`)**: `PATCH /api/admin/orders/:id/status` and `POST /api/admin/orders/:id/complete` run raw `UPDATE orders SET status = ?` without updating `AUTH_KV` (`orders:latest_updated_at`) for KDS/SSE consumers. **Fix**: Update `orders:latest_updated_at` in `AUTH_KV` on status changes so KDS polling/stream consumers immediately detect admin status updates.
   - **KDS SSE Item Mapping (`src/hooks/use-kds.ts:42-54`, `admin-orders.ts:33-36`)**: `mapStreamOrders` only reads `item.product_name` (ignoring `item.name` and `item.modifiers`), and `getAdminOrders` omits `o.table_id` in its `SELECT` list. **Fix**: Support `item.product_name || item.name` and `modifiers` in `mapStreamOrders`, and include `o.table_id` in `getAdminOrders`.

3. **Track C — Catalog Pricing, Stats & Admin UI (`@aura/domain-catalog`, `@aura/domain-order`, `src/pages/admin/Orders.tsx`)**
   - **Composite Product ID Split Bug (`pricing-resolver.ts:74-75`)**: `productId.split(/[-_]/)[0]` corrupts underscore-prefixed IDs (`prod_1726000000` -> `prod`). **Fix**: Only split composite variant suffixes on `-` (or when not matching `prod_<id>`).
   - **Stats Top Products Multiplication (`stats.ts:44`)**: `SELECT items, COUNT(*) as order_count ... GROUP BY items` sums `item.quantity || 1` without multiplying by `row.order_count`. **Fix**: Multiply `(item.quantity || item.qty || 1) * (Number(row.order_count) || 1)`.
   - **Admin Orders UI Status Mapping (`src/pages/admin/Orders.tsx:16-24`)**: `STORE_TO_STITCH` omits `served` and `completed`, causing served/completed orders to fall back to `'pending'` in the Admin UI. **Fix**: Map `served: 'served'` and `completed: 'served'`.

## 2. Phases & File Ownership

| Phase | Track | Files Modified |
|-------|-------|----------------|
| Phase 1 | Staff Auth & Shift Reconciliation | `packages/domain/staff/commands/staff-auth.ts`, `worker/src/tree/auth/current-user.ts`, `packages/domain/shift/commands/shifts.ts`, `worker/src/routes/features-router.ts` |
| Phase 2 | KDS, Kitchen Stations & RBAC | `packages/domain/kitchen/commands/kitchen-station-tickets.ts`, `packages/domain/kitchen/commands/kitchen-stations.ts`, `packages/domain/kitchen/commands/kds-mobile.ts`, `worker/src/routes/staff-mobile.ts`, `worker/src/routes/orders-unified.ts`, `worker/src/index.ts`, `src/hooks/use-kds.ts` |
| Phase 3 | Catalog, Order Queries & Admin UI | `packages/domain/catalog/policies/pricing-resolver.ts`, `packages/domain/order/queries/admin-orders.ts`, `packages/domain/order/queries/stats.ts`, `src/pages/admin/Orders.tsx` |
| Phase 4 | Verification | Run `npm run build` and `npx vitest run` across `packages/domain/`, `worker/`, and `src/` |
| Phase 5 | Post-Review Production Hardening (`/brainstorm --deep next step`) | `worker/src/routes/features-router.ts` (scoped `/api/admin/orders*` RBAC + status allowlist), `packages/domain/shift/src/routes/reconciliation.ts` (400 payload validation), `worker/src/tree/auth/current-user.ts` (D1 `users` fallback for mobile staff JWTs), `src/pages/admin/Orders.tsx` (`table` mapping from `table_id`) |

