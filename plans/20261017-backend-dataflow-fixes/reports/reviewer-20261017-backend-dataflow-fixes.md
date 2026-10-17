# Code Review Report — Backend & Frontend Data-Flow Fixes (Phase 1–7)

**Date**: 2026-10-17
**Work Context**: `/Users/mac/mekong-cli/FnB-Container-Caffe`
**Verdict**: PASS (0 TypeScript errors, 16/16 targeted test suites, 187/187 tests passed, production build green)

## Verified Findings & Resolutions

1. **Admin RBAC Least-Privilege (`worker/src/routes/features-router.ts:71-78`)**:
   - Scoped `['kitchen', 'barista', 'chef']` strictly to `/api/admin/orders` and `/api/admin/orders/*` while keeping all other `/api/admin/*` routes restricted to `['owner', 'manager', 'staff', 'admin']`.
2. **Admin Status Allowlist (`worker/src/routes/features-router.ts:89-92`)**:
   - Validated `status` against canonical order statuses (`pending`, `confirmed`, `preparing`, `ready`, `served`, `delivering`, `delivered`, `completed`, `cancelled`) and updated both `latest_order_ts` and `orders:latest_updated_at` in `AUTH_KV`.
3. **Shift Cash Reconciliation Input Validation (`packages/domain/shift/src/routes/reconciliation.ts:34-42`)**:
   - Added validation for `opening_float` (`typeof === 'number'`, `Number.isFinite`, `>= 0`) and `denominations` (`Array.isArray`), returning HTTP `400` on malformed requests while preserving HTTP `500` on D1 failures (`cash-reconciliation.test.ts:259`).
4. **Mobile Staff `/mobile/me` D1 Fallback (`worker/src/tree/auth/current-user.ts:31-64`)**:
   - Added D1 `SELECT id, email, name, phone, role FROM users WHERE id = ?` lookup when `!userStr && !payload.email && payload.id`, without writing duplicate `user:${id}` keys to `AUTH_KV` (preserving `auth.test.ts:249`).
5. **Admin Orders Table Mapping (`src/pages/admin/Orders.tsx:54-66`)**:
   - Mapped `table` from `table ?? table_id ?? table_number` in `mapAdminOrder` while preserving the `normalizeAdminOrder` contract in `use-admin-orders-store.test.ts:41`.
6. **Realtime Order Sync & Mobile KDS / Table Sessions Hardening (Phase 6)**:
   - Updated `createOrderMobile` (`worker/src/routes/orders-mobile.ts`), `handlePosCheckout` (`worker/src/routes/orders-hono-handlers/checkout-handlers.ts`), `handleGuestCheckin` & `handleGuestCheckout` (`worker/src/routes/orders-hono-handlers/guest-handlers.ts`), and `POST /api/table-sessions/:id/orders` (`worker/src/routes/table-sessions-handlers/order-handlers.ts`) to write `latest_order_ts` and `orders:latest_updated_at` to `AUTH_KV` so KDS SSE and `/api/orders/latest` polling detect orders from all entrypoints.
   - Hardened `getKdsMobile` (`packages/domain/kitchen/commands/kds-mobile.ts`) with `parseKdsItems` and included `'confirmed'` orders (`WHERE o.status IN ('pending','confirmed','preparing')`).
   - Aligned `registerKdsHandlers` (`worker/src/routes/orders-hono-handlers/kds-handlers.ts`) RBAC roles with `['owner', 'manager', 'staff', 'admin', 'kitchen', 'barista', 'chef']`.
   - Protected `POST /api/table-sessions/:id/orders` against cancelled orders (`409`) and duplicate bill-merge attachment (`idempotent: true` when `order.table_id === session.table_id`).
   - Added unit regression tests across `cash-reconciliation.test.ts`, `auth.test.ts`, `mobile-orders.test.ts`, `mobile-kds.test.ts`, and `table-sessions.test.ts`.
7. **KDS SSE Stream, Station Tickets, Canonical Order KV Sync & Unified RBAC (Phase 7)**:
   - Included `'confirmed'` orders in `kds-stream.ts:94`, `kitchen-station-tickets.ts:29`, and `kds-handlers.ts:29`, with safe array/JSON item parsing.
   - Updated `executeKdsStatusTransition` (`kds-status-transition.ts:106-110`), `publishOrderEvent` (`customer-order-payload.ts:141-145`), `create-order-side-effects.ts:115-116`, `update-order.ts:141-142`, `split-orders.ts:135-139`, `openapi-payments-handlers/webhook-handlers.ts:80-83`, and `webhooks-handlers/payos.ts:133-134` to atomically sync `latest_order_ts` and `orders:latest_updated_at` in `AUTH_KV`.
   - Passed `{ kv: c.env?.AUTH_KV }` into `executeKdsStatusTransition` inside `stationTicketsRouter` (`kitchen-station-tickets.ts:80,122`).
   - Aligned RBAC in `orders-unified.ts:56-79` across `/checkout`, `/summary`, `/`, `/:id/mark-cod-paid`, `/:id/cancel`, `/:id/claim`, `/:id`, and `PATCH /:id` for `waiter`, `admin`, and kitchen roles (`kitchen`, `barista`, `chef`).
   - Added regression tests in `kitchen-kds-lifecycle.test.ts`, `orders-unified.test.ts`, and `customer-order-tracking.test.ts`.
8. **Admin Customers D1 Schema Compatibility, Admin Order SSE Publishing & Split-Order Table Lookup (Phase 8)**:
   - Updated `getAdminCustomers`, `createAdminCustomer`, and `updateAdminCustomer` (`worker/src/routes/admin-handlers.ts`) to query/mutate canonical D1 `customers` (`loyalty_tier`, `cashback_wallets` join, orders count subquery, non-null fallback `@loyalty.aura` email) with seamless fallback to the flat mock schema.
   - Updated `/api/customers` and `/api/customers/segments` (`worker/src/routes/customers-handlers/admin-handlers.ts`) to authorize `role === 'admin'` and filter `LOWER(c.loyalty_tier) = LOWER(?)`.
   - Updated `PATCH /api/admin/orders/:id/status` and `POST /api/admin/orders/:id/complete` (`worker/src/routes/features-router.ts:104,119`) to invoke `publishOrderEvent(c.env.AUTH_KV, orderId, status)`, syncing `order_event:${orderId}` alongside `latest_order_ts` and `orders:latest_updated_at`.
   - Updated `splitOrders` (`packages/domain/order/commands/split-orders.ts:57`) to resolve tables by `WHERE table_number = ? OR id = ?`.
   - Added regression tests in `worker/src/__tests__/routes/customers.test.ts` and `worker/src/__tests__/tree/orders/split-orders.test.ts`.

## Unresolved Questions
- None.
