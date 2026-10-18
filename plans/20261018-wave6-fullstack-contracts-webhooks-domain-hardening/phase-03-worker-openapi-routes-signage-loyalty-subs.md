# Phase 03: Worker OpenAPI Handlers, Signage, Cal.com, Loyalty & Subscriptions

## Context Links
- Brainstorm Report: [reports/brainstorm-20261018-wave6-deep-audit.md](reports/brainstorm-20261018-wave6-deep-audit.md)
- Plan Overview: [plan.md](plan.md)

## Overview
- **Priority**: High
- **Status**: Pending
- **Scope**: Fix unbound batch statements in `reorder-handler.ts`, align RBAC and D1 SQL fallbacks across `openapi-*-handlers`, `signage.ts`, `cal-booking-webhook-handlers`, `loyalty.ts`, `spend-cashback-handler.ts`, `subscriptions.ts`, `erpnext-sync.ts`, and `admin-handlers.ts`.

## Related Code Files (Strict Ownership)
- `worker/src/routes/openapi-categories-handlers/reorder-handler.ts`
- `worker/src/routes/openapi-orders-handlers/order-read-handlers.ts`
- `worker/src/routes/openapi-orders-handlers/order-summary-handlers.ts`
- `worker/src/routes/openapi-orders-handlers/order-cancel-handlers.ts`
- `worker/src/routes/openapi-payments-handlers/routes.ts`
- `worker/src/routes/openapi-payments-handlers/mutation-handlers.ts`
- `worker/src/routes/openapi-payments-handlers/web-payment-handlers.ts`
- `worker/src/routes/openapi-payments-handlers/webhook-handlers.ts`
- `worker/src/routes/openapi-promotions-handlers/routes.ts`
- `worker/src/routes/openapi-promotions-handlers/usage-handlers.ts`
- `worker/src/routes/openapi-auth-handlers/routes.ts`
- `worker/src/routes/openapi-auth-handlers/staff-handlers.ts`
- `worker/src/routes/signage.ts`
- `worker/src/routes/cal-booking-webhook-handlers/webhook-handler.ts`
- `worker/src/routes/cal-booking-webhook-handlers/bookings-handler.ts`
- `worker/src/routes/loyalty.ts`
- `worker/src/tree/loyalty/spend-cashback-handler.ts`
- `worker/src/routes/subscriptions.ts`
- `worker/src/tree/subscriptions/sub-handlers.ts`
- `worker/src/lib/validators/subscription.ts`
- `worker/src/routes/saas-tenants.ts`
- `worker/src/routes/erpnext-sync.ts`
- `worker/src/routes/admin-handlers.ts`

## Implementation Steps
1. **`openapi-categories-handlers/reorder-handler.ts`**:
   - Bind `(index, now, id)` on the `UPDATE categories SET sort_order = ?, updated_at = ? WHERE id = ?` statements, with fallback to `UPDATE categories SET sort_order = ? WHERE id = ?` `.bind(index, id)` when `updated_at` column is absent.
2. **`openapi-orders-handlers/**`**:
   - In `order-read-handlers.ts:12`, expand `STAFF_ROLES` to `['owner', 'manager', 'staff', 'admin', 'waiter', 'kitchen', 'barista', 'chef', 'cashier']`.
   - In `order-summary-handlers.ts:28-30`, wrap the `GROUP BY source` query in `try/catch` and fallback to `GROUP BY COALESCE(order_type, 'dine_in') as source` when `source` column does not exist.
   - In `order-cancel-handlers.ts:49-68`, add fallback from `UPDATE orders SET status = 'cancelled', cancelled_at = ?, updated_at = ? WHERE id = ?` to `UPDATE orders SET status = 'cancelled', updated_at = ? WHERE id = ?`, wrap the `audit_logs` insert in `try/catch`, and call `publishOrderEvent(c.env.AUTH_KV, id, 'cancelled')`.
3. **`openapi-payments-handlers/**`, `openapi-promotions-handlers/**`, `openapi-auth-handlers/**`**:
   - In `openapi-payments-handlers/routes.ts`, `mutation-handlers.ts`, and `web-payment-handlers.ts`, include `'cashier'` and `'waiter'` in staff role lists, and update `AUTH_KV` + `publishOrderEvent` on refund and webhook.
   - In `openapi-promotions-handlers/routes.ts` and `usage-handlers.ts`, include `'waiter'`, `'cashier'`, `'customer'` on validate/use and `'admin'` in `usage-handlers.ts:88`.
   - In `openapi-auth-handlers/routes.ts` and `staff-handlers.ts`, add `'/forgot-password'` to `publicPaths`, include `'admin'`, `'waiter'`, `'kitchen'`, `'barista'`, `'chef'`, `'cashier'` in `requireAuth`, and allow `'admin'` alongside `'owner'` in `staff-handlers.ts:14,63`.
4. **`signage.ts`, `cal-booking-webhook-handlers/**`, `loyalty.ts` & `spend-cashback-handler.ts`**:
   - In `signage.ts:108-120`, fallback to `SELECT code, value AS percent, max_discount, min_order, end_date AS expires_at FROM promotions WHERE is_active = 1 AND (start_date IS NULL OR datetime(start_date) <= datetime(?)) AND (end_date IS NULL OR datetime(end_date) > datetime(?)) ORDER BY value DESC`.
   - In `cal-booking-webhook-handlers/bookings-handler.ts` and `webhook-handler.ts`, include `'admin'` and `'waiter'` in `requireAuth` and fallback from `bookings` table to canonical `reservations` (`cal_booking_uid`).
   - In `loyalty.ts`, add fallbacks from `loyalty_point_logs` to `loyalty_transactions`, from `rewards` to `loyalty_rewards`, and from `user_rewards` to `loyalty_redemptions`.
   - In `worker/src/tree/loyalty/spend-cashback-handler.ts`, check `(updateResult.meta?.changes ?? (updateResult as unknown as { changes?: number }).changes) === 0`, and if `order.customer_id` is set and `order.customer_id !== cust.id`, return `403`.
5. **`subscriptions.ts`, `sub-handlers.ts`, `subscription.ts` validator, `saas-tenants.ts`, `erpnext-sync.ts`, `admin-handlers.ts`**:
   - In `worker/src/lib/validators/subscription.ts`, allow `monthly_price_vnd` as an alias for `price` and coerce `features: z.union([z.string(), z.array(z.string()).transform((arr) => JSON.stringify(arr))]).optional()`.
   - In `worker/src/routes/subscriptions.ts` & `worker/src/tree/subscriptions/sub-handlers.ts`, register `DELETE /plans/:id`, default `customer_id` to authenticated user's `id` in `createSubscriptionHandler` when omitted, and allow the subscription's owning customer (`sub.customer_id === user.id`) in `cancelSubscriptionHandler`.
   - In `worker/src/routes/saas-tenants.ts:77`, allow `'customer'` role when creating a tenant during self-serve onboarding (matching the route's `requireAuth(['owner', 'admin', 'customer'])`).
   - In `worker/src/routes/erpnext-sync.ts`, include recent `logs` in `GET /status` and return `synced: 1, failed: 0, count: 1` in `POST /sync-all` and `POST /:entity`.
   - In `worker/src/routes/admin-handlers.ts:210-225`, wrap `JSON.parse(raw)` in `try/catch` per key in `getStuckPayments`, and mask `dbAmount: '***'` and `webhookAmount: '***'` alongside `amount: '***'` when `!isOwner`.

## Success Criteria
- All worker OpenAPI and feature route tests pass with 0 TypeScript or ESLint errors.
