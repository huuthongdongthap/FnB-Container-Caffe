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
9. **Admin QR 404 Bug, Check-In Reject State Guard & Unified Admin/Waiter RBAC (Phase 9)**:
   - Fixed unreachable `404` branch in `GET /api/admin/qr/:slug/download` (`worker/src/routes/admin-qr.ts:97-105`) where `?? { table_id: -1 }` prevented missing QR slugs from returning `404`.
   - Added state guard `if (checkin.status !== 'pending')` in `PATCH /api/checkin/:id/reject` (`worker/src/routes/checkin.ts:136-138`) to prevent rejecting already-approved check-ins where cashback was already credited.
   - Aligned RBAC across `adminQRRouter`, `reservationsRouter`, `tablesRouter`, `floorPlanRouter`, `posCustomerRouter`, `promotionsRouter`, `productsRouter`, `categoriesRouter`, `menuModifiersRouter`, `happyHourRouter`, `chatRouter`, `campaignsRouter`, and `features-router.ts` (`stats`, `dashboard`, `table-sessions`, `shifts`, `broadcast`, `analytics`, `reports`, `inventory`) so `'admin'` and `'waiter'` tokens are properly authorized.
   - Added regression tests in `tables.test.ts`, `checkin.test.ts`, `promotions.test.ts`, `pos-customer.test.ts`, and `floor-plan.test.ts`.
10. **Birthday `date_of_birth` D1 Schema, Loyalty/Referral Auth Fallback, Reports D1 Fallbacks, CRM/Refund/Shift RBAC & POS/DinDin Contracts (Phase 10)**:
   - Updated `birthdayRouter` (`worker/src/routes/birthday.ts`) to resolve customer birthday via canonical D1 `date_of_birth AS birthday` with fallback to legacy `birthday`, and protected `PUT /config` with `requireAuth(['owner', 'manager', 'admin', 'staff'])`.
   - Updated `authCustomer` (`worker/src/tree/loyalty/auth-middleware.ts`) and `requireCustomer` (`worker/src/routes/referrals.ts`) to match `WHERE email = ? OR id = ?`.
   - Aligned RBAC across `staffTipsRouter`, `shiftsRouter` (`clock-in`, `clock-out`, `today`, `/`), `reconciliationRoutes` (`ALLOWED_RECONCILIATION_ROLES`), `crmRouter` (`customer-handlers.ts`, `segment-handlers.ts`), `refundRouter` (`mutation-handlers.ts`, `read-handlers.ts`), and `adminAuditLogsRouter`.
   - Hardened `reports-handlers/grouped-sales-handlers.ts` (`sales-by-category` fallback to `orders.items` JSON when `order_items` table is absent), `reconciliation-handlers.ts` (`expenses` -> `cash_payouts` -> `[]` fallback), and `export-handlers.ts` (phone-matched orders join on customer CSV export).
   - Restored `src/hooks/stores/admin/admin-utils.ts` (`getAuthHeaders`) and aligned `POS.tsx`, `use-checkout.ts`, `validators.ts`, `DinDinMenu-hooks.ts`, and `dindin-cart-types.ts` with backend payload/response contracts.
   - Added regression tests in `birthday.test.ts` and `admin-reports-revenue.test.ts`.
11. **DinDin Checkout KV/KDS Sync, ERPNext Sub-Route Precedence & Config Auth, Recruitment/Subscription RBAC & Broadcast Tier Matching (Phase 11)**:
   - Updated `dindinRouter` (`worker/src/routes/dindin-handlers/routes.ts`, `checkout-handlers.ts`) to authorize `'admin'` and `'waiter'`, include `name` in `orders.items` JSON, and sync `latest_order_ts`, `orders:latest_updated_at`, and `order_event:${orderId}` in `AUTH_KV` upon checkout.
   - Registered `erpnextSyncRoutes`, `customerRoutes`, `vendorRoutes`, and `expenseRoutes` before the catch-all `app.all('/api/erpnext/*', ...)` in `worker/src/routes/integrations-router.ts`, widened ERPNext/Mixpost/Mautic/Zalo/Frigate RBAC to include `'admin'` and `'manager'`, and enforced JWT auth on `DELETE /api/erpnext/configure` (`worker/src/routes/erpnext.ts:98`).
   - Updated `recruitmentRouter` (`worker/src/routes/recruitment.ts:191-195`), `requireAdmin` / `requireVendor` (`worker/src/tree/subscriptions/middleware.ts:18,34`), and `/api/subscriptions/invoices/:id/receipt` (`worker/src/routes/features-router.ts:171`) to authorize `'admin'` and `'manager'`.
   - Updated `segmentSQL` (`worker/src/routes/broadcast-handlers/types.ts:15-22`) to use case-insensitive `LOWER(loyalty_tier)` queries on D1 `customers`.
   - Added regression tests in `dindin.test.ts`, `recruitment.test.ts`, `broadcast.test.ts`, `middleware.test.ts`, and `admin-revenue-inventory.test.ts`.
12. **OpenAPI Realtime KV Sync, Multi-Tenant HQ Super-Admin RBAC Harmonization, Top Customers Subqueries, Mobile Auth Dual Signature & Bilingual i18n Parity (Phase 12)**:
   - Added `publishOrderEvent(c.env.AUTH_KV, id, 'pending')` in `openApiOrdersRouter` (`order-write-handlers.ts:98`) to synchronize `order_event:${id}`, `latest_order_ts`, and `orders:latest_updated_at` on OpenAPI order creation.
   - Updated `isHQSuperAdmin` (`worker/src/middleware/tenant.ts:31-34`) to recognize `role === 'admin'` alongside `owner` when unbound or bound to `default`/`hq`, harmonizing multi-tenant super-admin capabilities across franchise, telemetry, forecasting, pricing, SaaS, cron, and edge integrations.
   - Authorized `'admin'` role across OpenAPI loyalty admin/tier/reward handlers (`worker/src/routes/openapi-loyalty-handlers/*`), franchise locations, container telemetry, demand forecast, dynamic pricing, inventory forecasting, SaaS tenant creation, and dev cron endpoints.
   - Updated `admin-loyalty.ts` customer visit counting by matching both `o.customer_id = c.id` and `o.customer_phone = c.phone` while excluding cancelled orders.
   - Enhanced `useMobileAuth.login` (`src/hooks/use-mobile-auth.tsx`) with a dual signature accepting either `(deviceToken, pin)` or `(token, staffProfile)` for direct staff auth dispatch.
   - Synchronized bilingual i18n dictionary leaf keys and structures between `public/locales/` and `src/locales/` (including `checkout.payment` and role placeholders).
   - Added regression tests in `openapi-zones-staff-loyalty-hardening.test.ts`, `multi-tenant-franchise.test.ts`, and `phase-20-admin-loyalty-broadcast-checkin-contracts.test.ts`.

## Unresolved Questions
- None.
