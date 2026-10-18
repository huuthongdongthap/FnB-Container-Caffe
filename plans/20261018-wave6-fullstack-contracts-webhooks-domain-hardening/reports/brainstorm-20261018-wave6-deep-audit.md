# Deep Brainstorm & Audit Report — Fullstack Contracts, Webhooks, OpenAPI Routes & Domain Hardening

**Date**: 2026-10-18
**Work Context**: `/Users/mac/mekong-cli/FnB-Container-Caffe`
**Method**: 3 Parallel Deep Scouts (`Frontend UI & Hooks`, `Worker Routes & D1 SQL`, `Domain Packages & Policies`)

---

## 1. Executive Summary

Following the completion of the previous hardening wave (`d505434`), a 3-track deep audit across `src/**`, `worker/src/**`, and `packages/domain/**` uncovered concrete runtime defects, React DOM warnings, frontend-backend contract mismatches, webhook signature/sync bugs, and D1 SQL column mismatches:

1. **Track 1 — Frontend Stitch UI, Hooks, Admin Ops & SaaS Contracts (`src/**`)**:
   - `StitchReservationNew-form.tsx:41`: Uses `key={day}` on `['M', 'T', 'W', 'T', 'F', 'S', 'S']`, triggering duplicate key warnings for `'T'` and `'S'`.
   - `StitchReservationNew.tsx:45-47`: Form `handleSubmit` calls `e.preventDefault()` without calling `onConfirmReservation?.()`, making mobile submit & Enter key no-ops.
   - Empty `src=""` on `<img>` tags in `stitch-reviews-new-card.tsx:64-69`, `StitchAdminTerminalNew-sidebar.tsx:118-122`, `StitchAccountDashNew-profile.tsx:31-36`, `StitchAccountNew-profile-section.tsx:44-49`, `StitchReferralNew1-friends.tsx:60-65`, and `StitchReferralNew2-rewards.tsx:51-56`.
   - `src/pages/stitch/customer-reviews/index.tsx:13-21`: `'Mới nhất'` filter chip falls through without sorting by date.
   - `use-offline-sync.ts:49-64`, `use-split-bill.ts:112-128`, `use-push-notifications.ts:58-124`, and `src/components/staff/notification-settings.tsx:69,115`: Raw `fetch()` calls missing `Authorization: Bearer <token>` and `credentials: 'include'` or failing to unwrap `.data`.
   - `push-notification-toggle.tsx:11,34-36`: Ignores `role` and `token` props passed from `MobileNotificationPanel`, subscribing staff devices as `'customer'`.
   - `use-reports.ts:37-78`: Fails to unwrap `{ success: true, data }` envelope on `/api/reports/{daily,top-products,peak-hours,customer-metrics}`.
   - `use-admin-orders-store.ts:102-108` & `Orders.tsx:29-35`: `ACTION_TO_STORE` omits `'cancelled'`, and `updateOrderStatus` needs fallback/support for `/api/orders/:id/status` and `/api/orders/:id`.
   - `CheckinApprove-hooks.ts:65-90`: Uses `method: 'POST'` instead of `PATCH` on `/api/admin/checkins/:id/{approve,reject}` and swallows errors in `finally`.
   - `use-subscription-plans.ts:39-63`: Sends `monthly_price_vnd` and `features: string[]` while backend validator expects `price` and `features: string | string[]`, and calls `DELETE /api/subscriptions/plans/:id`.
   - `GenerateQR.tsx:64-71`: Renders both `<ZoneGroupedTables />` and `filteredTables.map(...)`, duplicating every QR card when multiple zones exist.
   - `ERPNExtSync.tsx:30-91` & `worker/src/routes/erpnext-sync.ts:197-247`: Status response omits recent logs and sync responses omit `synced`/`failed`/`count`.
   - `src/pages/saas/dashboard/invoice-table-card.tsx:14-16` & `cancel-dialog.tsx:22-37`: Uses `window.location.href` (`GET`) for `POST /api/subscriptions/invoices/:id/pay` and invalidates `['my-active-subscription']` instead of `['my-subscriptions']`.
   - `src/pages/saas/onboard/index.tsx:58-63`: Omits `customer_id` when creating subscription; `saas-tenants.ts:77-79` blocks `'customer'` role despite route middleware allowing it.
   - `src/pages/order/index.tsx:99-104`: Fails to unwrap `(raw as { order?: ActiveOrderData; data?: ActiveOrderData })?.order ?? raw?.data ?? raw` from `GET /api/orders/:id`.

2. **Track 2 — Worker Metrics, Middleware, Webhooks & Order Hono Handlers (`worker/src/{lib,middleware,routes/webhooks*,routes/orders-hono-handlers}/**`)**:
   - `worker/src/lib/metrics-collector.ts:92-285`: Missing `typeof stmt?.run === 'function'` guard on minimal D1 bindings and `_alerts.dispatched` column fallback.
   - `worker/src/middleware/staff-auth.ts:18,35,59` & `worker/src/middleware/audit-log.ts:15,22`: Default `allowedRoles` omits `'admin'`, `c.env?.AUTH_KV` unguarded, `payload.sub` fallback missing, and `audit-log.ts` reads `user?.tenant_id` without `user?.tenantId` fallback.
   - `worker/src/routes/webhooks-handlers/helpers.ts:9-19`: `verifySignature` serializes `null`/`undefined` as `"null"`/`"undefined"` instead of `""`.
   - `worker/src/routes/webhooks-handlers/payos.ts:22-25,68,128,133,141`: Missing signature on non-empty `data` returns `200` instead of `401` when `data.orderCode` is present; `AND payment_method = 'payos'` blocks updating orders originally created with default `'cash'`; `kv.put('latest_order_ts', now)` lacks `.catch(() => {})`; `publishOrderEvent` is not called; loyalty lookup queries non-existent `total_amount` without fallback to `total`.
   - `worker/src/routes/webhooks/momo.ts:138-145`: Missing `AUTH_KV` update (`latest_order_ts`, `orders:latest_updated_at`, `publishOrderEvent`) and missing `WHERE payment_status != 'paid'` guard on failed MoMo attempts.
   - `worker/src/routes/orders-hono-handlers/{guest-handlers.ts,checkout-handlers.ts,kds-handlers.ts}`: Missing `publishOrderEvent` calls on guest checkin/checkout and POS checkout; `guest-handlers.ts` should look up authoritative product price from `products` when available; `checkout-handlers.ts` and `kds-handlers.ts` omit `'cashier'`/`'waiter'`.

3. **Track 3 — Worker OpenAPI Handlers & Feature Routes (`worker/src/routes/openapi-*-handlers/**`, `signage.ts`, `zalo.ts`, `cal-booking-webhook*`, `push.ts`, `reviews.ts`, `loyalty.ts`, `subscriptions.ts`)**:
   - `openapi-categories-handlers/reorder-handler.ts:14-17`: `db.prepare(...)` never calls `.bind(index, id)` and references non-existent `updated_at` on `categories` without fallback.
   - `openapi-orders-handlers/{order-read-handlers.ts,order-summary-handlers.ts,order-cancel-handlers.ts}`: `STAFF_ROLES` omits `'admin'`, `'waiter'`, `'kitchen'`, `'barista'`, `'chef'`, `'cashier'`; `order-summary-handlers.ts` queries `source` without fallback; `order-cancel-handlers.ts` updates `cancelled_at` without fallback and omits `publishOrderEvent`.
   - `openapi-payments-handlers/{routes.ts,mutation-handlers.ts,webhook-handlers.ts}`: Include `'cashier'` and `'waiter'` roles; update `AUTH_KV` + `publishOrderEvent` on refund and webhook.
   - `openapi-promotions-handlers/{routes.ts,usage-handlers.ts}`: Allow `'waiter'`, `'cashier'`, `'customer'` on validate/use and `'admin'` on summary.
   - `openapi-auth-handlers/{routes.ts,staff-handlers.ts}`: Include `'/forgot-password'` in `publicPaths` and `'admin'` in staff role checks.
   - `signage.ts:108-114`: `GET /api/signage/promos` queries `percent, starts_at, expires_at` without fallback to canonical `value as percent, start_date as starts_at, end_date as expires_at`.
   - `cal-booking-webhook-handlers/{webhook-handler.ts,bookings-handler.ts}`: Fallback from `bookings` to canonical `reservations` (`cal_booking_uid`) and include `'admin'`/`'waiter'` in `bookings-handler.ts`.
   - `loyalty.ts:89-185`: Fallback from `loyalty_point_logs` / `rewards` / `user_rewards` to canonical `loyalty_transactions` / `loyalty_rewards` / `loyalty_redemptions`.
   - `worker/src/tree/loyalty/spend-cashback-handler.ts:29-74`: Check `updateResult.meta?.changes === 0` (alongside legacy `.changes === 0`) and verify order ownership when `order.customer_id` is set.
   - `subscriptions.ts` & `worker/src/tree/subscriptions/sub-handlers.ts` & `worker/src/lib/validators/subscription.ts`: Support `monthly_price_vnd` alias for `price` and array/string `features` in `createPlanSchema`, register `DELETE /api/subscriptions/plans/:id`, bind `customer_id` from authenticated user token when omitted in `createSubscriptionHandler`, and allow customer/owner/admin to cancel their own subscription.
   - `worker/src/routes/admin-handlers.ts:210-225`: Per-key `try/catch` around `JSON.parse` in `getStuckPayments` and mask `dbAmount`/`webhookAmount` alongside `amount` for non-owners.

4. **Track 4 — Domain Payment, Order, Catalog, CRM & Customer (`packages/domain/{payment,order,catalog,crm,customer}/**` & `worker/src/__tests__/routes/{payments.test.ts,admin-payments-stuck.test.ts}`)**:
   - `packages/domain/payment/commands/payos-helpers.ts:77-85,128-158`: Fix `attemptCode` in `persistPayOSPaymentWithRetry` so retries use the `orderCode` just registered with PayOS instead of generating a third code; include `'waiter'`/`'cashier'` in `isStaffOrOwner`; require matching customer or staff when `orderRow.customer_id` is set and caller is authenticated as another customer.
   - `packages/domain/payment/commands/payos-create-link.ts:81-114`: Only return cached `existingPayment` when `existingPayment.payment_url || existingPayment.checkout_url` is non-empty; update `orders.payment_method = 'payos'` when creating a PayOS link; include `'waiter'` in COD staff roles and update `AUTH_KV` on COD confirmation.
   - `packages/domain/customer/policies/order-ownership-policy.ts:51,83,119`: Include `'waiter'`, `'kitchen'`, `'barista'`, `'chef'`, `'cashier'` in privileged staff roles across `resolveCustomerScope`, `canAccessOrder`, and `projectOrderForActor`.
   - `packages/domain/order/queries/{shared-listing.ts,admin-orders.ts}`: Fix `safeSortColumn` to return `${prefix}${col}` instead of raw `raw` (preventing SQL injection and ambiguous `created_at`), and align `buildOrderTail` / `admin-orders.ts` bind parameters.
   - `packages/domain/order/policies/order-snapshot.ts:27,96-102` & `packages/domain/catalog/policies/pricing.ts:54-66`: Select `category` / `category_id` in `fetchAuthoritativeProducts` (with fallback) and ensure category/product-scoped happy hour rules return `false` when target context is missing.
   - `packages/domain/crm/commands/{accrual.ts,refund-reversal.ts,update-consent.ts,place-order.ts}`: Use `order?.cashback_used ?? input.cashbackUsedVnd ?? 0` in `applyAccrual`; mark prior active consent rows `revoked_at = now` when revoking in `updateConsent`; guard `menu_items` query with `.catch(() => null)` in `placeOrder`.
   - Complete the assertions in `worker/src/__tests__/routes/payments.test.ts` and `worker/src/__tests__/routes/admin-payments-stuck.test.ts`.

5. **Track 5 — Domain Staff, Shift, Table, Reservation, Kitchen, Inventory, Audit & Notification (`packages/domain/{staff,shift,table,reservation,kitchen,inventory,audit,notification,integration}/**`)**:
   - `packages/domain/staff/{lib/staff-roles.ts,src/model/authorization-types.ts,src/policies/authorization-policy.ts,commands/staff-auth.ts,commands/staff-tips.ts}`: Include `'admin'`, `'barista'`, `'chef'`, `'kitchen'`, `'cashier'` in `StaffRole` and mobile device roles; preserve kitchen/barista/chef roles in `normalizeDeviceRole`; add `payment: ['read', 'create']` to `waiter` in `authorization-policy.ts`; add schema fallback on `users` queries in `staff-auth.ts`.
   - `packages/domain/shift/{commands/shifts.ts,src/routes/reconciliation.ts,src/policies/cash-reconciliation-policy.ts,src/policies/shift-lifecycle-policy.ts}`: Add schema fallback between `clock_in`/`clock_out` and `start_time`/`end_time`/`actual_start`/`actual_end` in `shifts.ts`; include `'cashier'` and `'waiter'` roles; wrap `cash_payouts` query in `try/catch` returning `0` when table does not exist.
   - `packages/domain/table/{commands/qr-scan.ts,commands/tables.ts,src/policies/table-availability-policy.ts,src/policies/table-reservation-policy.ts}`: Prefix fallback QR URL with `https://`; include `'cashier'` in table status update roles; add `reservation_date`/`reservation_time` fallback in table policies.
   - `packages/domain/reservation/src/routes/reservations.ts`: Include `'waiter'` and `'cashier'` in `requireAuth`; add `reservation_date`/`reservation_time` fallback; only reset `cafe_tables.status = 'Available'` on cancel/delete when current status is `'Reserved'`.
   - `packages/domain/kitchen/commands/{kds-mobile.ts,kitchen-stations.ts,kitchen-station-tickets.ts}`: Include `'waiter'` in `VIEW_ROLES` and `UPDATE_ROLES`; scope ready item check in `kitchen-station-tickets.ts` to `compositeKey` (`${orderId}:${idx}`) when `order_item_id` is product-scoped.
   - `packages/domain/inventory/src/routes/{inventory-transactions.ts,order-deduction.ts}`: Preserve signed `input.quantity` for `'adjust'` transactions when negative; add fallback between `inventory_items`/`inventory_transactions` and `ingredients`/`stock_movements` in `order-deduction.ts`.
   - `packages/domain/audit/src/policies/{audit-redaction-policy.ts,audit-writer-policy.ts}` & `packages/domain/notification/src/policies/notification-orchestration-policy.ts`: Preserve `Date` instances and clean up `seen` set on return in `redactSensitiveFields`; add canonical D1 `audit_logs` (`actor, resource, resource_id, details, ip`) and `notification_audit_log` (`phone, channel, message_type, status`) fallbacks; fix `verifyWebhookSignature` boolean logic (`signature !== 'sig_' + secretKey || signature.length < 8`).

---

## Unresolved Questions
- None. All findings are verified with exact `file:line` citations and preserve all existing test invariants.
